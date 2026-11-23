/* Customer-history security and persistence regression checks use disposable stores.
 * A demo code alone must never enumerate registrations for a supplied mobile number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { normalizeWarrantyReference } from "../src/warranty/types.ts";

const reference = () => "ARV-WR-20261122-" + crypto.randomUUID().toUpperCase();

test("browser history stores bounded opaque references and tolerates blocked storage", async () => {
  let value = "not JSON",
    blocked = false,
    writesBlocked = false;
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        if (blocked) throw Error("Blocked");
        return value;
      },
      setItem(_key, next) {
        if (blocked || writesBlocked) throw Error("Blocked");
        value = next;
      },
    },
  });
  try {
    const { readWarrantyReferences, rememberWarrantyReference } =
      await import("../src/warranty/customer-history.ts");
    assert.deepEqual(readWarrantyReferences(), []);
    assert.equal(normalizeWarrantyReference("9000000000"), null);
    assert.equal(normalizeWarrantyReference("ARV-WR-20261122"), null);
    const first = reference();
    assert.equal(
      normalizeWarrantyReference(" " + first.toLowerCase() + " "),
      first,
    );
    assert.equal(rememberWarrantyReference("invalid"), false);
    assert.equal(rememberWarrantyReference(first), true);
    assert.equal(rememberWarrantyReference(first.toLowerCase()), true);
    assert.deepEqual(readWarrantyReferences(), [first]);
    for (let index = 0; index < 104; index++)
      rememberWarrantyReference(reference());
    assert.equal(readWarrantyReferences().length, 100);
    assert.equal(readWarrantyReferences().includes(first), false);
    assert.equal(value.includes("customerName"), false);
    blocked = true;
    const temporary = reference();
    assert.equal(rememberWarrantyReference(temporary), false);
    assert.ok(readWarrantyReferences().includes(temporary));
    blocked = false;
    value = JSON.stringify([null, "invalid", first]);
    assert.deepEqual(readWarrantyReferences(), [first, temporary]);
    assert.equal(readWarrantyReferences().includes("invalid"), false);
    writesBlocked = true;
    const quotaReference = reference();
    assert.equal(rememberWarrantyReference(quotaReference), false);
    assert.deepEqual(readWarrantyReferences(), [
      first,
      temporary,
      quotaReference,
    ]);
    writesBlocked = false;
    assert.equal(rememberWarrantyReference(quotaReference), true);
    assert.deepEqual(JSON.parse(value), [first, temporary, quotaReference]);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("customer history requires a live session, full reference and matching login phone", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-customer-history-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let server,
    logs = "";
  async function start(extra = {}) {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        TRUST_PROXY_HOPS: "0",
        WARRANTY_OTP_MODE: "demo",
        ...extra,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk) => (logs += chunk));
    server.stderr.on("data", (chunk) => (logs += chunk));
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Startup timed out: " + logs);
  }
  async function stop() {
    if (server?.exitCode === null) {
      const stopped = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await stopped;
    }
  }
  const request = (url, body, cookie = "", extra = {}) =>
    fetch(base + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login(mobile) {
    const challenge = await (
      await request("/api/warranty/otp/request", { mobile })
    ).json();
    const result = await request("/api/warranty/otp/verify", {
      challengeId: challenge.challengeId,
      code: challenge.demoCode,
    });
    assert.equal(result.status, 200);
    return result.headers.get("set-cookie").split(";")[0];
  }
  const endpoint = "/api/warranty/registrations/history";
  try {
    await start();
    assert.equal(
      (await request(endpoint, { references: "x".repeat(20000) })).status,
      401,
      "Authenticate before parsing a large body",
    );
    assert.equal(
      (await request(endpoint, { references: [] }, "areva_warranty=forged"))
        .status,
      401,
    );
    const owner = await login("9000000000"),
      other = await login("9111111111");
    assert.equal(
      (
        await request(endpoint, { references: [] }, owner, {
          Origin: "https://foreign.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(endpoint, { references: [] }, owner, {
          "Sec-Fetch-Site": "cross-site",
        })
      ).status,
      403,
    );
    for (const invalid of [
      {},
      { references: null },
      { references: ["ARV-WR-20261122"] },
      { references: [null] },
      { references: Array.from({ length: 101 }, reference) },
    ])
      assert.equal((await request(endpoint, invalid, owner)).status, 400);
    const options = await (await request("/api/warranty/options")).json(),
      product = options.products[0];
    const receiptResponse = await request(
      "/api/warranty/receipt",
      {
        name: "history-invoice.pdf",
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.4\nHistory test receipt\n%%EOF").toString(
            "base64",
          ),
      },
      owner,
    );
    assert.equal(receiptResponse.status, 201);
    const receipt = await receiptResponse.json();
    const form = {
      submissionId: crypto.randomUUID(),
      customerName: "History " + crypto.randomUUID(),
      email: "private@example.test",
      productId: product.id,
      purchaseDate: "2026-01-01",
      quantity: "1",
      packSize: "4 L",
      dealerName: "Private dealer",
      dealerAddress: "Private dealer road",
      dealerCity: "Pune",
      invoiceNumber: "PRIVATE-" + crypto.randomUUID(),
      siteAddress: "Private building",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      notes: "Private customer notes",
      consent: true,
      receiptId: receipt.id,
    };
    const saved = await request("/api/warranty/registrations", form, owner);
    assert.equal(saved.status, 201, await saved.clone().text());
    const registration = await saved.json();
    assert.equal(
      (await request("/api/warranty/registrations", form, owner)).status,
      200,
    );
    const records = JSON.parse(
      await readFile(path.join(dir, "warranties.json"), "utf8"),
    );
    const second = {
      ...records[0],
      id: crypto.randomUUID(),
      reference: reference(),
      createdAt: new Date(Date.parse(records[0].createdAt) + 60000).toISOString(),
      status: "needs_information",
      reviewNotes: "PRIVATE review notes",
    };
    // Login phone is authoritative even when a separate contact snapshot differs.
    second.mobile = "+919111111111";
    const wrongLogin = {
      ...records[0],
      id: crypto.randomUUID(),
      reference: reference(),
      loginMobile: "+919111111111",
    };
    const legacy = {
      ...records[0],
      id: crypto.randomUUID(),
      reference: reference(),
      createdAt: "2025-01-01T00:00:00Z",
    };
    delete legacy.loginMobile;
    await writeFile(
      path.join(dir, "warranties.json"),
      JSON.stringify([...records, second, wrongLogin, legacy]),
    );

    let response = await request(endpoint, { references: [] }, owner);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.deepEqual(
      await response.json(),
      { registrations: [], total: 0 },
      "Phone alone must not reveal counts or existence",
    );
    assert.deepEqual(
      await (
        await request(
          endpoint,
          { references: [reference()], mobile: "+919000000000" },
          owner,
        )
      ).json(),
      { registrations: [], total: 0 },
    );
    const proofs = [
      registration.reference,
      second.reference,
      wrongLogin.reference,
      legacy.reference,
    ];
    response = await request(
      endpoint,
      {
        references: proofs,
        mobile: "+919111111111",
        mobileVerified: true,
        verificationMode: "whatsapp",
      },
      owner,
    );
    const history = await response.json();
    assert.equal(history.total, 3);
    assert.deepEqual(
      history.registrations.map((row) => row.reference),
      [second.reference, registration.reference, legacy.reference],
    );
    assert.equal(history.registrations[0].status, "needs_information");
    const accessFile = path.join(dir, "warranty-history-access.json");
    const accesses = JSON.parse(await readFile(accessFile, "utf8"));
    const sessionHash = crypto
      .createHash("sha256")
      .update(owner.split("=")[1])
      .digest("hex");
    assert.equal(accesses.length, 3);
    for (const access of accesses) {
      assert.equal(access.sessionHash, sessionHash);
      assert.equal(access.lookupCount, 1);
      assert.ok(access.firstAccessedAt <= access.lastAccessedAt);
      assert.deepEqual(
        Object.keys(access).sort(),
        [
          "registrationId",
          "sessionHash",
          "firstAccessedAt",
          "lastAccessedAt",
          "lookupCount",
        ].sort(),
      );
    }
    assert.equal((await stat(accessFile)).mode & 0o777, 0o600);
    const accessText = JSON.stringify(accesses);
    for (const privateValue of [
      owner.split("=")[1],
      registration.reference,
      form.customerName,
      form.email,
      "+919000000000",
    ])
      assert.equal(accessText.includes(privateValue), false);
    for (const item of history.registrations)
      assert.deepEqual(
        Object.keys(item).sort(),
        [
          "reference",
          "productName",
          "categoryName",
          "purchaseDate",
          "createdAt",
          "status",
          "reportAvailable",
        ].sort(),
      );
    const serialized = JSON.stringify(history);
    assert.ok(
      history.registrations.every((item) => item.reportAvailable === false),
    );
    for (const privateValue of [
      form.customerName,
      form.email,
      form.invoiceNumber,
      form.siteAddress,
      form.notes,
      receipt.id,
      "PRIVATE review notes",
    ])
      assert.equal(serialized.includes(privateValue), false);
    const otherHistory = await (
      await request(
        endpoint,
        { references: proofs, mobile: "+919000000000" },
        other,
      )
    ).json();
    assert.deepEqual(
      otherHistory.registrations.map((row) => row.reference),
      [wrongLogin.reference],
    );
    assert.deepEqual(
      await (
        await request(
          endpoint,
          {
            references: [
              " " + registration.reference.toLowerCase() + " ",
              registration.reference,
            ],
          },
          owner,
        )
      ).json(),
      { registrations: [history.registrations[1]], total: 1 },
    );
    assert.equal(
      JSON.parse(await readFile(accessFile, "utf8")).find(
        (row) =>
          row.registrationId === registration.id &&
          row.sessionHash === sessionHash,
      ).lookupCount,
      2,
    );
    assert.equal(
      (
        await request(
          "/api/admin/warranties/" + registration.id + "/receipt",
          undefined,
          owner,
        )
      ).status,
      401,
    );
    assert.equal(
      (await request("/api/admin/warranties", undefined, owner)).status,
      401,
    );
    await request("/api/warranty/logout", {}, owner);
    assert.equal(
      (await request(endpoint, { references: proofs }, owner)).status,
      401,
    );
    await stop();
    await start();
    const returning = await login("9000000000");
    assert.equal(
      (
        await (
          await request(endpoint, { references: proofs }, returning)
        ).json()
      ).total,
      3,
      "Saved references work after a server restart",
    );
    const rows = JSON.parse(
      await readFile(path.join(dir, "warranties.json"), "utf8"),
    );
    rows[0].status = "approved";
    await writeFile(path.join(dir, "warranties.json"), JSON.stringify(rows));
    assert.equal(
      (
        await (
          await request(
            endpoint,
            { references: [registration.reference] },
            returning,
          )
        ).json()
      ).registrations[0].status,
      "approved",
      "Refresh uses the latest saved review status",
    );
    /* Expire/cap only audit rows, including a nearly-full access store. */
    const sample = JSON.parse(await readFile(accessFile, "utf8"))[0];
    const recent = new Date(Date.now() - 60000).toISOString();
    const atCapacity = Array.from({ length: 9999 }, (_, index) => ({
      ...sample,
      registrationId: registration.id,
      sessionHash: crypto
        .createHash("sha256")
        .update("fixture-" + index)
        .digest("hex"),
      firstAccessedAt: recent,
      lastAccessedAt: recent,
      lookupCount: 1,
    }));
    atCapacity.push({
      ...sample,
      registrationId: registration.id,
      sessionHash: "f".repeat(64),
      firstAccessedAt: "2000-01-01T00:00:00Z",
      lastAccessedAt: "2000-01-01T00:00:00Z",
    });
    await writeFile(accessFile, JSON.stringify(atCapacity));
    assert.equal(
      (await request(endpoint, { references: proofs }, returning)).status,
      200,
    );
    const retained = JSON.parse(await readFile(accessFile, "utf8"));
    assert.equal(retained.length, 10000);
    assert.ok(
      retained.every((row) => row.lastAccessedAt !== "2000-01-01T00:00:00Z"),
    );
    assert.equal(
      JSON.parse(await readFile(path.join(dir, "warranties.json"), "utf8"))
        .length,
      4,
    );
    await writeFile(accessFile, "{}");
    const failed = await request(
      endpoint,
      { references: [registration.reference] },
      returning,
    );
    assert.equal(
      failed.status,
      500,
      "Corrupt access storage must not disclose an unrecorded response",
    );
    assert.equal((await failed.text()).includes(registration.reference), false);
    assert.equal(
      await readFile(accessFile, "utf8"),
      "{}",
      "Preserve a corrupt store for recovery",
    );
    await stop();
    await start({ WARRANTY_OTP_MODE: "disabled" });
    assert.equal(
      (await request(endpoint, { references: proofs }, returning)).status,
      401,
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

for (const schema of ["public", "areva"])
  test(`customer history SQL table upgrades ${schema} without opening private records`, async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
      );
      if (schema === "areva")
        await db.exec("CREATE SCHEMA areva; SET search_path=areva,pg_catalog;");
      await db.exec(await readFile("database/schema.sql", "utf8"));
      const indexName = `${schema}.warranty_registrations_login_created_idx`;
      assert.match(
        (
          await db.query("SELECT pg_get_indexdef($1::regclass) AS ddl", [
            indexName,
          ])
        ).rows[0].ddl,
        /login_mobile, created_at DESC/,
      );
      const before = await db.query(
        `SELECT relrowsecurity FROM pg_class WHERE oid='${schema}.warranty_registrations'::regclass`,
      );
      const registrationId = crypto.randomUUID(),
        receiptId = crypto.randomUUID();
      await db.query(
        `INSERT INTO ${schema}.warranty_registrations(id,reference,submission_id,mobile,login_mobile,verification_mode,customer_name,product_name,category_id,category_name,purchase_date,quantity,pack_size,dealer_name,dealer_address,dealer_city,invoice_number,site_address,city,state,pin_code,contact_consent,receipt_id,receipt_name,receipt_mime,receipt_bytes,receipt_file_key) VALUES ($1,$2,$3,'+919000000000','+919000000000','demo','SQL customer','Snapshot product','interior','Interior Paints','2026-01-01',1,'4 L','Dealer','Dealer address','Pune','SQL-INV','Site address','Pune','Maharashtra','411001',true,$4,'invoice.pdf','application/pdf',100,$5)`,
        [
          registrationId,
          reference(),
          crypto.randomUUID(),
          receiptId,
          receiptId + ".pdf",
        ],
      );
      const purchases = (
        await db.query(`SELECT * FROM ${schema}.warranty_registrations`)
      ).rows;
      await db.query(
        `INSERT INTO ${schema}.warranty_history_access(registration_id,session_hash) VALUES ($1,$2)`,
        [registrationId, "a".repeat(64)],
      );
      await db.exec(
        `DROP TABLE ${schema}.warranty_history_access; DROP INDEX ${indexName}`,
      );
      for (const role of ["anon", "authenticated", "service_role"])
        await db.exec(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON TABLES TO ${role}`,
        );
      const migration = await readFile(
        "database/migrations/014-customer-warranty-history.sql",
        "utf8",
      );
      await db.exec(migration);
      assert.deepEqual(
        (await db.query(`SELECT * FROM ${schema}.warranty_registrations`)).rows,
        purchases,
        "Migration preserves existing purchases",
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM ${schema}.warranty_history_access`,
          )
        ).rows[0].n,
        0,
      );
      assert.deepEqual(
        await db.query(
          `SELECT relrowsecurity FROM pg_class WHERE oid='${schema}.warranty_registrations'::regclass`,
        ),
        before,
      );
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          (
            await db.query(
              "SELECT has_table_privilege($1, $2, 'SELECT') AS allowed",
              [role, `${schema}.warranty_registrations`],
            )
          ).rows[0].allowed,
          false,
        );
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"])
          assert.equal(
            (
              await db.query(
                "SELECT has_table_privilege($1,$2,$3) AS allowed",
                [role, `${schema}.warranty_history_access`, privilege],
              )
            ).rows[0].allowed,
            false,
          );
      }
      const insert = (
        id = registrationId,
        session = "b".repeat(64),
        count = 1,
        first = "2026-01-01T00:00:00Z",
        last = "2026-01-02T00:00:00Z",
      ) =>
        db.query(
          `INSERT INTO ${schema}.warranty_history_access(registration_id,session_hash,lookup_count,first_accessed_at,last_accessed_at) VALUES ($1,$2,$3,$4,$5)`,
          [id, session, count, first, last],
        );
      await insert();
      await assert.rejects(insert(), (error) => error.code === "23505");
      await assert.rejects(
        insert(crypto.randomUUID(), "c".repeat(64)),
        (error) => error.code === "23503",
      );
      await assert.rejects(
        insert(registrationId, "raw-session-cookie"),
        (error) => error.code === "23514",
      );
      await assert.rejects(
        insert(registrationId, "c".repeat(64), 0),
        (error) => error.code === "23514",
      );
      await assert.rejects(
        insert(registrationId, "c".repeat(64), 1000001),
        (error) => error.code === "23514",
      );
      await assert.rejects(
        insert(
          registrationId,
          "c".repeat(64),
          1,
          "2026-02-01T00:00:00Z",
          "2026-01-01T00:00:00Z",
        ),
        (error) => error.code === "23514",
      );
      assert.equal(
        (
          await db.query(
            `SELECT relrowsecurity FROM pg_class WHERE oid='${schema}.warranty_history_access'::regclass`,
          )
        ).rows[0].relrowsecurity,
        true,
      );
      await db.exec(
        `GRANT USAGE ON SCHEMA ${schema} TO authenticated; GRANT SELECT ON ${schema}.warranty_history_access TO authenticated; SET ROLE authenticated`,
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM ${schema}.warranty_history_access`,
          )
        ).rows[0].n,
        0,
        "RLS protects records even after an accidental SELECT grant",
      );
      await db.exec(
        `RESET ROLE; REVOKE SELECT ON ${schema}.warranty_history_access FROM authenticated`,
      );
      await assert.rejects(db.exec(migration), /already exists/);
      await db.exec("ROLLBACK");
      assert.ok(
        (await db.query("SELECT to_regclass($1) AS relation", [indexName]))
          .rows[0].relation,
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM ${schema}.warranty_history_access`,
          )
        ).rows[0].n,
        1,
        "Repeated migration rollback preserves access records",
      );
      await db.query(
        `DELETE FROM ${schema}.warranty_registrations WHERE id=$1`,
        [registrationId],
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM ${schema}.warranty_history_access`,
          )
        ).rows[0].n,
        0,
        "Deleting a registration cascades only its access records",
      );
    } finally {
      await db.close();
    }
  });

/* Regression coverage for admin review decisions, search and date filtering.
 * Fixtures use disposable local stores/databases; hosted customer records are not changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";

function fixture(id, createdAt, purchaseDate) {
  return {
    id,
    reference: "ARV-WR-" + id,
    mobile: "+919000000000",
    verificationMode: "demo",
    mobileVerified: false,
    status: "pending_review",
    customerName: "Review customer",
    email: "private@example.test",
    alternateMobile: "",
    productId: "test-product",
    productName: "Snapshot product",
    categoryId: "interior",
    categoryName: "Interior Paints",
    warrantyYears: 12,
    warrantyLabel: "Performance warranty",
    purchaseDate,
    quantity: "2",
    packSize: "4 L",
    batchNumber: "BATCH-A",
    shade: "White",
    dealerId: "",
    dealerName: "Test dealer",
    dealerPhone: "",
    dealerAddress: "Dealer address",
    dealerCity: "Pune",
    invoiceNumber: "INV-REVIEW",
    siteAddress: "Private address",
    city: "Pune",
    state: "Maharashtra",
    pinCode: "411001",
    applicationDate: "",
    paintedArea: "",
    applicatorName: "",
    applicatorPhone: "",
    notes: "Private notes",
    consent: true,
    receipt: {
      id: crypto.randomUUID(),
      name: "invoice.pdf",
      mime: "application/pdf",
      bytes: 100,
    },
    createdAt,
    submissionId: crypto.randomUUID(),
  };
}
test("admin manual review preserves demo verification, records history and applies inclusive IST date filters", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-warranty-review-"));
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let server,
    logs = "";
  const id = crypto.randomUUID(),
    before = fixture(
      crypto.randomUUID(),
      "2026-11-14T18:29:59.999Z",
      "2026-11-13",
    ),
    first = fixture(id, "2026-11-14T18:30:00.000Z", "2026-11-14"),
    last = fixture(
      crypto.randomUUID(),
      "2026-11-15T18:29:59.999Z",
      "2026-11-15",
    ),
    after = fixture(
      crypto.randomUUID(),
      "2026-11-15T18:30:00.000Z",
      "2026-11-16",
    );
  first.notes = "Testing purchase details";
  first.loginMobile = "+919000000009";
  await writeFile(
    path.join(dir, "warranties.json"),
    JSON.stringify([after, last, first, before]),
  );
  async function start() {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "review-admin",
        ADMIN_PASSWORD: password,
        TRUST_PROXY_HOPS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (d) => (logs += d));
    server.stderr.on("data", (d) => (logs += d));
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(logs);
  }
  async function stop() {
    if (server?.exitCode === null) {
      const done = new Promise((r) => server.once("exit", r));
      server.kill();
      await done;
    }
  }
  const request = (url, body, cookie = "", method = "PATCH") =>
    fetch(base + url, {
      method: body === undefined ? "GET" : method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request(
      "/api/admin/login",
      { username: "review-admin", password },
      "",
      "POST",
    );
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  const url = "/api/admin/warranties/" + id;
  try {
    await start();
    const body = {
      status: "approved",
      notes: "Reviewed receipt and purchase",
      expectedVersion: 1,
      approvalConfirmed: true,
    };
    assert.equal((await request(url, body)).status, 401);
    assert.equal((await request(url, undefined)).status, 401);
    let cookie = await login();
    const get = async (query) =>
      await (
        await request("/api/admin/warranties" + query, undefined, cookie)
      ).json();
    assert.equal(
      (await get("")).registrations.find((row) => row.id === before.id)
        .loginMobile,
      before.mobile,
      "Legacy rows retain the original entry phone",
    );
    for (const [search, count] of [
      ["Testing", 1],
      ["  TESTING   pune  ", 1],
      ["Pune customer Snapshot", 4],
      ["pending review", 4],
      ["+91 (90000) 00000", 4],
      ["9000000000", 4],
      ["+91 (90000) 00009", 1],
      ["Interior Paints INV-REVIEW", 4],
      [first.reference, 1],
      ["customerName", 0],
      ["submissionId", 0],
      [first.submissionId, 0],
      ["No such customer", 0],
    ]) {
      const result = await get("?search=" + encodeURIComponent(search));
      assert.equal(result.total, count, "Readable-value search: " + search);
    }
    const dateMatches = await get(
      "?search=" + encodeURIComponent("15 Nov 2026"),
    );
    assert.ok(dateMatches.registrations.some((row) => row.id === first.id));
    assert.ok(dateMatches.registrations.some((row) => row.id === last.id));
    assert.equal((await get("?search=Testing&status=approved")).total, 0);
    assert.equal(
      (
        await get(
          "?search=Testing&category=interior&from=2026-11-15&to=2026-11-15",
        )
      ).total,
      1,
    );
    let result = await get("?from=2026-11-15&to=2026-11-15");
    assert.equal(result.total, 2);
    assert.deepEqual(
      result.registrations.map((row) => row.id),
      [last.id, first.id],
    );
    assert.equal(
      result.registrations[1].version,
      1,
      "Older records receive review defaults without changing their data",
    );
    assert.equal(result.registrations[1].reviewedAt, null);
    assert.equal(
      (await get("?dateBy=purchase&from=2026-11-14&to=2026-11-15")).total,
      2,
    );
    assert.equal((await get("?dateBy=registration&from=2026-11-16")).total, 1);
    assert.equal((await get("?dateBy=registration&to=2026-11-14")).total, 1);
    for (const query of [
      "?from=2026-02-30",
      "?to=bad",
      "?from=2026-11-16&to=2026-11-15",
      "?dateBy=review",
      "?status=bad",
      "?from[x]=2026-11-15",
      "?category=bad",
    ])
      assert.equal(
        (await request("/api/admin/warranties" + query, undefined, cookie))
          .status,
        400,
        query,
      );
    assert.equal(
      (await request(url, { ...body, approvalConfirmed: false }, cookie))
        .status,
      400,
    );
    assert.equal(
      (await request(url, { ...body, mobileVerified: true }, cookie)).status,
      400,
      "Review cannot rewrite OTP flags",
    );
    assert.equal(
      (await request(url, { ...body, reviewedBy: "forged" }, cookie)).status,
      400,
      "Reviewer must come from the session",
    );
    assert.equal(
      (
        await request(
          url,
          { ...body, status: "needs_information", notes: " " },
          cookie,
        )
      ).status,
      400,
    );
    const receiptFolder = path.join(dir, "warranty-receipts");
    await mkdir(receiptFolder, { recursive: true });
    assert.equal(
      (await request(url, body, cookie)).status,
      409,
      "Missing receipts cannot be manually approved",
    );
    await writeFile(
      path.join(receiptFolder, first.receipt.id + ".pdf"),
      "%PDF-1.4\nReceipt fixture\n%%EOF",
    );
    const response = await request(url, body, cookie);
    assert.equal(response.status, 200);
    const approved = (await response.json()).registration;
    assert.equal(approved.status, "approved");
    assert.equal(approved.mobileVerified, false);
    assert.equal(approved.verificationMode, "demo");
    assert.equal(approved.approvalConfirmed, true);
    assert.equal(approved.version, 2);
    assert.equal(approved.reviewedBy, "review-admin");
    assert.ok(approved.reviewedAt);
    assert.equal(approved.submissionId, undefined);
    assert.equal(approved.reviewHistory.length, 1);
    assert.equal(
      (
        await get(
          "?search=" +
            encodeURIComponent("Reviewed receipt approved review-admin"),
        )
      ).total,
      1,
    );
    assert.equal(approved.productName, "Snapshot product");
    assert.equal(approved.receipt.id, first.receipt.id);
    assert.equal(
      (await request(url, body, cookie)).status,
      409,
      "Stale admin version cannot overwrite a review",
    );
    assert.equal(
      (
        await (
          await request(url, { ...body, expectedVersion: 2 }, cookie)
        ).json()
      ).registration.version,
      2,
      "No-op saves do not generate audit spam",
    );
    assert.equal(
      (
        await get(
          "?status=approved&from=2026-11-15&to=2026-11-15&category=interior&search=INV-REVIEW",
        )
      ).total,
      1,
    );
    assert.equal((await get("?status=pending_review")).total, 3);
    assert.equal(
      (
        await request(
          url,
          {
            status: "rejected",
            notes: "Attempt to change final decision",
            expectedVersion: 2,
            approvalConfirmed: false,
          },
          cookie,
        )
      ).status,
      409,
      "Approved decisions are final",
    );
    const secondUrl = "/api/admin/warranties/" + last.id;
    const pending = (
      await (
        await request(
          secondUrl,
          {
            status: "needs_information",
            notes: "Upload the complete invoice",
            expectedVersion: 1,
            approvalConfirmed: false,
          },
          cookie,
        )
      ).json()
    ).registration;
    assert.equal(pending.status, "needs_information");
    assert.equal(pending.version, 2);
    const rejected = (
      await (
        await request(
          secondUrl,
          {
            status: "rejected",
            notes: "Receipt needs correction <script>text only</script>",
            expectedVersion: 2,
            approvalConfirmed: false,
          },
          cookie,
        )
      ).json()
    ).registration;
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.version, 3);
    assert.equal(rejected.reviewHistory.length, 2);
    assert.equal(
      (
        await request(
          secondUrl,
          {
            status: "needs_information",
            notes: "Try reopening",
            expectedVersion: 3,
            approvalConfirmed: false,
          },
          cookie,
        )
      ).status,
      409,
      "Rejected decisions are final",
    );
    const report = await request(url + "/report.pdf", undefined, cookie);
    assert.equal(report.status, 200);
    assert.match(report.headers.get("content-type"), /application\/pdf/);
    assert.match(report.headers.get("content-disposition"), /attachment/);
    assert.equal(report.headers.get("cache-control"), "no-store");
    assert.equal(
      Buffer.from(await report.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    assert.equal((await request(url + "/report.pdf")).status, 401);
    assert.equal(
      (
        await request(
          "/api/admin/warranties/" + before.id + "/report.pdf",
          undefined,
          cookie,
        )
      ).status,
      409,
      "Unreviewed records do not have a final decision report",
    );
    await stop();
    await start();
    cookie = await login();
    const restored = (await (await request(url, undefined, cookie)).json())
      .registration;
    assert.equal(restored.version, 2);
    assert.equal(restored.reviewHistory.length, 1);
    assert.equal(restored.mobileVerified, false);
    assert.equal(
      (
        await get(
          "?dateBy=purchase&from=2026-11-14&to=2026-11-14&status=approved",
        )
      ).total,
      1,
    );
    const disk = JSON.parse(
      await readFile(path.join(dir, "warranties.json"), "utf8"),
    );
    assert.equal(disk.find((row) => row.id === id).reviewedBy, "review-admin");
    assert.ok(
      !(await (await request("/api/content")).text()).includes(
        "Reviewed receipt and purchase",
      ),
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("review SQL upgrade allows explicit manual approval and preserves real OTP boundaries", async () => {
  for (const schema of ["public", "areva"]) {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;",
      );
      if (schema === "areva")
        await db.exec("CREATE SCHEMA areva;SET search_path=areva,pg_catalog;");
      await db.exec(await readFile("database/schema.sql", "utf8"));
      await db.exec("DROP TABLE warranty_registrations");
      await db.exec(
        await readFile(
          "database/migrations/006-warranty-registrations.sql",
          "utf8",
        ),
      );
      await db.exec(
        `INSERT INTO ${schema}.warranty_registrations(id,reference,submission_id,mobile,verification_mode,customer_name,product_name,category_id,category_name,purchase_date,quantity,pack_size,dealer_name,dealer_address,dealer_city,invoice_number,site_address,city,state,pin_code,contact_consent,receipt_id,receipt_name,receipt_mime,receipt_bytes,receipt_file_key) VALUES ('11111111-1111-4111-8111-111111111111','TEST-REF','22222222-2222-4222-8222-222222222222','+919000000000','demo','Test customer','Snapshot product','interior','Interior Paints','2026-01-01',2,'4 L','Test dealer','Dealer address','Pune','INV1','Property address','Pune','Maharashtra','411001',true,'33333333-3333-4333-8333-333333333333','invoice.pdf','application/pdf',100,'33333333-3333-4333-8333-333333333333.pdf')`,
      );
      await db.exec(
        await readFile(
          "database/migrations/007-warranty-review-and-filters.sql",
          "utf8",
        ),
      );
      const row = (
        await db.query(
          `SELECT status, version,reviewed_at,review_history,mobile_verified FROM ${schema}.warranty_registrations`,
        )
      ).rows[0];
      assert.equal(row.status, "pending_review");
      assert.equal(row.version, 1);
      assert.equal(row.reviewed_at, null);
      assert.deepEqual(row.review_history, []);
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.warranty_registrations SET status='approved'`,
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.warranty_registrations SET approval_confirmed=true`,
        ),
        /check constraint/,
      );
      await db.exec(
        `UPDATE ${schema}.warranty_registrations SET status='approved', approval_confirmed=true,reviewed_by='review-admin',reviewed_at=now(),version=2,review_notes='Receipt reviewed'`,
      );
      assert.equal(
        (
          await db.query(
            `SELECT mobile_verified FROM ${schema}.warranty_registrations`,
          )
        ).rows[0].mobile_verified,
        false,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.warranty_registrations SET mobile_verified=true`,
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.exec(`UPDATE ${schema}.warranty_registrations SET status='unknown'`),
        /check constraint/,
      );
      await db.exec("SET ROLE anon");
      await assert.rejects(
        db.exec(`SELECT * FROM ${schema}.warranty_registrations`),
        /permission denied/,
      );
      await db.exec("RESET ROLE");
    } finally {
      await db.close();
    }
  }
});

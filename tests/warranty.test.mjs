import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  rm,
  readFile,
  stat,
  readdir,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";

test("demo warranty registration persists private details and receipts with admin-only search", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-warranty-"));
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
    server.stdout.on("data", (d) => (logs += d));
    server.stderr.on("data", (d) => (logs += d));
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Startup timeout " + logs);
  }
  async function stop() {
    if (server?.exitCode === null) {
      const done = new Promise((r) => server.once("exit", r));
      server.kill();
      await done;
    }
  }
  const req = (url, body, cookie = "", headers = {}) =>
    fetch(base + url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function demo(mobile) {
    const challenge = await req("/api/warranty/otp/request", { mobile });
    assert.equal(challenge.status, 200);
    const d = await challenge.json();
    assert.equal(d.demoCode, "123456");
    const response = await req("/api/warranty/otp/verify", {
      challengeId: d.challengeId,
      code: d.demoCode,
    });
    assert.equal(response.status, 200);
    assert.equal((await response.clone().json()).mobileVerified, false);
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
    return response.headers.get("set-cookie").split(";")[0];
  }
  try {
    await start();
    assert.equal(
      (await req("/api/warranty/receipt", { data: "x".repeat(100000) })).status,
      401,
      "Receipt authentication precedes body parsing",
    );
    assert.equal((await req("/api/admin/warranties")).status, 401);
    assert.equal(
      (await req("/api/warranty/otp/request", { mobile: "123" })).status,
      400,
    );
    assert.equal(
      (
        await req("/api/warranty/otp/request", { mobile: "9000000000" }, "", {
          Origin: "https://foreign.example",
        })
      ).status,
      403,
    );
    const challenge = await (
      await req("/api/warranty/otp/request", { mobile: "9000000000" })
    ).json();
    assert.equal(
      (await req("/api/warranty/otp/request", { mobile: "9000000000" })).status,
      429,
      "Resend cooldown",
    );
    assert.equal(
      (
        await req("/api/warranty/otp/verify", {
          challengeId: challenge.challengeId,
          code: "000000",
        })
      ).status,
      400,
    );
    const verified = await req("/api/warranty/otp/verify", {
        challengeId: challenge.challengeId,
        code: "123456",
      }),
      cookie = verified.headers.get("set-cookie").split(";")[0];
    assert.equal(verified.status, 200);
    assert.equal(
      (
        await req("/api/warranty/otp/verify", {
          challengeId: challenge.challengeId,
          code: "123456",
        })
      ).status,
      400,
      "Challenge cannot be replayed",
    );
    assert.equal(
      (await req("/api/admin/content", undefined, cookie)).status,
      401,
      "Demo session cannot become an admin",
    );
    assert.equal(
      (await req("/api/warranty/registrations", {}, "areva_warranty=forged"))
        .status,
      401,
    );
    assert.equal(
      (
        await req(
          "/api/warranty/receipt",
          { data: "data:image/svg+xml;base64,PHN2Zz4=" },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "/api/warranty/receipt",
          {
            data:
              "data:application/pdf;base64," +
              Buffer.from("not a pdf at all").toString("base64"),
          },
          cookie,
        )
      ).status,
      400,
    );
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
    const upload = await req(
      "/api/warranty/receipt",
      {
        name: "customer-paid-receipt.pdf",
        data: "data:application/pdf;base64," + pdf.toString("base64"),
      },
      cookie,
    );
    assert.equal(upload.status, 201);
    const receipt = await upload.json();
    assert.equal(
      (await req("/uploads/" + receipt.id + ".pdf")).status,
      404,
      "Private receipt is never a public upload",
    );
    assert.equal(
      (await req("/warranty-receipts/" + receipt.id + ".pdf")).status,
      404,
    );
    assert.equal(
      (await stat(path.join(dir, "warranty-receipts", receipt.id + ".pdf")))
        .mode & 0o777,
      0o600,
    );
    const options = await (await req("/api/warranty/options")).json(),
      product = options.products[0];
    const form = {
      customerName: "PRIVATE_WARRANTY_CUSTOMER <script>bad()</script>",
      email: "private@example.test",
      alternateMobile: "9000000001",
      productId: product.id,
      purchaseDate: options.today,
      quantity: "2",
      packSize: "4 L",
      batchNumber: "BATCH-2026",
      shade: "Pearl White",
      dealerId: "",
      dealerName: "PRIVATE_DEALER",
      dealerPhone: "9000000002",
      dealerAddress: "Invoice shop address",
      dealerCity: "Pune",
      invoiceNumber: "PRIVATE-INV-471",
      siteAddress: "PRIVATE_SITE_ADDRESS",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      applicationDate: "",
      paintedArea: "",
      applicatorName: "Test applicator",
      applicatorPhone: "9000000003",
      notes: "PRIVATE_WARRANTY_NOTES",
      receiptId: receipt.id,
      consent: true,
      submissionId: crypto.randomUUID(),
      mobileVerified: true,
      verificationMode: "whatsapp",
      warrantyYears: 999,
      loginMobile: "+919999999999",
    };
    const other = await demo("9000000004");
    assert.equal(
      (await req("/api/warranty/registrations", form, other)).status,
      400,
      "Another session cannot claim the receipt",
    );
    assert.equal(
      (
        await req(
          "/api/warranty/registrations",
          { ...form, consent: false },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "/api/warranty/registrations",
          { ...form, purchaseDate: "2999-01-01" },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "/api/warranty/registrations",
          { ...form, quantity: "-1" },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await req(
          "/api/warranty/registrations",
          { ...form, pinCode: "bad" },
          cookie,
        )
      ).status,
      400,
    );
    // The per-IP limit counts invalid writes too. Restart for the valid persistence scenario; expired sessions must re-upload their own receipts.
    await stop();
    await start();
    const fresh = await demo("9000000000");
    const uploadedAgain = await req(
      "/api/warranty/receipt",
      {
        name: "customer-paid-receipt.pdf",
        data: "data:application/pdf;base64," + pdf.toString("base64"),
      },
      fresh,
    );
    assert.equal(uploadedAgain.status, 201);
    form.receiptId = (await uploadedAgain.json()).id;
    const saved = await req("/api/warranty/registrations", form, fresh);
    assert.equal(saved.status, 201, await saved.clone().text());
    const result = await saved.json();
    assert.match(result.reference, /^ARV-WR-/);
    const retry = await req("/api/warranty/registrations", form, fresh);
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).id, result.id);
    const raw = JSON.parse(
      await readFile(path.join(dir, "warranties.json"), "utf8"),
    );
    assert.equal(raw.length, 1);
    assert.equal(raw[0].verificationMode, "demo");
    assert.equal(raw[0].mobileVerified, false);
    assert.equal(raw[0].mobile, "+919000000000");
    assert.equal(
      raw[0].loginMobile,
      "+919000000000",
      "Entry phone comes from the session, never the submitted form",
    );
    assert.equal(raw[0].warrantyYears, product.specs.warrantyYears);
    assert.equal(raw[0].status, "pending_review");
    assert.equal(
      (await stat(path.join(dir, "warranties.json"))).mode & 0o777,
      0o600,
    );
    assert.equal(
      (
        await req(
          "/api/admin/warranties/" + result.id + "/receipt",
          undefined,
          fresh,
        )
      ).status,
      401,
    );
    const login = await req("/api/admin/login", { password }),
      admin = login.headers.get("set-cookie").split(";")[0];
    const list = await req(
      "/api/admin/warranties?search=" + encodeURIComponent("PRIVATE-INV-471"),
      undefined,
      admin,
    );
    assert.equal(list.status, 200);
    const found = await list.json();
    assert.equal(found.total, 1);
    assert.equal(found.registrations[0].siteAddress, form.siteAddress);
    assert.equal(found.registrations[0].loginMobile, "+919000000000");
    assert.equal(found.registrations[0].submissionId, undefined);
    assert.equal(
      (
        await (
          await req(
            "/api/admin/warranties?search=not-present",
            undefined,
            admin,
          )
        ).json()
      ).total,
      0,
    );
    assert.equal(
      (
        await (
          await req(
            "/api/admin/warranties?category=" + product.categoryId,
            undefined,
            admin,
          )
        ).json()
      ).total,
      1,
    );
    const download = await req(
      "/api/admin/warranties/" + result.id + "/receipt",
      undefined,
      admin,
    );
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-disposition"), /attachment/);
    assert.equal(download.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
    for (const url of [
      "/api/content",
      "/attached-page",
      "/api/products",
      "/api/project/source-files",
    ])
      assert.equal(
        (
          await (
            await req(url, undefined, url.includes("/project/") ? admin : "")
          ).text()
        ).includes("PRIVATE_WARRANTY_CUSTOMER"),
        false,
        url,
      );
    // Product edits preserve registration snapshots, and temporary cleanup cannot remove referenced receipts.
    const content = await (
      await req("/api/admin/content", undefined, admin)
    ).json();
    content.products[0].name = "Changed product";
    content.products[0].specs.warrantyYears = 99;
    assert.equal(
      (
        await fetch(base + "/api/admin/content", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: admin },
          body: JSON.stringify(content),
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await req("/api/admin/warranties", undefined, admin)).json())
        .registrations[0].productName,
      product.name,
    );
    const uploads = JSON.parse(
      await readFile(path.join(dir, "warranty-uploads.json"), "utf8"),
    );
    uploads[raw[0].receipt.id] = {
      receipt: raw[0].receipt,
      session: "expired-owner",
      until: 0,
    };
    await writeFile(
      path.join(dir, "warranty-uploads.json"),
      JSON.stringify(uploads),
    );
    assert.equal(
      (
        await req(
          "/api/warranty/receipt",
          {
            name: "another.pdf",
            data: "data:application/pdf;base64," + pdf.toString("base64"),
          },
          fresh,
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await req(
          "/api/admin/warranties/" + result.id + "/receipt",
          undefined,
          admin,
        )
      ).status,
      200,
      "Expired-upload cleanup never deletes a submitted receipt",
    );
    await req("/api/warranty/logout", {}, fresh);
    assert.equal(
      (await req("/api/warranty/session", undefined, fresh)).status,
      401,
    );
    await stop();
    await start();
    const restoredLogin = await req("/api/admin/login", { password }),
      restored = restoredLogin.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await (await req("/api/admin/warranties", undefined, restored)).json())
        .total,
      1,
    );
    assert.equal(
      (await (await req("/api/admin/warranties", undefined, restored)).json())
        .registrations[0].loginMobile,
      "+919000000000",
      "The login phone snapshot survives restart",
    );
    assert.equal(
      (
        await req(
          "/api/admin/warranties/" + result.id + "/receipt",
          undefined,
          restored,
        )
      ).status,
      200,
    );
    await stop();
    await start({ WARRANTY_OTP_MODE: "whatsapp" });
    assert.equal(
      (await req("/api/warranty/otp/request", { mobile: "9000000000" })).status,
      503,
      "An unconfigured real provider never falls back to demo",
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("warranty SQL migration preserves private access and prevents demo approval", async () => {
  for (const schemaName of ["public", "areva"]) {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;",
      );
      if (schemaName === "areva")
        await db.exec("CREATE SCHEMA areva;SET search_path=areva,pg_catalog;");
      await db.exec(await readFile("database/schema.sql", "utf8"));
      await db.exec("DROP TABLE warranty_registrations");
      await db.exec(
        await readFile(
          "database/migrations/006-warranty-registrations.sql",
          "utf8",
        ),
      );
      const insert = `INSERT INTO ${schemaName}.warranty_registrations(id,reference,submission_id,mobile,verification_mode,customer_name,product_name,category_id,category_name,purchase_date,quantity,pack_size,dealer_name,dealer_address,dealer_city,invoice_number,site_address,city,state,pin_code,contact_consent,receipt_id,receipt_name,receipt_mime,receipt_bytes,receipt_file_key) VALUES ('11111111-1111-4111-8111-111111111111','TEST-REF','22222222-2222-4222-8222-222222222222','+919000000000','demo','Test customer','Snapshot product','interior','Interior Paints','2026-01-01',2,'4 L','Test dealer','Dealer address','Pune','INV1','Property address','Pune','Maharashtra','411001',true,'33333333-3333-4333-8333-333333333333','invoice.pdf','application/pdf',100,'33333333-3333-4333-8333-333333333333.pdf')`;
      await db.exec(insert);
      await assert.rejects(
        db.exec(
          `UPDATE ${schemaName}.warranty_registrations SET status='approved'`,
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${schemaName}.warranty_registrations SET mobile_verified=true`,
        ),
        /check constraint/,
      );
      await db.exec("SET ROLE anon");
      await assert.rejects(
        db.exec(`SELECT * FROM ${schemaName}.warranty_registrations`),
        /permission denied/,
      );
      await db.exec("RESET ROLE");
      assert.equal(
        (
          await db.query(
            `SELECT product_name FROM ${schemaName}.warranty_registrations`,
          )
        ).rows[0].product_name,
        "Snapshot product",
      );
    } finally {
      await db.close();
    }
  }
});

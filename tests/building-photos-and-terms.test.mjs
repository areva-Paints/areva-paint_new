/* Real API/persistence and PostgreSQL checks for private building photos and
 * product-type warranty terms. Fixtures never contact customers or hosted storage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { ProductWarrantyBadge } from "../src/components/ProductSummaryHeading.tsx";
import { documentAppliesToProduct } from "../src/data/warrantyTerms.ts";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=",
  "base64",
);
const imageData = "data:image/png;base64," + png.toString("base64");

/* Isolated production server checks the same cookies and parsers as a deployment. */
test("private building photos persist with registration and product-type terms publish safely", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-building-terms-"));
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const base = "http://127.0.0.1:" + port,
    password = crypto.randomBytes(24).toString("hex");
  let processServer,
    output = "",
    admin = "";
  async function start() {
    processServer = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        CONTENT_DATA_DIR: dir,
        PORT: String(port),
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        ADMIN_TEST_LOGIN: "false",
        TRUST_PROXY_HOPS: "0",
        WARRANTY_OTP_MODE: "demo",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    processServer.stdout.on("data", (data) => (output += data));
    processServer.stderr.on("data", (data) => (output += data));
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (processServer.exitCode !== null) throw Error(output);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(output);
  }
  async function stop() {
    if (processServer?.exitCode === null) {
      const done = new Promise((r) => processServer.once("exit", r));
      processServer.kill();
      await done;
    }
  }
  const request = (
    url,
    body,
    cookie = "",
    method = body === undefined ? "GET" : "POST",
    headers = {},
  ) =>
    fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request("/api/admin/login", {
      username: "admin",
      password,
    });
    assert.equal(response.status, 200);
    admin = response.headers.get("set-cookie").split(";")[0];
  }
  async function entry(mobile) {
    const challenge = await (
      await request("/api/warranty/otp/request", { mobile })
    ).json();
    const response = await request("/api/warranty/otp/verify", {
      challengeId: challenge.challengeId,
      code: challenge.demoCode,
    });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie").split(";")[0];
  }
  try {
    await start();
    await login();
    let content = await (
      await request("/api/admin/content", undefined, admin)
    ).json();
    const product = content.products[0],
      category = product.categoryId;
    const pdf = await request(
      "/api/admin/pdf-upload",
      {
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.4\nTerms fixture\n%%EOF").toString("base64"),
        originalName: "Warranty terms.pdf",
        section: "certifications",
      },
      admin,
    );
    assert.equal(pdf.status, 201);
    const url = (await pdf.json()).url;
    const document = {
      id: crypto.randomUUID(),
      title: "Warranty terms <script>literal</script>",
      description: "Official product-type terms",
      type: "warranty",
      label: "Terms and conditions",
      issuer: "",
      reference: "TERM-A",
      issuedOn: "",
      validUntil: "",
      productIds: [],
      categoryIds: [category],
      published: true,
      attachments: [{ id: crypto.randomUUID(), label: "Warranty terms", url }],
      createdAt: "",
      updatedAt: "",
    };
    const saved = await request(
      "/api/admin/content",
      { ...content, certifications: [document] },
      admin,
      "PUT",
    );
    assert.equal(saved.status, 200, await saved.clone().text());
    content = await saved.json();
    assert.deepEqual(content.certifications[0].categoryIds, [category]);
    assert.equal(
      documentAppliesToProduct(content.certifications[0], product),
      true,
    );
    assert.equal(
      documentAppliesToProduct(content.certifications[0], {
        ...product,
        id: "future-product",
      }),
      true,
      "Future products inherit product-type terms",
    );
    assert.equal(
      documentAppliesToProduct(content.certifications[0], {
        ...product,
        categoryId: "invalid-category",
      }),
      false,
    );
    for (const categoryIds of [[category, category], ["unknown"]])
      assert.equal(
        (
          await request(
            "/api/admin/content",
            {
              ...content,
              certifications: [{ ...content.certifications[0], categoryIds }],
            },
            admin,
            "PUT",
          )
        ).status,
        400,
      );
    const oldClient = structuredClone(content);
    delete oldClient.certifications[0].categoryIds;
    const retained = await request(
      "/api/admin/content",
      oldClient,
      admin,
      "PUT",
    );
    assert.equal(retained.status, 200);
    content = await retained.json();
    assert.deepEqual(content.certifications[0].categoryIds, [category]);
    const html = await (await request("/attached-page")).text();
    assert.match(html, /id="terms"/);
    assert.match(html, /Terms and conditions/);
    assert.match(html, /Warranty terms &lt;script&gt;literal&lt;\/script&gt;/);
    assert.ok(!html.includes("Warranty terms <script>literal</script>"));
    assert.ok(html.includes("#terms/" + encodeURIComponent(product.id)));
    assert.match(
      renderToStaticMarkup(
        React.createElement(ProductWarrantyBadge, {
          product: {
            ...product,
            specs: { ...product.specs, warrantyYears: 8 },
          },
        }),
      ),
      /#terms\//,
    );
    assert.equal(
      (await request("/api/warranty/site-photos", { data: "x".repeat(100000) }))
        .status,
      401,
      "Authenticate before reading the upload body",
    );
    const owner = await entry("9000000000"),
      other = await entry("9000000001");
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos",
          { data: imageData },
          owner,
          "POST",
          { Origin: "https://foreign.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos",
          {
            data:
              "data:image/png;base64," +
              Buffer.from("invalid image content").toString("base64"),
          },
          owner,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos",
          { data: "data:application/pdf;base64," + png.toString("base64") },
          owner,
        )
      ).status,
      400,
    );
    const photos = [];
    for (let i = 0; i < 5; i++) {
      const response = await request(
        "/api/warranty/site-photos",
        { data: imageData, name: `Building ${i + 1}.png` },
        owner,
      );
      assert.equal(response.status, 201, await response.clone().text());
      photos.push(await response.json());
    }
    assert.equal(
      (await request("/api/warranty/site-photos", { data: imageData }, owner))
        .status,
      429,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos/" + photos[0].id,
          undefined,
          owner,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos/" + photos[0].id,
          undefined,
          other,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos/" + photos[0].id,
          {},
          other,
          "DELETE",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos/" + photos[4].id,
          {},
          owner,
          "DELETE",
        )
      ).status,
      200,
    );
    photos.pop();
    const replacement = await request(
      "/api/warranty/site-photos",
      { data: imageData, name: "Building final.png" },
      owner,
    );
    assert.equal(replacement.status, 201);
    photos.push(await replacement.json());
    const foreignResponse = await request(
      "/api/warranty/site-photos",
      { data: imageData, name: "Other customer.png" },
      other,
    );
    assert.equal(foreignResponse.status, 201);
    const foreign = await foreignResponse.json();
    const receiptResponse = await request(
      "/api/warranty/receipt",
      {
        data:
          "data:application/pdf;base64," +
          Buffer.from("%PDF-1.4\nPrivate receipt fixture\n%%EOF").toString(
            "base64",
          ),
        name: "Invoice.pdf",
      },
      owner,
    );
    assert.equal(receiptResponse.status, 201);
    const receipt = await receiptResponse.json();
    const form = {
      submissionId: crypto.randomUUID(),
      customerName: "Building customer",
      productId: product.id,
      purchaseDate: "2026-01-01",
      quantity: "1",
      packSize: "4 L",
      dealerId: "",
      dealerName: "Dealer",
      dealerAddress: "Shop address",
      dealerCity: "Pune",
      invoiceNumber: "INV-PHOTO",
      siteAddress: "Private building address",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      consent: true,
      receiptId: receipt.id,
      sitePhotoIds: photos.map((p) => p.id),
    };
    for (const sitePhotoIds of [
      [foreign.id],
      [photos[0].id, photos[0].id],
      [...form.sitePhotoIds, crypto.randomUUID()],
    ])
      assert.equal(
        (
          await request(
            "/api/warranty/registrations",
            { ...form, sitePhotoIds },
            owner,
          )
        ).status,
        400,
      );
    const registered = await request(
      "/api/warranty/registrations",
      form,
      owner,
    );
    assert.equal(registered.status, 201, await registered.clone().text());
    const result = await registered.json();
    assert.equal(
      (await request("/api/warranty/registrations", form, owner)).status,
      200,
      "A retry returns the saved registration even after temporary uploads are consumed",
    );
    const detail = (
      await (
        await request("/api/admin/warranties/" + result.id, undefined, admin)
      ).json()
    ).registration;
    assert.deepEqual(detail.sitePhotos, photos);
    assert.equal(
      (
        await (
          await request(
            "/api/admin/warranties?search=Building%20final",
            undefined,
            admin,
          )
        ).json()
      ).total,
      1,
    );
    const photoUrl =
      "/api/admin/warranties/" + result.id + "/site-photos/" + photos[0].id;
    assert.equal((await request(photoUrl)).status, 401);
    const privateImage = await request(photoUrl, undefined, admin);
    assert.equal(privateImage.status, 200);
    assert.equal(privateImage.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await privateImage.arrayBuffer()), png);
    assert.match(
      (await request(photoUrl + "?download=1", undefined, admin)).headers.get(
        "content-disposition",
      ),
      /attachment/,
    );
    assert.equal(
      (
        await request(
          "/api/admin/warranties/" + result.id + "/site-photos/" + foreign.id,
          undefined,
          admin,
        )
      ).status,
      404,
    );
    assert.equal(
      (await request("/warranty-site-photos/" + photos[0].id + ".png")).status,
      404,
    );
    assert.equal(
      (
        await stat(
          path.join(dir, "warranty-site-photos", photos[0].id + ".png"),
        )
      ).mode & 0o777,
      0o600,
    );
    assert.ok(
      !(await (await request("/api/content")).text()).includes(photos[0].id),
    );
    const before = JSON.parse(
      await readFile(path.join(dir, "warranties.json"), "utf8"),
    );
    const pending = JSON.parse(
      await readFile(path.join(dir, "warranty-site-uploads.json"), "utf8"),
    );
    pending[foreign.id].until = Date.now() - 1;
    pending[photos[0].id] = {
      photo: photos[0],
      session: "expired",
      until: Date.now() - 1,
    };
    await writeFile(
      path.join(dir, "warranty-site-uploads.json"),
      JSON.stringify(pending),
    );
    assert.equal(
      (
        await request(
          "/api/warranty/site-photos",
          { data: imageData, name: "Cleanup trigger.png" },
          other,
        )
      ).status,
      201,
    );
    await assert.rejects(
      stat(path.join(dir, "warranty-site-photos", foreign.id + ".png")),
      /ENOENT/,
    );
    assert.ok(
      (
        await stat(
          path.join(dir, "warranty-site-photos", photos[0].id + ".png"),
        )
      ).isFile(),
    );
    assert.deepEqual(
      JSON.parse(await readFile(path.join(dir, "warranties.json"), "utf8")),
      before,
    );
    await stop();
    await start();
    await login();
    assert.equal((await request(photoUrl, undefined, admin)).status, 200);
    assert.deepEqual(
      (
        await (
          await request("/api/admin/warranties/" + result.id, undefined, admin)
        ).json()
      ).registration.sitePhotos,
      photos,
    );
    assert.deepEqual(
      (await (await request("/api/admin/content", undefined, admin)).json())
        .certifications[0].categoryIds,
      [category],
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

/* Fresh schemas and one-time upgrades retain the 24-table permission boundary. */
for (const schema of ["public", "areva"])
  test(`building-photo and product-type SQL integrity in ${schema}`, async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;",
      );
      if (schema === "areva")
        await db.exec("CREATE SCHEMA areva;SET search_path=areva,pg_catalog;");
      await db.exec(await readFile("database/schema.sql", "utf8"));
      const photo = {
        id: crypto.randomUUID(),
        name: "Building.png",
        mime: "image/png",
        bytes: png.length,
      };
      assert.equal(
        (
          await db.query(
            `SELECT ${schema}.valid_warranty_site_photos($1::jsonb) AS valid`,
            [JSON.stringify([photo])],
          )
        ).rows[0].valid,
        true,
      );
      for (const value of [
        {},
        [photo, photo],
        [null],
        [1],
        ["not an object"],
        [{ ...photo, mime: "text/html" }],
        [{ ...photo, bytes: 1 }],
        [{ ...photo, path: "/etc/passwd" }],
        [{}],
        Array.from({ length: 6 }, () => ({
          ...photo,
          id: crypto.randomUUID(),
        })),
      ])
        assert.equal(
          (
            await db.query(
              `SELECT ${schema}.valid_warranty_site_photos($1::jsonb) AS valid`,
              [JSON.stringify(value)],
            )
          ).rows[0].valid,
          false,
        );
      await db.exec(
        `INSERT INTO ${schema}.certifications(id,title,description,document_type,category_ids) VALUES ('terms','Terms','Published file description','warranty',ARRAY['interior']::varchar(100)[]);`,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${schema}.certifications SET category_ids=ARRAY['unknown']::varchar(100)[]`,
        ),
        /check constraint/,
      );
      await db.exec(
        `ALTER TABLE ${schema}.certifications DROP COLUMN category_ids;ALTER TABLE ${schema}.warranty_registrations DROP COLUMN site_photos;DROP FUNCTION ${schema}.valid_warranty_site_photos(jsonb);`,
      );
      const before = (
        await db.query(`SELECT id,title FROM ${schema}.certifications`)
      ).rows;
      const migration = await readFile(
        "database/migrations/013-building-photos-and-product-terms.sql",
        "utf8",
      );
      await db.exec(migration);
      assert.deepEqual(
        (await db.query(`SELECT id,title FROM ${schema}.certifications`)).rows,
        before,
      );
      assert.deepEqual(
        (await db.query(`SELECT category_ids FROM ${schema}.certifications`))
          .rows[0].category_ids,
        [],
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relrowsecurity",
            [schema],
          )
        ).rows[0].count,
        24,
      );
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.exec(`SET ROLE ${role}`);
        await assert.rejects(
          db.exec(`SELECT * FROM ${schema}.warranty_registrations`),
          /permission denied/,
        );
        await db.exec("RESET ROLE");
      }
      await assert.rejects(db.exec(migration), /already exists/);
      await db.exec("ROLLBACK");
    } finally {
      await db.close();
    }
  });

/* Regression coverage for document validation, publication and attachments.
 * Fixtures use disposable local stores/databases; hosted customer records are not changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";

test("document cards validate, exclude hidden cards, preserve older clients and record activity", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-documents-"));
  const port = await new Promise((resolve) => {
    const listener = net.createServer();
    listener.listen(0, "127.0.0.1", () => {
      const port = listener.address().port;
      listener.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let server,
    cookie = "",
    logs = "";
  async function start() {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        TRUST_PROXY_HOPS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (data) => (logs += data));
    server.stderr.on("data", (data) => (logs += data));
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Server did not start: " + logs);
  }
  async function stop() {
    if (server?.exitCode === null) {
      const done = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await done;
    }
  }
  const request = (route, body, auth = true, method = "PUT", headers = {}) =>
    fetch(base + route, {
      method: body === undefined ? "GET" : method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request(
      "/api/admin/login",
      { username: "admin", password },
      false,
      "POST",
    );
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
  }
  async function save(content) {
    const response = await request("/api/admin/content", content);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  const pdf = Buffer.from("%PDF-1.4\nDocument upload test\n%%EOF");
  try {
    await start();
    assert.equal(
      (await request("/api/admin/pdf-upload", {}, false, "POST")).status,
      401,
    );
    await login();
    let content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.certifications, []);
    content = await save(content);
    const oldFile = JSON.parse(
      await readFile(path.join(dir, "content.json"), "utf8"),
    );
    delete oldFile.certifications;
    await writeFile(path.join(dir, "content.json"), JSON.stringify(oldFile));
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(
      content.certifications,
      [],
      "Existing content starts with an empty section",
    );
    assert.equal(
      (
        await request(
          "/api/admin/pdf-upload",
          {
            data:
              "data:application/pdf;base64," +
              Buffer.from("Fake PDF not a document").toString("base64"),
          },
          true,
          "POST",
        )
      ).status,
      400,
    );
    const uploaded = await request(
      "/api/admin/pdf-upload",
      {
        data: "data:application/pdf;base64," + pdf.toString("base64"),
        section: "certifications",
        originalName: "Product report.pdf",
      },
      true,
      "POST",
    );
    assert.equal(uploaded.status, 201);
    const url = (await uploaded.json()).url;
    const file = await request(url, undefined, false);
    assert.match(file.headers.get("content-disposition"), /attachment/);
    assert.match(file.headers.get("content-security-policy"), /sandbox/);
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
    const card = {
      id: crypto.randomUUID(),
      title: "Test report <script>alert(1)</script>",
      description: "Published test data & specifications",
      type: "test_report",
      label: "Per product",
      issuer: "Example lab",
      reference: "TEST-REF-42",
      issuedOn: "2026-01-01",
      validUntil: "2027-01-01",
      productIds: [content.products[0].id],
      attachments: [{ id: crypto.randomUUID(), label: "Report download", url }],
      published: true,
      createdAt: "1900-01-01",
      updatedAt: "1900-01-01",
      forged: "must not persist",
    };
    const hidden = {
      ...card,
      id: crypto.randomUUID(),
      title: "UNPUBLISHED-DOCUMENT-DRAFT",
      attachments: [],
      published: false,
    };
    content = await save({ ...content, certifications: [card, hidden] });
    const created = content.certifications[0];
    assert.notEqual(created.createdAt, "1900-01-01");
    assert.equal(created.forged, undefined);
    assert.equal(content.certifications.length, 2);
    let published = await (
      await request("/api/content", undefined, false)
    ).json();
    assert.deepEqual(published.certifications, [created]);
    const html = await (
      await request(
        "/assets/aistudio/areva-paints_a2364c60.html",
        undefined,
        false,
      )
    ).text();
    assert.match(html, /Test report &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.ok(!html.includes("UNPUBLISHED-DOCUMENT-DRAFT"));
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.match(html, /cd-product-documents/);
    assert.match(html, /Report download/);
    content = await save({
      ...content,
      certifications: content.certifications.map((item) => ({
        ...item,
        createdAt: "forged",
        updatedAt: "forged",
      })),
    });
    assert.deepEqual(
      content.certifications[0],
      created,
      "Unchanged saves retain server timestamps",
    );
    const olderClient = structuredClone(content);
    delete olderClient.certifications;
    content = await save(olderClient);
    assert.equal(
      content.certifications.length,
      2,
      "An older client cannot erase documents by omission",
    );
    for (const invalid of [
      null,
      {},
      [created, created],
      [{ ...created, title: " " }],
      [{ ...created, description: "" }],
      [{ ...created, type: "invented" }],
      [{ ...created, published: "true" }],
      [{ ...created, issuedOn: "2026-02-30" }],
      [{ ...created, validUntil: "2025-01-01" }],
      [{ ...created, productIds: ["missing-product"] }],
      [
        {
          ...created,
          productIds: [created.productIds[0], created.productIds[0]],
        },
      ],
      [{ ...created, attachments: [] }],
      [
        {
          ...created,
          attachments: [
            { ...created.attachments[0], url: "javascript:alert(1)" },
          ],
        },
      ],
      [
        {
          ...created,
          attachments: [
            {
              ...created.attachments[0],
              url: "/uploads/" + crypto.randomUUID() + ".pdf",
            },
          ],
        },
      ],
      [
        {
          ...created,
          attachments: Array.from({ length: 6 }, () => ({
            ...created.attachments[0],
            id: crypto.randomUUID(),
          })),
        },
      ],
      [created, { ...created, id: crypto.randomUUID() }],
    ])
      assert.equal(
        (
          await request("/api/admin/content", {
            ...content,
            certifications: invalid,
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request("/api/admin/content", content, true, "PUT", {
          Origin: "https://untrusted.example",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/admin/content", {
          ...content,
          revision: content.revision - 1,
        })
      ).status,
      409,
    );
    content = await save({
      ...content,
      certifications: [...content.certifications].reverse(),
    });
    content = await save({
      ...content,
      certifications: content.certifications.map((item) =>
        item.id === created.id
          ? { ...item, description: "Updated card", published: false }
          : item,
      ),
    });
    assert.notEqual(
      content.certifications.find((item) => item.id === created.id).updatedAt,
      created.updatedAt,
    );
    assert.deepEqual(
      (await (await request("/api/content", undefined, false)).json())
        .certifications,
      [],
    );
    content = await save({
      ...content,
      certifications: content.certifications.map((item) =>
        item.id === created.id ? { ...item, published: true } : item,
      ),
      products: content.products.filter(
        (product) => product.id !== created.productIds[0],
      ),
    });
    assert.deepEqual(
      content.certifications.find((item) => item.id === created.id).productIds,
      [],
      "Removing a product clears its association without losing the card",
    );
    const history = await (
      await request("/api/admin/history?tab=certifications")
    ).json();
    for (const action of ["uploaded", "created", "updated", "reordered"])
      assert.ok(
        history.events.some(
          (event) =>
            event.action === action && event.section === "certifications",
        ),
        action,
      );
    const stored = structuredClone(content.certifications);
    await stop();
    await start();
    await login();
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.certifications, stored);
    content = await save({ ...content, certifications: [] });
    assert.deepEqual(
      (await (await request("/api/content", undefined, false)).json())
        .certifications,
      [],
    );
    assert.ok(
      (
        await (
          await request("/api/admin/history?tab=certifications&action=deleted")
        ).json()
      ).total > 0,
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("document table upgrade protects both schemas, bounds attachments and preserves existing data", async () => {
  const schema = await readFile("database/schema.sql", "utf8"),
    setup = await readFile("database/supabase-setup.sql", "utf8"),
    migration = await readFile(
      "database/migrations/009-certifications-and-documents.sql",
      "utf8",
    );
  for (const name of ["public", "areva"]) {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;",
      );
      await db.exec(name === "public" ? schema : setup);
      await db.exec(
        `SET search_path=${name},pg_catalog; DROP TABLE certification_products, certification_attachments, certifications;`,
      );
      await db.exec(migration);
      await db.exec(
        "INSERT INTO certifications(id,title,description,document_type) VALUES ('test-doc','Test document','Document description','tds')",
      );
      await db.exec(
        "INSERT INTO certification_attachments(id,certification_id,label,pdf_url,position) VALUES ('test-file','test-doc','Data sheet','/uploads/11111111-1111-4111-8111-111111111111.pdf',0)",
      );
      await assert.rejects(
        db.exec(
          "UPDATE certifications SET issued_on='2026-01-01',valid_until='2025-01-01' WHERE id='test-doc'",
        ),
        /check constraint/,
      );
      await assert.rejects(
        db.exec("UPDATE certification_attachments SET position=5"),
        /check constraint/,
      );
      for (const table of [
        "certifications",
        "certification_attachments",
        "certification_products",
      ]) {
        const result = await db.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass",
          [name + "." + table],
        );
        assert.equal(result.rows[0].relrowsecurity, true);
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal(
            (
              await db.query(
                "SELECT has_table_privilege($1,$2,'SELECT') AS allowed",
                [role, name + "." + table],
              )
            ).rows[0].allowed,
            false,
          );
      }
      await db.exec(
        "INSERT INTO activity_events(id,actor,action,section,label) VALUES ('test-event','admin','created','certifications','Document created')",
      );
      assert.equal(
        (await db.query("SELECT revision FROM site_state WHERE id=1")).rows[0]
          .revision,
        0,
      );
      await db.exec("DELETE FROM certifications WHERE id='test-doc'");
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM certification_attachments",
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(db.exec(migration), /already exists/);
      await db.exec("ROLLBACK");
    } finally {
      await db.close();
    }
  }
});

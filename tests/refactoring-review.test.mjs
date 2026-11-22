/* Concrete regressions found in the 22 November review: rewrite collisions,
 * symlinked storage, failed upload commits and private filesystem error messages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import vm from "node:vm";
import { testServer } from "./helpers/server.mjs";
import { assertPrivateDataDirectory } from "../src/server/private-data-directory.ts";
import { writePrivateUpload } from "../src/server/storage.ts";
import { uploadBudgetBytes } from "../src/server/upload-files.ts";

test("development file serving excludes a private data directory inside the project", async () => {
  const server = await testServer();
  const name = "review-private-" + crypto.randomUUID();
  const directory = path.resolve(name);
  try {
    await server.start([], {
      NODE_ENV: "development",
      CONTENT_DATA_DIR: directory,
      DISABLE_HMR: "true",
    });
    await server.login();
    const secret = "Private fixture " + crypto.randomUUID();
    fs.writeFileSync(
      path.join(directory, "customer.json"),
      JSON.stringify({ secret }),
    );
    for (const route of [
      "/" + name + "/customer.json",
      "/@fs" + directory + "/customer.json",
    ]) {
      const response = await server.request(route, undefined, "GET", false);
      assert.ok([403, 404].includes(response.status));
      assert.equal((await response.text()).includes(secret), false);
    }
    assert.equal(
      (await server.request("/src/main.tsx", undefined, "GET", false)).status,
      200,
      "Ordinary development sources still load",
    );
  } finally {
    await server.dispose();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("private storage resolves symlinked ancestors and rejects public upload aliases", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "areva-directory-review-"),
  );
  try {
    const application = path.join(root, "app"),
      privateDirectory = path.join(root, "private");
    fs.mkdirSync(path.join(application, "public"), { recursive: true });
    fs.mkdirSync(privateDirectory);
    assert.doesNotThrow(() =>
      assertPrivateDataDirectory(privateDirectory, application),
    );
    assert.doesNotThrow(() =>
      assertPrivateDataDirectory(
        path.join(root, "future", "private"),
        application,
      ),
    );
    fs.symlinkSync(privateDirectory, path.join(root, "private-alias"));
    assert.doesNotThrow(() =>
      assertPrivateDataDirectory(
        path.join(root, "private-alias", "new"),
        application,
      ),
    );
    for (const folder of ["public", "dist", "src"]) {
      assert.throws(
        () =>
          assertPrivateDataDirectory(
            path.join(application, folder, "future"),
            application,
          ),
        /outside public/,
      );
      fs.symlinkSync(
        path.join(application, folder, "future"),
        path.join(root, "alias-" + folder),
      );
      assert.throws(
        () =>
          assertPrivateDataDirectory(
            path.join(root, "alias-" + folder, "new"),
            application,
          ),
        /outside public/,
        "Dangling aliases to future public folders are rejected",
      );
    }
    fs.symlinkSync(
      path.join(privateDirectory, "warranty-receipts"),
      path.join(privateDirectory, "uploads"),
    );
    assert.throws(
      () => assertPrivateDataDirectory(privateDirectory, application),
      /Public upload storage/,
    );
    fs.unlinkSync(path.join(privateDirectory, "uploads"));
    const file = path.join(root, "not-a-directory");
    fs.writeFileSync(file, "data");
    assert.throws(
      () => assertPrivateDataDirectory(file, application),
      /must name a private directory/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("attachment persistence cleans failed commits and never deletes an existing file", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "areva-attachment-review-"),
  );
  const file = path.join(root, "private", "attachment.pdf");
  try {
    assert.throws(
      () =>
        writePrivateUpload(file, Buffer.from("new document"), () => {
          throw Error("Metadata save failed");
        }),
      /Metadata save failed/,
    );
    assert.equal(fs.existsSync(file), false);
    let committed = false;
    writePrivateUpload(file, Buffer.from("saved document"), () => {
      committed = true;
    });
    assert.equal(committed, true);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.throws(
      () => writePrivateUpload(file, Buffer.from("replacement"), () => {}),
      { code: "EEXIST" },
    );
    assert.equal(fs.readFileSync(file, "utf8"), "saved document");
    const link = path.join(root, "alias.pdf");
    fs.symlinkSync(file, link);
    assert.throws(
      () => writePrivateUpload(link, Buffer.from("replacement"), () => {}),
      { code: "EEXIST" },
    );
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
    for (const invalid of [undefined, "", "-1", "NaN", "Infinity", "1e308"])
      assert.equal(uploadBudgetBytes(invalid, 128), 128 * 1024 * 1024);
    assert.equal(uploadBudgetBytes("0.5", 128), 512 * 1024);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CMS text cannot collide with HTML/JavaScript template rewrite anchors", async () => {
  const server = await testServer();
  try {
    await server.start();
    await server.login();
    const content = await (await server.request("/api/admin/content")).json();
    const uploaded = await server.request("/api/admin/pdf-upload", {
      data:
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nReview fixture\n%%EOF").toString("base64"),
    });
    assert.equal(uploaded.status, 201);
    const productName = "Paint cur=i; const p=P[i], c=cats[p[1]];";
    content.products[0].name = productName;
    content.products[0].description =
      "Description const $ = and function renderGrid(){\n}";
    content.colours[0].name = "Shade function drawSw(){";
    content.certifications = [
      {
        id: "anchors",
        type: "warranty",
        title: "Report const $ =",
        label: "const ST=[",
        description:
          "Quotes $& $` $' and markup <script>alert(1)</script> remain text.",
        issuer: "",
        reference: "",
        issuedOn: "",
        validUntil: "",
        productIds: [content.products[0].id],
        categoryIds: [],
        published: true,
        attachments: [
          {
            id: "file",
            label: "Terms const $ =",
            url: (await uploaded.json()).url,
          },
        ],
        createdAt: "",
        updatedAt: "",
      },
    ];
    content.galleryReviews = [
      {
        id: "review-anchors",
        name: "Review const $ =",
        detail: "",
        text: "const save=()=> is a literal review, not an application instruction.",
        image: "",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const saved = await server.request("/api/admin/content", content, "PUT");
    assert.equal(saved.status, 200, await saved.clone().text());
    const response = await server.request("/attached-page");
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes("<h3>Report const $ =</h3>"));
    assert.equal(html.includes("<!--AREVA_SLOT_"), false);
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(
        (match) => !/\bsrc=|application\/(?:json|ld\+json)/.test(match[1]),
      )
      .map((match) => match[2]);
    for (const script of scripts) new vm.Script(script);
    const code = scripts.join("\n");
    assert.ok(code.includes("P.splice(0,P.length"));
    assert.ok(code.includes("const REFERENCE_PRODUCT_HEADER_HTML="));
    assert.ok(code.includes("window.arevaProductCategories="));
    assert.ok(code.includes(productName));
    assert.ok(html.includes("HOME / CERTIFICATIONS AND DOCUMENTS"));
  } finally {
    await server.dispose();
  }
});

test("storage failures return generic server errors and public media excludes arbitrary files and symlinks", async () => {
  const server = await testServer();
  try {
    const flag = path.join(server.directory, "fail-writes");
    const injection = path.join(server.directory, "write-failure.mjs");
    fs.writeFileSync(
      injection,
      `import fs from 'node:fs'; const original = fs.openSync; fs.openSync = function(file, flags, ...args) { if (flags === 'wx' && String(file).endsWith('.tmp') && fs.existsSync(${JSON.stringify(flag)})) throw new Error('EACCES: /srv/private/customer-secrets/content.json'); return original.call(this, file, flags, ...args); };`,
    );
    await server.start([injection]);
    await server.login();
    const content = await (await server.request("/api/admin/content")).json();
    const invalid = structuredClone(content);
    invalid.products[0].name = "";
    const invalidResponse = await server.request(
      "/api/admin/content",
      invalid,
      "PUT",
    );
    assert.equal(invalidResponse.status, 400);
    assert.match((await invalidResponse.json()).error, /Products need/);
    const raw = fs.readFileSync(
      path.join(server.directory, "content.json"),
      "utf8",
    );
    fs.writeFileSync(flag, "fail");
    const failed = await server.request("/api/admin/content", content, "PUT");
    assert.equal(failed.status, 500);
    assert.equal((await failed.text()).includes("customer-secrets"), false);
    assert.equal(
      fs.readFileSync(path.join(server.directory, "content.json"), "utf8"),
      raw,
    );
    const pdfResponse = await server.request("/api/admin/pdf-upload", {
      data:
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nReview fixture\n%%EOF").toString("base64"),
    });
    assert.equal(pdfResponse.status, 500);
    const directory = path.join(server.directory, "uploads");
    assert.deepEqual(
      fs.readdirSync(directory),
      [],
      "Failed audit commits remove the newly uploaded file",
    );
    fs.unlinkSync(flag);
    const validUpload = await server.request("/api/admin/pdf-upload", {
      data:
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nReview fixture\n%%EOF").toString("base64"),
    });
    assert.equal(validUpload.status, 201);
    const url = (await validUpload.json()).url;
    assert.equal(
      (await server.request(url, undefined, "GET", false)).status,
      200,
    );
    fs.writeFileSync(path.join(directory, "backup.json"), raw);
    assert.equal(
      (await server.request("/uploads/backup.json", undefined, "GET", false))
        .status,
      404,
    );
    const name = crypto.randomUUID() + ".png";
    fs.symlinkSync(
      path.join(server.directory, "content.json"),
      path.join(directory, name),
    );
    assert.equal(
      (await server.request("/uploads/" + name, undefined, "GET", false))
        .status,
      404,
    );
    const mixedCase = await server.request("/API/ADMIN/content");
    assert.equal(mixedCase.status, 200);
    assert.equal(mixedCase.headers.get("x-frame-options"), "DENY");
    assert.match(
      mixedCase.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
  } finally {
    await server.dispose();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { rateLimit } from "../src/server/security.ts";
import { escapeMarkup } from "../src/data/safeMarkup.ts";

const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });

test("security boundaries, validation, private persistence, quotas and production login", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-security-"));
  const port = await freePort(),
    base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let server,
    logs = "",
    cookie = "";
  async function start(extra = {}) {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        ADMIN_TEST_LOGIN: "false",
        TRUST_PROXY_HOPS: "0",
        UPLOAD_STORAGE_MB: "0.0001",
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
    throw Error("Server startup timed out");
  }
  async function stop() {
    if (server?.exitCode === null) {
      const done = new Promise((r) => server.once("exit", r));
      server.kill();
      await done;
    }
  }
  const req = (url, method = "GET", body, headers = {}) =>
    fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    await start();
    for (const url of [
      "/api/project/source-files",
      "/api/project/download",
      "/api/project/info",
      "/areva-paints-code.zip",
      "/areva-paints-fullstack.zip",
      "/assets/aistudio/areva-paints-website_e598fb28.zip",
      "/areva-paints-code.z%69p",
      "/api/enquiries",
    ])
      assert.equal((await req(url)).status, 401, url);
    assert.equal(
      (await req("/api/admin/upload", "POST", { data: "x".repeat(100000) }))
        .status,
      401,
      "Authenticate before parsing upload bodies",
    );
    const health = await req("/api/health");
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      health.headers.get("content-security-policy"),
      /object-src 'none'/,
    );
    const adminPage = await req("/admin");
    assert.equal(adminPage.headers.get("x-frame-options"), "DENY");
    assert.match(
      adminPage.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    assert.equal(adminPage.headers.get("cache-control"), "no-store");
    const htmlResponse = await req("/attached-page"),
      html = await htmlResponse.text();
    const nonce = htmlResponse.headers
      .get("content-security-policy")
      .match(/'nonce-([^']+)'/)[1];
    assert.ok(html.includes(`<script nonce="${nonce}">`));
    assert.equal(
      (
        await req("/api/content", "GET", undefined, {
          Origin: "https://foreign.example",
        })
      ).headers.get("access-control-allow-origin"),
      null,
    );
    assert.equal(
      (
        await req("/api/content", "GET", undefined, {
          Origin: "https://areva-paint-new.onrender.com",
        })
      ).headers.get("access-control-allow-origin"),
      "https://areva-paint-new.onrender.com",
    );
    assert.equal(
      (
        await req(
          "/api/admin/login",
          "POST",
          { password },
          { Origin: "https://areva-paint-new.onrender.com" },
        )
      ).status,
      403,
      "Public CORS origin cannot write admin APIs",
    );
    assert.equal(
      (
        await req(
          "/api/admin/login",
          "POST",
          { password },
          { "Sec-Fetch-Site": "cross-site" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await req(
          "/api/admin/login",
          "POST",
          { password },
          { "Content-Type": "text/plain" },
        )
      ).status,
      415,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"bad"',
        })
      ).status,
      400,
    );
    assert.equal(
      (await req("/api/auth/login", "POST", { username: "x".repeat(70000) }))
        .status,
      413,
    );
    assert.equal((await req("/api/dealers?state[x]=bad")).status, 400);
    assert.equal((await req("/api/no-such-route")).status, 404);
    for (const body of [
      null,
      [],
      { length: -1 },
      { length: {}, width: 2, height: 3, productId: "x" },
      { length: 1e309, width: 2, height: 3, productId: "x" },
      { length: 1, width: 2, height: 3, coats: 0, productId: "x" },
    ])
      assert.equal(
        (await req("/api/calculator/estimate", "POST", body)).status,
        400,
      );
    assert.equal(
      (
        await req("/api/calculator/estimate", "POST", {
          length: 10,
          width: 12,
          height: 9,
          productId: "unknown-product",
        })
      ).status,
      404,
    );
    const login = await req("/api/admin/login", "POST", { password });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await req("/api/project/source-files")).status, 200);
    assert.equal(
      (await req("/api/project/download")).headers.get("cache-control"),
      "no-store",
    );
    const upload = await req("/api/admin/upload", "POST", {
      data:
        "data:image/png;base64," +
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          Buffer.alloc(1000),
        ]).toString("base64"),
    });
    assert.equal(
      upload.status,
      507,
      "Shared upload quota applies before writing",
    );
    const content = await (await req("/api/content")).json();
    for (const image of [
      "javascript:alert(1)",
      "//foreign.example/image.png",
      "/\\foreign.example/image.png",
      "https://user:password@foreign.example/image.png",
    ])
      assert.equal(
        (
          await req("/api/admin/content", "PUT", {
            ...content,
            products: content.products.map((p, i) => (i ? p : { ...p, image })),
          })
        ).status,
        400,
        image,
      );
    for (const body of [
      { fullName: {}, phone: "9000000000" },
      { fullName: "Test", phone: "invalid" },
      { fullName: "Test", phone: "9000000000", message: "x".repeat(3001) },
    ])
      assert.equal((await req("/api/enquiries", "POST", body)).status, 400);
    const created = await req("/api/enquiries", "POST", {
      fullName: "PRIVATE_ENQUIRY_MARKER",
      phone: "9000000000",
      city: "Bengaluru",
      message: "Please call me.",
    });
    assert.equal(created.status, 201);
    const ticket = (await created.json()).ticketId;
    assert.match(ticket, /^ARV-REQ-[a-f0-9-]{36}$/);
    assert.equal(
      (
        await req("/api/enquiries", "POST", {
          fullName: "Second enquiry",
          phone: "9000000001",
        })
      ).status,
      201,
    );
    const limited = await req("/api/enquiries", "POST", {
      fullName: "Third enquiry",
      phone: "9000000002",
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    const rows = (await (await req("/api/enquiries")).json()).enquiries;
    assert.equal(rows.length, 2);
    const disk = JSON.parse(
      await readFile(path.join(dir, "enquiries.json"), "utf8"),
    );
    assert.equal(disk[1].id, ticket);
    assert.equal(
      (await stat(path.join(dir, "enquiries.json"))).mode & 0o777,
      0o600,
    );
    assert.ok(
      !(await (await req("/api/content")).text()).includes(
        "PRIVATE_ENQUIRY_MARKER",
      ),
    );
    await stop();
    await start();
    assert.equal(
      (await req("/api/enquiries")).status,
      401,
      "Restart expires sessions",
    );
    const restored = await req("/api/admin/login", "POST", { password });
    cookie = restored.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await (await req("/api/enquiries")).json()).enquiries.length,
      2,
      "Enquiries survive restart",
    );
    await req("/api/admin/logout", "POST", {});
    assert.equal(
      (await req("/api/project/source-files")).status,
      401,
      "Source authorization revoked by logout",
    );
    for (let i = 0; i < 8; i++)
      assert.equal(
        (await req("/api/admin/login", "POST", { password: "wrong" })).status,
        401,
      );
    const blocked = await req("/api/admin/login", "POST", {
      password: "wrong",
    });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    await stop();
    await start({ ADMIN_PASSWORD: "", ADMIN_TEST_LOGIN: "true" });
    assert.equal(
      (await req("/api/admin/login", "POST", { password: "ArevaTest2026!" }))
        .status,
      503,
      "Known testing password is never enabled in production",
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("rate limiter expires bounded windows and fails closed at capacity", () => {
  const original = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const limit = rateLimit(1, 1000, 1);
    const run = (ip) => {
      let result = "allowed";
      const res = {
        setHeader() {},
        status(code) {
          result = code;
          return this;
        },
        json() {
          return this;
        },
      };
      limit({ ip }, res, () => {});
      return result;
    };
    assert.equal(run("a"), "allowed");
    assert.equal(run("a"), 429);
    assert.equal(run("b"), 429);
    now = 2001;
    assert.equal(run("b"), "allowed");
  } finally {
    Date.now = original;
  }
  assert.equal(
    escapeMarkup('<img src=x onerror="bad()"> &'),
    "&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp;",
  );
});

test("source packaging stays outside public and excludes hidden files, ZIPs and symlinks", async () => {
  const { writeFile, mkdir, symlink, readdir } =
    await import("node:fs/promises");
  const { default: JSZip } = await import("jszip");
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-private-package-"));
  try {
    await mkdir(path.join(dir, "public"));
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "package.json"), "{}");
    await writeFile(
      path.join(dir, "src", "main.ts"),
      "export const safe = true;",
    );
    await writeFile(path.join(dir, "public", "image.png"), "public fixture");
    await writeFile(path.join(dir, "public", ".env"), "PRIVATE_TEST_SECRET");
    await writeFile(path.join(dir, "private.env"), "PRIVATE_TEST_SECRET");
    await writeFile(path.join(dir, "public", "old.zip"), "OLD_SOURCE_ZIP");
    await symlink(
      path.join(dir, "private.env"),
      path.join(dir, "public", "linked.txt"),
    );
    const child = spawn(
      process.execPath,
      [path.resolve("scripts/pack_windows_zip.cjs")],
      { cwd: dir, stdio: ["ignore", "ignore", "pipe"] },
    );
    let errors = "";
    child.stderr.on("data", (data) => (errors += data));
    assert.equal(
      await new Promise((resolve) => child.once("exit", resolve)),
      0,
      errors,
    );
    for (const name of [
      "areva-paints-code.zip",
      "areva-paints-fullstack.zip",
    ]) {
      const zip = await JSZip.loadAsync(
        await readFile(path.join(dir, "artifacts", "source", name)),
      );
      assert.ok(zip.file("src/main.ts"));
      assert.ok(zip.file("public/image.png"));
      assert.equal(zip.file("public/.env"), null);
      assert.equal(zip.file("public/linked.txt"), null);
      assert.equal(zip.file("public/old.zip"), null);
    }
    assert.deepEqual(
      (await readdir(path.join(dir, "public"))).filter((name) =>
        name.startsWith("areva-paints"),
      ),
      [],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

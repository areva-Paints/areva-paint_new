import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";

test("gallery reviews validate, publish safely, preserve dates, survive older clients and record history", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-reviews-test-"));
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let child,
    cookie = "",
    logs = "";
  async function start() {
    child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        CONTENT_DATA_DIR: dir,
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        TRUST_PROXY_HOPS: "0",
        RENDER: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => (logs += chunk));
    child.stderr.on("data", (chunk) => (logs += chunk));
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (child.exitCode !== null) throw Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Server startup timeout " + logs);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const done = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await done;
    }
  }
  const request = (route, method = "GET", body, auth = true) =>
    fetch(base + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function login() {
    const response = await request("/api/admin/login", "POST", {
      username: "admin",
      password,
    });
    assert.equal(response.status, 200);
    cookie = response.headers.get("set-cookie").split(";")[0];
  }
  async function save(content) {
    const response = await request("/api/admin/content", "PUT", content);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  }
  try {
    await start();
    await login();
    let content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.galleryReviews, []);
    assert.equal(
      (await request("/api/admin/content", "PUT", content, false)).status,
      401,
    );
    content = await save(content);
    const oldFile = JSON.parse(
      await readFile(path.join(dir, "content.json"), "utf8"),
    );
    delete oldFile.galleryReviews;
    await writeFile(path.join(dir, "content.json"), JSON.stringify(oldFile));
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.galleryReviews, []);
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";
    const upload = await request("/api/admin/upload", "POST", {
      data: "data:image/png;base64," + png,
      originalName: "review.png",
      section: "galleryReviews",
    });
    assert.equal(upload.status, 201);
    const image = (await upload.json()).url;
    const review = {
      id: "review-one",
      name: "Reviewer <script> & name",
      detail: "Bengaluru",
      text: "Beautiful finish.\nLiteral <img src=x onerror=alert(1)> & $&",
      image,
      createdAt: "2000-01-01",
      updatedAt: "2000-01-01",
    };
    content = await save({ ...content, galleryReviews: [review] });
    const created = content.galleryReviews[0].createdAt,
      updated = content.galleryReviews[0].updatedAt;
    assert.notEqual(created, review.createdAt);
    const publicContent = await (await request("/api/content")).json();
    assert.deepEqual(publicContent.galleryReviews, content.galleryReviews);
    assert.equal(publicContent.adminHistory, undefined);
    const html = await (await request("/attached-page#gallery")).text();
    assert.ok(html.includes('data-ga-tab="reviews"'));
    assert.ok(html.includes("Reviewer &lt;script&gt; &amp; name"));
    assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
    assert.ok(html.includes("Literal &lt;img"));
    assert.ok(html.includes(image));
    content = await save({
      ...content,
      galleryReviews: content.galleryReviews.map((row) => ({
        ...row,
        createdAt: "1999-01-01",
        updatedAt: "2099-01-01",
      })),
    });
    assert.equal(content.galleryReviews[0].createdAt, created);
    assert.equal(content.galleryReviews[0].updatedAt, updated);
    for (const list of [
      null,
      {},
      Array.from({ length: 101 }, (_, i) => ({ ...review, id: String(i) })),
      [review, review],
      [{ ...review, name: " " }],
      [{ ...review, text: "" }],
      [{ ...review, text: "x".repeat(2001) }],
      [{ ...review, detail: "x".repeat(201) }],
      [{ ...review, image: "javascript:alert(1)" }],
      [
        {
          ...review,
          image: "/uploads/ffffffff-ffff-ffff-ffff-ffffffffffff.png",
        },
      ],
    ]) {
      if (list === null) continue; // Older clients may omit the entire section.
      assert.equal(
        (
          await request("/api/admin/content", "PUT", {
            ...content,
            galleryReviews: list,
          })
        ).status,
        400,
      );
    }
    const second = {
      ...review,
      id: "text-only",
      name: "Text reviewer",
      text: "A text-only experience.",
      detail: "",
      image: "",
    };
    content = await save({
      ...content,
      galleryReviews: [...content.galleryReviews, second],
    });
    const unchanged = structuredClone(content.galleryReviews);
    const olderClient = structuredClone(content);
    delete olderClient.galleryReviews;
    content = await save(olderClient);
    assert.deepEqual(content.galleryReviews, unchanged);
    await new Promise((resolve) => setTimeout(resolve, 10));
    content = await save({
      ...content,
      galleryReviews: content.galleryReviews.map((row) =>
        row.id === "review-one" ? { ...row, text: "Updated experience" } : row,
      ),
    });
    assert.equal(content.galleryReviews[0].createdAt, created);
    assert.notEqual(content.galleryReviews[0].updatedAt, updated);
    const history = await (
      await request("/api/admin/history?tab=gallery&section=galleryReviews")
    ).json();
    for (const action of ["uploaded", "created", "updated"])
      assert.ok(history.events.some((event) => event.action === action));
    assert.ok(
      history.events.every((event) => event.section === "galleryReviews"),
    );
    const stored = structuredClone(content.galleryReviews);
    await stop();
    await start();
    await login();
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.galleryReviews, stored);
    content = await save({ ...content, galleryReviews: [] });
    assert.deepEqual(
      (await (await request("/api/content")).json()).galleryReviews,
      [],
    );
    assert.ok(
      (await (await request("/attached-page")).text()).includes(
        "No reviews yet",
      ),
    );
    assert.ok(
      (
        await (
          await request("/api/admin/history?section=galleryReviews")
        ).json()
      ).events.some((event) => event.action === "deleted"),
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

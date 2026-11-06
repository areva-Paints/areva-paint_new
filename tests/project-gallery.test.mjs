import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";

test("project gallery publishes real albums, validates photos, preserves timestamps and upgrades older clients", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-project-test-"));
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let server,
    logs = "",
    cookie = "";
  async function start() {
    server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: "production",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: password,
        CONTENT_DATA_DIR: dir,
        TRUST_PROXY_HOPS: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (b) => (logs += b));
    server.stderr.on("data", (b) => (logs += b));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (server.exitCode !== null) throw Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Server did not start: " + logs);
  }
  async function stop() {
    if (server && server.exitCode === null) {
      const done = new Promise((r) => server.once("exit", r));
      server.kill("SIGTERM");
      await done;
    }
  }
  async function req(url, method = "GET", body) {
    return fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function login() {
    const r = await req("/api/admin/login", "POST", {
      username: "admin",
      password,
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
  }
  async function save(content) {
    const r = await req("/api/admin/content", "PUT", content);
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  }
  try {
    await start();
    assert.equal((await req("/api/admin/content", "PUT", {})).status, 401);
    await login();
    let c = await (await req("/api/admin/content")).json();
    assert.deepEqual(c.galleryProjects, []);
    let html = await (
      await req("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
    assert.ok(html.includes('id="gallery"'));
    assert.ok(html.includes("New projects are on the way"));
    assert.ok(!html.includes("Inspiration gallery"));
    const up = await req("/api/admin/upload", "POST", {
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
    });
    assert.equal(up.status, 201);
    const image = (await up.json()).url;
    const project = {
      id: "first-project",
      title: "A </script> $& project",
      location: "Bengaluru",
      description: "Painted interior <script>bad()</script>",
      photos: [
        { id: "photo-one", image, caption: "Living area" },
        { id: "photo-two", image, caption: "Bedroom" },
      ],
      createdAt: "1900-01-01",
      updatedAt: "1900-01-01",
    };
    c = await save({ ...c, galleryProjects: [project] });
    const created = c.galleryProjects[0].createdAt,
      updated = c.galleryProjects[0].updatedAt;
    assert.ok(Date.parse(created) > Date.parse("2026-01-01"));
    assert.equal(created, updated);
    c = await save({
      ...c,
      products: c.products.map((p, i) =>
        i === 0 ? { ...p, tagline: p.tagline + " updated" } : p,
      ),
    });
    assert.equal(
      c.galleryProjects[0].updatedAt,
      updated,
      "Unrelated content saves must not reorder projects",
    );
    const second = {
      ...project,
      id: "second-project",
      title: "Newest project",
      photos: [{ id: "third-photo", image, caption: "" }],
    };
    c = await save({ ...c, galleryProjects: [...c.galleryProjects, second] });
    html = await (
      await req("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
    const json = JSON.parse(
      html.match(
        /<script type="application\/json" id="pg-project-data">([\s\S]*?)<\/script>/,
      )[1],
    );
    assert.equal(json[0].title, "Newest project");
    assert.equal(json[1].title, project.title);
    assert.equal(json[1].photos.length, 2);
    assert.ok(!html.includes("<script>bad()</script>"));
    assert.ok(html.includes('href="#gallery"'));
    for (const invalid of [
      { ...c, galleryProjects: [...c.galleryProjects, c.galleryProjects[0]] },
      { ...c, galleryProjects: [{ ...c.galleryProjects[0], photos: [] }] },
      { ...c, galleryProjects: [{ ...c.galleryProjects[0], title: "" }] },
      {
        ...c,
        galleryProjects: [
          {
            ...c.galleryProjects[0],
            photos: [{ id: "bad", image: "javascript:alert(1)", caption: "" }],
          },
        ],
      },
      {
        ...c,
        galleryProjects: [
          {
            ...c.galleryProjects[0],
            photos: [
              {
                id: "bad",
                image: "/uploads/ffffffff-ffff-ffff-ffff-ffffffffffff.png",
                caption: "",
              },
            ],
          },
        ],
      },
      {
        ...c,
        galleryProjects: [
          {
            ...c.galleryProjects[0],
            photos: Array.from({ length: 21 }, (_, i) => ({
              id: "extra-" + i,
              image,
              caption: "",
            })),
          },
        ],
      },
    ])
      assert.equal(
        (await req("/api/admin/content", "PUT", invalid)).status,
        400,
      );
    await new Promise((r) => setTimeout(r, 5));
    c = await save({
      ...c,
      galleryProjects: c.galleryProjects.map((p, i) =>
        i === 0
          ? {
              ...p,
              photos: [
                ...p.photos,
                { id: "fourth-photo", image, caption: "New exterior" },
              ],
            }
          : p,
      ),
    });
    assert.equal(c.galleryProjects[0].createdAt, created);
    assert.notEqual(c.galleryProjects[0].updatedAt, updated);
    const oldClient = { ...c };
    delete oldClient.galleryProjects;
    c = await save(oldClient);
    assert.equal(
      c.galleryProjects.length,
      2,
      "Older clients must not erase gallery data",
    );
    await stop();
    await start();
    await login();
    c = await (await req("/api/admin/content")).json();
    assert.equal(c.galleryProjects[0].photos.length, 3);
    assert.equal((await req(image)).status, 200);
    c = await save({ ...c, galleryProjects: [] });
    html = await (
      await req("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
    assert.ok(html.includes('id="gallery"'));
    assert.ok(html.includes("New projects are on the way"));
  } finally {
    await stop();
    await rm(dir, { force: true, recursive: true });
  }
});

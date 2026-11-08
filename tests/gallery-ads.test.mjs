import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";

test("gallery ads validate assets, publish safely, preserve server dates and survive older clients and restarts", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-gallery-ads-test-"));
  const port = await new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const value = socket.address().port;
      socket.close(() => resolve(value));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const password = crypto.randomBytes(24).toString("hex");
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=";
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
        ADMIN_TEST_LOGIN: "false",
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error("Temporary server did not start: " + logs);
  }
  async function stop() {
    if (server && server.exitCode === null) {
      const done = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      await done;
    }
  }
  async function request(url, method = "GET", body, authenticated = true) {
    return fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
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
  async function homepage() {
    return (
      await request("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
  }
  function adsIn(html) {
    const match = html.match(
      /<script type="application\/json" id="ga-ad-data">([\s\S]*?)<\/script>/,
    );
    assert.ok(match, "Public gallery should include published ad data");
    return JSON.parse(match[1]);
  }
  try {
    await start();
    assert.equal((await request("/api/admin/content")).status, 401);
    assert.equal((await request("/api/admin/content", "PUT", {})).status, 401);
    assert.equal(
      (await request("/api/admin/upload", "POST", { data: png })).status,
      401,
    );
    let content = await (await request("/api/content")).json();
    assert.deepEqual(content.galleryAds, []);
    await login();

    // Files saved before this feature should upgrade without changing other content.
    const oldFile = { ...content };
    delete oldFile.galleryAds;
    await writeFile(path.join(dir, "content.json"), JSON.stringify(oldFile), {
      mode: 0o600,
    });
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.galleryAds, []);
    assert.deepEqual(
      (await (await request("/api/content")).json()).galleryAds,
      [],
    );
    assert.deepEqual(adsIn(await homepage()), []);

    const upload = await request("/api/admin/upload", "POST", { data: png });
    assert.equal(upload.status, 201);
    const image = (await upload.json()).url;
    const digital = {
      id: "digital-campaign",
      title: "Digital </script> $& <img src=x onerror=bad()>",
      channel: "digital",
      image,
      description: "A campaign <script>adBad()</script> & $&",
      link: "",
      createdAt: "1900-01-01T00:00:00.000Z",
      updatedAt: "2999-01-01T00:00:00.000Z",
    };
    const beforeCreate = Date.now();
    content = await save({ ...content, galleryAds: [digital] });
    const first = content.galleryAds[0];
    const created = first.createdAt,
      updated = first.updatedAt;
    assert.ok(Number.isFinite(Date.parse(created)));
    assert.ok(
      Date.parse(created) >= beforeCreate - 1000 &&
        Date.parse(created) <= Date.now() + 1000,
    );
    assert.equal(
      created,
      updated,
      "Server should assign both dates when an ad is created",
    );
    assert.notEqual(created, digital.createdAt);
    assert.notEqual(updated, digital.updatedAt);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const social = {
      id: "social-post",
      title: "Newest social campaign",
      channel: "social",
      link: "https://example.com/areva?campaign=one&source=gallery",
    };
    content = await save({
      ...content,
      galleryAds: [...content.galleryAds, social],
    });
    const socialSaved = content.galleryAds.find((ad) => ad.id === social.id);
    assert.equal(
      socialSaved.image,
      "",
      "An HTTPS post can be published without an image",
    );
    assert.equal(socialSaved.description, "", "Descriptions are optional");
    let html = await homepage();
    let published = adsIn(html);
    assert.deepEqual(
      published.map((ad) => ad.id),
      [social.id, digital.id],
    );
    assert.equal(
      published[1].title,
      digital.title,
      "Ad JSON should round-trip closing script tags and replacement tokens",
    );
    assert.equal(published[1].description, digital.description);
    assert.ok(html.includes('id="ga-ads-panel"'));
    assert.ok(html.includes('data-ga-channel="digital"'));
    assert.ok(html.includes('data-ga-channel="social"'));
    assert.ok(html.includes('data-ga-filter="digital"'));
    assert.ok(html.includes('data-ga-filter="social"'));
    assert.ok(
      html.includes(
        "Digital &lt;/script&gt; $&amp; &lt;img src=x onerror=bad()&gt;",
      ),
    );
    assert.ok(!html.includes("<script>adBad()</script>"));
    assert.ok(!html.includes("<img src=x onerror=bad()>"));
    assert.ok(
      html.includes(
        'href="https://example.com/areva?campaign=one&amp;source=gallery" target="_blank" rel="noopener noreferrer"',
      ),
    );

    const retainedAds = structuredClone(content.galleryAds);
    content = await save({
      ...content,
      products: content.products.map((product, index) =>
        index === 0
          ? { ...product, tagline: product.tagline + " updated" }
          : product,
      ),
    });
    assert.deepEqual(
      content.galleryAds,
      retainedAds,
      "Unrelated saves must not reorder ads or change their dates",
    );
    content = await save({
      ...content,
      galleryAds: content.galleryAds.map((ad) => ({
        ...ad,
        createdAt: "1800-01-01T00:00:00.000Z",
        updatedAt: "2999-01-01T00:00:00.000Z",
      })),
    });
    assert.deepEqual(
      content.galleryAds,
      retainedAds,
      "Client-supplied dates must not change unchanged ads",
    );

    const validAd = content.galleryAds[0];
    const invalidLists = [
      ["unknown channel", [{ ...validAd, channel: "video" }]],
      ["missing channel", [{ ...validAd, channel: undefined }]],
      ["empty title", [{ ...validAd, title: "  " }]],
      ["long title", [{ ...validAd, title: "x".repeat(151) }]],
      ["long description", [{ ...validAd, description: "x".repeat(2001) }]],
      ["empty assets", [{ ...validAd, image: "", link: "" }]],
      ["script image", [{ ...validAd, image: "javascript:bad()", link: "" }]],
      ["embedded image", [{ ...validAd, image: png, link: "" }]],
      [
        "missing upload",
        [
          {
            ...validAd,
            image: "/uploads/ffffffff-ffff-ffff-ffff-ffffffffffff.png",
            link: "",
          },
        ],
      ],
      ["duplicate IDs", [validAd, { ...validAd }]],
      [
        "too many ads",
        Array.from({ length: 101 }, (_, index) => ({
          ...validAd,
          id: "ad-" + index,
        })),
      ],
      ...[
        "http://example.com/ad",
        "javascript:bad()",
        "/social/post",
        "//example.com/post",
        "https://",
        "https://user:pass@example.com/post",
      ].map((link) => [
        "unsafe link " + link,
        [{ ...validAd, image: "", link }],
      ]),
    ];
    const beforeInvalid = structuredClone(content);
    for (const [label, galleryAds] of invalidLists) {
      const response = await request("/api/admin/content", "PUT", {
        ...content,
        galleryAds,
      });
      assert.equal(
        response.status,
        400,
        label + ": " + (await response.text()),
      );
    }
    assert.deepEqual(
      await (await request("/api/admin/content")).json(),
      beforeInvalid,
      "Rejected ads must not alter published content",
    );

    await new Promise((resolve) => setTimeout(resolve, 5));
    content = await save({
      ...content,
      galleryAds: content.galleryAds.map((ad) =>
        ad.id === digital.id
          ? {
              ...ad,
              title: "Updated digital campaign",
              createdAt: "1800-01-01",
              updatedAt: "2999-01-01",
            }
          : ad,
      ),
    });
    const changed = content.galleryAds.find((ad) => ad.id === digital.id);
    assert.equal(changed.createdAt, created);
    assert.notEqual(changed.updatedAt, updated);
    assert.notEqual(changed.updatedAt, "2999-01-01");
    assert.equal(
      content.galleryAds.find((ad) => ad.id === social.id).updatedAt,
      socialSaved.updatedAt,
    );
    published = adsIn(await homepage());
    assert.equal(
      published[0].id,
      digital.id,
      "An updated ad should appear first",
    );

    const beforeOldClient = structuredClone(content.galleryAds);
    const oldClient = { ...content };
    delete oldClient.galleryAds;
    content = await save(oldClient);
    assert.deepEqual(
      content.galleryAds,
      beforeOldClient,
      "Older clients must not erase ads they do not know about",
    );

    const originalIds = new Set(content.galleryAds.map((ad) => ad.id));
    content = await save({
      ...content,
      galleryAds: [
        ...content.galleryAds,
        ...Array.from({ length: 98 }, (_, index) => ({
          ...social,
          id: "boundary-" + index,
        })),
      ],
    });
    assert.equal(
      content.galleryAds.length,
      100,
      "Exactly 100 ads should be accepted",
    );
    content = await save({
      ...content,
      galleryAds: content.galleryAds.filter((ad) => originalIds.has(ad.id)),
    });
    const persistedAds = structuredClone(content.galleryAds);
    await stop();
    await start();
    cookie = "";
    await login();
    content = await (await request("/api/admin/content")).json();
    assert.deepEqual(content.galleryAds, persistedAds);
    assert.equal((await request(image)).status, 200);
    assert.deepEqual(
      adsIn(await homepage()).map((ad) => ad.id),
      [digital.id, social.id],
    );

    content = await save({ ...content, galleryAds: [] });
    html = await homepage();
    assert.deepEqual(adsIn(html), []);
    assert.ok(
      html.includes('id="ga-projects-panel"'),
      "Removing ads must keep the project gallery available",
    );
    assert.deepEqual(
      (await (await request("/api/content")).json()).galleryAds,
      [],
    );
  } finally {
    await stop();
    await rm(dir, { force: true, recursive: true });
  }
});

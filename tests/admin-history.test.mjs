import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import net from "node:net";

test("private admin activity persists, detects meaningful changes and never leaks into public content", async () => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "areva-admin-history-test-"),
  );
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
        ADMIN_USERNAME: "history-admin",
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
      username: "history-admin",
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

  async function history(query = "") {
    const response = await request("/api/admin/history" + query);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    return response.json();
  }
  try {
    await start();
    assert.equal((await request("/api/admin/history")).status, 401);
    assert.equal((await request("/api/admin/history", "POST", {})).status, 401);
    const initial = await (await request("/api/content")).json();
    await login();
    let h = await history();
    assert.equal(h.totalEvents, 1);
    assert.equal(h.events[0].action, "signed_in");
    assert.equal(h.events[0].actor, "history-admin");
    assert.deepEqual(
      h.latest,
      {},
      "Old content must not receive invented update dates",
    );
    assert.equal(
      (await (await request("/api/content")).json()).revision,
      initial.revision,
    );
    assert.equal((await request("/api/admin/history", "PUT", {})).status, 404);
    const uploaded = await request("/api/admin/upload", "POST", {
      data: png,
      originalName: "PRIVATE_UPLOAD_HISTORY_MARKER.png",
      section: "products",
      actor: "forged-admin",
    });
    assert.equal(uploaded.status, 201);
    const image = (await uploaded.json()).url;
    const pdf = await request("/api/admin/pdf-upload", "POST", {
      data:
        "data:application/pdf;base64," +
        Buffer.from("%PDF-1.4\nreview\n%%EOF".replaceAll("\\n", "\n")).toString(
          "base64",
        ),
      originalName: "private-card.pdf",
      section: "shadeCards",
    });
    assert.equal(pdf.status, 201);
    const pdfUrl = (await pdf.json()).url;
    h = await history("?action=uploaded");
    assert.equal(h.total, 2);
    assert.ok(h.events.every((event) => event.actor === "history-admin"));
    assert.equal(
      h.events.find((event) => event.fileUrl === image).label,
      "PRIVATE_UPLOAD_HISTORY_MARKER.png",
    );
    assert.equal(
      h.events.find((event) => event.fileUrl === image).section,
      "products",
    );
    let c = structuredClone(initial);
    c.landingImages = ["a", "b"].map((id) => ({
      id,
      image,
      label: "Slide " + id,
      roomType: "",
      recommendedProduct: "",
    }));
    c.products[0].tagline += " revised";
    c.dealers[0].badges = [...c.dealers[0].badges, "New service"];
    c.colours[0].name += " revised";
    c.shadeCards = [{ id: "card", title: "Reference card", url: pdfUrl }];
    c.galleryProjects = [
      {
        id: "project",
        title: "Project One",
        location: "",
        description: "",
        photos: [
          { id: "p1", image, caption: "First" },
          { id: "p2", image, caption: "Second" },
        ],
      },
    ];
    c.galleryAds = [
      {
        id: "ad",
        title: "Campaign",
        channel: "digital",
        image,
        description: "",
        link: "",
      },
    ];
    c.adminHistory = { events: [], startedAt: "1900-01-01" };
    c = await save(c);
    h = await history("?pageSize=50");
    assert.ok(
      h.events.some(
        (event) =>
          event.section === "galleryPhotos" &&
          event.entityId === "project/p1" &&
          event.action === "created",
      ),
    );
    for (const section of [
      "landingImages",
      "products",
      "dealers",
      "colours",
      "shadeCards",
      "galleryProjects",
      "galleryAds",
    ])
      assert.ok(h.lastSection[section], section);
    const firstProductDate = h.latest["products:" + c.products[0].id];
    assert.ok(firstProductDate);
    const otherProductDate = h.latest["products:" + c.products[1].id];
    assert.equal(otherProductDate, undefined);
    assert.ok(h.startedAt > "2020-01-01");
    const oldRevision = structuredClone(c);
    let beforeCount = h.totalEvents;
    c = await save(c);
    h = await history("?pageSize=50");
    assert.equal(
      h.totalEvents,
      beforeCount + 1,
      "No-op save records only publication",
    );
    assert.equal(h.latest["products:" + c.products[0].id], firstProductDate);
    beforeCount = h.totalEvents;
    assert.equal(
      (await request("/api/admin/content", "PUT", oldRevision)).status,
      409,
    );
    const invalid = structuredClone(c);
    invalid.products[0].coverageSqFtPerLiter = -1;
    assert.equal(
      (await request("/api/admin/content", "PUT", invalid)).status,
      400,
    );
    assert.equal((await history()).totalEvents, beforeCount);
    c.landingImages.reverse();
    c.galleryProjects[0].photos.reverse();
    c.products[0].specs.dryingTime = "Changed drying time";
    c.galleryProjects[0].photos[0].caption = "Updated caption";
    c = await save(c);
    h = await history("?action=reordered&pageSize=50");
    assert.ok(h.events.some((event) => event.section === "landingImages"));
    assert.ok(h.events.some((event) => event.section === "galleryPhotos"));
    h = await history("?action=updated&pageSize=50");
    assert.ok(
      h.events.some((event) => event.fields.includes("specs.dryingTime")),
    );
    assert.ok(
      h.events.some(
        (event) =>
          event.section === "galleryPhotos" && event.fields.includes("caption"),
      ),
    );
    const latestBeforeDelete = (await history()).latest["landingImages:a"];
    c.landingImages = c.landingImages.filter((item) => item.id !== "a");
    c.shadeCards = [];
    c = await save(c);
    h = await history("?action=deleted");
    assert.ok(
      h.events.some(
        (event) => event.section === "landingImages" && event.entityId === "a",
      ),
    );
    assert.ok(h.events.some((event) => event.section === "shadeCards"));
    h = await history("?search=PRIVATE_UPLOAD_HISTORY_MARKER");
    assert.equal(h.total, 1);
    assert.equal(h.events[0].action, "uploaded");
    h = await history("?section=account");
    assert.ok(h.events.every((event) => event.section === "account"));
    h = await history("?page=2&pageSize=2");
    assert.equal(h.page, 2);
    assert.equal(h.events.length, 2);
    h = await history("?page=99999&pageSize=99999");
    assert.equal(h.pageSize, 50);
    assert.equal(h.page, h.pages);
    h = await history("?page=-1&pageSize=bad");
    assert.equal(h.page, 1);
    assert.equal(h.pageSize, 25);
    for (const url of [
      "/api/content",
      "/api/admin/content",
      "/api/products",
      "/attached-page",
    ]) {
      const text = await (await request(url)).text();
      assert.equal(text.includes("adminHistory"), false, url);
      assert.equal(text.includes("PRIVATE_UPLOAD_HISTORY_MARKER"), false, url);
      assert.equal(text.includes("history-admin"), false, url);
    }
    const diskText = await (
      await import("node:fs/promises")
    ).readFile(path.join(dir, "content.json"), "utf8");
    assert.equal(diskText.includes(password), false);
    assert.equal(diskText.includes(cookie.split("=")[1]), false);
    assert.ok(JSON.parse(diskText).adminHistory.events.length > 0);
    // Grouping happens on the server before pagination, across all related sections.
    const allEvents = await history("?pageSize=50");
    const tabs = {
      gallery: ["galleryProjects", "galleryPhotos", "galleryAds", "galleryReviews"],
      colours: ["colours", "shadeCards"],
      landingImages: ["landingImages"],
      products: ["products"],
      dealers: ["dealers"],
    };
    for (const [tab, sections] of Object.entries(tabs)) {
      const expected = allEvents.events.filter((event) =>
        sections.includes(event.section),
      );
      const group = await history("?tab=" + tab + "&pageSize=50");
      assert.deepEqual(
        group.events.map((event) => event.id),
        expected.map((event) => event.id),
        tab,
      );
      assert.equal(group.total, expected.length, tab);
    }
    const galleryPage = await history("?tab=gallery&pageSize=2&page=2");
    const galleryAll = await history("?tab=gallery&pageSize=50");
    assert.deepEqual(
      galleryPage.events.map((event) => event.id),
      galleryAll.events.slice(2, 4).map((event) => event.id),
    );
    const colourUploads = await history("?tab=colours&action=uploaded");
    assert.equal(colourUploads.total, 1);
    assert.equal(colourUploads.events[0].section, "shadeCards");
    const projectPhotos = await history("?tab=gallery&section=galleryPhotos");
    assert.ok(projectPhotos.events.length > 0);
    assert.ok(
      projectPhotos.events.every((event) => event.section === "galleryPhotos"),
    );
    assert.equal((await history("?tab=products&section=galleryAds")).total, 0);
    assert.equal((await request("/api/admin/history?tab=invalid")).status, 400);
    assert.deepEqual(
      (await history("?tab=all&pageSize=50")).events,
      allEvents.events,
    );
    const historyBeforeRestart = await history("?pageSize=50");
    await request("/api/admin/logout", "POST", {});
    assert.equal((await request("/api/admin/history")).status, 401);
    await stop();
    await start();
    await login();
    h = await history("?pageSize=50");
    assert.equal(h.totalEvents, historyBeforeRestart.totalEvents + 2);
    assert.ok(h.events.some((event) => event.action === "signed_out"));
    assert.equal(h.latest["landingImages:a"], latestBeforeDelete);
    assert.equal(h.startedAt, historyBeforeRestart.startedAt);
    assert.equal(
      (await (await request("/api/content")).json()).revision,
      c.revision,
    );
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

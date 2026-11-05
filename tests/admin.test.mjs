import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";

test("admin authentication, uploads, validation, public integration and persistence", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "areva-admin-test-"));
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  const base = `http://127.0.0.1:${port}`,
    password = crypto.randomBytes(24).toString("hex");
  let child,
    logs = "";
  async function start(overrides = {}) {
    child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        PORT: String(port),
        DISABLE_HMR: "true",
        ADMIN_PASSWORD: password,
        CONTENT_DATA_DIR: dataDir,
        ADMIN_USERNAME: "admin",
        ADMIN_TEST_LOGIN: "false",
        RENDER: "false",
        TRUST_PROXY_HOPS: "0",
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (b) => (logs += b));
    child.stderr.on("data", (b) => (logs += b));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + "/api/health")).ok) return;
      } catch {}
      if (child.exitCode !== null) throw Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Server did not become ready: " + logs);
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const done = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await done;
    }
  }
  let cookie = "";
  async function req(url, method = "GET", body, authenticated = true) {
    return fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function login() {
    const r = await req("/api/admin/login", "POST", { password });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
    assert.match(r.headers.get("set-cookie"), /HttpOnly/i);
    assert.match(r.headers.get("set-cookie"), /SameSite=Strict/i);
  }
  try {
    await start();
    assert.equal((await req("/api/admin/content")).status, 401);
    assert.equal(
      (await req("/api/admin/upload", "POST", { data: "test" })).status,
      401,
    );
    assert.equal(
      (await req("/api/admin/login", "POST", { password: "wrong" })).status,
      401,
    );
    await login();
    const original = await (await req("/api/admin/content")).json();
    assert.equal(original.products.length, 18);
    assert.equal(original.dealers.length, 13);
    assert.equal(original.colours.length, 24);
    assert.equal(original.shadeCards.length, 0);
    // Upgrade a saved file written before the palette feature existed.
    await writeFile(
      path.join(dataDir, "content.json"),
      JSON.stringify({
        ...original,
        colours: undefined,
        shadeCards: undefined,
      }),
    );
    assert.equal(
      (await (await req("/api/admin/content")).json()).colours.length,
      24,
    );
    assert.equal(
      (
        await req(
          "/api/admin/pdf-upload",
          "POST",
          { data: "data:application/pdf;base64,eA==" },
          false,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await req("/api/admin/pdf-upload", "POST", {
          data: "data:application/pdf;base64,aW52YWxpZA==",
        })
      ).status,
      400,
    );
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
    const uploadedPdf = await req("/api/admin/pdf-upload", "POST", {
      data: "data:application/pdf;base64," + pdf.toString("base64"),
    });
    assert.equal(uploadedPdf.status, 201);
    const pdfUrl = (await uploadedPdf.json()).url;
    const download = await req(pdfUrl);
    assert.match(download.headers.get("content-type"), /application\/pdf/);
    assert.match(download.headers.get("content-disposition"), /attachment/);

    const homepage = await (
      await req("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
    assert.ok(
      homepage.includes('href="/admin" target="_top"'),
      "Homepage Admin link must leave the demo portal for real authentication",
    );
    assert.equal(
      original.products.find((p) => p.name === "Sheen Pro")
        .coverageSqFtPerLiter,
      120,
    );
    assert.equal(
      (await req("/api/content/legacy-image/0")).headers.get("content-type"),
      "image/jpeg",
    );
    assert.equal(
      (
        await req("/api/admin/upload", "POST", {
          data: "data:image/svg+xml;base64,PHN2Zz4=",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/api/admin/upload", "POST", {
          data: "data:image/png;base64,aaaaaaaaaaaaaaaa",
        })
      ).status,
      400,
    );
    const uploaded = await req("/api/admin/upload", "POST", {
      data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
    });
    assert.equal(uploaded.status, 201);
    const { url } = await uploaded.json();
    assert.equal((await req(url)).status, 200);
    const unconfigured = original.products.find(
      (p) => p.coverageSqFtPerLiter === 0,
    );
    assert.ok(
      unconfigured,
      "Legacy products without coverage should not receive invented values",
    );
    assert.equal(
      (
        await req("/api/calculator/estimate", "POST", {
          length: 12,
          width: 10,
          height: 9,
          productId: unconfigured.id,
        })
      ).status,
      400,
    );
    const product = {
      ...original.products[0],
      id: "test-product",
      name: "Test coating",
      description: "A durable finish <script>alert(1)</script>",
      coverageSqFtPerLiter: 50,
      image: url,
    };
    const edited = {
      ...original,
      colours: [
        ...original.colours,
        {
          name: "Coastal Mist <test>",
          code: "AR901",
          hex: "#B3CCD5",
          family: "Coastal & Blues",
          goesWellWith: [],
        },
      ],
      shadeCards: [{ id: "test-pdf", title: "Shade card", url: pdfUrl }],
      products: [...original.products, product],
      landingImages: [
        {
          id: "test-slide",
          image: url,
          label: "A new landing image",
          roomType: "Interior",
          recommendedProduct: "Test coating",
        },
      ],
      dealers: [
        ...original.dealers,
        {
          id: "test-dealer",
          name: "Test Dealer",
          phone: "+91 90000 00000",
          pin: "682001",
          city: "Kochi",
          state: "Kerala",
          address: "Test road",
          badges: ["Tinting"],
        },
      ],
    };

    const duplicate = structuredClone(edited);
    duplicate.colours.push({
      ...duplicate.colours[0],
      code: duplicate.colours[0].code.toLowerCase(),
    });
    assert.equal(
      (await req("/api/admin/content", "PUT", duplicate)).status,
      400,
    );
    const invalidHex = structuredClone(edited);
    invalidHex.colours[0].hex = "red";
    assert.equal(
      (await req("/api/admin/content", "PUT", invalidHex)).status,
      400,
    );
    const noColours = structuredClone(edited);
    noColours.colours = [];
    assert.equal(
      (await req("/api/admin/content", "PUT", noColours)).status,
      400,
    );
    const invalid = structuredClone(edited);
    invalid.products[0].coverageSqFtPerLiter = -1;
    assert.equal((await req("/api/admin/content", "PUT", invalid)).status, 400);
    const badImage = structuredClone(edited);
    badImage.landingImages[0].image = "javascript:alert(1)";
    assert.equal(
      (await req("/api/admin/content", "PUT", badImage)).status,
      400,
    );
    const crossOrigin = await fetch(base + "/api/admin/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://evil.example",
      },
      body: JSON.stringify(edited),
    });
    assert.equal(crossOrigin.status, 403);
    const saved = await req("/api/admin/content", "PUT", edited);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).revision, 1);
    assert.equal((await req("/api/admin/content", "PUT", edited)).status, 409);

    const palette = await (await req("/api/shades?search=ar901")).json();
    assert.equal(palette.total, 1);
    assert.equal(palette.shades[0].hex, "#B3CCD5");
    const nameSearch = await (
      await req("/api/shades?search=coastal%20mist")
    ).json();
    assert.equal(nameSearch.total, 1);
    const pub = await (await req("/api/products")).json();
    assert.ok(pub.products.some((p) => p.id === "test-product"));
    const dealers = await (await req("/api/dealers?state=Kerala")).json();
    assert.equal(dealers.total, 1);
    const estimate = await (
      await req("/api/calculator/estimate", "POST", {
        length: 12,
        width: 10,
        height: 9,
        doors: 1,
        windows: 1,
        productId: "test-product",
        coats: 2,
      })
    ).json();
    assert.equal(estimate.netPaintableAreaSqFt, 360);
    assert.equal(estimate.recommendedTotalLiters, 16);
    const html = await (
      await req("/assets/aistudio/areva-paints_a2364c60.html")
    ).text();
    assert.ok(html.includes("A new landing image"));
    assert.ok(html.includes("Test Dealer"));
    assert.ok(html.includes("Test coating"));
    assert.ok(html.includes("Coastal Mist &lt;test&gt;"));
    assert.ok(html.includes(pdfUrl));
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.equal((await req("/admin")).status, 200);
    assert.equal((await req("/api/admin/logout", "POST")).status, 200);
    assert.equal((await req("/api/admin/content")).status, 401);
    await stop();
    await start();
    await login();
    const restored = await (await req("/api/admin/content")).json();
    assert.equal(restored.revision, 1);
    assert.equal(restored.colours.at(-1).code, "AR901");
    assert.equal(restored.shadeCards[0].url, pdfUrl);
    assert.equal(restored.products.at(-1).id, "test-product");
    assert.equal((await req(url)).status, 200);
    await stop();
    await start({ ADMIN_PASSWORD: "", ADMIN_TEST_LOGIN: "false" });
    assert.equal(
      (
        await req("/api/admin/login", "POST", {
          username: "admin",
          password: "ArevaTest2026!",
        })
      ).status,
      503,
    );
    await stop();
    await start({ ADMIN_PASSWORD: "", ADMIN_TEST_LOGIN: "true" });
    assert.equal(
      (
        await req("/api/admin/login", "POST", {
          username: "wrong",
          password: "ArevaTest2026!",
        })
      ).status,
      401,
    );
    const demo = await req("/api/admin/login", "POST", {
      username: "admin",
      password: "ArevaTest2026!",
    });
    assert.equal(demo.status, 200);
    cookie = demo.headers.get("set-cookie").split(";")[0];
    assert.equal((await req("/api/admin/session")).status, 200);
    await stop();
    await start({ ADMIN_USERNAME: "owner", ADMIN_TEST_LOGIN: "true" });
    assert.equal(
      (
        await req("/api/admin/login", "POST", {
          username: "admin",
          password: "ArevaTest2026!",
        })
      ).status,
      401,
    );
    assert.equal(
      (await req("/api/admin/login", "POST", { username: "owner", password }))
        .status,
      200,
    );
    await stop();
    await start({ RENDER: "true", TRUST_PROXY_HOPS: undefined });
    const proxied = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `https://127.0.0.1:${port}`,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({ username: "admin", password }),
    });
    assert.equal(
      proxied.status,
      200,
      "Render HTTPS origin should match the trusted forwarded protocol",
    );
    assert.match(proxied.headers.get("set-cookie"), /; Secure/i);
    const foreignOrigin = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({ username: "admin", password }),
    });
    assert.equal(
      foreignOrigin.status,
      403,
      "Foreign origins must remain blocked behind Render",
    );
  } finally {
    await stop();
    await rm(dataDir, { recursive: true, force: true });
  }
});

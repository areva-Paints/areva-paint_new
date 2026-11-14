import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductWarrantyBadge } from "../src/components/ProductSummaryHeading.tsx";
import {
  getProductDisplayDetails,
  productPacking,
  productWarrantyText,
} from "../src/data/productDetails.ts";

test("product display fields validate, persist, render safely and keep calculator inputs independent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "areva-product-details-"));
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
    if (server && server.exitCode === null) {
      const done = new Promise((resolve) => server.once("exit", resolve));
      server.kill();
      await done;
    }
  }
  const req = (url, method = "GET", body, auth = true) =>
    fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth && cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
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
    await login();
    let c = await (await req("/api/admin/content")).json();
    const original = c.products[0];
    const p = {
      ...original,
      sheen: "High Sheen",
      coverageSqFtPerLiter: 50,
      coverageUnit: "L",
      recommendedCoats: 2,
      calculationBasis: "wall",
      availableSizes: [1, 4, 10, 20],
      specs: {
        ...original.specs,
        coverageText: "240 - 260 sqft/litre/coat",
        dilution: "200 ml/ Ltr",
        bases: ["2", "11", "017", "18", "22"],
        packing: ["1", "4", "10", "20"],
        dryingTime: "Touch dry: 2-3 hours, Hard dry: 48 hours",
        recoatTime: "4-6 hours",
        thinnedWith: "Clean water",
        warrantyYears: 12,
        warrantyLabel: "Performance Warranty*",
        recommendedSurfaces: ["Plaster", "Concrete"],
        surfacePreparation: "Clean and dry the surface.",
        applicationMethod: "Brush or roller",
      },
    };
    c = await save({
      ...c,
      products: c.products.map((item) => (item.id === p.id ? p : item)),
    });
    let saved = c.products[0];
    assert.deepEqual(saved.specs, p.specs);
    assert.equal(saved.sheen, "High Sheen");
    assert.equal(
      productWarrantyText(saved),
      "12 Years · Performance Warranty*",
    );
    assert.ok(
      renderToStaticMarkup(
        createElement(ProductWarrantyBadge, { product: saved }),
      ).includes("12 Years"),
    );
    assert.equal(
      new Map(getProductDisplayDetails(saved)).get("BASES"),
      "2, 11, 017, 18, 22",
    );
    const estimate = await (
      await req("/api/calculator/estimate", "POST", {
        length: 12,
        width: 10,
        height: 9,
        doors: 1,
        windows: 1,
        productId: p.id,
        coats: 2,
      })
    ).json();
    assert.equal(estimate.netPaintableAreaSqFt, 360);
    assert.equal(estimate.recommendedTotalLiters, 16);
    const publicProduct = (await (await req("/api/products/" + p.id)).json())
      .product;
    assert.deepEqual(publicProduct.specs, saved.specs);
    const html = await (await req("/attached-page")).text();
    assert.ok(html.includes("product-warranty-badge"));
    assert.ok(html.includes("240 - 260 sqft/litre/coat"));
    assert.ok(html.includes("High Sheen"));
    for (const change of [
      { coverageText: 123 },
      { coverageText: "x".repeat(301) },
      { dilution: {} },
      { bases: [""] },
      { bases: Array(31).fill("1") },
      { bases: ["x".repeat(101)] },
      { packing: "1,4" },
      { packing: Array(21).fill("1") },
      { warrantyLabel: "x".repeat(101) },
      { warrantyYears: -1 },
      { warrantyYears: 101 },
    ]) {
      const bad = structuredClone(c);
      Object.assign(bad.products[0].specs, change);
      assert.equal((await req("/api/admin/content", "PUT", bad)).status, 400);
    }
    for (const sheen of ["", "x".repeat(101)]) {
      const bad = structuredClone(c);
      bad.products[0].sheen = sheen;
      assert.equal((await req("/api/admin/content", "PUT", bad)).status, 400);
    }
    const oldClient = structuredClone(c);
    for (const key of [
      "coverageText",
      "dilution",
      "bases",
      "packing",
      "warrantyLabel",
    ])
      delete oldClient.products[0].specs[key];
    c = await save(oldClient);
    assert.deepEqual(c.products[0].specs, saved.specs);
    const malicious = structuredClone(c);
    malicious.products[0].specs.coverageText = "<script>alert(1)</script>";
    malicious.products[0].specs.bases = ["<img src=x onerror=alert(1)>"];
    malicious.products[0].specs.warrantyLabel = "Warranty <script>";
    c = await save(malicious);
    const escaped = await (await req("/attached-page")).text();
    assert.ok(!escaped.includes("<script>alert(1)</script>"));
    assert.ok(escaped.includes("&lt;script&gt;"));
    assert.ok(!escaped.includes("<img src=x onerror=alert(1)>"));
    c = await save({
      ...c,
      products: c.products.map((item) =>
        item.id === p.id
          ? {
              ...item,
              specs: {
                ...item.specs,
                coverageText: "",
                dilution: "",
                bases: [],
                packing: [],
                warrantyYears: 0,
                warrantyLabel: "",
              },
            }
          : item,
      ),
    });
    saved = c.products[0];
    assert.equal(
      renderToStaticMarkup(
        createElement(ProductWarrantyBadge, { product: saved }),
      ),
      "",
    );
    assert.deepEqual(productPacking(saved), ["1 L", "4 L", "10 L", "20 L"]);
    assert.equal(
      new Map(getProductDisplayDetails(saved)).get("COVERAGE"),
      "50 sq ft/L/coat",
    );
    const history = await (
      await req("/api/admin/history?section=products")
    ).json();
    assert.ok(
      history.events.some((event) =>
        event.fields.includes("specs.warrantyYears"),
      ),
    );
    await stop();
    await start();
    await login();
    const restored = await (await req("/api/admin/content")).json();
    assert.deepEqual(restored.products[0], saved);
  } finally {
    await stop();
    await rm(dir, { recursive: true, force: true });
  }
});

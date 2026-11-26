/* White preparation and colouring use immutable source buffers; model resources
 * are pinned locally and only the dedicated worker may compile their WASM code.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { testServer } from "./helpers/server.mjs";
import "../public/assets/photo-paint-studio.js";
const {
  whiteWallBase,
  renderWhitePreview,
  polygonMask,
  subtractMask,
  cleanWallMask,
  refineWallBoundary,
  modelWallMask,
  modelBuildingMask,
  paintableBuildingMask,
} = globalThis.ArevaPaintStudio;
const image = (width, height, colour) => ({
  width,
  height,
  data: Uint8ClampedArray.from(
    Array.from({ length: width * height }, (_, p) => [
      ...colour(p % width, Math.floor(p / width)),
      255,
    ]).flat(),
  ),
});
const rgb = (im, x, y) =>
  Array.from(im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 3));

test("automatic preparation whitens distant wall faces and cast shadows, while protecting openings and surrounding pixels", () => {
  const original = image(120, 100, (x, y) => {
    if (y < 10 || x < 10 || x >= 110) return [70, 150, 220]; // Sky outside the model body.
    if (x >= 45 && x < 75 && y >= 35 && y < 65) return [12, 15, 18]; // Opening.
    if (x >= 85 && x < 105 && y > 55) return [140, 83, 38]; // Wood door.
    if (x > 55 && y < 30) return [80, 80, 80]; // Cast shadow on concrete.
    if (x === 60 && y === 50) return [150, 150, 150]; // A window reflection.
    return x < 55 ? [170, 170, 170] : [140, 140, 140];
  });
  const body = polygonMask(120, 100, [
    [10, 10],
    [110, 10],
    [110, 95],
    [10, 95],
  ]);
  const mask = paintableBuildingMask(original, body),
    base = whiteWallBase(original, [{ mask }]);
  for (const [x, y] of [
    [25, 25],
    [95, 25],
    [65, 20],
    [25, 80],
  ]) {
    assert.equal(mask[y * 120 + x], 255, `Wall face at ${x},${y} is prepared`);
    const colour = rgb(base, x, y);
    assert.equal(colour[0], colour[1]);
    assert.equal(colour[1], colour[2]);
    assert.ok(colour[0] > rgb(original, x, y)[0]);
  }
  for (const [x, y] of [
    [5, 40],
    [50, 50],
    [60, 50],
    [95, 70],
    [50, 97],
  ])
    assert.deepEqual(
      rgb(base, x, y),
      rgb(original, x, y),
      `Protected source at ${x},${y}`,
    );
  assert.deepEqual(paintableBuildingMask(original, body), mask);
});

test("automatic building detection uses an enclosing confident mask, while a wall tap chooses its fine surface", () => {
  const original = image(100, 80, () => [170, 170, 170]),
    logits = new Float32Array(3 * 65536).fill(-8);
  for (let y = 0; y < 205; y++)
    for (let x = 0; x < 256; x++) {
      if (x > 25 && x < 230 && y > 25 && y < 190) logits[y * 256 + x] = 8;
      if (x > 95 && x < 190 && y > 70 && y < 150)
        logits[65536 + y * 256 + x] = 8;
      if (x > 115 && x < 155 && y > 90 && y < 140)
        logits[131072 + y * 256 + x] = 8;
    }
  const scores = new Float32Array([0.92, 0.85, 0.8]),
    resized = [1024, 819],
    point = [52, 45];
  const building = modelBuildingMask(original, logits, scores, resized, point),
    wall = modelWallMask(original, logits, scores, resized, point);
  assert.ok(building.filter(Boolean).length > wall.filter(Boolean).length * 3);
  assert.equal(building[20 * 100 + 20], 255);
  assert.equal(wall[20 * 100 + 20], 0);
  assert.equal(
    modelBuildingMask(
      original,
      logits,
      new Float32Array([NaN, 0.1, 0.1]),
      resized,
      point,
    ),
    null,
  );
  assert.throws(() =>
    modelBuildingMask(original, logits, scores, resized, [NaN, 0]),
  );
});

test("white foundation removes old pigment, preserves openings and source, and recolours only its selected wall", () => {
  const original = image(80, 60, (x, y) => [130 + y, 100 + y, 75 + y]),
    saved = new Uint8ClampedArray(original.data);
  const left = polygonMask(80, 60, [
      [5, 5],
      [35, 5],
      [35, 55],
      [5, 55],
    ]),
    right = polygonMask(80, 60, [
      [45, 5],
      [75, 5],
      [75, 55],
      [45, 55],
    ]),
    hole = polygonMask(80, 60, [
      [15, 15],
      [25, 15],
      [25, 35],
      [15, 35],
    ]),
    mask = subtractMask(left, hole);
  const base = whiteWallBase(original, [{ mask }, { mask: right }]);
  const p = rgb(base, 10, 20);
  assert.ok(Math.max(...p) - Math.min(...p) <= 1, "White base has neutral RGB");
  assert.ok(p[0] > 200);
  assert.deepEqual(rgb(base, 20, 20), rgb(original, 20, 20));
  assert.deepEqual(rgb(base, 40, 20), rgb(original, 40, 20));
  const blue = renderWhitePreview(base, [
    { mask, hex: "#2d9aff" },
    { mask: right },
  ]);
  assert.notDeepEqual(rgb(blue, 10, 20), p);
  assert.deepEqual(rgb(blue, 60, 20), rgb(base, 60, 20));
  assert.deepEqual(rgb(blue, 20, 20), rgb(original, 20, 20));
  for (const hex of ["#9d6a82", "#70a585", "#ead8b1"]) {
    const first = renderWhitePreview(base, [{ mask, hex }]);
    assert.deepEqual(renderWhitePreview(base, [{ mask, hex }]), first);
  }
  assert.deepEqual(original.data, saved);
  assert.deepEqual(whiteWallBase(original, []).data, saved);
  assert.throws(() => whiteWallBase(original, [{ mask: new Uint8Array(1) }]));
  assert.throws(() => whiteWallBase(original, Array(17).fill({ mask })));
});

test("white preparation retains rough-wall shadows without gaps inside the surface", () => {
  const original = image(100, 70, (x, y) => {
    const v = 190 - y + ((x + y) % 2 ? 12 : -12);
    return [v, v, v];
  });
  const mask = new Uint8Array(7000).fill(255),
    base = whiteWallBase(original, [{ mask }]);
  assert.ok(rgb(base, 20, 5)[0] > rgb(base, 20, 60)[0]);
  for (let p = 0; p < mask.length; p++)
    assert.equal(base.data[p * 4], base.data[p * 4 + 1]);
  const painted = renderWhitePreview(base, [{ mask, hex: "#8ccf50" }]);
  for (let p = 0; p < mask.length; p++)
    assert.notDeepEqual(
      painted.data.slice(p * 4, p * 4 + 3),
      original.data.slice(p * 4, p * 4 + 3),
    );
});

test("detection cleanup closes pinholes while protecting large windows and the outside", () => {
  const mask = polygonMask(70, 60, [
    [5, 5],
    [65, 5],
    [65, 55],
    [5, 55],
  ]);
  mask[15 * 70 + 15] = 0;
  const hole = polygonMask(70, 60, [
      [25, 15],
      [45, 15],
      [45, 40],
      [25, 40],
    ]),
    cut = subtractMask(mask, hole),
    cleaned = cleanWallMask(cut, 70, 60);
  assert.equal(cleaned[15 * 70 + 15], 255);
  assert.equal(cleaned[25 * 70 + 35], 0);
  assert.equal(cleaned[0], 0);
  assert.equal(cut[15 * 70 + 15], 0);
});

test("wall refinement removes disconnected islands and stops at an adjoining vertical plane", () => {
  const original = image(120, 100, (x, y) => {
    const v = (x < 60 ? 190 : 210) + ((x + y) % 2 ? 3 : -3);
    return [v, v, v];
  });
  let mask = polygonMask(120, 100, [
    [10, 10],
    [110, 10],
    [110, 90],
    [10, 90],
  ]);
  const refined = refineWallBoundary(original, mask, [30, 50]);
  assert.equal(refined[50 * 120 + 30], 255);
  assert.equal(refined[50 * 120 + 90], 0);
  mask = new Uint8Array(120 * 100);
  for (let y = 10; y < 40; y++)
    for (let x = 10; x < 40; x++) mask[y * 120 + x] = 255;
  mask[60 * 120 + 100] = 255;
  const joined = refineWallBoundary(original, mask, [20, 20]);
  assert.equal(joined[20 * 120 + 20], 255);
  assert.equal(joined[60 * 120 + 100], 0);
});

test("model mask decoding picks the finest confident region and preserves a dark opening", () => {
  const original = image(64, 48, (x, y) =>
    x >= 29 && x < 36 && y >= 16 && y < 30 ? [18, 18, 18] : [185, 185, 185],
  );
  const logits = new Float32Array(3 * 65536).fill(-8);
  for (let k = 0; k < 3; k++)
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 256; x++) {
        const yes =
          k === 0 ||
          (k === 1
            ? x >= 24 && x < 220 && y >= 16 && y < 184
            : x >= 56 && x < 172 && y >= 32 && y < 152);
        if (yes) logits[k * 65536 + y * 256 + x] = 8;
      }
  const chosen = modelWallMask(
    original,
    logits,
    new Float32Array([0.98, 0.91, 0.82]),
    [1024, 768],
    [20, 20],
  );
  assert.equal(chosen[20 * 64 + 20], 255);
  assert.equal(chosen[22 * 64 + 32], 0);
  assert.equal(chosen[20 * 64 + 55], 0);
  assert.throws(() =>
    modelWallMask(
      original,
      new Float32Array(1),
      new Float32Array(3),
      [1024, 768],
      [20, 20],
    ),
  );
});

test("bundled segmentation assets match their pinned redistribution manifest", async () => {
  const root = new URL("../public/assets/", import.meta.url),
    manifest = JSON.parse(
      await readFile(new URL("wall-model/manifest.json", root), "utf8"),
    );
  assert.equal(manifest.modelLicense, "Apache-2.0");
  assert.equal(manifest.runtimeLicense, "MIT");
  assert.match(manifest.modelRevision, /^[a-f0-9]{40}$/);
  assert.equal(Object.keys(manifest.files).length, 5);
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.match(file, /^(wall-model\/v1|vendor\/onnx)\/[a-z0-9_.-]+$/);
    const bytes = await readFile(new URL(file, root));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      hash,
      file + " failed integrity check",
    );
  }
  assert.match(
    await readFile(new URL("wall-model/LICENSE.txt", root), "utf8"),
    /Apache License/,
  );
  assert.match(
    await readFile(new URL("vendor/onnx/LICENSE.txt", root), "utf8"),
    /MIT License/,
  );
  assert.ok(
    (await readFile(new URL("vendor/onnx/ThirdPartyNotices.txt", root)))
      .length > 1000,
  );
});

test("WASM compilation is limited to the static wall worker, while documents retain strict CSP", async () => {
  const s = await testServer();
  try {
    await s.start();
    for (const route of [
      "/",
      "/attached-page",
      "/admin",
      "/warranty",
      "/assets/wall-selector-worker.js",
    ]) {
      const r = await s.request(route),
        csp = r.headers.get("content-security-policy");
      assert.equal(r.status, 200, route);
      const script = csp
        .split(";")
        .find((line) => line.trim().startsWith("script-src"))
        .trim()
        .split(/\s+/);
      assert.equal(script.includes("'unsafe-eval'"), false);
      assert.equal(
        script.includes("'wasm-unsafe-eval'"),
        route.includes("wall-selector-worker"),
      );
    }
    const model = await s.request("/assets/wall-model/v1/encoder.onnx");
    assert.equal(model.status, 200);
    assert.equal(Number(model.headers.get("content-length")), 8882165);
    await model.body.cancel();
  } finally {
    await s.dispose();
  }
});

test("model selection keeps a sharp cast shadow inside the wall instead of leaving a grey stripe", () => {
  const original = image(100, 80, (x, y) =>
    x >= 35 && x < 55 && y >= 35 && y < 55 ? [80, 80, 80] : [190, 190, 190],
  );
  const logits = new Float32Array(3 * 65536).fill(-8);
  for (let k = 0; k < 3; k++)
    for (let y = 0; y < 205; y++)
      for (let x = 0; x < 256; x++)
        if (k === 0 || (x >= 25 && x < 210 && y >= 25 && y < 180))
          logits[k * 65536 + y * 256 + x] = 8;
  const mask = modelWallMask(
    original,
    logits,
    new Float32Array([0.95, 0.88, 0.8]),
    [1024, 819],
    [25, 25],
  );
  assert.equal(
    mask[45 * 100 + 45],
    255,
    "Concrete in cast shadow remains part of the selected wall",
  );
  const painted = renderWhitePreview(whiteWallBase(original, [{ mask }]), [
    { mask, hex: "#2d9aff" },
  ]);
  assert.notDeepEqual(rgb(painted, 45, 45), rgb(original, 45, 45));
  assert.ok(rgb(painted, 45, 45)[2] > rgb(painted, 45, 45)[0]);
});

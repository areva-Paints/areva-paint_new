/* Geometry and colour regressions use synthetic pixels, not hosted customer photos.
 * Both public renderers load this exact shared engine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import "../public/assets/photo-paint-studio.js";

const { polygonMask, subtractMask, connectedMask, paintImage, validPolygon } =
  globalThis.ArevaPaintStudio;
const image = (width, height, pixel) => ({
  width,
  height,
  data: Uint8ClampedArray.from(
    Array.from({ length: width * height }, (_, i) => [
      ...pixel(i % width, Math.floor(i / width)),
      255,
    ]).flat(),
  ),
});
const rgb = (data, width, x, y) =>
  Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 3));

test("coordinate outlines stay inside the chosen wall and preserve antialiased edges", () => {
  const mask = polygonMask(16, 12, [
    [2, 2],
    [13, 2],
    [13, 10],
    [2, 10],
  ]);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 16; x++)
      assert.equal(
        mask[y * 16 + x],
        x >= 2 && x < 13 && y >= 2 && y < 10 ? 255 : 0,
      );
  const diagonal = polygonMask(16, 12, [
    [1, 1],
    [14, 3],
    [10, 11],
  ]);
  assert.ok(diagonal.some((alpha) => alpha > 0 && alpha < 255));
  assert.equal(diagonal[0], 0);
  assert.equal(diagonal[15], 0);
  const outside = polygonMask(5, 4, [
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
  ]);
  assert.ok(
    outside.every((alpha) => alpha === 255),
    "Bounds are clipped to the image",
  );
});

test("polygon exclusions leave windows and doors unchanged, including separate cutouts", () => {
  const original = image(20, 16, () => [195, 180, 165]);
  const wall = polygonMask(20, 16, [
    [2, 2],
    [18, 2],
    [18, 14],
    [2, 14],
  ]);
  const window = polygonMask(20, 16, [
    [4, 4],
    [8, 4],
    [8, 8],
    [4, 8],
  ]);
  const door = polygonMask(20, 16, [
    [11, 7],
    [15, 7],
    [15, 14],
    [11, 14],
  ]);
  const selection = subtractMask(subtractMask(wall, window), door);
  const painted = paintImage(original, original.data, selection, "#57a87b");
  for (const [x, y] of [
    [0, 0],
    [6, 6],
    [12, 12],
    [19, 15],
  ])
    assert.deepEqual(rgb(painted, 20, x, y), rgb(original.data, 20, x, y));
  assert.notDeepEqual(rgb(painted, 20, 9, 5), rgb(original.data, 20, 9, 5));
  assert.throws(() => subtractMask(wall, new Uint8Array(1)));
});

test("invalid, crossing, repeated or unbounded outlines cannot paint arbitrary regions", () => {
  for (const points of [
    [],
    [
      [0, 0],
      [3, 0],
    ],
    [
      [0, 0],
      [3, 3],
      [0, 3],
      [3, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [3, 3],
    ],
    [
      [NaN, 0],
      [3, 0],
      [3, 3],
    ],
    Array.from({ length: 81 }, (_, i) => [i, i]),
  ]) {
    assert.equal(validPolygon(points), false);
    assert.throws(() => polygonMask(10, 10, points));
  }
  assert.throws(() =>
    polygonMask(100000, 100000, [
      [0, 0],
      [3, 0],
      [3, 3],
    ]),
  );
});

test("flat walls match the chosen swatch without retaining the previous pigment", () => {
  for (const source of [
    [200, 180, 140],
    [120, 145, 160],
    [245, 245, 245],
  ]) {
    const original = image(8, 8, () => source),
      mask = new Uint8Array(64).fill(255);
    for (const hex of ["#ffcc33", "#663399", "#2d6c73", "#f4eee4", "#25243a"]) {
      const result = paintImage(original, original.data, mask, hex);
      const target = [1, 3, 5].map((offset) =>
        parseInt(hex.slice(offset, offset + 2), 16),
      );
      rgb(result, 8, 4, 4).forEach((value, index) =>
        assert.ok(
          Math.abs(value - target[index]) <= 2,
          `${source} -> ${hex}: ${rgb(result, 8, 4, 4)}`,
        ),
      );
    }
  }
});

test("textured and shadowed selections are fully painted without neon clipping or pixel holes", () => {
  const original = image(64, 24, (x, y) => {
    const base = 70 + x * 2.5 + (y % 2 ? 6 : 0);
    return [base, base * 0.95, base * 0.86];
  });
  const mask = new Uint8Array(64 * 24).fill(255);
  for (const hex of ["#ffcc33", "#c85642", "#f6f1e8", "#1f2440"]) {
    const result = paintImage(original, original.data, mask, hex);
    const first = rgb(result, 64, 0, 4),
      middle = rgb(result, 64, 30, 4),
      last = rgb(result, 64, 63, 4);
    assert.ok(first.reduce((a, b) => a + b) < middle.reduce((a, b) => a + b));
    assert.ok(middle.reduce((a, b) => a + b) < last.reduce((a, b) => a + b));
    assert.ok(
      new Set(
        Array.from({ length: 64 }, (_, x) => rgb(result, 64, x, 4).join(",")),
      ).size > 45,
      "Shading must retain a gradual surface gradient",
    );
    for (let p = 0; p < mask.length; p++) {
      assert.notDeepEqual(
        result.slice(p * 4, p * 4 + 3),
        original.data.slice(p * 4, p * 4 + 3),
      );
      assert.equal(result[p * 4 + 3], 255);
    }
    assert.deepEqual(
      paintImage(original, result, mask, hex),
      result,
      "Reapplying a shade must not progressively tint or darken the wall",
    );
  }
});

test("painting a second coordinate region preserves the first and never mutates source pixels", () => {
  const original = image(20, 10, () => [210, 205, 195]);
  const saved = new Uint8ClampedArray(original.data);
  const left = polygonMask(20, 10, [
    [1, 1],
    [8, 1],
    [8, 9],
    [1, 9],
  ]);
  const right = polygonMask(20, 10, [
    [12, 1],
    [19, 1],
    [19, 9],
    [12, 9],
  ]);
  const first = paintImage(original, original.data, left, "#cc8855");
  const second = paintImage(original, first, right, "#6677aa");
  assert.deepEqual(rgb(second, 20, 4, 5), rgb(first, 20, 4, 5));
  assert.deepEqual(rgb(second, 20, 10, 5), rgb(saved, 20, 10, 5));
  assert.notDeepEqual(rgb(second, 20, 15, 5), rgb(first, 20, 15, 5));
  assert.deepEqual(original.data, saved);
  assert.deepEqual(
    paintImage(original, second, new Uint8Array(200), "#6677aa"),
    second,
  );
  assert.throws(() => paintImage(original, second, right, "red"));
});

test("quick selection is connected and does not cross a strong contrasting object edge", () => {
  const original = image(40, 20, (x) =>
    x === 20 ? [20, 20, 20] : [190, 185, 180],
  );
  const mask = connectedMask(original, 10, 10, 30);
  assert.equal(mask[10 * 40 + 10], 255);
  assert.equal(mask[10 * 40 + 20], 0);
  assert.equal(
    mask[10 * 40 + 30],
    0,
    "The same-colour wall beyond the object remains unselected",
  );
  assert.equal(mask.filter((value) => value > 0).length, 400);
  assert.equal(
    connectedMask(
      image(1, 1, () => [180, 180, 180]),
      0,
      0,
    )[0],
    255,
  );
  assert.throws(() => connectedMask(original, NaN, 3));
});

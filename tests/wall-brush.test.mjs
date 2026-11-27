/* Brush artwork is clipped in source-photo coordinates, never expands a wall
 * mask, and keeps independent base finishes and immutable Undo data intact. */
import { test } from "node:test";
import assert from "node:assert/strict";
import "../public/assets/photo-paint-studio.js";
const {
  polygonMask,
  subtractMask,
  brushBoundary,
  constrainedBrushMask,
  cropBrushMask,
  paintBrushLayer,
  eraseBrushLayers,
  renderSelectedPreview,
  paintImage,
  constrainDetectedWall,
} = globalThis.ArevaPaintStudio;
const width = 120,
  height = 100,
  count = width * height;
const image = {
  width,
  height,
  data: Uint8ClampedArray.from(
    Array.from({ length: count }, (_, p) => {
      const light = 80 + Math.floor(p / width);
      return [light + 20, light + 10, light, 255];
    }).flat(),
  ),
};
const polygon = (points) => polygonMask(width, height, points);
const left = polygon([
    [10, 10],
    [70, 10],
    [70, 90],
    [10, 90],
  ]),
  right = polygon([
    [75, 10],
    [115, 10],
    [115, 90],
    [75, 90],
  ]),
  window = polygon([
    [30, 25],
    [50, 25],
    [50, 55],
    [30, 55],
  ]),
  wall = subtractMask(left, window),
  trim = polygon([
    [60, 15],
    [68, 15],
    [68, 85],
    [60, 85],
  ]),
  boundary = brushBoundary(width, height, wall, [right, trim]);
const rgb = (im, x, y) =>
  Array.from(im.data.slice((y * width + x) * 4, (y * width + x) * 4 + 3));

test("fast brush strokes stop at the wall edge, window holes, roof, background and other known walls", () => {
  const originalBoundary = new Uint8Array(boundary),
    empty = new Uint8Array(count);
  const stroke = constrainedBrushMask(
    width,
    height,
    boundary,
    empty,
    [
      [15, 15],
      [115, 95],
      [15, 75],
    ],
    20,
  );
  assert.ok(stroke.some(Boolean));
  for (let p = 0; p < count; p++) assert.ok(stroke[p] <= boundary[p]);
  for (const [x, y] of [
    [35, 35],
    [80, 30],
    [5, 5],
    [64, 35],
    [119, 99],
  ])
    assert.equal(stroke[y * width + x], 0);
  assert.deepEqual(empty, new Uint8Array(count));
  assert.deepEqual(boundary, originalBoundary);
  const crop = cropBrushMask(stroke, width, height),
    painted = paintBrushLayer(image, image.data, wall, {
      ...crop,
      hex: "#EF1234",
    });
  for (let p = 0; p < count; p++)
    if (!boundary[p])
      assert.deepEqual(
        painted.slice(p * 4, p * 4 + 4),
        image.data.slice(p * 4, p * 4 + 4),
      );
});

test("brush rectangles are compact and use the wall lighting reference, matching a full-wall fill", () => {
  const coverage = constrainedBrushMask(
      width,
      height,
      wall,
      new Uint8Array(count),
      [
        [20, 20],
        [25, 25],
      ],
      4,
    ),
    crop = cropBrushMask(coverage, width, height);
  assert.ok(
    crop.data.length < count * 0.1,
    "A short stroke stores its small bounding rectangle",
  );
  const full = cropBrushMask(wall, width, height);
  assert.deepEqual(
    paintBrushLayer(image, image.data, wall, { ...full, hex: "#2D9AFF" }),
    paintImage(image, image.data, wall, "#2D9AFF"),
  );
  const painted = paintBrushLayer(image, image.data, wall, {
    ...crop,
    hex: "#2D9AFF",
  });
  assert.notDeepEqual(
    Array.from(painted.slice((20 * width + 20) * 4, (20 * width + 20) * 4 + 3)),
    rgb(image, 20, 20),
  );
  assert.equal(cropBrushMask(new Uint8Array(count), width, height), null);
});

test("multicolour artwork follows edit order without repainting an earlier wall's base when adding a stroke", () => {
  const stroke = constrainedBrushMask(
      width,
      height,
      boundary,
      new Uint8Array(count),
      [
        [20, 20],
        [20, 80],
      ],
      6,
    ),
    layer = {
      ...cropBrushMask(stroke, width, height),
      hex: "#EF1234",
      name: "Red",
      order: 3,
    };
  const finishes = [
    { mask: wall, hex: "#2D9AFF", order: 1, brushes: [layer] },
    { mask: right, hex: "#70A585", order: 2 },
  ];
  const result = renderSelectedPreview(image, finishes),
    base = renderSelectedPreview(
      image,
      finishes.map((s) => ({ ...s, brushes: [] })),
    );
  assert.notDeepEqual(rgb(result, 20, 40), rgb(base, 20, 40));
  assert.deepEqual(rgb(result, 55, 70), rgb(base, 55, 70));
  assert.deepEqual(rgb(result, 95, 40), rgb(base, 95, 40));
  assert.deepEqual(
    renderSelectedPreview(image, [...finishes].reverse()).data,
    result.data,
    "Explicit action order survives wall switching",
  );
  assert.deepEqual(rgb(result, 35, 35), rgb(image, 35, 35));
});

test("eraser removes only selected-wall brush marks and leaves primer, other colours and Undo masks intact", () => {
  const stroke = constrainedBrushMask(
      width,
      height,
      boundary,
      new Uint8Array(count),
      [
        [20, 20],
        [20, 80],
      ],
      7,
    ),
    layer = {
      ...cropBrushMask(stroke, width, height),
      hex: "#EF1234",
      name: "Red",
      order: 3,
    },
    saved = new Uint8Array(layer.data),
    eraser = constrainedBrushMask(
      width,
      height,
      boundary,
      new Uint8Array(count),
      [
        [20, 40],
        [110, 40],
      ],
      12,
    ),
    erased = eraseBrushLayers(width, height, [layer], eraser, boundary);
  assert.notDeepEqual(erased[0].data, saved);
  assert.deepEqual(layer.data, saved);
  const result = renderSelectedPreview(image, [
      { mask: wall, primed: true, order: 1, brushes: erased },
      { mask: right, hex: "#70A585", order: 2 },
    ]),
    base = renderSelectedPreview(image, [
      { mask: wall, primed: true, order: 1 },
      { mask: right, hex: "#70A585", order: 2 },
    ]);
  assert.deepEqual(rgb(result, 20, 40), rgb(base, 20, 40));
  assert.notDeepEqual(rgb(result, 20, 75), rgb(base, 20, 75));
  assert.deepEqual(rgb(result, 95, 40), rgb(base, 95, 40));
  assert.deepEqual(rgb(result, 35, 35), rgb(image, 35, 35));
  const unchanged = [layer];
  assert.equal(
    eraseBrushLayers(width, height, unchanged, new Uint8Array(count), boundary),
    unchanged,
  );
});

test("a full eraser pass clears antialiased boundary coverage without a coloured rim", () => {
  const soft = wall.map((alpha, p) =>
      Math.round(alpha * (p % width < 20 ? 0.5 : 1)),
    ),
    layer = { ...cropBrushMask(soft, width, height), hex: "#EF1234", order: 1 },
    saved = new Uint8Array(layer.data);
  const erased = eraseBrushLayers(
    width,
    height,
    [layer],
    new Uint8Array(soft),
    soft,
  );
  assert.deepEqual(
    erased,
    [],
    "Fully covered soft edges must be erased, not half-faded",
  );
  assert.deepEqual(layer.data, saved, "Undo still retains the original stroke");
  assert.deepEqual(
    renderSelectedPreview(image, [{ mask: soft, brushes: erased }]).data,
    image.data,
  );
});

test("point-local selection admits a dark concrete wall while preserving model cutouts and building bounds", () => {
  const dark = {
    width,
    height,
    data: Uint8ClampedArray.from(
      Array.from({ length: count }, (_, p) => {
        const x = p % width,
          y = Math.floor(p / width),
          v = x < 70 ? 210 : x < 115 && y > 10 && y < 90 ? 65 : 120;
        return [
          x >= 85 && x < 95 && y >= 25 && y < 55 ? 10 : v,
          x >= 85 && x < 95 && y >= 25 && y < 55 ? 10 : v,
          x >= 85 && x < 95 && y >= 25 && y < 55 ? 10 : v,
          255,
        ];
      }).flat(),
    ),
  };
  const opening = polygon([
      [85, 25],
      [95, 25],
      [95, 55],
      [85, 55],
    ]),
    fine = subtractMask(right, opening),
    body = polygon([
      [5, 5],
      [115, 5],
      [115, 95],
      [5, 95],
    ]),
    globalMaterial = left;
  const selected = constrainDetectedWall(
    dark,
    fine,
    body,
    globalMaterial,
    [80, 50],
  );
  assert.equal(selected[50 * width + 80], 255);
  assert.equal(selected[40 * width + 90], 0);
  assert.equal(selected[40 * width + 20], 0);
  assert.throws(
    () => constrainDetectedWall(dark, right, body, globalMaterial, [90, 40]),
    /window or opening/,
  );
  assert.throws(() =>
    constrainDetectedWall(dark, fine, body, globalMaterial, [119, 50]),
  );
});

test("brush helpers reject mismatched masks and corrupt rectangles without mutating the source", () => {
  assert.throws(() => brushBoundary(width, height, new Uint8Array(1)));
  assert.throws(() =>
    constrainedBrushMask(
      width,
      height,
      new Uint8Array(1),
      new Uint8Array(count),
      [[20, 20]],
      4,
    ),
  );
  assert.throws(() => cropBrushMask(new Uint8Array(1), width, height));
  assert.throws(() =>
    paintBrushLayer(image, image.data, wall, {
      x: -1,
      y: 0,
      width: 1,
      height: 1,
      data: new Uint8Array([255]),
      hex: "#EF1234",
    }),
  );
  assert.throws(() =>
    eraseBrushLayers(width, height, [], new Uint8Array(1), boundary),
  );
});

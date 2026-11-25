/* Geometry and colour regressions use synthetic pixels, not hosted customer photos.
 * Both public renderers load this exact shared engine.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import "../public/assets/photo-paint-studio.js";

const {
  polygonMask,
  subtractMask,
  connectedMask,
  paintImage,
  validPolygon,
  brushMask,
  composeImage,
  presetWallRegions,
} = globalThis.ArevaPaintStudio;
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

test("every room preset has distinct, bounded wall selections at both photo resolutions", () => {
  for (const id of [
    "nordic-living",
    "master-bedroom",
    "kitchen-studio",
    "modern-villa",
    "office-studio",
  ])
    for (const [width, height] of [
      [900, 502],
      [960, 536],
    ]) {
      const regions = presetWallRegions(width, height, id);
      assert.ok(regions.length >= 2, `${id} should offer separate walls`);
      assert.equal(
        new Set(regions.map((region) => region.regionKey)).size,
        regions.length,
      );
      for (const region of regions) {
        assert.equal(region.mask.length, width * height);
        const selected = region.mask.filter((value) => value > 0).length;
        assert.ok(
          selected > width * height * 0.005,
          `${region.regionKey}: usable wall area`,
        );
        assert.ok(
          selected < width * height * 0.5,
          `${region.regionKey}: cannot paint the entire home`,
        );
      }
      for (let i = 0; i < regions.length; i++)
        for (let j = i + 1; j < regions.length; j++)
          assert.equal(
            regions[i].mask.some(
              (value, p) => value > 127 && regions[j].mask[p] > 127,
            ),
            false,
            `${id}: wall regions must not overlap`,
          );
    }
  assert.deepEqual(
    presetWallRegions(20, 20, "customer-upload"),
    [],
    "Unknown/uploaded photos need an explicit user outline",
  );
});

test("sample wall masks preserve furniture and leave another same-colour wall untouched", () => {
  const original = image(1000, 600, () => [211, 207, 198]);
  const [sofa, window] = presetWallRegions(1000, 600, "nordic-living");
  const painted = composeImage(original, [{ ...sofa, hex: "#b67b99" }]);
  const point = (x, y) => rgb(painted.data, 1000, x, Math.floor(y * 0.6));
  assert.notDeepEqual(
    point(500, 300),
    [211, 207, 198],
    "Selected wall gets the chosen shade",
  );
  for (const [x, y] of [
    [500, 750],
    [700, 400],
    [270, 510],
    [250, 100],
    [875, 500],
    [930, 400],
    [400, 950],
  ])
    assert.deepEqual(
      point(x, y),
      [211, 207, 198],
      "Sofa, framed art, switch, other wall, window and floor stay untouched",
    );
  const changed = composeImage(original, [
    { ...sofa, hex: "#b67b99" },
    { ...window, hex: "#698d98" },
  ]);
  assert.deepEqual(
    rgb(changed.data, 1000, 500, 180),
    point(500, 300),
    "Painting the next wall retains the first wall's shade",
  );
  assert.notDeepEqual(rgb(changed.data, 1000, 875, 300), point(875, 500));
});

test("brush strokes cover fast pointer movement and leave surrounding pixels untouched", () => {
  const blank = new Uint8Array(80 * 50);
  const mask = brushMask(
    80,
    50,
    blank,
    [
      [10, 25],
      [70, 25],
    ],
    5,
  );
  assert.ok(
    blank.every((value) => value === 0),
    "Saved masks must not be changed in place",
  );
  for (let x = 10; x < 70; x++) assert.equal(mask[25 * 80 + x], 255);
  for (const [x, y] of [
    [0, 0],
    [40, 15],
    [40, 35],
    [79, 49],
  ])
    assert.equal(mask[y * 80 + x], 0);
  assert.ok(
    mask.some((value) => value > 0 && value < 255),
    "Brush edges should be smooth",
  );
  assert.deepEqual(
    brushMask(
      80,
      50,
      mask,
      [
        [10, 25],
        [70, 25],
      ],
      5,
    ),
    mask,
    "A repeated stroke must not build up edge opacity",
  );
});

test("an eraser protects openings after painting and a later shade change keeps them clear", () => {
  const original = image(40, 30, () => [205, 198, 181]);
  const filled = polygonMask(40, 30, [
    [2, 2],
    [38, 2],
    [38, 28],
    [2, 28],
  ]);
  const erased = brushMask(
    40,
    30,
    filled,
    [
      [20, 10],
      [20, 22],
    ],
    5,
    true,
  );
  assert.equal(erased[15 * 40 + 20], 0);
  assert.equal(filled[15 * 40 + 20], 255);
  for (const hex of ["#d4b25e", "#59858b", "#c67668"]) {
    const output = composeImage(original, [{ mask: erased, hex }]);
    assert.deepEqual(
      rgb(output.data, 40, 20, 15),
      rgb(original.data, 40, 20, 15),
    );
    assert.notDeepEqual(
      rgb(output.data, 40, 7, 15),
      rgb(original.data, 40, 7, 15),
    );
  }
});

test("named wall recomposition isolates shade changes and restores lower walls on erase/remove", () => {
  const original = image(24, 16, () => [211, 207, 198]);
  const first = {
    mask: polygonMask(24, 16, [
      [2, 2],
      [14, 2],
      [14, 14],
      [2, 14],
    ]),
    hex: "#a282bb",
  };
  const second = {
    mask: polygonMask(24, 16, [
      [10, 4],
      [22, 4],
      [22, 13],
      [10, 13],
    ]),
    hex: "#59928b",
  };
  const before = composeImage(original, [first, second]);
  const changed = composeImage(original, [
    { ...first, hex: "#cc8855" },
    second,
  ]);
  assert.deepEqual(rgb(before.data, 24, 18, 8), rgb(changed.data, 24, 18, 8));
  assert.notDeepEqual(rgb(before.data, 24, 5, 8), rgb(changed.data, 24, 5, 8));
  const cut = {
    ...second,
    mask: brushMask(24, 16, second.mask, [[12, 8]], 3, true),
  };
  const erased = composeImage(original, [first, cut]);
  assert.deepEqual(
    rgb(erased.data, 24, 12, 8),
    rgb(composeImage(original, [first]).data, 24, 12, 8),
  );
  assert.deepEqual(composeImage(original, []).data, original.data);
  assert.deepEqual(
    composeImage(original, [first, second]).data,
    before.data,
    "Shade trials start from the untouched photo",
  );
  assert.throws(() => composeImage(original, Array(9).fill(first)));
});

test("edge and out-of-bounds brush gestures stay clipped to valid image coordinates", () => {
  const mask = brushMask(
    10,
    8,
    new Uint8Array(80),
    [
      [-4, -4],
      [15, 12],
    ],
    2,
  );
  assert.equal(mask.length, 80);
  assert.ok(mask.some((value) => value > 0));
  for (const invalid of [0, -2, Infinity, NaN, 513])
    assert.throws(() =>
      brushMask(10, 8, new Uint8Array(80), [[3, 4]], invalid),
    );
  assert.throws(() => brushMask(10, 8, new Uint8Array(80), [[NaN, 4]], 2));
});

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

test("one wall tap follows neutral shadows instead of leaving the darker half unpainted", () => {
  const original = image(90, 60, (x, y) => {
    const light = 220 - y * 2.25 + ((x + y) % 2 ? 6 : -6);
    return [light, light, light];
  });
  const mask = connectedMask(original, 20, 5);
  assert.ok(
    mask.every((value) => value === 255),
    "A continuous wall should include its shaded lower area",
  );
  assert.deepEqual(
    original.data.slice(0, 4),
    new Uint8ClampedArray([214, 214, 214, 255]),
  );
});

test("wall texture does not create speckled gaps while openings and separate walls stay protected", () => {
  const original = image(100, 70, (x, y) => {
    if (x >= 76 && x < 80) return [35, 110, 200];
    if (x >= 30 && x < 50 && y >= 20 && y < 50) return [30, 30, 30];
    const value = 205 - y * 1.3 + ((x + y) % 2 ? 17 : -17);
    return [value, value, value];
  });
  const mask = connectedMask(original, 15, 10);
  let wall = 0,
    selected = 0;
  for (let y = 0; y < 70; y++)
    for (let x = 0; x < 76; x++) {
      if (x >= 30 && x < 50 && y >= 20 && y < 50) continue;
      wall++;
      if (mask[y * 100 + x]) selected++;
    }
  assert.ok(
    selected / wall > 0.97,
    "Textured wall coverage should remain continuous",
  );
  for (const [x, y] of [
    [35, 30],
    [45, 40],
    [77, 20],
    [90, 40],
  ])
    assert.equal(mask[y * 100 + x], 0);
});

test("selection does not travel through a warmer floor into another wall", () => {
  const original = image(100, 70, (x, y) => {
    if (y >= 50) return [183, 160, 139];
    if (y < 10 || x < 10 || (x >= 65 && x < 68)) return [118, 179, 223];
    const ratio = (y - 10) / 40;
    return [238 - ratio * 102, 227 - ratio * 97, 205 - ratio * 86];
  });
  const mask = connectedMask(original, 20, 15);
  assert.equal(mask[40 * 100 + 20], 255, "Shaded wall remains selected");
  assert.equal(mask[60 * 100 + 30], 0, "Floor is not a bridge between walls");
  assert.equal(
    mask[30 * 100 + 85],
    0,
    "Neighbouring wall keeps its own colour",
  );
});

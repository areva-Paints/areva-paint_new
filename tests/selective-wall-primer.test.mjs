/* Pixel-level guarantees for optional, selected-wall primer. Source pixels and
 * other wall finishes must survive selection, priming, recolouring and reset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import "../public/assets/photo-paint-studio.js";
const { renderSelectedPreview, polygonMask, subtractMask } =
  globalThis.ArevaPaintStudio;
const original = {
  width: 100,
  height: 80,
  data: Uint8ClampedArray.from(
    Array.from({ length: 8000 }, (_, p) => {
      const y = Math.floor(p / 100);
      return [120 + y, 105 + y, 85 + y, 255];
    }).flat(),
  ),
};
const left = polygonMask(100, 80, [
    [5, 5],
    [45, 5],
    [45, 75],
    [5, 75],
  ]),
  right = polygonMask(100, 80, [
    [55, 5],
    [95, 5],
    [95, 75],
    [55, 75],
  ]),
  opening = polygonMask(100, 80, [
    [15, 25],
    [30, 25],
    [30, 55],
    [15, 55],
  ]),
  wall = subtractMask(left, opening);
const rgb = (image, x, y) =>
  Array.from(image.data.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 3));

test("loading and selecting any unedited wall preserve every source pixel", () => {
  const saved = new Uint8ClampedArray(original.data);
  assert.deepEqual(renderSelectedPreview(original, []).data, saved);
  const selected = [
    { mask: wall, primed: false, hex: null },
    { mask: right, primed: false, hex: null },
  ];
  assert.deepEqual(renderSelectedPreview(original, selected).data, saved);
  assert.deepEqual(original.data, saved);
  assert.notEqual(
    renderSelectedPreview(original, selected).data,
    original.data,
  );
});

test("optional primer changes only its selected wall; direct colour needs no primer", () => {
  const primed = renderSelectedPreview(original, [
    { mask: wall, primed: true },
  ]);
  const white = rgb(primed, 10, 20);
  assert.ok(white[0] > 200);
  assert.equal(white[0], white[1]);
  assert.equal(white[1], white[2]);
  for (let p = 0; p < wall.length; p++)
    if (!wall[p])
      assert.deepEqual(
        primed.data.slice(p * 4, p * 4 + 4),
        original.data.slice(p * 4, p * 4 + 4),
      );
  const direct = renderSelectedPreview(original, [
    { mask: right, primed: false, hex: "#2D9AFF" },
  ]);
  assert.notDeepEqual(rgb(direct, 70, 30), rgb(original, 70, 30));
  assert.deepEqual(rgb(direct, 10, 20), rgb(original, 10, 20));
  const combined = renderSelectedPreview(original, [
    { mask: wall, primed: true },
    { mask: right, hex: "#2D9AFF" },
  ]);
  assert.deepEqual(rgb(combined, 10, 20), rgb(primed, 10, 20));
  assert.deepEqual(rgb(combined, 70, 30), rgb(direct, 70, 30));
  assert.deepEqual(
    rgb(combined, 20, 40),
    rgb(original, 20, 40),
    "Window stays unchanged",
  );
  for (const hex of ["#2D9AFF", "#70A585", "#EF1234"]) {
    const repainted = renderSelectedPreview(original, [
      { mask: wall, primed: true, hex },
      { mask: right, hex: "#2D9AFF" },
    ]);
    assert.deepEqual(rgb(repainted, 70, 30), rgb(direct, 70, 30));
    assert.deepEqual(
      renderSelectedPreview(original, [{ mask: wall, hex }]).data,
      renderSelectedPreview(original, [{ mask: wall, primed: true, hex }]).data,
      "Primer is optional for accurate, non-accumulating colour rendering",
    );
  }
  assert.deepEqual(
    renderSelectedPreview(original, []).data,
    original.data,
    "Reset restores the raw photo",
  );
});

test("nested wall/trim finishes respect action order without editing outside either selection", () => {
  const trim = polygonMask(100, 80, [
    [5, 5],
    [45, 5],
    [45, 15],
    [5, 15],
  ]);
  const accent = { mask: trim, hex: "#70A585" },
    primer = { mask: wall, primed: true };
  const accentLast = renderSelectedPreview(original, [primer, accent]);
  assert.deepEqual(
    rgb(accentLast, 10, 10),
    rgb(renderSelectedPreview(original, [accent]), 10, 10),
  );
  const primerLast = renderSelectedPreview(original, [accent, primer]);
  assert.deepEqual(
    rgb(primerLast, 10, 10),
    rgb(renderSelectedPreview(original, [primer]), 10, 10),
  );
  assert.deepEqual(rgb(primerLast, 70, 30), rgb(original, 70, 30));
  assert.deepEqual(rgb(primerLast, 20, 40), rgb(original, 20, 40));
});

test("selective rendering rejects corrupt masks/source and bounds the number of surfaces", () => {
  assert.throws(() =>
    renderSelectedPreview(original, [{ mask: new Uint8Array(1) }]),
  );
  assert.throws(() =>
    renderSelectedPreview(original, Array(17).fill({ mask: wall })),
  );
  assert.throws(() =>
    renderSelectedPreview({ ...original, data: new Uint8ClampedArray(4) }, []),
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseColourRows } from "../src/admin/colour-import.ts";
test("preview explicit name, code and HEX rows without guessing colour values", () => {
  const result = parseColourRows(
    "Coastal Mist | AR901 | #b3ccd5\nWarm Ivory, AR902, #F5E9D0\nOcean Blue AR903 #123456\nScanned swatch without a HEX value\nBad Hex | AR904 | #XYZXYZ",
  );
  assert.equal(result.colours.length, 3);
  assert.equal(result.rejected, 2);
  assert.equal(result.colours[0].name, "Coastal Mist");
  assert.equal(result.colours[0].hex, "#B3CCD5");
  assert.equal(result.colours[2].code, "AR903");
});

import { normalizeShade, filterShades } from "../src/data/shadeFamilies.ts";
test("family and overlapping tone metadata survive default and explicit imports", () => {
  const result = parseColourRows(
    "Sun Gold | AR950 | #FFCC33\nRose | AR951 | #EE6688 | Reds & Pinks | Warm+Vibrant\nWrong | AR952 | #112233 | Unknown\nWrong tone | AR953 | #112233 | Blues | Neon",
    { family: "Yellows", tones: ["Warm", "Light"] },
  );
  assert.equal(result.rejected, 2);
  assert.deepEqual(
    result.colours.map((c) => [c.family, c.tones]),
    [
      ["Yellows", ["Warm", "Light"]],
      ["Reds & Pinks", ["Warm", "Vibrant"]],
    ],
  );
  assert.equal(
    filterShades(result.colours, "Yellows", "Warm", "ar950").length,
    1,
  );
  assert.equal(filterShades(result.colours, "Yellows", "Cool", "").length, 0);
});
test("legacy grouping keeps HEX and explicit metadata; canonical untagged shades stay untagged", () => {
  const old = {
    name: "Legacy",
    code: "OLD",
    hex: "#6c4cf5",
    family: "Vibrant Accents",
    goesWellWith: [],
  };
  const grouped = normalizeShade(old);
  assert.equal(grouped.family, "Violets");
  assert.equal(grouped.hex, old.hex);
  assert.ok(grouped.tones.includes("Vibrant"));
  assert.deepEqual(
    normalizeShade({ ...old, family: "Yellows", tones: [] }).tones,
    [],
  );
  assert.equal(normalizeShade({ ...old, family: "Yellows" }).family, "Yellows");
});

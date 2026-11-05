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

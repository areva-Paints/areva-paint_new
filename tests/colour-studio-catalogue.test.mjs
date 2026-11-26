/* Published catalogue records keep their explicit family and identity across
 * the API, preserved page, and React palette. No RGB-based regrouping is allowed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalogueFamilies, filterShades } from "../src/data/shadeFamilies.ts";
import { ShadeLibrary } from "../src/components/ShadeLibrary.tsx";
import { testServer } from "./helpers/server.mjs";

const colours = [
  {
    name: "Red saved under Blues & <test>",
    code: "SYNC01",
    hex: "#EF1234",
    family: "Blues",
    tones: ["Warm"],
    goesWellWith: [],
  },
  {
    name: "Same HEX, different record",
    code: "SYNC02",
    hex: "#EF1234",
    family: "Greens",
    tones: [],
    goesWellWith: [],
  },
  {
    name: "Deep Sea",
    code: "SYNC03",
    hex: "#213255",
    family: "Blues",
    tones: ["Cool"],
    goesWellWith: [],
  },
];

test("visualizer families and cards come from saved metadata, with no fabricated fallback colours", () => {
  assert.deepEqual(catalogueFamilies(colours), [
    { name: "Blues", color: "#EF1234" },
    { name: "Greens", color: "#EF1234" },
  ]);
  assert.deepEqual(
    filterShades(colours, "Blues", "All", "").map((s) => s.code),
    ["SYNC01", "SYNC03"],
  );
  assert.deepEqual(
    filterShades(colours, "Greens", "All", "").map((s) => s.code),
    ["SYNC02"],
  );
  const html = renderToStaticMarkup(
    React.createElement(ShadeLibrary, {
      shades: colours,
      visualizer: true,
      selectedCode: "SYNC02",
    }),
  );
  assert.deepEqual(
    [...html.matchAll(/data-shade-family="([^"]+)"/g)].map((m) => m[1]),
    ["All Shades", "Blues", "Greens"],
  );
  assert.equal(
    (html.match(/class="shade-swatch"/g) || []).length,
    colours.length,
  );
  assert.equal(
    (html.match(/aria-pressed="true" aria-label="Apply /g) || []).length,
    1,
    "Same-HEX records are selected by code",
  );
  assert.ok(html.includes("Red saved under Blues &amp; &lt;test&gt;"));
  assert.ok(!html.includes("White base"));
  const empty = renderToStaticMarkup(
    React.createElement(ShadeLibrary, { shades: [], visualizer: true }),
  );
  assert.ok(!empty.includes('class="shade-swatch"'));
  assert.deepEqual(
    [...empty.matchAll(/data-shade-family="([^"]+)"/g)].map((m) => m[1]),
    ["All Shades"],
  );
});

test("a published catalogue replaces the API and page records without default families or duplicate shades", async () => {
  const s = await testServer();
  try {
    await s.start();
    await s.login();
    const current = await (await s.request("/api/admin/content")).json();
    const save = await s.request(
      "/api/admin/content",
      { ...current, colours },
      "PUT",
    );
    assert.equal(save.status, 200);
    const content = await (await s.request("/api/content")).json();
    assert.deepEqual(content.colours, colours);
    const blue = await (await s.request("/api/shades?family=Blues")).json();
    assert.deepEqual(
      blue.shades.map((shade) => shade.code),
      ["SYNC01", "SYNC03"],
    );
    const html = await (await s.request("/attached-page")).text();
    const palette = html.slice(
      html.indexOf('class="colour-shade-panel"'),
      html.indexOf('id="calculator"'),
    );
    assert.ok(palette.includes('data-shade-code="SYNC01"'));
    assert.ok(palette.includes('data-shade-family-name="Blues"'));
    assert.ok(!palette.includes('data-shade-family="Oranges"'));
    assert.ok(!palette.includes('class="colour-shade-panel" hidden'));
    assert.ok(html.includes("/assets/shade-catalogue.js?v=1"));
    assert.ok(
      html.indexOf('class="colour-room-panel"') <
        html.indexOf('id="photoPaintViewport"'),
    );
  } finally {
    await s.dispose();
  }
});

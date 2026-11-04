import fs from "node:fs";
import path from "node:path";
import { readContent } from "./content-store";
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function legacyPage() {
  let html = fs.readFileSync(
    path.resolve("public/assets/aistudio/areva-paints_a2364c60.html"),
    "utf8",
  );
  const c = readContent();
  if (c.revision === 0) return html;
  const cats = [
    "interior",
    "exterior",
    "waterproofing",
    "tile-adhesives",
    "sealants",
    "putty-primers",
    "textures",
    "chemicals",
  ];
  const productData = c.products.map((p) => [
    esc(p.name),
    cats.indexOf(p.categoryId),
    esc(p.description),
    [
      esc(p.tagline),
      p.coverageSqFtPerLiter > 0
        ? `${p.coverageSqFtPerLiter} sq ft/${p.coverageUnit || "L"} per coat`
        : "Coverage awaiting confirmation",
      `${p.recommendedCoats} recommended coats`,
    ],
    esc(p.image),
  ]);
  const coverage = c.products
    .filter((p) => p.coverageSqFtPerLiter > 0)
    .map((p) => [
      esc(p.name),
      {
        interior: "Interior",
        exterior: "Exterior",
        waterproofing: "Waterproofing",
        "putty-primers": "Primer & putty",
        "tile-adhesives": "Tile",
      }[p.categoryId] || "Interior",
      p.coverageSqFtPerLiter,
      0,
      esc(p.sheen),
      p.coverageUnit || "L",
      p.calculationBasis || "wall",
    ]);
  const dealers = c.dealers.map((d) => ({
    ...d,
    ...Object.fromEntries(
      ["name", "city", "state", "address", "phone", "pin"].map((k) => [
        k,
        esc(d[k]),
      ]),
    ),
    badges: d.badges.map(esc),
  }));
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  html = html.replace(
    "const $ =",
    `P.splice(0,P.length,...${json(productData)});\nconst $ =`,
  );
  html = html.replace(
    'let cfl="All";',
    `PR.splice(0,PR.length,...${json(coverage)});\nlet cfl="All";`,
  );
  html = html.replace(
    "const ST=[",
    `DEALERS.splice(0,DEALERS.length,...${json(dealers)});\nconst ST=[`,
  );
  html = html.replace(
    'let activeState="All";',
    `ST.splice(0,ST.length,'All',...new Set(DEALERS.map(d=>d.state)));\nlet activeState="All";`,
  );
  // No selling price is configured in administration; do not present a zero-price estimate.
  html = html.replace('d.cost.toLocaleString("en-IN")', "'Contact dealer'");
  html = html
    .replace("Estimated cost: <b>₹", "Price: <b>")
    .replace(" <small>(sample rate)</small>", "");
  html = html
    .replace('$("#dName").textContent=p[0]', '$("#dName").innerHTML=p[0]')
    .replace('$("#dDesc").textContent=p[2]', '$("#dDesc").innerHTML=p[2]');
  if (c.landingImages.length) {
    const slides = c.landingImages
      .map(
        (l) =>
          `<div class="slide pic"><img src="${esc(l.image)}" alt="${esc(l.label)}"><div style="position:absolute;bottom:30px;left:30px;background:#ffffffed;padding:16px;border-radius:16px"><h2>${esc(l.label)}</h2><p>${esc(l.roomType)}</p></div></div>`,
      )
      .join("");
    html = html.replace(
      /(<div class="track" id="track">)[\s\S]*?(<div class="ctrl" id="dots")/,
      `$1${slides}</div>\n$2`,
    );
  }
  return html;
}

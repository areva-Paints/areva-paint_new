import { renderProjectGallery } from "./project-gallery-page";
import { referenceLayout } from "./reference-layout";
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
  html = html.replace("<!-- PROJECT_GALLERY -->", () =>
    renderProjectGallery(c.galleryProjects, c.galleryAds),
  );
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
      ...(p.availableSizes.length
        ? [
            `Pack sizes: ${p.availableSizes.join(", ")} ${p.coverageUnit || "L"}`,
          ]
        : []),
      ...Object.entries({
        Finish: p.sheen,
        "Drying time": p.specs.dryingTime,
        "Recoat time": p.specs.recoatTime,
        Application: p.specs.applicationMethod,
        "Surface preparation": p.specs.surfacePreparation,
      })
        .filter(([, v]) => v)
        .map(([key, v]) => esc(`${key}: ${v}`)),
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
    () => `P.splice(0,P.length,...${json(productData)});\nconst $ =`,
  );
  html = html.replace(
    'let cfl="All";',
    () => `PR.splice(0,PR.length,...${json(coverage)});\nlet cfl="All";`,
  );
  html = html.replace(
    "const ST=[",
    () => `DEALERS.splice(0,DEALERS.length,...${json(dealers)});\nconst ST=[`,
  );
  html = html.replace(
    'let activeState="All";',
    () =>
      `ST.splice(0,ST.length,'All',...new Set(DEALERS.map(d=>d.state)));\nlet activeState="All";`,
  );
  html = html.replace(
    "const save=()=>",
    () =>
      `C.splice(0,C.length,...${json(c.colours.map((s) => [esc(s.name), esc(s.code), s.hex]))});\nconst save=()=>`,
  );
  html = html.replace(
    'paint(C[5][2], C[5][0]+" ("+C[5][1]+")")',
    'paint((C[5]||C[0])[2], (C[5]||C[0])[0]+" ("+(C[5]||C[0])[1]+")")',
  );
  if (c.shadeCards.length) {
    const cards =
      '<div class="wrap" style="padding:20px"><h3>Download colour shade cards</h3>' +
      c.shadeCards
        .map(
          (card) =>
            `<a class="btn btn-line" href="${esc(card.url)}" download>${esc(card.title)} (PDF)</a>`,
        )
        .join(" ") +
      "</div>";
    html = html.replace("<footer>", () => cards + "<footer>");
  }
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
          `<div class="slide pic"><img src="${esc(l.image)}" alt="${esc(l.label || "Landing image")}">${l.label || l.roomType ? `<div style="position:absolute;bottom:30px;left:30px;background:#ffffffed;padding:16px;border-radius:16px">${l.label ? `<h2>${esc(l.label)}</h2>` : ""}${l.roomType ? `<p>${esc(l.roomType)}</p>` : ""}</div>` : ""}</div>`,
      )
      .join("");
    html = html.replace(
      /(<div class="track" id="track">)[\s\S]*?(<div class="ctrl" id="dots")/,
      (_match, start, end) => `${start}${slides}</div>\n${end}`,
    );
  }
  // Replace the template's demo-only sign-in with the real account flow.
  html = html.replace(
    /<dialog id="lg">[\s\S]*?<\/dialog>/,
    () =>
      `<dialog id="lg" aria-labelledby="account-signin-title"><button class="close" id="lx" aria-label="Close sign in">×</button><div class="bd" style="padding-top:2.6rem"><h3 id="account-signin-title">Sign in</h3><div class="chips" id="roles"></div><p id="account-error" role="alert"></p><form id="lf" style="box-shadow:none;border:0;padding:0"><label>Email or username<input name="username" type="text" required maxlength="160" autocomplete="username"></label><label>Password<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="btn btn-main" type="submit">Sign in</button></form><div id="dash"></div><p class="note">Use the account created by your administrator. Only admins can create users.</p></div></dialog>`,
  );
  html = html.replace(
    /let role="Customer",signed=false;[\s\S]*?\$\("#lx"\)\.onclick=\(\)=>\$\("#lg"\)\.close\(\);/,
    "",
  );
  html = html.replace(
    /else if\(d\.r\)\{if\(d\.r==="Admin"\)[^\n]+/,
    "else if(d.r){window.arevaOpenAccount?.(d.r)}});",
  );
  html = html.replace(
    "</body>",
    '<script src="/assets/account-access.js" defer></script></body>',
  );
  html = html.replace("\nroles();\n", "\n");
  return referenceLayout(html, c);
}

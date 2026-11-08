import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DreamsHero } from "../components/DreamsHero";
import type { SiteContent } from "./content-types";
import { CATEGORIES } from "../data/paintsData";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** Apply the supplied corporate concept around the existing functional page. */
export function referenceLayout(html: string, content: SiteContent) {
  html = html.replace("</head>", '<link rel="stylesheet" href="/assets/dreams-hero.css"></head>');
  const logo =
    html.match(/<a class="logo"[^>]*>(<img[^>]+>)<\/a>/)?.[1] || "Areva Paints";
  html = html.replace(
    /<header>[\s\S]*?<\/header>/,
    () => `<header class="ref-header">
    <div class="topbar"><div class="wrap"><span>Paint your dreams</span><span id="today"></span></div></div>
    <div class="wrap nav"><a class="logo" href="#home" aria-label="Areva Paints home">${logo}</a>
      <nav aria-label="Main"><ul>
        <li><a href="#home" data-ref-nav="home">Home</a></li>
        <li><a href="#products" data-ref-nav="products">Products</a></li>
        <li><a href="#visualizer" data-ref-nav="visualizer">Colour Visualizer</a></li>
        <li><a href="#calculator" data-ref-nav="calculator">Paint Calculator</a></li>
        <li><a href="#gallery" data-ref-nav="gallery">Gallery</a></li>
        <li><details class="ref-more"><summary>More</summary><div>
          <a href="#services" data-ref-nav="services">Services</a><a href="#about" data-ref-nav="about">About Areva</a>
          <a href="#portals" data-ref-nav="portals">Authorised dealers</a><a href="#certs">Documents</a><a href="#contact" data-ref-nav="contact">Contact</a>
          <a href="/admin" target="_top">Admin portal</a>
        </div></details></li>
      </ul></nav><div class="ref-nav-actions"><button class="btn btn-line" data-r="Customer">Login</button><a class="btn btn-main" href="#contact">Enquire now</a></div>
    </div></header>`,
  );
  const start = html.indexOf('<div class="wrap hero">');
  const end = html.indexOf('<div class="mq"', start);
  if (start !== -1 && end !== -1) {
    const original = html.slice(start, end),
      statsStart = original.indexOf('<div class="stats">');
    const carousel = original.slice(
      '<div class="wrap hero">'.length,
      statsStart,
    );
    const stats = original.slice(statsStart).replace(/<\/div>\s*$/, "");
    const solutions = CATEGORIES.map((category) =>
      `<a class="ref-solution" href="#products/${category.id}" aria-label="Explore ${escapeHtml(category.name)}"><span class="ref-solution-icon" aria-hidden="true">${category.icon}</span><span class="ref-solution-copy"><b>${escapeHtml(category.name)}</b><small>${escapeHtml(category.description)}</small></span></a>`,
    ).join("");
    const home = `<section id="home" class="ref-home" data-ref-view="home">
      ${renderToStaticMarkup(createElement(DreamsHero))}
      <section class="ref-campaign-section" aria-label="Latest from Areva"><div class="wrap"><div class="ref-campaign-heading"><span class="ref-eyebrow">COLOUR. COMMUNITY. POSSIBILITIES.</span><h2>Latest from Areva</h2><p>Discover our latest updates, collections and moments from the Areva family.</p></div><div class="ref-campaign">${carousel}</div></div></section>
      <div class="ref-benefits"><div class="wrap"><a href="#visualizer"><span aria-hidden="true">◉</span>Colour visualizer</a><a href="#products"><span aria-hidden="true">✦</span>Specialist coatings</a><a href="#calculator"><span aria-hidden="true">▧</span>Paint calculator</a><a href="#services"><span aria-hidden="true">◇</span>Expert guidance</a><a href="#portals"><span aria-hidden="true">⌖</span>Dealer network</a></div></div>
      <div class="ref-solutions-band" id="solutions"><div class="wrap ref-solutions"><span class="ref-eyebrow">MADE FOR EVERY SPACE</span><h2>Solutions for every surface</h2><p class="lead">Explore the right finish, from your first coat to the final detail.</p><div class="ref-solution-grid">${solutions}</div><a class="btn btn-line ref-view-all" href="#products/all">View all products <span aria-hidden="true">→</span></a></div></div>
      <div class="wrap ref-home-stats">${stats}</div>
    </section>\n`;
    html = html.slice(0, start) + home + html.slice(end);
  }
  const banners = [
    [
      "products",
      "Our paint collection",
      "Find your perfect finish",
      "Explore every category, compare the details and choose the right coating for your space.",
    ],
    [
      "visualizer",
      "Colour visualizer",
      "See the possibilities",
      "Try colours in a ready room, upload your own home or explore them through your camera.",
    ],
    [
      "calculator",
      "Paint calculator",
      "Plan with confidence",
      "Use your selected product’s coverage to estimate paint for your project.",
    ],
  ];
  for (const [id, eyebrow, title, copy] of banners) {
    html = html.replace(
      new RegExp(`(<section id="${id}"[^>]*>)`),
      () =>
        `<section id="${id}" data-ref-view="${id}"><div class="ref-page-banner"><div class="wrap"><span class="ref-eyebrow">HOME / ${eyebrow.toUpperCase()}</span><h1>${title}</h1><p>${copy}</p></div></div>`,
    );
  }
  const specs = content.products.map((p) => {
    const fields = [
      ["FINISH", p.sheen],
      [
        "COVERAGE",
        p.coverageSqFtPerLiter > 0
          ? `${p.coverageSqFtPerLiter} sq ft/${p.coverageUnit || "L"}/coat`
          : "Ask for technical guidance",
      ],
      [
        "PACK SIZES",
        p.availableSizes
          ?.map((n) => `${n} ${p.coverageUnit || "L"}`)
          .join(" · "),
      ],
      ["RECOMMENDED COATS", String(p.recommendedCoats)],
      ["DRYING TIME", p.specs.dryingTime],
      ["APPLICATION", p.specs.applicationMethod],
    ].filter(([, value]) => value);
    return `<dl class="ref-product-specs">${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
  });
  const json = JSON.stringify(specs).replace(/</g, "\\u003c");
  html = html.replace(
    "const $ =",
    () => `const REFERENCE_PRODUCT_SPEC_HTML=${json};\nconst $ =`,
  );
  html = html.replace(
    /<h2>Products for every surface<\/h2>[\s\S]*?<div class="tiles" id="tiles"><\/div>/,
    "",
  );
  html = html.replace(/function renderTiles\(\)\{[\s\S]*?\n\}/, "");
  html = html.replace(
    '<div class="grid" id="grid"',
    '<p class="lead ref-category-intro" id="refCategoryIntro" hidden></p><div class="grid" id="grid"',
  );
  html = html.replace(
    /function renderGrid\(\)\{[\s\S]*?\n\}/,
    () => `function renderGrid(){
  const list=P.map((p,i)=>[p,i]).filter(([p])=>sel.c===null||p[1]===sel.c);
  $("#listTitle").textContent=sel.c===null?"All products":"Our "+cats[sel.c][0];
  $("#showAll").hidden=sel.c===null;
  $("#showAll").textContent="All product types";
  $("#grid").innerHTML=list.map(([p,i])=>{const c=cats[p[1]];return '<article class="card ref-category-product"><div class="product-copy"><span class="tag">'+c[0]+'</span><h4>'+p[0]+'</h4><p>'+p[2]+'</p>'+(REFERENCE_PRODUCT_SPEC_HTML[i]||'')+'<button class="btn btn-line" data-p="'+i+'">View specifications &amp; photo</button></div><div class="ref-badge-panel"><button type="button" class="ref-product-badge ref-flip-badge" data-product-flip data-product-name="'+p[0]+'" aria-label="Show product photo for '+p[0]+'" aria-pressed="false"'+(p[4]?'':' disabled')+'><span class="ref-flip-inner" aria-hidden="true"><span class="ref-flip-face ref-flip-front"><span class="ref-badge-brand">AREVA<small>PAINTS</small></span><strong>'+p[0].replace(/^Areva\\s+/i,'')+'</strong></span>'+(p[4]?'<span class="ref-flip-face ref-flip-back"><img class="ref-flip-photo" src="'+p[4]+'" alt="" loading="lazy" decoding="async"></span>':'')+'</span></button></div></article>'}).join("")||'<div class="ref-catalog-empty"><h3>New products are on the way</h3><p>Contact our team for guidance on this product category.</p><a class="btn btn-main" href="#contact">Enquire now</a></div>';
}`,
  );
  const categoryData = JSON.stringify(
    CATEGORIES.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
    })),
  );
  html = html.replace(
    /function pick\(i, scroll\)\{[^\n]*\}/,
    () => `window.arevaProductCategories=${categoryData};
window.arevaSetProductCategory=(i)=>{sel.c=i;renderGrid();};
function pick(i, scroll){if(window.arevaOpenCategory){window.arevaOpenCategory(i);return;}window.arevaSetProductCategory(i);}`,
  );
  html = html.replace('if(t.closest(".slide")) location.hash="#products";', "");
  html = html.replace(
    '<div><b>Page sections</b><ul id="dSec">',
    '<div><b>Product specifications</b><ul id="dSec">',
  );
  html = html.replace(
    '<span class="tag" id="dCat">',
    '<img id="refProductPhoto" class="ref-product-photo" alt="" hidden><span class="tag" id="dCat">',
  );
  html = html.replace(
    "cur=i; const p=P[i], c=cats[p[1]];",
    () => `cur=i; const p=P[i], c=cats[p[1]];
  const photo=document.getElementById("refProductPhoto"),decode=v=>{const field=document.createElement("textarea");field.innerHTML=v;return field.value;};
  photo.hidden=!p[4];if(p[4]){photo.src=decode(p[4]);photo.alt=decode(p[0]);}`,
  );
  // Show the containing view before the established actions scroll to their targets.
  html = html.replace(
    /\$\("#([^"\n]+)"\)\.scrollIntoView\((\{[^}]*\})\)/g,
    (_match, id, options) => `window.arevaNavigate("${id}",${options})`,
  );
  html = html.replace(
    'if (viz) viz.scrollIntoView({ behavior: "smooth" });',
    'if (viz) window.arevaNavigate("visualizer", { behavior: "smooth" });',
  );
  html = html.replace(
    "</body>",
    '<script src="/assets/reference-layout.js" defer></script></body>',
  );
  return html;
}

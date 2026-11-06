import type { SiteContent } from "./content-types";

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
    const solutions = [
      ["interior", "Interior Paints", "Premium finishes for living spaces", 0],
      ["exterior", "Exterior Paints", "Finishes for the world outside", 1],
      [
        "waterproofing",
        "Waterproofing",
        "Protection for roofs and surfaces",
        2,
      ],
      ["textures", "Textures & Finishes", "Add character to your walls", 6],
    ]
      .map(([category, title, description, index]) => {
        const image = content.products.find(
          (p) => p.categoryId === category,
        )?.image;
        return `<button class="ref-solution" data-cat="${index}" type="button">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : '<span class="ref-solution-art" aria-hidden="true">✦</span>'}<span><b>${title} <i aria-hidden="true">↗</i></b><small>${description}</small></span></button>`;
      })
      .join("");
    const home = `<section id="home" class="ref-home" data-ref-view="home">
      <div class="ref-hero"><div class="wrap ref-hero-grid"><div class="ref-hero-copy"><span class="ref-eyebrow">AREVA PAINTS · PAINT YOUR DREAMS</span>
        <h1>Paint Your<br><em>Dreams.</em></h1><p>Thoughtful colour. Beautiful finishes. Discover paints and protective coatings for every space you call your own.</p>
        <div class="ref-hero-actions"><a class="btn btn-main" href="#products">Explore products <span aria-hidden="true">→</span></a><a class="btn btn-ghost" href="#visualizer">Find a colour</a></div>
      </div><div class="ref-campaign">${carousel}</div></div></div>
      <div class="ref-benefits"><div class="wrap"><a href="#visualizer"><span aria-hidden="true">◉</span>Colour visualizer</a><a href="#products"><span aria-hidden="true">✦</span>Specialist coatings</a><a href="#calculator"><span aria-hidden="true">▧</span>Paint calculator</a><a href="#services"><span aria-hidden="true">◇</span>Expert guidance</a><a href="#portals"><span aria-hidden="true">⌖</span>Dealer network</a></div></div>
      <div class="wrap ref-solutions"><span class="ref-eyebrow">MADE FOR EVERY SPACE</span><h2>Solutions for every surface</h2><p class="lead">Explore the right finish, from your first coat to the final detail.</p><div class="ref-solution-grid">${solutions}</div></div>
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
    "<p>'+p[2]+'</p><button",
    "<p>'+p[2]+'</p>'+(REFERENCE_PRODUCT_SPEC_HTML[i]||'')+'<button",
  );
  html = html.replace(
    ">View details</button>",
    ">View specifications</button>",
  );
  html = html.replace(
    '<div><b>Page sections</b><ul id="dSec">',
    '<div><b>Product specifications</b><ul id="dSec">',
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

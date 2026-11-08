import type { GalleryAd, GalleryProject } from "./content-types";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

const safeAdLink = (link: string) => {
  try {
    const url = new URL(link);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

/** Render the same published project albums and ads as the React homepage. */
export function renderProjectGallery(projects: GalleryProject[], ads: GalleryAd[] = []): string {
  const albums = projects
    .map((project, index) => ({
      project: { ...project, photos: project.photos.filter((photo) => photo.image) },
      index,
    }))
    .filter(({ project }) => project.photos.length > 0)
    .sort(
      (a, b) =>
        (Date.parse(b.project.updatedAt) || Date.parse(b.project.createdAt) || 0) -
          (Date.parse(a.project.updatedAt) || Date.parse(a.project.createdAt) || 0) ||
        b.index - a.index,
    )
    .map(({ project }) => project);
  const cards = albums
    .map((project, index) => {
      const cover = project.photos[0];
      const photoCount = `${project.photos.length} ${project.photos.length === 1 ? "photo" : "photos"}`;
      return `<button class="pg-card" type="button" data-pg-open="${index}" aria-haspopup="dialog" aria-label="${escapeHtml(`View ${project.title}, ${photoCount}`)}">
        <span class="pg-cover">
          <img src="${escapeHtml(cover.image)}" alt="${escapeHtml(cover.caption || project.title)}" loading="lazy" decoding="async">
          <span class="pg-image-fallback" hidden role="img" aria-label="Photo unavailable">Photo unavailable</span>
          <span class="pg-photo-count">${photoCount}</span>
        </span>
        <span class="pg-card-body">
          <span class="pg-card-title">${escapeHtml(project.title)}</span>
          ${project.location ? `<span class="pg-location">${escapeHtml(project.location)}</span>` : ""}
          <span class="pg-view">View project <span aria-hidden="true">↗</span></span>
        </span>
      </button>`;
    })
    .join("");
  // A literal '<' must never be allowed to terminate the JSON script element.
  const projectData = JSON.stringify(albums).replace(/</g, "\\u003c");
  const latestAds = ads
    .map((ad, index) => ({ ad: { ...ad, link: safeAdLink(ad.link || "") }, index }))
    .filter(({ ad }) => ad.image || ad.link)
    .sort((a, b) =>
      (Date.parse(b.ad.updatedAt) || Date.parse(b.ad.createdAt) || 0) -
      (Date.parse(a.ad.updatedAt) || Date.parse(a.ad.createdAt) || 0) || b.index - a.index,
    )
    .map(({ ad }) => ad);
  const adCards = latestAds.map((ad, index) => {
    const channel = ad.channel === "social" ? "Social media" : "Digital";
    const action = ad.image
      ? `button type="button" data-ga-open="${index}" aria-haspopup="dialog" aria-label="${escapeHtml(`View ${ad.title}`)}"`
      : `a href="${escapeHtml(ad.link)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(`Open ${ad.title} in a new tab`)}"`;
    return `<article class="ga-card" data-ga-channel="${ad.channel === "social" ? "social" : "digital"}">
      <${action} class="ga-card-action">
        <span class="ga-cover">${ad.image
          ? `<img src="${escapeHtml(ad.image)}" alt="${escapeHtml(ad.title)}" loading="lazy" decoding="async"><span class="pg-image-fallback" hidden role="img" aria-label="Ad image unavailable">Image unavailable</span>`
          : '<span class="ga-link-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M14 3h7v7M21 3l-11 11M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg><span>Open ad <span aria-hidden="true">↗</span></span></span>'}</span>
        <span class="ga-card-body">
          <span class="ga-channel">${channel}</span>
          <span class="ga-card-title">${escapeHtml(ad.title)}</span>
          ${ad.description ? `<span class="ga-description">${escapeHtml(ad.description)}</span>` : ""}
          <span class="ga-view">${ad.image ? "View ad" : "Open ad"} <span aria-hidden="true">↗</span></span>
        </span>
      </${ad.image ? "button" : "a"}>
    </article>`;
  }).join("");
  const adData = JSON.stringify(latestAds).replace(/</g, "\\u003c");

  return `<link rel="stylesheet" href="/assets/project-gallery.css">
    <section id="gallery" class="pg-section" aria-labelledby="pg-gallery-title">
      <div class="pg-wrap">
        <div class="pg-heading">
          <p class="pg-kicker">SPACES BROUGHT TO LIFE</p>
          <h2 id="pg-gallery-title" class="pg-title">Gallery</h2>
          <p class="pg-intro">Explore our latest painting projects and brand campaigns.</p>
        </div>
        <div class="ga-tabs" role="tablist" aria-label="Gallery categories">
          <button id="ga-projects-tab" class="ga-tab" type="button" role="tab" aria-selected="true" aria-controls="ga-projects-panel" tabindex="0" data-ga-tab="projects">Projects</button>
          <button id="ga-ads-tab" class="ga-tab" type="button" role="tab" aria-selected="false" aria-controls="ga-ads-panel" tabindex="-1" data-ga-tab="ads">Ads</button>
        </div>
        <div id="ga-projects-panel" class="ga-panel" role="tabpanel" tabindex="0" aria-labelledby="ga-projects-tab" data-ga-panel="projects">
          ${albums.length ? `<div class="pg-grid">${cards}</div>` : '<div class="pg-empty"><h3>New projects are on the way</h3><p>Visit again soon for a closer look at our latest work.</p></div>'}
        </div>
        <div id="ga-ads-panel" class="ga-panel" role="tabpanel" tabindex="0" aria-labelledby="ga-ads-tab" data-ga-panel="ads" hidden>
          <p class="ga-intro">Discover our latest digital and social media ads.</p>
          <div class="ga-filters" role="group" aria-label="Filter ads">
            <button class="ga-filter" type="button" aria-pressed="true" data-ga-filter="all">All</button>
            <button class="ga-filter" type="button" aria-pressed="false" data-ga-filter="digital">Digital</button>
            <button class="ga-filter" type="button" aria-pressed="false" data-ga-filter="social">Social media</button>
          </div>
          <p class="ga-count" role="status" data-ga-count>${latestAds.length} ${latestAds.length === 1 ? "ad" : "ads"}</p>
          <div class="ga-grid">${adCards}</div>
          <div class="pg-empty" data-ga-empty ${latestAds.length ? "hidden" : ""}><h3 data-ga-empty-title>No ads yet</h3><p data-ga-empty-copy>Our latest digital and social media ads will appear here.</p></div>
        </div>
      </div>
    </section>
    <script type="application/json" id="pg-project-data">${projectData}</script>
    <script type="application/json" id="ga-ad-data">${adData}</script>
    <script src="/assets/project-gallery.js" defer></script>`;
}

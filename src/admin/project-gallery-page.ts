import type { GalleryProject } from "./content-types";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

/** Render the same published project albums as the React homepage. */
export function renderProjectGallery(projects: GalleryProject[]): string {
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

  return `<link rel="stylesheet" href="/assets/project-gallery.css">
    <section id="gallery" class="pg-section" aria-labelledby="pg-gallery-title">
      <div class="pg-wrap">
        <div class="pg-heading">
          <p class="pg-kicker">SPACES BROUGHT TO LIFE</p>
          <h2 id="pg-gallery-title" class="pg-title">Project gallery</h2>
          <p class="pg-intro">Explore our latest painting projects. Open a project to see every detail.</p>
        </div>
        ${albums.length ? `<div class="pg-grid">${cards}</div>` : '<div class="pg-empty"><h3>New projects are on the way</h3><p>Visit again soon for a closer look at our latest work.</p></div>'}
      </div>
    </section>
    <script type="application/json" id="pg-project-data">${projectData}</script>
    <script src="/assets/project-gallery.js" defer></script>`;
}

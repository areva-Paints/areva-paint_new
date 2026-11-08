(() => {
  "use strict";

  const section = document.getElementById("gallery");
  const projectData = document.getElementById("pg-project-data");
  if (!section || !projectData || section.dataset.pgReady) return;
  section.dataset.pgReady = "true";

  const readData = (node) => {
    try {
      const data = JSON.parse(node?.textContent || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const projects = readData(projectData);
  const ads = readData(document.getElementById("ga-ad-data"));

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, label, text) => {
    const node = element("button", className, text);
    node.type = "button";
    node.setAttribute("aria-label", label);
    return node;
  };
  const observeImage = (image, fallback) => {
    const update = () => {
      const failed = image.complete && image.naturalWidth === 0;
      image.hidden = failed;
      fallback.hidden = !failed;
    };
    image.addEventListener("load", update);
    image.addEventListener("error", update);
    if (image.complete) update();
  };

  const tabs = Array.from(section.querySelectorAll(".ga-tab[data-ga-tab]"));
  const selectTab = (selected, focus = false) => {
    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    section.querySelectorAll("[data-ga-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.gaPanel !== selected.dataset.gaTab;
    });
    if (focus) selected.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let target;
      if (event.key === "ArrowLeft") target = (index + tabs.length - 1) % tabs.length;
      else if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = tabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        selectTab(tabs[target], true);
      }
    });
  });

  const filters = Array.from(section.querySelectorAll(".ga-filter[data-ga-filter]"));
  const adCards = Array.from(section.querySelectorAll(".ga-card[data-ga-channel]"));
  const emptyAds = section.querySelector("[data-ga-empty]");
  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      const channel = filter.dataset.gaFilter;
      filters.forEach((item) => item.setAttribute("aria-pressed", String(item === filter)));
      let visible = 0;
      adCards.forEach((card) => {
        card.hidden = channel !== "all" && card.dataset.gaChannel !== channel;
        if (!card.hidden) visible += 1;
      });
      const count = section.querySelector("[data-ga-count]");
      if (count) count.textContent = `${visible} ${visible === 1 ? "ad" : "ads"}`;
      if (emptyAds) {
        emptyAds.hidden = visible > 0;
        emptyAds.querySelector("[data-ga-empty-title]").textContent = adCards.length
          ? "No ads in this category" : "No ads yet";
        emptyAds.querySelector("[data-ga-empty-copy]").textContent = adCards.length
          ? "Try another category to see more ads."
          : "Our latest digital and social media ads will appear here.";
      }
    });
  });

  section.querySelectorAll(".pg-cover, .ga-cover").forEach((cover) => {
    const image = cover.querySelector("img");
    const fallback = cover.querySelector(".pg-image-fallback");
    if (image && fallback) observeImage(image, fallback);
  });

  if (ads.some((ad) => ad.image)) {
    const preview = element("dialog", "pg-dialog ga-preview");
    preview.setAttribute("aria-labelledby", "ga-preview-title");
    const content = element("div", "pg-album");
    const heading = element("div", "pg-album-heading");
    const headingText = element("div");
    const channel = element("p", "pg-kicker");
    const title = element("h2", "pg-album-title");
    title.id = "ga-preview-title";
    const close = button("pg-close", "Close ad preview", "×");
    close.autofocus = true;
    headingText.append(channel, title);
    heading.append(headingText, close);
    const frame = element("div", "ga-preview-frame");
    const image = element("img", "ga-preview-image");
    image.decoding = "async";
    const fallback = element("span", "pg-image-fallback", "Image unavailable");
    fallback.hidden = true;
    fallback.setAttribute("role", "img");
    fallback.setAttribute("aria-label", "Ad image unavailable");
    observeImage(image, fallback);
    frame.append(image, fallback);
    const body = element("div", "ga-preview-body");
    const description = element("p", "ga-description");
    const link = element("a", "ga-link", "Open ad ↗");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open ad in a new tab");
    body.append(description, link);
    content.append(heading, frame, body);
    preview.append(content);
    document.body.append(preview);
    let opener = null;
    let previousOverflow = "";
    section.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const source = event.target.closest("button[data-ga-open]");
      if (!source || !section.contains(source)) return;
      const ad = ads[Number(source.dataset.gaOpen)];
      if (!ad?.image) return;
      opener = source;
      channel.textContent = ad.channel === "social" ? "SOCIAL MEDIA" : "DIGITAL";
      title.textContent = ad.title;
      image.hidden = false;
      fallback.hidden = true;
      image.alt = ad.title;
      image.src = ad.image;
      description.textContent = ad.description || "";
      description.hidden = !ad.description;
      let safeLink = "";
      try {
        const url = new URL(ad.link);
        if (url.protocol === "https:") safeLink = url.href;
      } catch { /* An optional absent link has no action. */ }
      link.hidden = !safeLink;
      if (safeLink) link.href = safeLink;
      else link.removeAttribute("href");
      body.hidden = !ad.description && !safeLink;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      preview.showModal();
    });
    close.addEventListener("click", () => preview.close());
    preview.addEventListener("click", (event) => {
      if (event.target === preview) preview.close();
    });
    preview.addEventListener("close", () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    });
  }

  if (!projects.length) return;

  const dialog = element("dialog", "pg-dialog");
  dialog.setAttribute("aria-labelledby", "pg-album-title");
  dialog.setAttribute("aria-describedby", "pg-album-counter");
  const album = element("div", "pg-album");
  const heading = element("div", "pg-album-heading");
  const headingText = element("div");
  const kicker = element("p", "pg-kicker", "PROJECT ALBUM");
  const title = element("h2", "pg-album-title");
  title.id = "pg-album-title";
  const location = element("p", "pg-album-location");
  const close = button("pg-close", "Close project album", "×");
  close.autofocus = true;
  headingText.append(kicker, title, location);
  heading.append(headingText, close);

  const stage = element("div", "pg-stage");
  const previous = button("pg-prev pg-step", "Previous photo", "‹");
  const next = button("pg-next pg-step", "Next photo", "›");
  const frame = element("figure", "pg-photo-frame");
  const photo = element("img", "pg-photo");
  photo.decoding = "async";
  const fallback = element("span", "pg-image-fallback", "Photo unavailable");
  fallback.hidden = true;
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", "Photo unavailable");
  const caption = element("figcaption", "pg-caption");
  frame.append(photo, fallback, caption);
  stage.append(previous, frame, next);
  observeImage(photo, fallback);

  const footer = element("div", "pg-album-footer");
  const counter = element("p", "pg-counter");
  counter.id = "pg-album-counter";
  counter.setAttribute("aria-live", "polite");
  counter.setAttribute("aria-atomic", "true");
  const description = element("p", "pg-description");
  footer.append(counter, description);
  const thumbnails = element("div", "pg-thumbnails");
  thumbnails.setAttribute("role", "group");
  thumbnails.setAttribute("aria-label", "Choose a project photo");
  album.append(heading, stage, footer, thumbnails);
  dialog.append(album);
  document.body.append(dialog);

  let activeProject = null;
  let currentPhoto = 0;
  let opener = null;
  let previousOverflow = "";

  const showPhoto = (index) => {
    if (!activeProject) return;
    currentPhoto = (index + activeProject.photos.length) % activeProject.photos.length;
    const item = activeProject.photos[currentPhoto];
    // Show a newly selected image while it loads, even after an earlier failure.
    photo.hidden = false;
    fallback.hidden = true;
    photo.alt = item.caption || `${activeProject.title}, photo ${currentPhoto + 1}`;
    photo.src = item.image;
    caption.textContent = item.caption || "";
    caption.hidden = !item.caption;
    counter.textContent = `Photo ${currentPhoto + 1} of ${activeProject.photos.length}`;
    thumbnails.querySelectorAll("button").forEach((thumbnail, number) => {
      thumbnail.setAttribute("aria-pressed", String(number === currentPhoto));
    });
  };

  const openProject = (index, source) => {
    const project = projects[index];
    if (!project || !Array.isArray(project.photos) || !project.photos.length) return;
    activeProject = project;
    opener = source;
    title.textContent = project.title;
    location.textContent = project.location || "";
    location.hidden = !project.location;
    description.textContent = project.description || "";
    description.hidden = !project.description;
    previous.hidden = next.hidden = project.photos.length < 2;
    thumbnails.replaceChildren();
    project.photos.forEach((item, number) => {
      const thumbnail = button(
        "pg-thumbnail",
        `Show photo ${number + 1}${item.caption ? `: ${item.caption}` : ""}`,
      );
      const image = element("img");
      image.src = item.image;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      thumbnail.append(image);
      thumbnail.addEventListener("click", () => showPhoto(number));
      thumbnails.append(thumbnail);
    });
    showPhoto(0);
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
  };

  section.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const source = event.target.closest("button[data-pg-open]");
    if (source && section.contains(source)) openProject(Number(source.dataset.pgOpen), source);
  });
  close.addEventListener("click", () => dialog.close());
  previous.addEventListener("click", () => showPhoto(currentPhoto - 1));
  next.addEventListener("click", () => showPhoto(currentPhoto + 1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(currentPhoto + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus({ preventScroll: true });
    activeProject = null;
  });
})();

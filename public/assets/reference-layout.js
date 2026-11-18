/*
 * Coordinate hash navigation, category visibility, product-photo animation and the illustrated More panel in the preserved public layout.
 */
(() => {
  "use strict";
  const main = document.querySelector("main#top");
  if (!main || !document.querySelector("#home.ref-home")) return;
  const more = document.querySelector(".ref-more");
  const moreSummary = more?.querySelector("summary");
  const morePanel = more?.querySelector(".ref-more-panel");
  /* Close the native More details panel and optionally restore focus to its summary. */
  function closeMore(restoreFocus = false) {
    if (!more?.open) return;
    more.open = false;
    if (restoreFocus) moreSummary.focus({ preventScroll: true });
  }
  /* Keep the open card panel within the available viewport below the sticky header. */
  function fitMore() {
    if (!more?.open) return;
    const bottom = document
      .querySelector(".ref-header")
      .getBoundingClientRect().bottom;
    more.style.setProperty(
      "--ref-more-available",
      Math.max(0, window.innerHeight - bottom - 20) + "px",
    );
  }
  more?.addEventListener("toggle", fitMore);
  moreSummary?.addEventListener("click", () => requestAnimationFrame(fitMore));
  more?.addEventListener("focusout", (event) => {
    if (
      event.relatedTarget instanceof Node &&
      !more.contains(event.relatedTarget)
    )
      closeMore();
  });
  morePanel?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-close-more]")) closeMore(true);
    else if (event.target.closest("a")) closeMore();
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !more?.contains(event.target))
      closeMore();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && more?.open) {
      event.preventDefault();
      closeMore(true);
    }
  });
  window.addEventListener("resize", fitMore);
  window.addEventListener("scroll", fitMore, { passive: true });
  const known = new Set([
    "home",
    "products",
    "visualizer",
    "calculator",
    "gallery",
    "services",
    "about",
    "our-story",
    "certs",
    "portals",
    "contact",
  ]);
  main.querySelectorAll(":scope > section, :scope > .mq").forEach((node) => {
    node.dataset.refView = known.has(node.id) ? node.id : "home";
  });
  const views = Array.from(main.querySelectorAll("[data-ref-view]"));
  const decodeHash = (hash) => {
    try {
      return decodeURIComponent(hash.slice(1)) || "home";
    } catch {
      return "home";
    }
  };
  let current = "";
  let currentCategory = null;
  let productFlipTimer = null;
  const productMotion = matchMedia("(prefers-reduced-motion: reduce)");
  /* Schedule product artwork changes only while the current view permits animation. */
  function scheduleProductFlip() {
    clearInterval(productFlipTimer);
    productFlipTimer = null;
    if (current !== "products" || document.hidden || productMotion.matches)
      return;
    productFlipTimer = setInterval(() => {
      main
        .querySelectorAll(".ref-flip-badge.ref-photo-ready:not(:disabled)")
        .forEach((badge) => {
          const showPhoto = badge.dataset.photoRequested !== "true";
          badge.dataset.photoRequested = String(showPhoto);
          setProductPhotoSide(badge, showPhoto);
        });
    }, 5000);
  }
  /* Switch one product badge between its artwork and product-photo side. */
  function setProductPhotoSide(badge, showPhoto) {
    badge.classList.toggle("is-flipped", showPhoto);
    badge.setAttribute("aria-pressed", String(showPhoto));
    badge.setAttribute(
      "aria-label",
      (showPhoto ? "Show product name for " : "Show product photo for ") +
        badge.dataset.productName,
    );
  }
  /* Track image availability so a missing product photo retains the card fallback. */
  function updatePhoto(image) {
    const badge = image.closest(".ref-flip-badge");
    if (!badge || !image.complete) return;
    const ready = image.naturalWidth > 0;
    badge.classList.toggle("ref-photo-ready", ready);
    badge.removeAttribute("aria-busy");
    badge.disabled = !ready;
    if (!ready) badge.dataset.photoRequested = "false";
    setProductPhotoSide(
      badge,
      ready && badge.dataset.photoRequested === "true",
    );
    if (!ready)
      badge.setAttribute(
        "aria-label",
        "Product photo unavailable for " + badge.dataset.productName,
      );
  }
  /* Restore product-image state when leaving or rebuilding the catalogue. */
  function resetProductPhotos() {
    main.querySelectorAll(".ref-flip-badge").forEach((badge) => {
      badge.dataset.photoRequested = "false";
      setProductPhotoSide(badge, false);
    });
    main.querySelectorAll(".ref-flip-photo").forEach(updatePhoto);
  }
  for (const eventName of ["load", "error"]) {
    main.addEventListener(
      eventName,
      (event) => {
        if (
          event.target instanceof HTMLImageElement &&
          event.target.matches(".ref-flip-photo")
        )
          updatePhoto(event.target);
      },
      true,
    );
  }
  main.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const badge = event.target.closest("[data-product-flip]");
    if (!badge || badge.disabled) return;
    const image = badge.querySelector(".ref-flip-photo");
    if (!image) return;
    const requested = badge.dataset.photoRequested !== "true";
    badge.dataset.photoRequested = String(requested);
    if (!requested) setProductPhotoSide(badge, false);
    else {
      image.loading = "eager";
      if (!image.complete) badge.setAttribute("aria-busy", "true");
      updatePhoto(image);
    }
    scheduleProductFlip();
  });
  /* Restart the product-photo timer after navigation or visibility changes. */
  function restartProductFlip() {
    if (!document.hidden) resetProductPhotos();
    scheduleProductFlip();
  }
  document.addEventListener("visibilitychange", restartProductFlip);
  productMotion.addEventListener("change", restartProductFlip);
  window.addEventListener("pageshow", restartProductFlip);
  window.addEventListener("pagehide", () => clearInterval(productFlipTimer));
  const categories = window.arevaProductCategories || [];
  /* Bring the active category into its horizontal navigation viewport. */
  function revealSelectedCategory() {
    const tabs = document.querySelector("#products [data-category-tabs]");
    const selected = tabs?.querySelector('[aria-current="page"]');
    if (tabs && selected)
      tabs.scrollLeft =
        selected.offsetLeft - (tabs.clientWidth - selected.offsetWidth) / 2;
  }
  window.addEventListener("resize", revealSelectedCategory);
  /* Render the selected category using the safe server-generated product fragments. */
  function updateCatalogue(index) {
    window.arevaSetProductCategory?.(index);
    currentCategory = index;
    const category = index === null ? null : categories[index];
    const products = document.getElementById("products");
    products.classList.toggle("ref-category-page", Boolean(category));
    const banner = products.querySelector(".ref-page-banner");
    const hero = products.querySelector("[data-ref-category-hero]");
    hero.hidden = !category;
    hero.innerHTML = category?.hero || "";
    requestAnimationFrame(revealSelectedCategory);
    banner.hidden = Boolean(category);
    banner.querySelector("h1").textContent = "All products";
    banner.querySelector(".ref-eyebrow").textContent =
      "HOME / PRODUCTS / ALL PRODUCTS";
    banner.querySelector("p").textContent =
      "Browse the complete Areva collection and compare finishes, coverage and product specifications.";
    document.getElementById("listTitle").textContent = category
      ? "Our " + category.name
      : "All products";
    const intro = document.getElementById("refCategoryIntro");
    intro.hidden = !category;
    intro.textContent = category
      ? "Explore the " +
        category.name.toLowerCase() +
        " collection. Compare finishes, coverage and specifications to find the right product for your project."
      : "";
  }
  /* Change the visible public section and synchronize history, active links and category state. */
  function navigate(id, options = {}, updateHistory = true) {
    if (id === "products") id = "products/interior";
    const allProductsPath = id === "products/all";
    const categoryPath = id.startsWith("products/") && !allProductsPath;
    const matchedCategory = categoryPath
      ? categories.findIndex((c) => c.id === id.slice("products/".length))
      : -1;
    const unknownCategory = categoryPath && matchedCategory === -1;
    const hubPath = id === "solutions" || unknownCategory;
    const target =
      document.getElementById(
        hubPath
          ? "solutions"
          : categoryPath || allProductsPath
            ? "products"
            : id === "top"
              ? "home"
              : id,
      ) || document.getElementById("home");
    const view = target.closest("[data-ref-view]")?.dataset.refView || "home";
    if (view === "products")
      updateCatalogue(
        categoryPath
          ? matchedCategory === -1
            ? null
            : matchedCategory
          : target.id === "products"
            ? null
            : currentCategory,
      );
    if (current === "visualizer" && view !== current) {
      const camera = document.getElementById("live");
      if (camera && !camera.hidden) document.getElementById("stopcam")?.click();
    }
    current = view;
    resetProductPhotos();
    scheduleProductFlip();
    views.forEach((node) => {
      node.hidden = node.dataset.refView !== view;
    });
    document.querySelectorAll("[data-ref-nav]").forEach((link) => {
      const active =
        link.dataset.refNav ===
        (target.id === "solutions"
          ? "products"
          : view === "our-story" || view === "certs"
            ? "about"
            : view);
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document
      .querySelectorAll(".ref-more[open]")
      .forEach((menu) => menu.removeAttribute("open"));
    const route =
      view === "products"
        ? currentCategory !== null
          ? "products/" + categories[currentCategory].id
          : "products/all"
        : target.id;
    if (unknownCategory) history.replaceState(null, "", "#solutions");
    else if (updateHistory && location.hash !== "#" + route)
      history.pushState(null, "", "#" + route);
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        block: "start",
        ...options,
        behavior: reduce ? "auto" : options.behavior || "auto",
      });
      const heading = target.matches("h1,h2,h3")
        ? target
        : target.querySelector("h1,h2,h3");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
  }
  window.arevaNavigate = navigate;
  window.arevaOpenCategory = (index) =>
    navigate(
      Number.isInteger(index) && categories[index]
        ? "products/" + categories[index].id
        : "solutions",
    );
  document.addEventListener("click", (event) => {
    if (
      !(event.target instanceof Element) ||
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (event.target.closest("[data-category-explore]")) {
      const heading = document.getElementById("listTitle");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({
        block: "start",
        behavior: productMotion.matches ? "auto" : "smooth",
      });
      return;
    }
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.target === "_blank" || !link.hash) return;
    const id = decodeHash(link.hash);
    if (!document.getElementById(id) && !id.startsWith("products/")) return;
    event.preventDefault();
    navigate(id, { behavior: "smooth" });
  });
  document.querySelector(".mq")?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("[data-c]"))
      navigate("visualizer");
  });
  window.addEventListener("hashchange", () =>
    navigate(decodeHash(location.hash), {}, false),
  );
  navigate(decodeHash(location.hash), {}, false);
})();

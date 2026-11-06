(() => {
  "use strict";
  const main = document.querySelector("main#top");
  if (!main || !document.querySelector("#home.ref-home")) return;
  const known = new Set([
    "home",
    "products",
    "visualizer",
    "calculator",
    "gallery",
    "services",
    "about",
    "portals",
    "contact",
  ]);
  main.querySelectorAll(":scope > section, :scope > .mq").forEach((node) => {
    node.dataset.refView = known.has(node.id)
      ? node.id
      : node.id === "certs"
        ? "about"
        : "home";
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
  function navigate(id, options = {}, updateHistory = true) {
    const target =
      document.getElementById(id === "top" ? "home" : id) ||
      document.getElementById("home");
    const view = target.closest("[data-ref-view]")?.dataset.refView || "home";
    if (current === "visualizer" && view !== current) {
      const camera = document.getElementById("live");
      if (camera && !camera.hidden) document.getElementById("stopcam")?.click();
    }
    current = view;
    views.forEach((node) => {
      node.hidden = node.dataset.refView !== view;
    });
    document.querySelectorAll("[data-ref-nav]").forEach((link) => {
      const active = link.dataset.refNav === view;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document
      .querySelectorAll(".ref-more[open]")
      .forEach((menu) => menu.removeAttribute("open"));
    if (updateHistory && location.hash !== "#" + target.id)
      history.pushState(null, "", "#" + target.id);
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
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.target === "_blank" || !link.hash) return;
    const id = decodeHash(link.hash);
    if (!document.getElementById(id)) return;
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

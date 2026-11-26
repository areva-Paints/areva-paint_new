/* The preserved public page reads the published CMS catalogue verbatim. Family
 * selection and background refresh never reload the photo or its paint masks.
 */
(() => {
  function mount({ root, initial, rows, onSelect, onRefresh, selectedCode }) {
    let snapshot = initial,
      family = "All Shades",
      query = "",
      pending = null,
      generation = 0,
      familySignature = "";
    const search = root.querySelector('[type="search"]'),
      families = root.querySelector(".shade-families"),
      grid = root.querySelector(".shade-swatch-grid"),
      downloads = root.querySelector("[data-shade-pdfs]");
    const node = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const escape = (value) =>
      String(value).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    const status = node("p", "ap-catalogue-status");
    status.hidden = true;
    status.setAttribute("role", "status");
    root.prepend(status);
    function choices() {
      const values = new Map([["All Shades", "#79218c"]]);
      for (const s of snapshot.colours)
        if (!values.has(s.family)) values.set(s.family, s.hex);
      for (const c of snapshot.shadeCards)
        if (c.family && !values.has(c.family)) values.set(c.family, "#79218c");
      return values;
    }
    function draw() {
      const scroll = root.parentElement.scrollTop,
        options = choices();
      if (!options.has(family)) family = "All Shades";
      const signature = JSON.stringify([...options]);
      if (signature !== familySignature) {
        familySignature = signature;
        families.replaceChildren();
        for (const [name, hex] of options) {
          const button = node("button");
          button.type = "button";
          button.dataset.shadeFamily = name;
          const dot = node("i");
          dot.style.backgroundColor = hex;
          dot.setAttribute("aria-hidden", "true");
          button.append(dot, document.createTextNode(name));
          families.append(button);
        }
      }
      families
        .querySelectorAll("button")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.shadeFamily === family),
          ),
        );
      const visible = snapshot.colours.filter(
        (s) =>
          (family === "All Shades" || s.family === family) &&
          (s.name + " " + s.code)
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase().trim()),
      );
      root.querySelector("[data-shade-count]").textContent =
        visible.length + " shades found";
      grid.replaceChildren();
      for (const s of visible) {
        const tile = node("div", "shade-tile"),
          button = node("button", "shade-swatch");
        button.type = "button";
        button.dataset.shadeCode = s.code;
        button.dataset.shadeFamilyName = s.family;
        button.setAttribute(
          "aria-label",
          "Apply " + s.name + " (" + s.code + ")",
        );
        button.setAttribute("aria-pressed", String(selectedCode() === s.code));
        const chip = node("span", "shade-chip");
        chip.style.backgroundColor = s.hex;
        button.append(
          chip,
          node("strong", "", s.name),
          node("small", "", s.code),
        );
        tile.append(button);
        grid.append(tile);
      }
      if (!visible.length)
        grid.append(
          node(
            "p",
            "shade-empty",
            "No shades match these filters. Try another family or reset the filters.",
          ),
        );
      downloads.replaceChildren(node("h3", "", "Download shade cards"));
      const pdfs = snapshot.shadeCards.filter(
        (c) => family === "All Shades" || c.family === family,
      );
      for (const c of pdfs) {
        const link = node("a", "", c.title);
        link.href = c.url;
        link.download = "";
        link.dataset.shadePdfFamily = c.family || "All Shades";
        link.append(node("span", "", "PDF · " + (c.family || "All Shades")));
        downloads.append(link);
      }
      downloads.hidden = !pdfs.length;
      root.parentElement.scrollTop = scroll;
    }
    root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.shadeCode) {
        event.stopPropagation();
        const record = snapshot.colours.find(
          (s) => s.code === button.dataset.shadeCode,
        );
        if (record) onSelect(record);
      } else if (button.dataset.shadeFamily) {
        family = button.dataset.shadeFamily;
        draw();
      } else if (button.hasAttribute("data-shade-reset")) {
        family = "All Shades";
        query = search.value = "";
        draw();
      }
    });
    search.addEventListener("input", () => {
      query = search.value;
      draw();
    });
    async function refresh() {
      const token = ++generation;
      pending?.abort();
      pending = new AbortController();
      try {
        const response = await fetch("/api/content", {
          cache: "no-store",
          signal: pending.signal,
        });
        if (!response.ok) throw Error("Catalogue unavailable");
        const next = await response.json();
        if (token !== generation) return;
        if (!Array.isArray(next.colours) || !Array.isArray(next.shadeCards))
          throw Error("Catalogue unavailable");
        status.hidden = true;
        if (next.revision === snapshot.revision) return;
        snapshot = next;
        rows.splice(
          0,
          rows.length,
          ...next.colours.map((s) => [
            escape(s.name),
            escape(s.code),
            s.hex,
            s.family,
            s.tones || [],
          ]),
        );
        onRefresh(next.colours);
        draw();
      } catch (error) {
        if (token !== generation || error.name === "AbortError") return;
        status.replaceChildren(
          document.createTextNode("The catalogue could not refresh. "),
        );
        const retry = node("button", "", "Retry");
        retry.type = "button";
        retry.onclick = refresh;
        status.append(retry);
        status.hidden = false;
      }
    }
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", (event) => {
      if (event.key === "areva-content-updated") void refresh();
    });
    draw();
    return { draw };
  }
  globalThis.ArevaShadeCatalogue = Object.freeze({ mount });
})();

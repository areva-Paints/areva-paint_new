/* One controller serves both React and the preserved public layout. It reads
 * server-rendered assignment metadata and uses textContent for filter messages.
 */
export function initializeTerms(root) {
  if (!root || root.dataset.termsReady) return;
  root.dataset.termsReady = "true";
  const category = root.querySelector("[data-terms-category]");
  const product = root.querySelector("[data-terms-product]");
  const reset = root.querySelector("[data-terms-reset]");
  const cards = Array.from(root.querySelectorAll("[data-terms-document]"));
  const options = Array.from(product.options);
  const read = (value) => {
    try {
      const result = JSON.parse(value || "[]");
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  };
  const apply = () => {
    const selected = options.find((option) => option.value === product.value);
    const selectedCategory = selected?.dataset.category || category.value;
    options.forEach((option) => {
      option.hidden = !!(
        option.value &&
        category.value &&
        option.dataset.category !== category.value
      );
    });
    let visible = 0;
    cards.forEach((card) => {
      const products = read(card.dataset.products),
        categories = read(card.dataset.categories);
      const companyWide = !products.length && !categories.length;
      const matches =
        companyWide ||
        (product.value
          ? products.includes(product.value) ||
            categories.includes(selectedCategory)
          : !category.value ||
            categories.includes(category.value) ||
            options.some(
              (option) =>
                option.dataset.category === category.value &&
                products.includes(option.value),
            ));
      card.hidden = !matches;
      if (matches) visible++;
    });
    root.querySelector("[data-terms-empty]").hidden = visible > 0;
    root.querySelector("[data-terms-summary]").textContent =
      `${visible} published ${visible === 1 ? "document" : "documents"}${product.value ? " for " + selected.textContent : ""}`;
    root.querySelector("[data-terms-empty-copy]").textContent = product.value
      ? `No published warranty terms are currently available for ${selected.textContent}. Contact Areva Paints for the applicable document.`
      : "Contact Areva Paints for the warranty terms applicable to your product.";
  };
  const fromHash = () => {
    if (!location.hash.startsWith("#terms")) return;
    let id = "";
    try {
      id = decodeURIComponent(location.hash.slice("#terms/".length));
    } catch {}
    const found = options.find((option) => option.value && option.value === id);
    product.value = found ? id : "";
    category.value = found?.dataset.category || "";
    apply();
    if (!window.arevaNavigate) root.scrollIntoView({ block: "start" });
  };
  const categoryChanged = () => {
    product.value = "";
    apply();
  };
  const productChanged = () => {
    category.value =
      options.find((option) => option.value === product.value)?.dataset
        .category || "";
    apply();
  };
  const cleared = () => {
    category.value = "";
    product.value = "";
    apply();
  };
  category.addEventListener("change", categoryChanged);
  product.addEventListener("change", productChanged);
  reset.addEventListener("click", cleared);
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("areva-terms-navigate", fromHash);
  fromHash();
  apply();
  return () => {
    delete root.dataset.termsReady;
    category.removeEventListener("change", categoryChanged);
    product.removeEventListener("change", productChanged);
    reset.removeEventListener("click", cleared);
    window.removeEventListener("hashchange", fromHash);
    window.removeEventListener("areva-terms-navigate", fromHash);
  };
}
if (typeof document !== "undefined") {
  document.querySelectorAll("#terms").forEach((root) => initializeTerms(root));
}

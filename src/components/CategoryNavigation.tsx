import { useEffect, useRef } from "react";
import { CATEGORIES } from "../data/paintsData";

/** Route links in the HTML site; state transitions in React Studio. */
export function CategoryNavigation({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect?: (categoryId: string) => void;
}) {
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const revealSelected = () => {
      const tabs = tabsRef.current;
      const selected = tabs?.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (tabs && selected)
        tabs.scrollLeft =
          selected.offsetLeft - (tabs.clientWidth - selected.offsetWidth) / 2;
    };
    revealSelected();
    window.addEventListener("resize", revealSelected);
    return () => window.removeEventListener("resize", revealSelected);
  }, [selectedId]);

  return (
    <nav className="category-range-nav" aria-label="Product categories">
      <div className="category-range-tabs" data-category-tabs ref={tabsRef}>
        {CATEGORIES.map((category) => (
          <a
            className="category-range-link"
            key={category.id}
            href={`#products/${category.id}`}
            aria-current={category.id === selectedId ? "page" : undefined}
            onClick={
              onSelect
                ? (event) => {
                    if (
                      event.button ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    onSelect(category.id);
                  }
                : undefined
            }
          >
            {category.name}
          </a>
        ))}
      </div>
    </nav>
  );
}

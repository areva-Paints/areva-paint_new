/*
 * Reuse Gallery introduction and category-count filters in the React project presentation.
 */
import React from "react";
import {
  GALLERY_PROJECT_CATEGORIES,
  projectCategory,
  type GalleryProjectFilter,
} from "../data/galleryCategories";
import type { GalleryProject } from "../admin/content-types";

/* Render the shared Gallery heading and introduction. */
export function ProjectGalleryIntroduction() {
  return (
    <div className="pg-project-intro">
      <h3>Beautiful Spaces. Lasting Impressions.</h3>
      <p>
        Explore how colour, texture and protection can transform every surface.
      </p>
    </div>
  );
}
/* Render supported category counts and the current active filter. */
export function ProjectCategoryFilters({
  projects,
  selected = "all",
  onSelect,
}: {
  projects: GalleryProject[];
  selected?: GalleryProjectFilter;
  onSelect?: (category: GalleryProjectFilter) => void;
}) {
  const options = [
    ["all", "All projects"],
    ...Object.entries(GALLERY_PROJECT_CATEGORIES),
  ] as Array<[GalleryProjectFilter, string]>;
  return (
    <div
      className="pg-category-filters"
      role="group"
      aria-label="Project categories"
    >
      {options.map(([category, label]) => (
        <button
          key={category}
          type="button"
          className="pg-category-filter"
          data-pg-filter={category}
          aria-pressed={selected === category}
          onClick={() => onSelect?.(category)}
        >
          {label}{" "}
          <span className="pg-filter-count">
            (
            {category === "all"
              ? projects.length
              : projects.filter(
                  (project) => projectCategory(project) === category,
                ).length}
            )
          </span>
        </button>
      ))}
    </div>
  );
}

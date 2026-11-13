import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { CATEGORY_ART } from "../data/categoryArt";

/** Shared card content for the HTML site and React Studio. The parent supplies navigation. */
export function CategorySceneCard({
  category,
}: {
  category: { id: string; name: string; description: string };
}) {
  const art = CATEGORY_ART[category.id];
  return (
    <span
      className="category-scene"
      style={
        {
          "--scene-ink": art.ink,
          "--scene-paper": art.paper,
          "--scene-tint": art.tint,
        } as CSSProperties
      }
    >
      <span className="category-scene-media">
        <img
          className="category-scene-photo"
          src={art.image}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="category-scene-copy">
        <span className="category-scene-heading">
          <span className="category-scene-title">{category.name}</span>
          <ArrowRight aria-hidden="true" />
        </span>
        <span className="category-scene-description">
          {category.description}
        </span>
      </span>
    </span>
  );
}

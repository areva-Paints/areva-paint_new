import type { CSSProperties } from "react";
import {
  House,
  CloudSunRain,
  Droplet,
  BrickWall,
  Wrench,
  PaintBucket,
  Sparkles,
  HardHat,
  ArrowUpRight,
} from "lucide-react";
import { CATEGORY_ART } from "../data/categoryArt";

const icons = {
  interior: House,
  exterior: CloudSunRain,
  waterproofing: Droplet,
  "tile-adhesives": BrickWall,
  sealants: Wrench,
  "putty-primers": PaintBucket,
  textures: Sparkles,
  chemicals: HardHat,
};

/** Shared card content for the HTML site and React Studio. The parent supplies navigation. */
export function CategorySceneCard({
  category,
}: {
  category: { id: string; name: string; description: string };
}) {
  const art = CATEGORY_ART[category.id];
  const Icon = icons[category.id as keyof typeof icons] || PaintBucket;
  const gradient = `category-panel-${category.id}`;
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
      <img
        className="category-scene-photo"
        src={art.image}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <svg
        className="category-scene-curve"
        viewBox="0 0 640 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={art.paper} />
            <stop offset="65%" stopColor={art.paper} />
            <stop offset="100%" stopColor={art.tint} />
          </linearGradient>
        </defs>
        <path
          d="M0 0H440C330 66 370 228 250 300H0Z"
          fill={`url(#${gradient})`}
        />
        <path
          d="M440 0C330 66 370 228 250 300"
          fill="none"
          stroke="#e9bb51"
          strokeWidth="3"
        />
      </svg>
      <span className="category-scene-copy">
        <span className="category-scene-heading">
          <span className="category-scene-icon" aria-hidden="true">
            <Icon strokeWidth={1.6} />
          </span>
          <span className="category-scene-title">{category.name}</span>
        </span>
        <span className="category-scene-description">
          {category.description}
        </span>
        <span className="category-scene-link">
          Explore range <ArrowUpRight aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}

import type { CSSProperties, Ref } from "react";
import {
  ArrowLeft,
  ArrowRight,
  House,
  Sparkles,
  ShieldCheck,
  Palette,
  CloudRain,
  Sun,
  Droplets,
  Layers,
  BrickWall,
  Link,
  Wrench,
  PaintRoller,
  MoveHorizontal,
  Waves,
  FlaskConical,
  Route,
  Building2,
} from "lucide-react";
import { CATEGORY_LANDINGS } from "../data/categoryLandings";
import { CategoryNavigation } from "./CategoryNavigation";

const icons: Record<string, typeof House> = {
  wall: House,
  finish: Sparkles,
  shield: ShieldCheck,
  palette: Palette,
  rain: CloudRain,
  sun: Sun,
  drop: Droplets,
  layers: Layers,
  tiles: BrickWall,
  bond: Link,
  wrench: Wrench,
  roller: PaintRoller,
  flex: MoveHorizontal,
  waves: Waves,
  flask: FlaskConical,
  road: Route,
  building: Building2,
};

/** Live text and controls over local artwork, shared by both public renderers. */
export function CategoryLandingHero({
  category,
  headingRef,
  onExplore,
  onCategoryChange,
}: {
  category: { id: string; name: string; description: string };
  headingRef?: Ref<HTMLHeadingElement>;
  onExplore?: () => void;
  onCategoryChange?: (categoryId: string) => void;
}) {
  const landing = CATEGORY_LANDINGS[category.id];
  return (
    <>
      <CategoryNavigation
        selectedId={category.id}
        onSelect={onCategoryChange}
      />
      <div
        className="category-landing-hero"
        data-category-id={category.id}
        style={{ "--landing-tone": landing.tone } as CSSProperties}
      >
        <img
          className="category-landing-photo"
          src={landing.image}
          alt=""
          decoding="async"
        />
        <a className="category-landing-back" href="#solutions">
          <ArrowLeft aria-hidden="true" />
          All categories
        </a>
        <div className="category-landing-copy">
          <span className="category-landing-eyebrow">
            AREVA PAINTS · OUR COLLECTION
          </span>
          <h1 className="category-landing-title" ref={headingRef} tabIndex={-1}>
            <span>{landing.title}</span> <em>{landing.accent}</em>
          </h1>
          <p className="category-landing-description">{category.description}</p>
          <ul
            className="category-landing-features"
            aria-label={`${category.name} range highlights`}
          >
            {landing.features.map(({ icon, label }) => {
              const Icon = icons[icon] || ShieldCheck;
              return (
                <li key={label}>
                  <Icon aria-hidden="true" strokeWidth={1.5} />
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
          <button
            className="category-landing-explore"
            type="button"
            data-category-explore
            onClick={onExplore}
          >
            Explore Products <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <svg
          className="category-landing-ribbon"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 80H1440V0C1160 22 1030 72 0 80Z" fill="#eebc46" />
          <path d="M0 80H1440V16C1140 38 990 78 0 80Z" fill="#3b1454" />
        </svg>
      </div>
    </>
  );
}

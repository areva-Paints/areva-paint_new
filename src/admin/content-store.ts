/*
 * Own the current private JSON persistence layer for CMS content, accounts and audit history.
 * Revision checks prevent stale full-content saves; SQL files are a separate future storage design.
 */
import { writePrivateJson } from "../server/storage";
import { normalizeShade } from "../data/shadeFamilies";
import { projectCategory } from "../data/galleryCategories";
import type { StoredUser } from "./user-types";
import fs from "node:fs";
import path from "node:path";
import { PRODUCTS, CATEGORIES, COLOR_SHADES } from "../data/paintsData";
import seed from "./legacy-seed.json";
import type { ActivityEvent, ActivityStore } from "./activity-types";
import type { SiteContent } from "./content-types";
export const dataDir = path.resolve(
  process.env.CONTENT_DATA_DIR || ".local/content",
);
const categoryIds = [
  "interior",
  "exterior",
  "waterproofing",
  "tile-adhesives",
  "sealants",
  "putty-primers",
  "textures",
  "chemicals",
];
/* Build the initial CMS snapshot from the committed seed data. */
export function defaults(): SiteContent {
  return {
    revision: 0,
    certifications: [],
    galleryProjects: [],
    galleryAds: [],
    galleryReviews: [],
    colours: COLOR_SHADES,
    shadeCards: [],
    products: seed.products.map((p) => {
      const match = PRODUCTS.find((x) =>
        x.name
          .toLowerCase()
          .includes(p.name.toLowerCase().replace(/^areva /, "")),
      );
      const categoryId = categoryIds[p.categoryIndex] || "interior";
      return {
        ...PRODUCTS[0],
        featured: false,
        vocLevel: "Standard" as const,
        washability: "Wipeable" as const,
        specs: {
          dryingTime: "",
          recoatTime: "",
          thinnedWith: "",
          warrantyYears: 0,
          recommendedSurfaces: [],
          surfacePreparation: "",
          applicationMethod: "",
        },
        ...match,
        id: match?.id || p.id,
        name: p.name,
        categoryId,
        categoryName:
          CATEGORIES.find((c) => c.id === categoryId)?.name ||
          "Interior Paints",
        description: p.description,
        tagline: match?.tagline || p.description,
        image:
          p.image || `/api/content/legacy-image/${p.id.replace("legacy-", "")}`,
        coverageSqFtPerLiter: p.coverage ?? match?.coverageSqFtPerLiter ?? 0,
        coverageUnit: p.unit as "L" | "kg",
        calculationBasis: p.basis as "wall" | "floor",
      };
    }),
    dealers: seed.dealers,
    landingImages: [],
  };
}
/* Read the private JSON snapshot and normalize compatible legacy content fields. */
export function readContent(): SiteContent {
  const file = path.join(dataDir, "content.json");
  if (!fs.existsSync(file)) return defaults();
  const {
    adminHistory: _privateHistory,
    users: _privateUsers,
    ...content
  } = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    // Allowlist public fields; future private store metadata must never be spread here.
    revision: content.revision,
    certifications: content.certifications ?? [],
    products: content.products,
    dealers: content.dealers,
    landingImages: content.landingImages,
    galleryProjects: (content.galleryProjects ?? []).map((project) => ({
      ...project,
      category: projectCategory(project),
    })),
    galleryAds: content.galleryAds ?? [],
    galleryReviews: content.galleryReviews ?? [],
    colours: (content.colours ?? COLOR_SHADES).map(normalizeShade),
    shadeCards: (content.shadeCards ?? []).map((card) => ({
      ...card,
      family: card.family ?? "All Shades",
      tones: card.tones ?? [],
    })),
  };
}
/* Select public CMS fields and published documents, excluding accounts and audit history. */
export function readPublicContent(): SiteContent {
  const content = readContent();
  return {
    ...content,
    certifications: content.certifications.filter((item) => item.published),
  };
}
/* Read saved audit history from the private content store. */
export function readActivity(): ActivityStore {
  const file = path.join(dataDir, "content.json");
  if (!fs.existsSync(file)) return { startedAt: null, events: [] };
  return (
    JSON.parse(fs.readFileSync(file, "utf8")).adminHistory ?? {
      startedAt: null,
      events: [],
    }
  );
}
/* Atomically save the accepted CMS snapshot and audit events; the route checks its expected revision before calling this writer. */
export function saveContent(
  content: SiteContent,
  events: ActivityEvent[] = [],
  users: StoredUser[] = readUsers(),
) {
  const history = readActivity();
  const adminHistory: ActivityStore = {
    startedAt: history.startedAt || events[0]?.at || null,
    events: [...history.events, ...events],
  };
  writePrivateJson(path.join(dataDir, "content.json"), {
    ...content,
    adminHistory,
    users,
  });
}

/* Append a saved account/upload event to private history. */
export function recordActivity(event: ActivityEvent) {
  saveContent(readContent(), [event]);
}

/* Read password-bearing stored users only inside the backend. */
export function readUsers(): StoredUser[] {
  const file = path.join(dataDir, "content.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")).users ?? [];
}
/* Persist accounts and their associated audit events in the same private snapshot. */
export function saveUsers(users: StoredUser[], events: ActivityEvent[]) {
  saveContent(readContent(), events, users);
}

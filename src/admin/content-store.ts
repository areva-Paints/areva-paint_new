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
export function defaults(): SiteContent {
  return {
    revision: 0,
    galleryProjects: [],
    galleryAds: [],
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
export function readContent(): SiteContent {
  const file = path.join(dataDir, "content.json");
  if (!fs.existsSync(file)) return defaults();
  const {
    adminHistory: _privateHistory,
    users: _privateUsers,
    ...content
  } = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    ...content,
    galleryProjects: content.galleryProjects ?? [],
    galleryAds: content.galleryAds ?? [],
    colours: content.colours ?? COLOR_SHADES,
    shadeCards: content.shadeCards ?? [],
  };
}
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
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "content.json");
  fs.writeFileSync(
    file + ".tmp",
    JSON.stringify({ ...content, adminHistory, users }, null, 2),
    {
      mode: 0o600,
    },
  );
  fs.renameSync(file + ".tmp", file);
}

export function recordActivity(event: ActivityEvent) {
  saveContent(readContent(), [event]);
}

export function readUsers(): StoredUser[] {
  const file = path.join(dataDir, "content.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")).users ?? [];
}
export function saveUsers(users: StoredUser[], events: ActivityEvent[]) {
  saveContent(readContent(), events, users);
}

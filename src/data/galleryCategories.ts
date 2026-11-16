export const GALLERY_PROJECT_CATEGORIES = {
  interior: "Interior",
  exterior: "Exterior",
  textures: "Textures",
  waterproofing: "Waterproofing",
  commercial: "Commercial",
  other: "Other",
} as const;
export type GalleryProjectCategory = keyof typeof GALLERY_PROJECT_CATEGORIES;
export type GalleryProjectFilter = "all" | GalleryProjectCategory;
export function projectCategory(project: {
  category?: string;
}): GalleryProjectCategory {
  return project.category &&
    Object.hasOwn(GALLERY_PROJECT_CATEGORIES, project.category)
    ? (project.category as GalleryProjectCategory)
    : "other";
}

import type { ShadeFamily, ShadeTone } from "../data/shadeFamilies";
import type { Product, ColorShade } from "../types";
import type { GalleryProjectCategory } from "../data/galleryCategories";
export interface LandingImage {
  id: string;
  label: string;
  image: string;
  roomType: string;
  recommendedProduct: string;
}
export interface Dealer {
  id: string;
  name: string;
  pin: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  badges: string[];
}
export interface ShadeCard {
  family?: ShadeFamily | "All Shades";
  tones?: ShadeTone[];
  id: string;
  title: string;
  url: string;
}
export interface ProjectPhoto {
  id: string;
  image: string;
  caption: string;
}
export interface GalleryProject {
  id: string;
  category: GalleryProjectCategory;
  title: string;
  location: string;
  description: string;
  photos: ProjectPhoto[];
  createdAt: string;
  updatedAt: string;
}
export interface GalleryAd {
  id: string;
  title: string;
  channel: "digital" | "social";
  image: string;
  description: string;
  link: string;
  createdAt: string;
  updatedAt: string;
}
export interface GalleryReview {
  id: string;
  name: string;
  detail: string;
  text: string;
  image: string;
  createdAt: string;
  updatedAt: string;
}
export const DOCUMENT_TYPES = {
  certification: "Certification",
  test_report: "Test report",
  tds: "Technical data sheet (TDS)",
  sds: "Safety data sheet (SDS)",
  warranty: "Product warranty",
  other: "Other document",
} as const;
export interface CertificationAttachment {
  id: string;
  label: string;
  url: string;
}
export interface CertificationDocument {
  id: string;
  title: string;
  description: string;
  type: keyof typeof DOCUMENT_TYPES;
  label: string;
  issuer: string;
  reference: string;
  issuedOn: string;
  validUntil: string;
  productIds: string[];
  attachments: CertificationAttachment[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SiteContent {
  certifications: CertificationDocument[];
  galleryReviews: GalleryReview[];
  galleryAds: GalleryAd[];
  galleryProjects: GalleryProject[];
  colours: ColorShade[];
  shadeCards: ShadeCard[];
  products: Product[];
  dealers: Dealer[];
  landingImages: LandingImage[];
  revision: number;
}

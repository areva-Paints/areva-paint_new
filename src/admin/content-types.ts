import type { Product, ColorShade } from "../types";
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
  title: string;
  location: string;
  description: string;
  photos: ProjectPhoto[];
  createdAt: string;
  updatedAt: string;
}
export interface SiteContent {
  galleryProjects: GalleryProject[];
  colours: ColorShade[];
  shadeCards: ShadeCard[];
  products: Product[];
  dealers: Dealer[];
  landingImages: LandingImage[];
  revision: number;
}

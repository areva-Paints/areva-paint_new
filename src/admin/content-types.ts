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
export interface SiteContent {
  colours: ColorShade[];
  shadeCards: ShadeCard[];
  products: Product[];
  dealers: Dealer[];
  landingImages: LandingImage[];
  revision: number;
}

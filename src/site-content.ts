import type { SiteContent } from "./admin/content-types";
// The existing public Render Static Site and admin Web Service must read one store.
// Other deployments can select their shared backend at build time.
export function contentOrigin(): string {
  const configured = import.meta.env.VITE_CONTENT_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  if (window.location.hostname === "areva-paint-new.onrender.com")
    return "https://areva-paint-new-admin.onrender.com";
  return window.location.origin;
}
export function contentUrl(path: string): string {
  return new URL(path, contentOrigin()).href;
}
export function resolveContentImages(content: SiteContent): SiteContent {
  const resolve = (path: string) =>
    path.startsWith("/") ? contentUrl(path) : path;
  return {
    ...content,
    products: content.products.map((p) => ({ ...p, image: resolve(p.image) })),
    landingImages: content.landingImages.map((p) => ({
      ...p,
      image: resolve(p.image),
    })),
    shadeCards: content.shadeCards.map((p) => ({ ...p, url: resolve(p.url) })),
  };
}

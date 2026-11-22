/* One assignment rule connects public terms, product downloads and admin editing.
 * Unassigned warranty documents are company-wide; other document types require a link.
 */
import type { CertificationDocument } from "../admin/content-types";
import type { Product } from "../types";

export function documentAppliesToProduct(
  document: CertificationDocument,
  product: Product,
): boolean {
  return (
    document.productIds.includes(product.id) ||
    (document.categoryIds ?? []).includes(product.categoryId) ||
    (document.type === "warranty" &&
      !document.productIds.length &&
      !(document.categoryIds ?? []).length)
  );
}

export function warrantyTermsHref(productId?: string): string {
  return productId ? "#terms/" + encodeURIComponent(productId) : "#terms";
}

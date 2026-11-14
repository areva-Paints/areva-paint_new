import type { Product } from "../types";

export const OPTIONAL_PRODUCT_DETAILS = [
  "coverageText",
  "dilution",
  "bases",
  "packing",
  "warrantyLabel",
] as const;
export function productCoverageText(product: Product): string {
  return (
    product.specs.coverageText?.trim() ||
    (product.coverageSqFtPerLiter > 0
      ? `${product.coverageSqFtPerLiter} sq ft/${product.coverageUnit || "L"}/coat`
      : "Ask for technical guidance")
  );
}
export function productPacking(product: Product): string[] {
  return product.specs.packing?.length
    ? product.specs.packing
    : product.availableSizes.map(
        (size) => `${size} ${product.coverageUnit || "L"}`,
      );
}
export function productWarrantyText(product: Product): string {
  const years = product.specs.warrantyYears;
  return years > 0
    ? `${years} ${years === 1 ? "Year" : "Years"} · ${product.specs.warrantyLabel?.trim() || "Performance warranty*"}`
    : "";
}
export function getProductDisplayDetails(product: Product): [string, string][] {
  return [
    ["COVERAGE", productCoverageText(product)],
    ["DILUTION", product.specs.dilution || ""],
    ["DRYING TIME", product.specs.dryingTime],
    ["BASES", product.specs.bases?.join(", ") || ""],
    ["PACKING", productPacking(product).join(", ")],
    ["RECOMMENDED COATS", String(product.recommendedCoats)],
    ["APPLICATION", product.specs.applicationMethod],
  ].filter(([, value]) => Boolean(value)) as [string, string][];
}

/*
 * Share the product heading and configured warranty badge across public layouts.
 * A missing warranty value leaves no empty badge space.
 */
import React from "react";
import type { Product } from "../types";

/* Render a warranty badge only when the product has configured warranty text. */
export function ProductWarrantyBadge({ product }: { product: Product }) {
  const years = product.specs.warrantyYears;
  if (!(years > 0)) return null;
  return (
    <div className="product-warranty-badge" aria-label="Product warranty">
      <strong>
        {years} {years === 1 ? "Year" : "Years"}
      </strong>
      <span>
        {product.specs.warrantyLabel?.trim() || "Performance warranty*"}
      </span>
    </div>
  );
}
/* Pair the product heading with its optional warranty badge without reserving empty space. */
export function ProductSummaryHeading({
  product,
  level = "h3",
}: {
  product: Product;
  level?: "h3" | "h4";
}) {
  const Heading = level;
  return (
    <div className="product-summary-heading">
      <div className="product-summary-identity">
        <span className="product-summary-category">{product.categoryName}</span>
        <Heading className="product-summary-name">{product.name}</Heading>
        <p className="product-summary-finish">{product.sheen}</p>
      </div>
      <ProductWarrantyBadge product={product} />
    </div>
  );
}

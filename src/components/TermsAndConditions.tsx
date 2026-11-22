/* Shared public terms page. Admin-published warranty documents can apply to a
 * product type, individual products or the company. No legal wording is invented.
 */
import React, { useEffect, useRef } from "react";
import type { SiteContent } from "../admin/content-types";
import { useSiteContent } from "../admin/ContentContext";
import { CATEGORIES } from "../data/paintsData";
import { initializeTerms } from "../../public/assets/terms-conditions.js";

export function TermsAndConditions({
  content: supplied,
}: {
  content?: SiteContent;
}) {
  const current = useSiteContent();
  const content = supplied ?? current;
  const root = useRef<HTMLElement>(null);
  const documents = (content?.certifications ?? []).filter(
    (item) => item.published && item.type === "warranty",
  );
  useEffect(
    () => (root.current ? initializeTerms(root.current) : undefined),
    [content],
  );
  return (
    <section
      id="terms"
      ref={root}
      className="tc-section"
      data-ref-view="terms"
      aria-labelledby="tc-title"
    >
      <div className="ref-page-banner">
        <div className="wrap tc-wrap">
          <span className="ref-eyebrow">HOME / TERMS AND CONDITIONS</span>
          <h1 id="tc-title">Terms and conditions</h1>
          <p>
            Find the published performance warranty terms for your Areva
            product.
          </p>
        </div>
      </div>
      <div className="tc-wrap tc-content">
        <div className="tc-intro">
          <h2>Your product. Your warranty terms.</h2>
          <p>
            Select a product type or product to read the applicable PDFs
            published by Areva Paints.
          </p>
        </div>
        <div className="tc-filters">
          <label>
            Product type
            <select data-terms-category defaultValue="">
              <option value="">All product types</option>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Product
            <select data-terms-product defaultValue="">
              <option value="">All products</option>
              {(content?.products ?? []).map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                  data-category={product.categoryId}
                >
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" data-terms-reset>
            Clear filters
          </button>
        </div>
        <p
          data-terms-summary
          className="tc-summary"
          role="status"
          aria-live="polite"
        >
          {documents.length} published document(s)
        </p>
        <div className="tc-grid">
          {documents.map((document) => {
            const categories = CATEGORIES.filter((category) =>
              document.categoryIds?.includes(category.id),
            );
            const products = (content?.products ?? []).filter((product) =>
              document.productIds.includes(product.id),
            );
            return (
              <article
                key={document.id}
                className="tc-card"
                data-terms-document
                data-products={JSON.stringify(document.productIds)}
                data-categories={JSON.stringify(document.categoryIds ?? [])}
              >
                <span className="tc-label">
                  {document.label || "Performance warranty terms"}
                </span>
                <h3>{document.title}</h3>
                <p>{document.description}</p>
                <p className="tc-applies">
                  <strong>Applies to:</strong>{" "}
                  {[
                    ...categories.map((category) => category.name),
                    ...products.map((product) => product.name),
                  ].join(", ") || "All products"}
                </p>
                {document.reference && (
                  <p className="tc-reference">
                    Reference: {document.reference}
                  </p>
                )}
                <div className="tc-downloads">
                  {document.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.label + ".pdf"}
                      aria-label={`Read ${file.label} for ${document.title}`}
                    >
                      <span aria-hidden="true">↓</span> {file.label}{" "}
                      <small>PDF</small>
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <div
          className="tc-empty"
          data-terms-empty
          hidden={documents.length > 0}
        >
          <h3>No published terms available</h3>
          <p data-terms-empty-copy>
            Contact Areva Paints for the warranty terms applicable to your
            product.
          </p>
          <a href="#contact">
            Contact Areva Paints <span aria-hidden="true">→</span>
          </a>
        </div>
        <p className="tc-note">
          Warranty coverage is subject to the applicable published document and
          purchase review. Register your purchase through{" "}
          <a href="/warranty" target="_top">
            Warranty Registration
          </a>
          .
        </p>
      </div>
    </section>
  );
}

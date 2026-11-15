import React from "react";
import {
  DOCUMENT_TYPES,
  type CertificationDocument,
  type SiteContent,
} from "../admin/content-types";

type Content = Pick<SiteContent, "certifications" | "products">;
const date = (value: string) =>
  new Date(value + "T12:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
function Attachments({ item }: { item: CertificationDocument }) {
  return (
    <ul className="cd-downloads">
      {item.attachments.map((file) => (
        <li key={file.id}>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            download={file.label + ".pdf"}
            aria-label={`Download ${file.label} for ${item.title}`}
          >
            <span aria-hidden="true">↓</span> {file.label} <small>PDF</small>
          </a>
        </li>
      ))}
    </ul>
  );
}
export function CertificationsSection({
  content,
}: {
  content: Content | null;
}) {
  const items = (content?.certifications ?? []).filter(
    (item) => item.published,
  );
  return (
    <section id="certs" className="cd-section" aria-labelledby="cd-title">
      <div className="cd-wrap">
        <h2 id="cd-title" className="cd-title">
          Certifications and documents
        </h2>
        <p className="cd-intro">
          Certificates, test reports and downloads, linked to each product.
        </p>
        {items.length ? (
          <div className="cd-grid">
            {items.map((item) => {
              const products = (content?.products ?? []).filter((product) =>
                item.productIds.includes(product.id),
              );
              return (
                <article key={item.id} className="cd-card">
                  <span className="cd-label">
                    {item.label || DOCUMENT_TYPES[item.type]}
                  </span>
                  <h3>{item.title}</h3>
                  <p className="cd-description">{item.description}</p>
                  {(item.issuer ||
                    item.reference ||
                    item.issuedOn ||
                    item.validUntil) && (
                    <dl className="cd-metadata">
                      {item.issuer && (
                        <div>
                          <dt>Issued by</dt>
                          <dd>{item.issuer}</dd>
                        </div>
                      )}
                      {item.reference && (
                        <div>
                          <dt>Reference</dt>
                          <dd>{item.reference}</dd>
                        </div>
                      )}
                      {item.issuedOn && (
                        <div>
                          <dt>Issued on</dt>
                          <dd>
                            <time dateTime={item.issuedOn}>
                              {date(item.issuedOn)}
                            </time>
                          </dd>
                        </div>
                      )}
                      {item.validUntil && (
                        <div>
                          <dt>Valid until</dt>
                          <dd>
                            <time dateTime={item.validUntil}>
                              {date(item.validUntil)}
                            </time>
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {products.length > 0 && (
                    <p className="cd-products">
                      <strong>Applies to</strong>{" "}
                      {products.map((product) => product.name).join(", ")}
                    </p>
                  )}
                  <Attachments item={item} />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="cd-empty">
            Documents will appear here when published by Areva Paints.
          </p>
        )}
      </div>
    </section>
  );
}
export function ProductDocumentDownloads({
  content,
  productId,
}: {
  content: Content | null;
  productId: string;
}) {
  const items = (content?.certifications ?? []).filter(
    (item) => item.published && item.productIds.includes(productId),
  );
  if (!items.length) return null;
  return (
    <section className="cd-product-documents" aria-label="Product documents">
      <h3>Certifications and documents</h3>
      {items.map((item) => (
        <div key={item.id}>
          <h4>{item.title}</h4>
          <Attachments item={item} />
        </div>
      ))}
    </section>
  );
}

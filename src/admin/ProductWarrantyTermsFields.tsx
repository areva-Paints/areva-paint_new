/* Attach public warranty PDF terms from the product editor. Assignments live in
 * the shared document collection, so product-type terms also cover future products.
 * Uploading does not publish: the parent saves product and documents in one revision.
 */
import { DOCUMENT_MAX_BYTES } from "../data/uploadLimits";
import React, { useId, useState } from "react";
import type { Product } from "../types";
import type { CertificationDocument } from "./content-types";

export function ProductWarrantyTermsFields({
  product,
  documents,
  onChange,
  onBusy,
}: {
  product: Product;
  documents: CertificationDocument[];
  onChange: (documents: CertificationDocument[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const available = documents.filter(
    (document) => document.type === "warranty",
  );
  const first =
    available.find((document) => document.productIds.includes(product.id)) ??
    available.find((document) =>
      (document.categoryIds ?? []).includes(product.categoryId),
    );
  const [activeId, setActiveId] = useState(first?.id ?? "");
  const active = available.find((document) => document.id === activeId);
  const [scope, setScope] = useState<"category" | "product">(
    first?.productIds.includes(product.id) ? "product" : "category",
  );
  const [title, setTitle] = useState(
    first?.title ?? `Warranty terms and conditions — ${product.categoryName}`,
  );
  const [description, setDescription] = useState(
    first?.description ??
      `Read the published warranty terms and conditions for ${product.categoryName}.`,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const prefix = useId();
  const put = (document: CertificationDocument) =>
    onChange(
      documents.some((item) => item.id === document.id)
        ? documents.map((item) => (item.id === document.id ? document : item))
        : [...documents, document],
    );
  const assigned = (document: CertificationDocument, nextScope = scope) => ({
    ...document,
    productIds:
      nextScope === "product"
        ? [...new Set([...document.productIds, product.id])]
        : document.productIds,
    categoryIds:
      nextScope === "category"
        ? [...new Set([...(document.categoryIds ?? []), product.categoryId])]
        : (document.categoryIds ?? []),
  });
  /* Validate and stage the server-owned PDF URL; the CMS save owns publication. */
  async function upload(file?: File) {
    if (!file) return;
    if (
      file.size > DOCUMENT_MAX_BYTES ||
      !(
        file.type === "application/pdf" ||
        (!file.type && /\.pdf$/i.test(file.name))
      )
    ) {
      setError("Choose a PDF up to 5 MB.");
      return;
    }
    if (!active && documents.length >= 100) {
      setError(
        "Keep up to 100 document cards. Edit an existing warranty document.",
      );
      return;
    }
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("The PDF could not be read."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/admin/pdf-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          originalName: file.name,
          section: "certifications",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "The PDF could not be uploaded.");
      const document: CertificationDocument = assigned({
        ...(active ?? {
          id: crypto.randomUUID(),
          type: "warranty",
          label: "Warranty terms and conditions",
          issuer: "",
          reference: "",
          issuedOn: "",
          validUntil: "",
          productIds: [],
          categoryIds: [],
          createdAt: "",
          updatedAt: "",
        }),
        title:
          title.trim() ||
          `Warranty terms and conditions — ${product.categoryName}`,
        description:
          description.trim() ||
          `Read the published warranty terms and conditions for ${product.categoryName}.`,
        attachments: [
          {
            id: active?.attachments[0]?.id ?? crypto.randomUUID(),
            label: file.name.replace(/\.pdf$/i, "").slice(0, 150),
            url: result.url,
          },
          ...(active?.attachments.slice(1) ?? []),
        ],
        published: true,
      });
      put(document);
      setActiveId(document.id);
      setTitle(document.title);
      setDescription(document.description);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      className="adm-product-terms"
      aria-label="Warranty terms and conditions"
    >
      <h3>Warranty terms and conditions</h3>
      <p className="adm-muted">
        Upload a public PDF for this product or its whole product type.
        Product-type documents also apply to future products in that type. Use
        Apply to workspace, then Save changes to publish the assignment.
      </p>
      <div className="adm-form-grid">
        <div className="adm-field">
          <label htmlFor={prefix + "-scope"}>Assign terms to</label>
          <select
            id={prefix + "-scope"}
            value={scope}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value as "category" | "product";
              setScope(value);
              if (active) put(assigned(active, value));
            }}
          >
            <option value="category">
              Product type: {product.categoryName}
            </option>
            <option value="product">Product: {product.name}</option>
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor={prefix + "-document"}>
            Existing warranty document
          </label>
          <select
            id={prefix + "-document"}
            value={activeId}
            disabled={busy}
            onChange={(event) => {
              const item = available.find(
                (document) => document.id === event.target.value,
              );
              setActiveId(item?.id ?? "");
              if (item) {
                setTitle(item.title);
                setDescription(item.description);
                put(assigned(item));
              }
            }}
          >
            <option value="">Upload a new terms document</option>
            {available.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title}
                {document.published ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor={prefix + "-title"}>Terms heading</label>
          <input
            id={prefix + "-title"}
            value={title}
            maxLength={150}
            disabled={busy}
            required={!!active}
            onChange={(event) => {
              setTitle(event.target.value);
              if (active) put({ ...active, title: event.target.value });
            }}
          />
        </div>
        <div className="adm-field">
          <label htmlFor={prefix + "-description"}>Terms description</label>
          <textarea
            id={prefix + "-description"}
            value={description}
            maxLength={2000}
            rows={2}
            disabled={busy}
            required={!!active}
            onChange={(event) => {
              setDescription(event.target.value);
              if (active) put({ ...active, description: event.target.value });
            }}
          />
        </div>
      </div>
      <label className="adm-upload adm-terms-upload">
        {busy
          ? "Uploading terms…"
          : active?.attachments.length
            ? "Replace terms PDF"
            : "Upload terms PDF"}
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label="Upload warranty terms PDF"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {active && (
        <>
          <p className="adm-muted">
            {active.attachments.map((file) => file.label).join(", ")} ·{" "}
            {active.published
              ? "Published after saving"
              : "Hidden — enable in Certifications and documents"}
          </p>
          <p className="adm-muted">
            Edits to a shared document affect all its assigned products. Manage
            additional assignments, attachments, visibility and removal in
            Certifications and documents.
          </p>
        </>
      )}
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

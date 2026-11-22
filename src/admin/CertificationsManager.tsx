/*
 * Edit document-card drafts, product links and uploaded PDFs.
 * Saving a document uses the parent revision-aware publish action; uploads are authenticated separately.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  type CertificationDocument,
  type SiteContent,
} from "./content-types";
import { CATEGORIES } from "../data/paintsData";
import { AdminUpdated } from "./ActivityHistory";

/* Keep label, required state and validation layout consistent across editor fields. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<any>;
}) {
  const id = useId();
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
}
/* Edit document-card drafts, product links and uploaded PDFs. */
export function CertificationsManager({
  content,
  onChange,
  onPublish,
  onBusy,
  publishError,
}: {
  content: SiteContent;
  onChange: (content: SiteContent) => void;
  onPublish: (content: SiteContent) => Promise<boolean>;
  onBusy: (busy: boolean) => void;
  publishError: string;
}) {
  const items = content.certifications ?? [];
  const [draft, setDraft] = useState<CertificationDocument | null>(null);
  const [query, setQuery] = useState(""),
    [type, setType] = useState("");
  const [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [attempted, setAttempted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    locked = uploading || saving;
  useEffect(() => {
    if (draft) dialog.current?.showModal();
    else dialog.current?.close();
  }, [Boolean(draft)]);
  /* Initialize an isolated editor draft from the selected record before showing its dialog. */
  function open(item?: CertificationDocument) {
    setError("");
    setAttempted(false);
    setDraft(
      item
        ? structuredClone(item)
        : {
            id: crypto.randomUUID(),
            title: "",
            description: "",
            type: "certification",
            label: "",
            issuer: "",
            reference: "",
            issuedOn: "",
            validUntil: "",
            productIds: [],
            attachments: [],
            published: true,
            createdAt: "",
            updatedAt: "",
          },
    );
  }
  /* Update one draft field while preserving the other form values. */
  function patch<K extends keyof CertificationDocument>(
    key: K,
    value: CertificationDocument[K],
  ) {
    setDraft((item) => (item ? { ...item, [key]: value } : item));
  }
  /* Send the selected file to its authenticated upload API and keep the returned server-owned URL. */
  async function upload(files: FileList | null) {
    if (!files?.length || !draft) return;
    const chosen = Array.from(files);
    if (draft.attachments.length + chosen.length > 5) {
      setError("Keep up to five PDF attachments per card.");
      return;
    }
    if (
      chosen.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !(
            file.type === "application/pdf" ||
            (!file.type && /\.pdf$/i.test(file.name))
          ),
      )
    ) {
      setError("Choose PDF files up to 5 MB each.");
      return;
    }
    setUploading(true);
    onBusy(true);
    setError("");
    try {
      for (const file of chosen) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(
              "data:application/pdf;base64," +
                String(reader.result).split(",")[1],
            );
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
        setDraft((item) =>
          item
            ? {
                ...item,
                attachments: [
                  ...item.attachments,
                  {
                    id: crypto.randomUUID(),
                    label: file.name.replace(/\.pdf$/i, "").slice(0, 150),
                    url: result.url,
                  },
                ],
              }
            : item,
        );
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }
  /* Validate the card and publish its complete CMS revision through the parent persistence action. */
  async function save() {
    if (!draft || locked) return;
    if (!draft.title.trim() || !draft.description.trim()) {
      setError("Enter a heading and description.");
      return;
    }
    if (draft.published && !draft.attachments.length) {
      setError(
        "Upload at least one PDF before showing this card on the website.",
      );
      return;
    }
    if (draft.attachments.some((file) => !file.label.trim())) {
      setError("Enter a label for every attachment.");
      return;
    }
    if (
      draft.issuedOn &&
      draft.validUntil &&
      draft.issuedOn > draft.validUntil
    ) {
      setError("Valid until cannot be before the issue date.");
      return;
    }
    setSaving(true);
    setError("");
    setAttempted(true);
    try {
      const next = {
        ...content,
        certifications: items.some((item) => item.id === draft.id)
          ? items.map((item) => (item.id === draft.id ? draft : item))
          : [...items, draft],
      };
      if (await onPublish(next)) setDraft(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  /* Reorder the selected card without changing its stable identifier. */
  function move(id: string, offset: number) {
    const next = [...items],
      index = next.findIndex((item) => item.id === id),
      target = index + offset;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...content, certifications: next });
  }
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = items.filter((item) => {
    const text = [
      item.title,
      item.description,
      item.label,
      DOCUMENT_TYPES[item.type],
      item.issuer,
      item.reference,
      ...item.attachments.map((file) => file.label),
      ...content.products
        .filter((product) => item.productIds.includes(product.id))
        .map((product) => product.name),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!type || item.type === type) &&
      terms.every((term) => text.includes(term))
    );
  });
  return (
    <section
      className="adm-panel adm-certifications"
      aria-label="Manage certifications and documents"
    >
      <div className="adm-panel-toolbar">
        <div>
          <h2>Document cards</h2>
          <small>{items.length} cards · Website order is shown below</small>
        </div>
        <button
          type="button"
          className="adm-primary"
          disabled={locked || items.length >= 100}
          onClick={() => open()}
        >
          <Plus size={17} />
          Add document
        </button>
      </div>
      <div className="adm-cert-tools">
        <Field label="Search documents">
          <input
            type="search"
            value={query}
            placeholder="Search heading, issuer, reference or product"
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field label="Document type filter">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All document types</option>
            {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="adm-muted">
        Cards appear in the website’s Certifications and documents section.
        Linked products also show their PDF downloads. After reordering or
        removing a card, use Save changes.
      </p>
      <div className="adm-cert-grid">
        {filtered.map((item) => {
          const index = items.findIndex((row) => row.id === item.id);
          return (
            <article key={item.id} className="adm-cert-card">
              <span>
                {item.label || DOCUMENT_TYPES[item.type]} ·{" "}
                {item.published ? "Shown on website" : "Hidden"}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>
                {item.attachments.length} PDF attachment(s) ·{" "}
                {(item.categoryIds ?? []).length
                  ? `${item.categoryIds!.length} product type(s)`
                  : item.productIds.length
                    ? `${item.productIds.length} linked product(s)`
                    : "Company-wide"}
              </small>
              <AdminUpdated
                section="certifications"
                id={item.id}
                fallback={item.updatedAt}
              />
              <div className="adm-row-actions">
                <button
                  type="button"
                  className="adm-secondary"
                  onClick={() => open(item)}
                  aria-label={`Edit ${item.title}`}
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  className="adm-icon-button"
                  disabled={index === 0}
                  onClick={() => move(item.id, -1)}
                  aria-label={`Move ${item.title} up`}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  className="adm-icon-button"
                  disabled={index === items.length - 1}
                  onClick={() => move(item.id, 1)}
                  aria-label={`Move ${item.title} down`}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  className="adm-icon-button"
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this card? Save changes to remove it from the website. Uploaded PDFs are retained for existing links.",
                      )
                    )
                      onChange({
                        ...content,
                        certifications: items.filter(
                          (row) => row.id !== item.id,
                        ),
                      });
                  }}
                  aria-label={`Remove ${item.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="adm-empty">
          <FileText size={30} />
          <h3>
            {items.length ? "No matching documents" : "No documents added yet"}
          </h3>
          <p>
            Add your certificates, reports, data sheets or warranty documents.
          </p>
        </div>
      )}
      <dialog
        ref={dialog}
        className="adm-dialog adm-cert-dialog"
        onClose={() => {
          if (!locked) setDraft(null);
        }}
        onCancel={(event) => {
          if (locked) event.preventDefault();
          else setDraft(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="adm-dialog-heading">
            <div>
              <span className="adm-eyebrow">CERTIFICATIONS AND DOCUMENTS</span>
              <h2>
                {items.some((item) => item.id === draft?.id)
                  ? "Edit document card"
                  : "Add document card"}
              </h2>
            </div>
            <button
              type="button"
              className="adm-icon-button"
              disabled={locked}
              aria-label="Close document editor"
              onClick={() => setDraft(null)}
            >
              <X size={20} />
            </button>
          </div>
          {draft && (
            <div className="adm-dialog-body">
              <fieldset disabled={locked} className="adm-cert-fields">
                <Field label="Heading *">
                  <input
                    required
                    maxLength={150}
                    value={draft.title}
                    onChange={(event) => patch("title", event.target.value)}
                  />
                </Field>
                <Field label="Description *">
                  <textarea
                    required
                    maxLength={2000}
                    rows={4}
                    value={draft.description}
                    onChange={(event) =>
                      patch("description", event.target.value)
                    }
                  />
                </Field>
                <div className="adm-cert-tools">
                  <Field label="Document type">
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        patch(
                          "type",
                          event.target.value as CertificationDocument["type"],
                        )
                      }
                    >
                      {Object.entries(DOCUMENT_TYPES).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Card label (optional)">
                    <input
                      maxLength={80}
                      placeholder="For example: Green building"
                      value={draft.label}
                      onChange={(event) => patch("label", event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Issuing organisation (optional)">
                  <input
                    maxLength={200}
                    value={draft.issuer}
                    onChange={(event) => patch("issuer", event.target.value)}
                  />
                </Field>
                <Field label="Certificate / document reference (optional)">
                  <input
                    maxLength={100}
                    value={draft.reference}
                    onChange={(event) => patch("reference", event.target.value)}
                  />
                </Field>
                <div className="adm-cert-tools">
                  <Field label="Issue date (optional)">
                    <input
                      type="date"
                      min="1900-01-01"
                      max={draft.validUntil || "2200-12-31"}
                      value={draft.issuedOn}
                      onChange={(event) =>
                        patch("issuedOn", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Valid until (optional)">
                    <input
                      type="date"
                      min={draft.issuedOn || "1900-01-01"}
                      max="2200-12-31"
                      value={draft.validUntil}
                      onChange={(event) =>
                        patch("validUntil", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <label className="adm-cert-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(event) =>
                      patch("published", event.target.checked)
                    }
                  />
                  Show on website
                </label>
                <fieldset className="adm-cert-products">
                  <legend>Product types (optional)</legend>
                  <small>
                    Assign a document to every current and future product in a
                    type.
                  </small>
                  <div>
                    {CATEGORIES.map((category) => (
                      <label key={category.id}>
                        <input
                          type="checkbox"
                          checked={(draft.categoryIds ?? []).includes(
                            category.id,
                          )}
                          onChange={(event) =>
                            patch(
                              "categoryIds",
                              event.target.checked
                                ? [...(draft.categoryIds ?? []), category.id]
                                : (draft.categoryIds ?? []).filter(
                                    (id) => id !== category.id,
                                  ),
                            )
                          }
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="adm-cert-products">
                  <legend>Linked products (optional)</legend>
                  <small>Leave unselected for a company-wide document.</small>
                  <div>
                    {content.products.map((product) => (
                      <label key={product.id}>
                        <input
                          type="checkbox"
                          checked={draft.productIds.includes(product.id)}
                          onChange={(event) =>
                            patch(
                              "productIds",
                              event.target.checked
                                ? [...draft.productIds, product.id]
                                : draft.productIds.filter(
                                    (id) => id !== product.id,
                                  ),
                            )
                          }
                        />
                        {product.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="adm-cert-attachments">
                  <h3>PDF attachments</h3>
                  <p className="adm-muted">
                    Up to five PDFs, 5 MB each. Uploaded files have public
                    download URLs; add documents intended for publication.
                  </p>
                  {draft.attachments.map((file, index) => (
                    <div key={file.id} className="adm-cert-attachment">
                      <Field label={`Attachment label ${index + 1}`}>
                        <input
                          required
                          maxLength={150}
                          value={file.label}
                          onChange={(event) =>
                            patch(
                              "attachments",
                              draft.attachments.map((row) =>
                                row.id === file.id
                                  ? { ...row, label: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download PDF
                      </a>
                      <button
                        type="button"
                        className="adm-icon-button"
                        aria-label={`Remove attachment ${index + 1}`}
                        onClick={() =>
                          patch(
                            "attachments",
                            draft.attachments.filter(
                              (row) => row.id !== file.id,
                            ),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <label className="adm-upload">
                    <Upload size={16} />
                    {uploading ? "Uploading…" : "Upload PDFs"}
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.pdf"
                      aria-label="Upload document PDFs"
                      disabled={locked || draft.attachments.length >= 5}
                      onChange={(event) => {
                        void upload(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </fieldset>
              {(error || (attempted && publishError)) && (
                <p className="adm-error" role="alert">
                  {error || publishError}
                </p>
              )}
            </div>
          )}
          <div className="adm-dialog-footer">
            <button
              type="button"
              className="adm-secondary"
              disabled={locked}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
            <button type="submit" className="adm-primary" disabled={locked}>
              <Save size={16} />
              {saving ? "Saving…" : "Save document card"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

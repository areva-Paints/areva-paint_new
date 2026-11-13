import React, { useEffect, useId, useRef, useState } from "react";
import {
  ImagePlus,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GalleryReview, SiteContent } from "./content-types";
import { AdminUpdated } from "./ActivityHistory";
import { ImagePreview, checkImage } from "./ImagePreview";

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
export function GalleryReviewsManager({
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
  const reviews = content.galleryReviews ?? [];
  const [draft, setDraft] = useState<GalleryReview | null>(null),
    [query, setQuery] = useState(""),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [publishAttempted, setPublishAttempted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    locked = uploading || saving;
  useEffect(() => {
    if (draft) dialog.current?.showModal();
    else dialog.current?.close();
  }, [Boolean(draft)]);
  function open(review?: GalleryReview) {
    const now = new Date().toISOString();
    setDraft(
      review
        ? { ...review }
        : {
            id: crypto.randomUUID(),
            name: "",
            detail: "",
            text: "",
            image: "",
            createdAt: now,
            updatedAt: now,
          },
    );
    setError("");
    setProgress("");
    setPublishAttempted(false);
  }
  function patch(key: "name" | "detail" | "text" | "image", value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
  async function upload(file?: File) {
    if (!file || !draft) return;
    if (
      file.size > 25 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG or WebP image up to 25 MB.");
      return;
    }
    setUploading(true);
    onBusy(true);
    setError("");
    setProgress("Uploading review image…");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("The image could not be read."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          originalName: file.name,
          section: "galleryReviews",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Image upload failed.");
      await checkImage(result.url);
      patch("image", result.url);
      setProgress("Image uploaded. Save the review to publish it.");
    } catch (failure) {
      setError((failure as Error).message);
      setProgress("");
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }
  async function apply(publish: boolean) {
    if (!draft || locked) return;
    const review = {
      ...draft,
      name: draft.name.trim(),
      detail: draft.detail.trim(),
      text: draft.text.trim(),
      image: draft.image.trim(),
    };
    if (!review.name || !review.text) {
      setError("Enter the reviewer name and review text.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (review.image) await checkImage(review.image);
      const next = {
        ...content,
        galleryReviews: reviews.some((item) => item.id === review.id)
          ? reviews.map((item) => (item.id === review.id ? review : item))
          : [...reviews, review],
      };
      if (publish) {
        setPublishAttempted(true);
        if (await onPublish(next)) setDraft(null);
      } else {
        onChange(next);
        setDraft(null);
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const filtered = reviews
    .map((review, index) => ({ review, index }))
    .sort(
      (a, b) =>
        (Date.parse(b.review.updatedAt) ||
          Date.parse(b.review.createdAt) ||
          0) -
          (Date.parse(a.review.updatedAt) ||
            Date.parse(a.review.createdAt) ||
            0) || b.index - a.index,
    )
    .map((item) => item.review)
    .filter((review) =>
      `${review.name} ${review.detail} ${review.text}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
    );
  return (
    <section className="adm-panel">
      <div className="adm-panel-toolbar">
        <div>
          <h2>Reviews gallery</h2>
          <small>{reviews.length} reviews · Newest updates appear first</small>
        </div>
        <button
          className="adm-primary"
          type="button"
          disabled={locked || reviews.length >= 100}
          onClick={() => open()}
        >
          <Plus size={17} />
          Add review
        </button>
      </div>
      <div className="adm-ads-tools">
        <Field label="Search reviews">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviewer or review text"
          />
        </Field>
        <p className="adm-muted">
          Add a reviewer name and their review. You can include a location or
          description and an image.
        </p>
      </div>
      <div className="adm-gallery">
        {filtered.map((review) => (
          <article key={review.id}>
            <div className="adm-gallery-image">
              {review.image ? (
                <ImagePreview
                  src={review.image}
                  alt={`Review from ${review.name}`}
                />
              ) : (
                <div className="adm-ad-link-cover">
                  <MessageSquare size={30} />
                  <small>Text review</small>
                </div>
              )}
            </div>
            <div className="adm-gallery-copy">
              <h3>{review.name}</h3>
              {review.detail && <small>{review.detail}</small>}
              <AdminUpdated
                section="galleryReviews"
                id={review.id}
                fallback={review.updatedAt}
              />
              <p>{review.text}</p>
              <div className="adm-row-actions">
                <button
                  type="button"
                  disabled={locked}
                  aria-label={`Edit review ${review.name}`}
                  onClick={() => open(review)}
                >
                  <Pencil size={14} />
                  Edit review
                </button>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={`Remove review ${review.name}`}
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this review? Save changes to publish the removal.",
                      )
                    )
                      onChange({
                        ...content,
                        galleryReviews: reviews.filter(
                          (item) => item.id !== review.id,
                        ),
                      });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="adm-empty">
          <MessageSquare size={32} />
          <h3>
            {query ? "No matching reviews" : "Share customer experiences"}
          </h3>
          <p>Add reviews for visitors to read in Gallery → Reviews.</p>
        </div>
      )}
      <dialog
        className="adm-dialog adm-ad-dialog"
        ref={dialog}
        onCancel={(event) => {
          if (locked) event.preventDefault();
          else setDraft(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void apply(true);
          }}
        >
          <div className="adm-dialog-heading">
            <div>
              <span className="adm-eyebrow">GALLERY REVIEW</span>
              <h2>
                {reviews.some((review) => review.id === draft?.id)
                  ? "Edit review"
                  : "Add review"}
              </h2>
            </div>
            <button
              type="button"
              className="adm-close"
              disabled={locked}
              aria-label="Close review editor"
              onClick={() => setDraft(null)}
            >
              <X />
            </button>
          </div>
          {draft && (
            <div className="adm-dialog-body">
              <fieldset className="adm-project-fields" disabled={locked}>
                <Field label="Reviewer name">
                  <input
                    required
                    maxLength={150}
                    value={draft.name}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Location or description (optional)">
                  <input
                    maxLength={200}
                    value={draft.detail}
                    onChange={(e) => patch("detail", e.target.value)}
                  />
                </Field>
                <Field label="Review text">
                  <textarea
                    required
                    rows={6}
                    maxLength={2000}
                    value={draft.text}
                    onChange={(e) => patch("text", e.target.value)}
                  />
                </Field>
                <div className="adm-ad-upload-row">
                  <h3>Review image (optional)</h3>
                  <label className="adm-upload">
                    <Upload size={16} />
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload review image"
                      disabled={locked}
                      onChange={(e) => {
                        void upload(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {draft.image ? (
                  <>
                    <div className="adm-ad-image-preview">
                      <ImagePreview
                        src={draft.image}
                        alt={`Review from ${draft.name || "reviewer"}`}
                      />
                    </div>
                    <button
                      type="button"
                      className="adm-secondary"
                      onClick={() => patch("image", "")}
                    >
                      <Trash2 size={15} />
                      Remove image
                    </button>
                  </>
                ) : (
                  <div className="adm-image-placeholder">
                    <ImagePlus size={32} />
                    <span>Optional JPEG, PNG or WebP image up to 25 MB.</span>
                  </div>
                )}
                <Field label="Review image URL (optional)">
                  <input
                    value={draft.image}
                    maxLength={2048}
                    onChange={(e) => patch("image", e.target.value)}
                  />
                </Field>
              </fieldset>
              {progress && (
                <p className="adm-muted" role="status">
                  {progress}
                </p>
              )}
              {(error || (publishAttempted && publishError)) && (
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
            <button
              type="button"
              className="adm-secondary"
              disabled={locked}
              onClick={() => void apply(false)}
            >
              Apply to workspace
            </button>
            <button type="submit" className="adm-primary" disabled={locked}>
              <Save size={16} />
              {saving ? "Saving…" : "Save review to website"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

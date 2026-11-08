import React, { useEffect, useId, useRef, useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GalleryAd, SiteContent } from "./content-types";
import { checkImage, ImagePreview } from "./ImagePreview";

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

export function GalleryAdsManager({
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
  const [draft, setDraft] = useState<GalleryAd | null>(null);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"all" | GalleryAd["channel"]>("all");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [publishAttempted, setPublishAttempted] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ads = content.galleryAds ?? [];
  const locked = uploading || saving;
  useEffect(() => {
    if (draft) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else dialog.current?.close();
  }, [Boolean(draft)]);

  function open(ad?: GalleryAd) {
    const now = new Date().toISOString();
    setError("");
    setProgress("");
    setPublishAttempted(false);
    setDraft(
      ad
        ? { ...ad }
        : {
            id: crypto.randomUUID(),
            title: "",
            channel: "digital",
            image: "",
            description: "",
            link: "",
            createdAt: now,
            updatedAt: now,
          },
    );
  }
  function patch(
    key: "title" | "channel" | "image" | "description" | "link",
    value: string,
  ) {
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
    setProgress("Uploading ad image…");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(Error("The file could not be read. Choose the image again."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Image upload failed.");
      await checkImage(result.url);
      setDraft((current) =>
        current ? { ...current, image: result.url } : current,
      );
      setProgress("Image uploaded. Save the ad to publish it.");
    } catch (failure) {
      setProgress("");
      setError((failure as Error).message);
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }
  async function apply(publish: boolean) {
    if (!draft || locked) return;
    const ad = {
      ...draft,
      title: draft.title.trim(),
      image: draft.image.trim(),
      link: draft.link.trim(),
      updatedAt: new Date().toISOString(),
    };
    if (!ad.title) {
      setError("Enter an ad title.");
      return;
    }
    if (!ad.image && !ad.link) {
      setError("Upload an image or add a video, post or campaign link.");
      return;
    }
    if (ad.link) {
      try {
        const link = new URL(ad.link);
        if (link.protocol !== "https:" || link.username || link.password)
          throw Error();
      } catch {
        setError("Enter a valid HTTPS video, post or campaign URL.");
        return;
      }
    }
    setError("");
    setSaving(true);
    try {
      if (ad.image) await checkImage(ad.image);
      const next = {
        ...content,
        galleryAds: ads.some((item) => item.id === ad.id)
          ? ads.map((item) => (item.id === ad.id ? ad : item))
          : [...ads, ad],
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
  const filtered = ads
    .map((ad, index) => ({ ad, index }))
    .sort(
      (a, b) =>
        (Date.parse(b.ad.updatedAt) || Date.parse(b.ad.createdAt) || 0) -
          (Date.parse(a.ad.updatedAt) || Date.parse(a.ad.createdAt) || 0) ||
        b.index - a.index,
    )
    .map(({ ad }) => ad)
    .filter(
      (ad) =>
        (channel === "all" || ad.channel === channel) &&
        `${ad.title} ${ad.description}`
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
    );

  return (
    <section className="adm-panel adm-ads-manager">
      <div className="adm-panel-toolbar">
        <div>
          <h2>Ads gallery</h2>
          <small>{ads.length} ads · Newest updates appear first</small>
        </div>
        <button
          type="button"
          className="adm-primary"
          disabled={locked || ads.length >= 100}
          onClick={() => open()}
        >
          <Plus size={17} />
          Add ad
        </button>
      </div>
      <div className="adm-ads-tools">
        <Field label="Search ads">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ad title or description"
          />
        </Field>
        <Field label="Filter ads by channel">
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as typeof channel)
            }
          >
            <option value="all">All channels</option>
            <option value="digital">Digital</option>
            <option value="social">Social media</option>
          </select>
        </Field>
        <p className="adm-muted">
          Upload an ad image up to 25 MB, or add a video, social post or
          campaign link. Only the title, channel and an image or link are
          required.
        </p>
      </div>
      <div className="adm-gallery">
        {filtered.map((ad) => (
          <article key={ad.id}>
            <div className="adm-gallery-image">
              {ad.image ? (
                <ImagePreview src={ad.image} alt={ad.title} />
              ) : (
                <div className="adm-ad-link-cover">
                  <Megaphone size={30} />
                  <small>Linked ad</small>
                </div>
              )}
              <span>
                {ad.channel === "social" ? "Social media" : "Digital"}
              </span>
            </div>
            <div className="adm-gallery-copy">
              <h3>{ad.title}</h3>
              <p>
                {ad.description ||
                  (ad.link ? "Video, post or campaign link" : "Image ad")}
              </p>
              {ad.link && (
                <a
                  className="adm-ad-link"
                  href={ad.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open linked ad <ExternalLink size={13} />
                </a>
              )}
              <div className="adm-row-actions">
                <button
                  type="button"
                  disabled={locked}
                  aria-label={"Edit ad " + ad.title}
                  onClick={() => open(ad)}
                >
                  <Pencil size={14} />
                  Edit ad
                </button>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={"Remove ad " + ad.title}
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this ad? Save changes to publish the removal.",
                      )
                    )
                      onChange({
                        ...content,
                        galleryAds: ads.filter((item) => item.id !== ad.id),
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
          <Megaphone size={32} />
          <h3>
            {search || channel !== "all"
              ? "No matching ads"
              : "Share your latest campaigns"}
          </h3>
          <p>
            Add digital and social media ads for visitors to explore in Gallery
            → Ads.
          </p>
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
              <span className="adm-eyebrow">GALLERY AD</span>
              <h2>
                {ads.some((ad) => ad.id === draft?.id) ? "Edit ad" : "Add ad"}
              </h2>
            </div>
            <button
              type="button"
              className="adm-close"
              disabled={locked}
              aria-label="Close ad editor"
              onClick={() => setDraft(null)}
            >
              <X />
            </button>
          </div>
          {draft && (
            <div className="adm-dialog-body">
              <fieldset className="adm-project-fields" disabled={locked}>
                <Field label="Ad title">
                  <input
                    required
                    maxLength={150}
                    value={draft.title}
                    onChange={(event) => patch("title", event.target.value)}
                  />
                </Field>
                <Field label="Channel">
                  <select
                    value={draft.channel}
                    onChange={(event) => patch("channel", event.target.value)}
                  >
                    <option value="digital">Digital</option>
                    <option value="social">Social media</option>
                  </select>
                </Field>
                <Field label="Description (optional)">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.description}
                    onChange={(event) =>
                      patch("description", event.target.value)
                    }
                  />
                </Field>
                <div className="adm-ad-upload-row">
                  <h3>Creative image (optional)</h3>
                  <label className="adm-upload">
                    <Upload size={16} />
                    {uploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Upload ad image"
                      disabled={locked}
                      onChange={(event) => {
                        void upload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {draft.image ? (
                  <div className="adm-ad-image-preview">
                    <ImagePreview
                      src={draft.image}
                      alt={draft.title || "Ad preview"}
                    />
                  </div>
                ) : (
                  <div className="adm-image-placeholder">
                    <ImagePlus size={32} />
                    <span>Upload a JPEG, PNG or WebP image up to 25 MB.</span>
                  </div>
                )}
                <Field label="Image URL (optional)">
                  <input
                    value={draft.image}
                    maxLength={2000}
                    placeholder="Upload an image or paste an HTTPS image URL"
                    onChange={(event) => patch("image", event.target.value)}
                  />
                </Field>
                {draft.image && (
                  <button
                    className="adm-ad-remove-image"
                    type="button"
                    onClick={() => patch("image", "")}
                  >
                    <Trash2 size={14} />
                    Remove image
                  </button>
                )}
                <Field label="Video, post or campaign URL (optional)">
                  <input
                    type="url"
                    value={draft.link}
                    maxLength={2000}
                    placeholder="https://…"
                    onChange={(event) => patch("link", event.target.value)}
                  />
                </Field>
                <p className="adm-muted">
                  Add an image, a link, or both. Video and social media links
                  open in a new tab.
                </p>
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
              <Save size={17} />
              {uploading
                ? "Uploading…"
                : saving
                  ? "Saving…"
                  : "Save ad to website"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

import { AdminUpdated } from "./ActivityHistory";
import React, { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { GalleryProject, SiteContent } from "./content-types";
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
const id = () => crypto.randomUUID();
export function ProjectGalleryManager({
  content,
  onChange,
  onPublish,
  onBusy,
  publishError,
}: {
  content: SiteContent;
  onChange: (next: SiteContent) => void;
  onPublish: (next: SiteContent) => Promise<boolean>;
  onBusy: (busy: boolean) => void;
  publishError: string;
}) {
  const [draft, setDraft] = useState<GalleryProject | null>(null),
    [search, setSearch] = useState(""),
    [uploading, setUploading] = useState(false),
    [saving, setSaving] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (draft) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    } else dialog.current?.close();
  }, [!!draft]);
  const locked = uploading || saving;
  function open(project?: GalleryProject) {
    setError("");
    setProgress("");
    const now = new Date().toISOString();
    setDraft(
      project
        ? { ...project, photos: project.photos.map((p) => ({ ...p })) }
        : {
            id: id(),
            title: "",
            location: "",
            description: "",
            photos: [],
            createdAt: now,
            updatedAt: now,
          },
    );
  }
  function patch(key: "title" | "location" | "description", value: string) {
    setDraft((p) => (p ? { ...p, [key]: value } : p));
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !draft) return;
    const selected = Array.from(files);
    if (draft.photos.length + selected.length > 20) {
      setError("Keep up to 20 photos per project.");
      return;
    }
    for (const file of selected) {
      if (
        file.size > 25 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ) {
        setError(`${file.name}: choose a JPEG, PNG or WebP image up to 25 MB.`);
        return;
      }
    }
    setUploading(true);
    onBusy(true);
    setError("");
    try {
      for (let n = 0; n < selected.length; n++) {
        const file = selected[n];
        setProgress(`Uploading photo ${n + 1} of ${selected.length}…`);
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const response = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data,
            originalName: file.name,
            section: "galleryProjects",
          }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "Photo upload failed.");
        await checkImage(result.url);
        setDraft((p) =>
          p
            ? {
                ...p,
                photos: [
                  ...p.photos,
                  { id: id(), image: result.url, caption: "" },
                ],
              }
            : p,
        );
      }
      setProgress("Photos uploaded. Save the project to publish them.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }
  async function apply(publish: boolean) {
    if (!draft || locked) return;
    if (!draft.title.trim()) {
      setError("Enter a project name.");
      return;
    }
    if (!draft.photos.length) {
      setError("Upload at least one photo for this project.");
      return;
    }
    const project = {
      ...draft,
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
    };
    const existing = content.galleryProjects.some((p) => p.id === project.id);
    const next = {
      ...content,
      galleryProjects: existing
        ? content.galleryProjects.map((p) =>
            p.id === project.id ? project : p,
          )
        : [...content.galleryProjects, project],
    };
    setError("");
    if (publish) {
      setSaving(true);
      try {
        if (await onPublish(next)) setDraft(null);
      } finally {
        setSaving(false);
      }
    } else {
      onChange(next);
      setDraft(null);
    }
  }
  const projects = content.galleryProjects
    .map((project, index) => ({ project, index }))
    .sort(
      (a, b) =>
        Date.parse(b.project.updatedAt) - Date.parse(a.project.updatedAt) ||
        b.index - a.index,
    )
    .map((x) => x.project)
    .filter((p) =>
      `${p.title} ${p.location}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
    );
  return (
    <section className="adm-panel adm-project-manager">
      <div className="adm-panel-toolbar">
        <div>
          <h2>Project photo gallery</h2>
          <small>
            {content.galleryProjects.length} projects · Latest updated projects
            appear first
          </small>
        </div>
        <button
          className="adm-primary"
          disabled={locked || content.galleryProjects.length >= 100}
          onClick={() => open()}
        >
          <Plus size={17} />
          Add project
        </button>
      </div>
      <div className="adm-project-tools">
        <Field label="Search projects">
          <input
            placeholder="Search project name or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <p className="adm-muted">
          Upload up to 20 photos per project, 25 MB per photo. Project name and
          at least one photo are required; other details are optional.
        </p>
      </div>
      <div className="adm-gallery">
        {projects.map((project) => (
          <article key={project.id}>
            <div className="adm-gallery-image">
              <ImagePreview src={project.photos[0].image} alt={project.title} />
              <span>
                {project.photos.length}{" "}
                {project.photos.length === 1 ? "photo" : "photos"}
              </span>
            </div>
            <div className="adm-gallery-copy">
              <h3>{project.title}</h3>
              <AdminUpdated
                section="galleryProjects"
                id={project.id}
                fallback={project.updatedAt}
              />
              <p>{project.location || "Project album"}</p>
              <div className="adm-row-actions">
                <button
                  disabled={locked}
                  onClick={() => open(project)}
                  aria-label={"Manage photos for " + project.title}
                >
                  <Pencil size={14} />
                  Manage photos
                </button>
                <button
                  disabled={locked}
                  aria-label={"Remove project " + project.title}
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this project from the gallery? Save changes to publish the removal.",
                      )
                    )
                      onChange({
                        ...content,
                        galleryProjects: content.galleryProjects.filter(
                          (p) => p.id !== project.id,
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
      {!projects.length && (
        <div className="adm-empty">
          <Camera size={32} />
          <h3>
            {search
              ? "No matching projects"
              : "Your project stories start here"}
          </h3>
          <p>
            Add a project and upload completed-work photos. Customers can open
            each project album from the Gallery tab.
          </p>
        </div>
      )}
      <dialog
        className="adm-dialog adm-project-dialog"
        ref={dialog}
        onCancel={(e) => {
          if (locked) e.preventDefault();
          else setDraft(null);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void apply(true);
          }}
        >
          <div className="adm-dialog-heading">
            <div>
              <span className="adm-eyebrow">PROJECT ALBUM</span>
              <h2>
                {content.galleryProjects.some((p) => p.id === draft?.id)
                  ? "Edit project"
                  : "Add project"}
              </h2>
            </div>
            <button
              type="button"
              className="adm-close"
              disabled={locked}
              aria-label="Close project editor"
              onClick={() => setDraft(null)}
            >
              <X />
            </button>
          </div>
          {draft && (
            <div className="adm-dialog-body">
              <fieldset disabled={locked} className="adm-project-fields">
                <Field label="Project name">
                  <input
                    required
                    maxLength={150}
                    value={draft.title}
                    onChange={(e) => patch("title", e.target.value)}
                  />
                </Field>
                <Field label="Location (optional)">
                  <input
                    maxLength={200}
                    value={draft.location}
                    onChange={(e) => patch("location", e.target.value)}
                  />
                </Field>
                <Field label="Project description (optional)">
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={draft.description}
                    onChange={(e) => patch("description", e.target.value)}
                  />
                </Field>
                <div className="adm-project-upload-heading">
                  <h3>Project photos · {draft.photos.length}/20</h3>
                  <label className="adm-upload">
                    <Upload size={16} />
                    {uploading ? "Uploading…" : "Upload photos"}
                    <input
                      type="file"
                      aria-label="Upload project photos"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={locked || draft.photos.length >= 20}
                      onChange={(e) => {
                        void upload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="adm-project-photos">
                  {draft.photos.map((photo, index) => (
                    <article className="adm-project-photo" key={photo.id}>
                      <div className="adm-project-photo-image">
                        <ImagePreview
                          src={photo.image}
                          alt={photo.caption || draft.title || "Project photo"}
                        />
                        {index === 0 && <span>Cover photo</span>}
                      </div>
                      <AdminUpdated
                        section="galleryPhotos"
                        id={draft.id + "/" + photo.id}
                      />
                      <Field label={`Photo ${index + 1} caption (optional)`}>
                        <input
                          maxLength={300}
                          value={photo.caption}
                          onChange={(e) =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    photos: p.photos.map((x) =>
                                      x.id === photo.id
                                        ? { ...x, caption: e.target.value }
                                        : x,
                                    ),
                                  }
                                : p,
                            )
                          }
                        />
                      </Field>
                      <div className="adm-row-actions">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    photos: [
                                      photo,
                                      ...p.photos.filter(
                                        (x) => x.id !== photo.id,
                                      ),
                                    ],
                                  }
                                : p,
                            )
                          }
                        >
                          Use as cover
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            setDraft((p) => {
                              if (!p) return p;
                              const photos = [...p.photos];
                              [photos[index - 1], photos[index]] = [
                                photos[index],
                                photos[index - 1],
                              ];
                              return { ...p, photos };
                            })
                          }
                        >
                          Move earlier
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove photo ${index + 1}`}
                          onClick={() =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    photos: p.photos.filter(
                                      (x) => x.id !== photo.id,
                                    ),
                                  }
                                : p,
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!draft.photos.length && (
                  <div className="adm-image-placeholder">
                    <ImagePlus size={32} />
                    <span>
                      Select several photos to build this project album.
                    </span>
                  </div>
                )}
              </fieldset>
              {progress && (
                <p className="adm-muted" role="status">
                  {progress}
                </p>
              )}
              {(error || publishError) && (
                <p className="adm-error" role="alert">
                  {error || publishError}
                </p>
              )}
            </div>
          )}
          <div className="adm-dialog-footer">
            <button
              type="button"
              disabled={locked}
              className="adm-secondary"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={locked}
              className="adm-secondary"
              onClick={() => void apply(false)}
            >
              Apply to workspace
            </button>
            <button type="submit" disabled={locked} className="adm-primary">
              <Save size={17} />
              {uploading
                ? "Uploading photos…"
                : saving
                  ? "Publishing…"
                  : "Save project to website"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

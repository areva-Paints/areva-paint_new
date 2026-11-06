import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Images, MapPin, X } from "lucide-react";
import { useSiteContent } from "../admin/ContentContext";
import type { GalleryProject } from "../admin/content-types";
import { contentUrl } from "../site-content";

const projectDate = (project: GalleryProject) =>
  Date.parse(project.updatedAt) || Date.parse(project.createdAt) || 0;

function GalleryImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { setUnavailable(false); }, [props.src]);
  return (
    <>
      <img {...props} hidden={unavailable} onError={() => setUnavailable(true)} onLoad={() => setUnavailable(false)} />
      <span className="pg-image-fallback" hidden={!unavailable} role="img" aria-label={`${props.alt || "Project photo"} — photo unavailable`}>Photo unavailable</span>
    </>
  );
}

export function ProjectGallery() {
  const content = useSiteContent();
  const projects = useMemo(
    () => [...(content?.galleryProjects ?? [])].reverse()
      .filter((project) => project.photos.some((photo) => photo.image))
      .sort((a, b) => projectDate(b) - projectDate(a)),
    [content?.galleryProjects],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const counterId = useId();
  const selectedProject = projects.find((project) => project.id === selectedId);
  const photos = selectedProject?.photos.filter((photo) => photo.image) ?? [];
  const activeIndex = Math.min(photoIndex, Math.max(photos.length - 1, 0));
  const activePhoto = photos[activeIndex];
  const albumOpen = Boolean(selectedProject && activePhoto);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (albumOpen && !dialog.open) dialog.showModal();
    else if (!albumOpen && dialog.open) dialog.close();
  }, [albumOpen]);

  useEffect(() => {
    if (!albumOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [albumOpen]);

  const closeAlbum = () => {
    dialogRef.current?.close();
    setSelectedId(null);
  };
  const stepPhoto = (direction: number) => {
    if (photos.length < 2) return;
    setPhotoIndex((index) => (index + direction + photos.length) % photos.length);
  };

  return (
    <>
      <link rel="stylesheet" href={contentUrl("/assets/project-gallery.css")} />
      <section id="gallery" className="pg-section" aria-labelledby="project-gallery-heading">
        <div className="pg-wrap">
          <div className="pg-heading">
            <span className="pg-kicker">SPACES BROUGHT TO LIFE</span>
            <h2 id="project-gallery-heading" className="pg-title">Project gallery</h2>
            <p className="pg-intro">Explore our latest painting projects. Open a project to see every detail.</p>
          </div>
          {projects.length ? (
            <div className="pg-grid">
              {projects.map((project) => {
                const projectPhotos = project.photos.filter((photo) => photo.image);
                const title = project.title.trim() || "Project";
                return (
                  <button
                    key={project.id}
                    type="button"
                    className="pg-card"
                    aria-haspopup="dialog"
                    aria-label={`View ${title}, ${projectPhotos.length} ${projectPhotos.length === 1 ? "photo" : "photos"}`}
                    onClick={() => { setPhotoIndex(0); setSelectedId(project.id); }}
                  >
                    <span className="pg-cover">
                      <GalleryImage src={projectPhotos[0].image} alt={projectPhotos[0].caption || title} loading="lazy" decoding="async" />
                      <span className="pg-photo-count"><Images aria-hidden="true" />{projectPhotos.length} {projectPhotos.length === 1 ? "photo" : "photos"}</span>
                    </span>
                    <span className="pg-card-body">
                      <span className="pg-card-title">{title}</span>
                      {project.location && <span className="pg-location"><MapPin aria-hidden="true" />{project.location}</span>}
                      <span className="pg-view">View project <ArrowUpRight aria-hidden="true" /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="pg-empty">
              <Images aria-hidden="true" />
              <h3>New projects are on the way</h3>
              <p>Visit again soon for a closer look at our latest work.</p>
            </div>
          )}
        </div>
      </section>
      <dialog
        ref={dialogRef}
        className="pg-dialog"
        aria-labelledby={titleId}
        aria-describedby={counterId}
        onClose={() => setSelectedId(null)}
        onCancel={(event) => { event.preventDefault(); closeAlbum(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeAlbum(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            stepPhoto(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        {selectedProject && activePhoto && (
          <div className="pg-album">
            <div className="pg-album-heading">
              <div>
                <span className="pg-kicker">PROJECT ALBUM</span>
                <h2 id={titleId} className="pg-album-title">{selectedProject.title.trim() || "Project"}</h2>
                {selectedProject.location && <p className="pg-album-location"><MapPin aria-hidden="true" />{selectedProject.location}</p>}
              </div>
              <button className="pg-close" type="button" aria-label="Close project album" onClick={closeAlbum}><X aria-hidden="true" /></button>
            </div>
            <div className="pg-stage">
              <button className="pg-step pg-prev" type="button" aria-label="Previous photo" hidden={photos.length < 2} onClick={() => stepPhoto(-1)}><ChevronLeft aria-hidden="true" /></button>
              <figure className="pg-photo-frame">
                <GalleryImage className="pg-photo" src={activePhoto.image} alt={activePhoto.caption || `${selectedProject.title || "Project"}, photo ${activeIndex + 1}`} decoding="async" />
                {activePhoto.caption && <figcaption className="pg-caption">{activePhoto.caption}</figcaption>}
              </figure>
              <button className="pg-step pg-next" type="button" aria-label="Next photo" hidden={photos.length < 2} onClick={() => stepPhoto(1)}><ChevronRight aria-hidden="true" /></button>
            </div>
            <div className="pg-album-footer">
              <p id={counterId} className="pg-counter" aria-live="polite" aria-atomic="true">Photo {activeIndex + 1} of {photos.length}</p>
              {selectedProject.description && <p className="pg-description">{selectedProject.description}</p>}
            </div>
            <div className="pg-thumbnails" role="group" aria-label="Project photos">
              {photos.map((photo, index) => (
                <button key={photo.id} className="pg-thumbnail" type="button" aria-label={`Show photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`} aria-pressed={index === activeIndex} onClick={() => setPhotoIndex(index)}>
                  <img src={photo.image} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

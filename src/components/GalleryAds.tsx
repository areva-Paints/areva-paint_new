import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Image as ImageIcon, X } from "lucide-react";
import type { GalleryAd } from "../admin/content-types";

const adDate = (ad: GalleryAd) =>
  Date.parse(ad.updatedAt) || Date.parse(ad.createdAt) || 0;
const channelName = (channel: GalleryAd["channel"]) =>
  channel === "social" ? "Social media" : "Digital";
const externalLink = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

function AdImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setUnavailable(false);
  }, [props.src]);
  return (
    <>
      <img
        {...props}
        hidden={unavailable}
        onError={() => setUnavailable(true)}
        onLoad={() => setUnavailable(false)}
      />
      <span
        className="pg-image-fallback"
        hidden={!unavailable}
        role="img"
        aria-label="Ad image unavailable"
      >
        Image unavailable
      </span>
    </>
  );
}

export function GalleryAds({ ads = [] }: { ads?: GalleryAd[] }) {
  const [channel, setChannel] = useState<"all" | GalleryAd["channel"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const orderedAds = useMemo(
    () =>
      [...ads]
        .reverse()
        .filter((ad) => ad.image || externalLink(ad.link))
        .sort((a, b) => adDate(b) - adDate(a)),
    [ads],
  );
  const visibleAds = orderedAds.filter(
    (ad) => channel === "all" || ad.channel === channel,
  );
  const selected = orderedAds.find((ad) => ad.id === selectedId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    else if (!selected && dialog.open) dialog.close();
  }, [Boolean(selected)]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [Boolean(selected)]);

  const close = () => {
    dialogRef.current?.close();
    setSelectedId(null);
  };

  return (
    <>
      <p className="ga-intro">
        Discover our latest digital and social media ads.
      </p>
      <div className="ga-filters" role="group" aria-label="Filter ads">
        {(
          [
            ["all", "All"],
            ["digital", "Digital"],
            ["social", "Social media"],
          ] as const
        ).map(([value, label]) => (
          <button
            className="ga-filter"
            type="button"
            key={value}
            aria-pressed={channel === value}
            onClick={() => setChannel(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="ga-count" role="status">
        {visibleAds.length} {visibleAds.length === 1 ? "ad" : "ads"}
      </p>
      {visibleAds.length ? (
        <div className="ga-grid">
          {visibleAds.map((ad) => {
            const link = externalLink(ad.link);
            const body = (
              <>
                <span className="ga-cover">
                  {ad.image ? (
                    <AdImage
                      src={ad.image}
                      alt={ad.title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="ga-link-placeholder">
                      <ArrowUpRight aria-hidden="true" />
                      <span>Open ad</span>
                    </span>
                  )}
                </span>
                <span className="ga-card-body">
                  <span className="ga-channel">{channelName(ad.channel)}</span>
                  <span className="ga-card-title">{ad.title}</span>
                  {ad.description && (
                    <span className="ga-description">{ad.description}</span>
                  )}
                  <span className="ga-view">
                    {ad.image ? "View ad" : "Open ad"}
                    <ArrowUpRight aria-hidden="true" />
                  </span>
                </span>
              </>
            );
            return (
              <article className="ga-card" key={ad.id}>
                {ad.image ? (
                  <button
                    className="ga-card-action"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`View ${ad.title} ad`}
                    onClick={() => setSelectedId(ad.id)}
                  >
                    {body}
                  </button>
                ) : link ? (
                  <a
                    className="ga-card-action"
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${ad.title} ad`}
                  >
                    {body}
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="pg-empty">
          <ImageIcon aria-hidden="true" />
          <h3>{ads.length ? "No ads in this category" : "No ads yet"}</h3>
          <p>
            {ads.length
              ? "Try another category to see more ads."
              : "Our latest digital and social media ads will appear here."}
          </p>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="pg-dialog ga-preview"
        aria-labelledby={titleId}
        onClose={() => setSelectedId(null)}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {selected && (
          <div className="pg-album">
            <div className="pg-album-heading">
              <div>
                <span className="pg-kicker">
                  {channelName(selected.channel).toUpperCase()} AD
                </span>
                <h2 id={titleId} className="pg-album-title">
                  {selected.title}
                </h2>
              </div>
              <button
                className="pg-close"
                type="button"
                aria-label="Close ad preview"
                onClick={close}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="ga-preview-frame">
              <AdImage
                className="ga-preview-image"
                src={selected.image}
                alt={selected.title}
                decoding="async"
              />
            </div>
            {(selected.description || externalLink(selected.link)) && (
              <div className="ga-preview-body">
                {selected.description && (
                  <p className="ga-description">{selected.description}</p>
                )}
                {externalLink(selected.link) && (
                  <a
                    className="ga-link"
                    href={externalLink(selected.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open ad <ArrowUpRight aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

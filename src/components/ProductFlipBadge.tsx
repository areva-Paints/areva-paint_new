import React, { useState } from 'react';

interface ProductFlipBadgeProps {
  name: string;
  image: string;
  sheen: string;
  onOpen: () => void;
}

/** Switch faces only after an explicit click or native keyboard activation. */
export function ProductFlipBadge({ name, image, sheen, onOpen }: ProductFlipBadgeProps) {
  const [photoReady, setPhotoReady] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoRequested, setPhotoRequested] = useState(false);
  const productName = name.replace(/^Areva\s+/i, '');
  const unavailable = !image || photoFailed;
  const showPhoto = photoRequested && photoReady && !unavailable;
  const actionLabel = unavailable
    ? `Photo unavailable. View ${name} specifications`
    : photoRequested
      ? photoReady ? `Show ${name} name` : `Loading ${name} photo. Activate to keep the name face`
      : `Show ${name} product photo`;

  return (
    <button
      className={`pc-name-badge pc-flip-badge${showPhoto ? ' is-photo' : ''}`}
      type="button"
      onClick={() => unavailable ? onOpen() : setPhotoRequested((previous) => !previous)}
      aria-label={actionLabel}
      aria-pressed={photoRequested && !unavailable}
      aria-busy={photoRequested && !photoReady && !unavailable}
      title={unavailable ? 'Photo unavailable — view product specifications' : showPhoto ? 'Click to show product name' : 'Click to show product photo'}
    >
      <span className="pc-flip-inner" aria-hidden="true">
        <span className="pc-flip-face pc-flip-front">
          <span className="pc-badge-brand">AREVA<span>PAINTS</span></span>
          <span className="pc-badge-line" />
          <span className="pc-badge-name">{productName}</span>
          {sheen && <span className="pc-badge-finish">{sheen}</span>}
        </span>
        <span className="pc-flip-face pc-flip-photo">
          {image && !photoFailed && (
            <img
              src={image}
              alt=""
              decoding="async"
              onLoad={(event) => {
                if (event.currentTarget.naturalWidth > 0) setPhotoReady(true);
                else setPhotoFailed(true);
              }}
              onError={() => { setPhotoReady(false); setPhotoFailed(true); setPhotoRequested(false); }}
            />
          )}
        </span>
      </span>
    </button>
  );
}

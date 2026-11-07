import React, { useEffect, useState } from 'react';

interface ProductFlipBadgeProps {
  name: string;
  image: string;
  sheen: string;
  onOpen: () => void;
}

/** The accessible button name stays constant while its decorative faces turn. */
export function ProductFlipBadge({ name, image, sheen, onOpen }: ProductFlipBadgeProps) {
  const [photoReady, setPhotoReady] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const productName = name.replace(/^Areva\s+/i, '');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    setShowPhoto(false);
    if (!photoReady || photoFailed || reducedMotion || !pageVisible) return;
    const interval = window.setInterval(() => setShowPhoto((previous) => !previous), 1000);
    return () => window.clearInterval(interval);
  }, [photoReady, photoFailed, reducedMotion, pageVisible]);

  return (
    <button
      className={`pc-name-badge pc-flip-badge${showPhoto ? ' is-photo' : ''}`}
      type="button"
      onClick={onOpen}
      aria-label={`View ${name} photo and specifications`}
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
              onError={() => { setPhotoReady(false); setPhotoFailed(true); setShowPhoto(false); }}
            />
          )}
        </span>
      </span>
    </button>
  );
}

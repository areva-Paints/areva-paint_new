/*
 * Render an accessible preview without delaying admin editing while remote image dimensions are checked.
 * Broken images retain a usable fallback.
 */
import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
/* Render an accessible preview without delaying admin editing while remote image dimensions are checked. */
export function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div
      className="adm-image-error"
      role="img"
      aria-label={alt + " unavailable"}
    >
      <ImageOff size={24} />
      <strong>Image unavailable</strong>
      <small>Edit this entry and upload the image again.</small>
    </div>
  ) : (
    <img src={src} alt={alt} onError={() => setFailed(true)} />
  );
}
/* Check a supported image URL before accepting it, with a timeout for failed remote loads. */
export function checkImage(src: string): Promise<void> {
  if (!/^\/(?!\/)[^\s<>"']*$/.test(src) && !/^https:\/\/[^\s<>"']+$/.test(src))
    return Promise.reject(
      Error(
        "Upload an image or enter a valid HTTPS image URL. A filename or “NA” is not an image URL.",
      ),
    );
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(
      () =>
        finish(
          Error(
            "The image could not be loaded. Upload it again or check the image URL.",
          ),
        ),
      12000,
    );
    /* Release handlers/timer before settling the image-check promise exactly once. */
    function finish(error?: Error) {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve();
    }
    image.onload = () =>
      image.naturalWidth > 0
        ? finish()
        : finish(Error("The image is empty. Please upload another image."));
    image.onerror = () =>
      finish(
        Error(
          "The image could not be loaded. Upload it again or check the image URL.",
        ),
      );
    image.src = src;
  });
}

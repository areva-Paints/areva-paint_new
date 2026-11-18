/*
 * Present CMS-managed customer reviews with optional portrait fallbacks and consistent Gallery card styling.
 */
import React, { useEffect, useState } from "react";
import type { GalleryReview } from "../admin/content-types";

/* Use a portrait when available and a readable initials fallback otherwise. */
function ReviewImage({ review }: { review: GalleryReview }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [review.image]);
  return (
    <a
      className="gr-cover"
      href={review.image}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View image for review by ${review.name}`}
    >
      <img
        src={review.image}
        alt={`Review image from ${review.name}`}
        loading="lazy"
        decoding="async"
        hidden={failed}
        onError={() => setFailed(true)}
      />
      <span
        className="pg-image-fallback"
        hidden={!failed}
        role="img"
        aria-label="Review image unavailable"
      >
        Image unavailable
      </span>
    </a>
  );
}
/* Present CMS-managed customer reviews with optional portrait fallbacks and consistent Gallery card styling.. */
export function GalleryReviews({ reviews }: { reviews: GalleryReview[] }) {
  const sorted = reviews
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
    .map((item) => item.review);
  return (
    <div className="gr-reviews">
      <p className="gr-intro">
        Read experiences shared by our customers and painting professionals.
      </p>
      {sorted.length ? (
        <div className="gr-grid">
          {sorted.map((review) => (
            <article className="gr-card" key={review.id}>
              {review.image && <ReviewImage review={review} />}
              <div className="gr-copy">
                <blockquote>{review.text}</blockquote>
                <div className="gr-author">
                  <h3>{review.name}</h3>
                  {review.detail && <p>{review.detail}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pg-empty">
          <h3>No reviews yet</h3>
          <p>Customer experiences will appear here when they are shared.</p>
        </div>
      )}
    </div>
  );
}

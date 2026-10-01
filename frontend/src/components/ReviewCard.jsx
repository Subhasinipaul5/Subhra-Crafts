// `onImageClick(localIndex)` reports which of THIS review's own images (0-based, in the order
// they appear on the review) was clicked - the caller (ProductDetails / ProductReviews) knows
// this review's starting offset into the flattened cross-review gallery (see
// utils/reviewGallery.js) and turns that into the actual lightbox index to open.
import placeholder from "../assets/placeholder.svg";

export default function ReviewCard({ review, onImageClick, showDate = false }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <span className="font-medium text-plum-dark dark:text-cream text-sm">{review.user?.name || "Customer"}</span>
        <span className="text-gold text-xs">
          {"★".repeat(review.rating)}
          {"☆".repeat(5 - review.rating)}
        </span>
      </div>
      {showDate && review.createdAt && (
        <div className="text-[11px] text-plum-light/50 dark:text-cream/50 mt-0.5">
          {new Date(review.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </div>
      )}
      {review.comment && <p className="text-sm text-plum-light/80 dark:text-cream/80 mt-2">{review.comment}</p>}
      {review.images?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {review.images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onImageClick?.(i)}
              className="w-16 h-16 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-rose"
              aria-label={`View review image ${i + 1}`}
            >
              <img
                src={url}
                alt="Customer review"
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

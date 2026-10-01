// Shared by the product page (top-3 reviews) and the dedicated "All Reviews" page (every
// review) - same flattening rule, just given a different input list, so the swipe/index math
// only has to be written once and is guaranteed to behave identically in both places.
//
// `flat` is the ordered list the lightbox actually swipes through: [{ url, review }, ...],
// review1-image1, review1-image2, review2-image1, review3-image1, ... - continuous across every
// customer whose review is currently displayed, not just within one review's own images.
//
// `offsets` maps a reviewId -> that review's FIRST image's position in `flat`. A review card
// only knows "this is my own image #i"; to open the lightbox at the right spot in the combined
// gallery (not just within that one review), the caller does `offsets[review._id] + i`.
export function buildReviewGallery(reviews) {
  const flat = [];
  const offsets = {};
  for (const r of reviews || []) {
    if (!r.images || r.images.length === 0) continue;
    offsets[r._id] = flat.length;
    for (const url of r.images) {
      flat.push({ url, review: r });
    }
  }
  return { flat, offsets };
}

// "Top 3 highest-rated" per the spec - ties broken by most recent, so the ordering is stable
// and predictable rather than depending on whatever order the API happened to return.
export function topRatedReviews(reviews, count = 3) {
  return [...(reviews || [])]
    .sort((a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, count);
}

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import BackButton from "../components/BackButton";
import Breadcrumb from "../components/Breadcrumb";
import ReviewCard from "../components/ReviewCard";
import ReviewGalleryLightbox from "../components/ReviewGalleryLightbox";
import { buildReviewGallery } from "../utils/reviewGallery";

// Reachable directly (e.g. a bookmarked/shared link), not only via the product page's
// "Show all →" link, so it fetches its own copy of the product (for the title/breadcrumb) and
// every one of that product's approved reviews, same endpoints ProductDetails.jsx already uses.
export default function ProductReviews() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${slug}`).then((res) => {
      setProduct(res.data.product);
      api.get(`/reviews/product/${res.data.product._id}`).then((r) => {
        setReviews(r.data);
        setLoading(false);
      });
    });
  }, [slug]);

  // Every review's images, in order - this (not just the currently-clicked review's own images)
  // is what the lightbox swipes through, so navigating through the gallery moves continuously
  // across every customer's photos.
  const gallery = useMemo(() => buildReviewGallery(reviews), [reviews]);

  if (loading) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading...</div>;
  if (!product) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Product not found.</div>;

  const sorted = [...reviews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="relative max-w-3xl mx-auto px-6 py-14">
      <BackButton fallback={`/product/${slug}`} />
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: product.name, to: `/product/${slug}` },
          { label: "Reviews" },
        ]}
      />

      <h1 className="section-title text-2xl sm:text-3xl mb-1">Customer Reviews</h1>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-8">
        {reviews.length} review{reviews.length === 1 ? "" : "s"} for{" "}
        <Link to={`/product/${slug}`} className="text-rose hover:underline">
          {product.name}
        </Link>
      </p>

      {reviews.length === 0 ? (
        <p className="text-plum-light/60 dark:text-cream/60 text-sm">No reviews yet — be the first to review this piece.</p>
      ) : (
        <div className="space-y-5">
          {sorted.map((r) => (
            <ReviewCard key={r._id} review={r} showDate onImageClick={(i) => setLightboxIndex((gallery.offsets[r._id] ?? 0) + i)} />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ReviewGalleryLightbox images={gallery.flat} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}

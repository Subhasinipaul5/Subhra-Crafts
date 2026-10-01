import { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/client";
import placeholder from "../assets/placeholder.svg";

export default function WriteReviewForm({ orderId, item, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.slice(0, 4).forEach((f) => formData.append("images", f));
      const res = await api.post("/upload/personal", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setImages((prev) => [...prev, ...res.data.images.map((i) => i.url)].slice(0, 4));
    } catch (err) {
      toast.error("Could not upload image(s)");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/reviews", { product: item.product, order: orderId, rating, comment, images });
      setDone(true);
      toast.success("Review submitted! It will appear once approved by the admin.");
      onSubmitted?.();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return <p className="text-sm text-plum-light dark:text-cream/90/70 dark:text-cream/60">Thank you! Your review for {item.name} is pending admin approval.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="border border-blush dark:border-plum-light/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <img src={item.image || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
        <span className="text-sm text-plum-dark dark:text-cream/90">{item.name}</span>
      </div>
      <div className="flex gap-1 text-xl text-gold">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)}>
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Share your experience with this piece..."
        className="w-full border border-blush rounded-lg px-3 py-2 text-sm bg-white/70"
      />
      <div>
        <input type="file" accept="image/*" multiple onChange={handleFiles} className="text-xs" />
        {uploading && <span className="text-xs text-plum-light/60 dark:text-cream/60 ml-2">Uploading...</span>}
        <div className="flex gap-2 mt-2">
          {images.map((url, i) => (
            <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover" />
          ))}
        </div>
      </div>
      <button disabled={submitting} className="btn-primary text-xs px-4 py-2 disabled:opacity-60">
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}

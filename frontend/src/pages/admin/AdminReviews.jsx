import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { useNotifications } from "../../context/NotificationContext";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { refresh: refreshNotifications } = useNotifications();

  const load = () => api.get("/reviews").then((res) => setReviews(res.data));

  useEffect(() => {
    load();
    api.put("/reviews/admin/mark-seen").then((res) => {
      if (res.data.markedCount > 0) {
        toast.success("Reviews marked as seen");
        refreshNotifications();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moderate = async (id, approved) => {
    await api.put(`/reviews/${id}/moderate`, { approved });
    toast.success(approved ? "Review approved — now visible to all customers" : "Review rejected");
    load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this review permanently?")) return;
    await api.delete(`/reviews/${id}`);
    toast.success("Review deleted");
    load();
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      await api.delete("/reviews/admin/delete-all");
      toast.success("All reviews have been deleted successfully.");
      setResetConfirmOpen(false);
      await load();
      refreshNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete reviews");
    } finally {
      setResetting(false);
    }
  };

  const filtered = reviews.filter((r) => {
    if (filter === "pending") return !r.approved;
    if (filter === "approved") return r.approved;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum">Reviews</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {["pending", "approved", "all"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter === f ? "bg-plum text-cream" : "border border-blush text-plum-dark"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setResetConfirmOpen(true)} className="text-sm border border-plum text-plum px-4 py-1.5 rounded-full">
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && <p className="text-plum-light/60 dark:text-cream/60 text-sm">No reviews in this filter.</p>}
        {filtered.map((r) => (
          <div key={r._id} className="bg-white rounded-xl2 shadow-card border border-blush p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-plum-dark">{r.product?.name}</div>
                <div className="text-xs text-plum-light/70 dark:text-cream/70">{r.user?.name} ({r.user?.email}) • {new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <span className="text-gold text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
            </div>
            {r.comment && <p className="text-sm text-plum-dark mt-2">{r.comment}</p>}
            {r.images?.length > 0 && (
              <div className="flex gap-2 mt-3">
                {r.images.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              {!r.approved && (
                <button onClick={() => moderate(r._id, true)} className="text-xs bg-plum text-cream px-3 py-1.5 rounded-full">Approve</button>
              )}
              {r.approved && (
                <button onClick={() => moderate(r._id, false)} className="text-xs border border-plum text-plum dark:text-cream px-3 py-1.5 rounded-full">Unapprove</button>
              )}
              <button onClick={() => remove(r._id)} className="text-xs text-rose px-3 py-1.5 rounded-full border border-rose/40">Delete</button>
            </div>
          </div>
        ))}
      </div>

      {resetConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetConfirmOpen(false)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete all reviews?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              This will permanently remove every review and reset all product ratings to zero. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirmOpen(false)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmReset} disabled={resetting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {resetting ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

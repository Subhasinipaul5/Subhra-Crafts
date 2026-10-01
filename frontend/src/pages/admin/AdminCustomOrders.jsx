import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { useNotifications } from "../../context/NotificationContext";
import NumberInput from "../../components/NumberInput";

const STATUS_OPTIONS = ["requested", "under_discussion", "price_proposed", "accepted", "rejected", "in_production", "shipped", "delivered"];

export default function AdminCustomOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lightbox, setLightbox] = useState(null); // image url
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({ status: "", proposedPrice: "", shippingCharge: "", estimatedDelivery: "", adminNotes: "" });
  const { refresh: refreshNotifications } = useNotifications();

  const load = () => api.get("/custom-orders").then((res) => setOrders(res.data));

  useEffect(() => {
    load();
    // Opening this page marks new custom orders as seen - Reset never does this, it only
    // deletes. Only toast if there was actually something new.
    api.put("/custom-orders/admin/mark-seen").then((res) => {
      if (res.data.markedCount > 0) {
        toast.success("Custom orders marked as seen");
        refreshNotifications();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openOrder = (o) => {
    setSelected(o);
    setForm({
      status: o.status, proposedPrice: o.proposedPrice || "", shippingCharge: o.shippingCharge || "",
      estimatedDelivery: o.estimatedDelivery ? o.estimatedDelivery.slice(0, 10) : "", adminNotes: o.adminNotes || "",
    });
  };

  const saveUpdate = async () => {
    const payload = {
      ...form,
      proposedPrice: form.proposedPrice === "" ? null : Number(form.proposedPrice),
      shippingCharge: form.shippingCharge === "" ? 0 : Number(form.shippingCharge),
      estimatedDelivery: form.estimatedDelivery || null,
    };
    await api.put(`/custom-orders/${selected._id}`, payload);
    toast.success("Custom order updated");
    setSelected(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/custom-orders/${deleteTarget._id}`);
      toast.success("Custom order deleted");
      setDeleteTarget(null);
      await load();
      refreshNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete custom order");
    } finally {
      setDeleting(false);
    }
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      await api.delete("/custom-orders/admin/delete-all");
      toast.success("All custom orders have been deleted successfully.");
      setResetConfirmOpen(false);
      await load();
      refreshNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete custom orders");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum">Custom Orders</h1>
        <button onClick={() => setResetConfirmOpen(true)} className="text-sm border border-plum text-plum px-4 py-1.5 rounded-full">
          Reset
        </button>
      </div>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o._id} className="bg-white rounded-xl2 shadow-card border border-blush p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {o.referenceImages?.[0] && (
                <img src={o.referenceImages[0]} alt="Reference" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-plum-dark truncate">#{o.customOrderNumber} — {o.productType}</div>
                <div className="text-xs text-plum-light/70 truncate">{o.name} • {o.phone} • {o.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs px-3 py-1 rounded-full bg-blush/50 text-plum capitalize">{o.status.replace("_", " ")}</span>
              <button onClick={() => openOrder(o)} className="text-plum underline text-sm">Manage</button>
              <button onClick={() => setDeleteTarget(o)} className="text-rose underline text-sm">Delete</button>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-plum-light/60 text-sm">No custom order requests yet.</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-plum dark:text-cream">#{selected.customOrderNumber}</h3>
            <div className="text-sm text-plum-dark space-y-1">
              <div><b>Customer:</b> {selected.name}</div>
              <div><b>Email:</b> {selected.email}</div>
              <div><b>Phone:</b> {selected.phone}</div>
              <div><b>Product Type:</b> {selected.productType}</div>
              <div><b>Color:</b> {selected.preferredColor || "-"}</div>
              <div><b>Design:</b> {selected.preferredDesign || "-"}</div>
              <div><b>Size:</b> {selected.size || "-"} • <b>Qty:</b> {selected.quantity}</div>
              <div><b>Budget:</b> {selected.budget || "-"}</div>
              <div><b>Requirements:</b> {selected.additionalRequirements || "-"}</div>
              <div><b>Message:</b> {selected.message || "-"}</div>
              <div><b>Date:</b> {new Date(selected.createdAt).toLocaleDateString()}</div>
            </div>

            {selected.referenceImages?.length > 0 && (
              <div>
                <div className="text-sm font-medium text-plum-dark mb-2">Reference Image</div>
                <div className="flex gap-2 flex-wrap">
                  {selected.referenceImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt="Reference"
                        className="w-24 h-24 rounded-lg object-cover border border-blush cursor-pointer"
                        onClick={() => setLightbox(url)}
                      />
                      <div className="flex gap-2 mt-1 text-[10px]">
                        <button onClick={() => setLightbox(url)} className="text-plum dark:text-cream underline">View Image</button>
                        <a href={url} target="_blank" rel="noreferrer" className="text-rose underline">Open in New Tab</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-plum-light/70 dark:text-cream/70">Proposed Price (₹)</label>
                <NumberInput placeholder="e.g. 450" value={form.proposedPrice} onChange={(e) => setForm({ ...form, proposedPrice: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-plum-light/70 dark:text-cream/70">Shipping Charge (₹)</label>
                <NumberInput placeholder="e.g. 60" value={form.shippingCharge} onChange={(e) => setForm({ ...form, shippingCharge: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm mt-1" />
              </div>
            </div>
            {(form.proposedPrice || form.shippingCharge) && (
              <div className="text-sm text-plum-dark bg-blush/30 rounded-lg px-3 py-2">
                Total for customer: ₹{(Number(form.proposedPrice) || 0) + (Number(form.shippingCharge) || 0)}
              </div>
            )}
            <div>
              <label className="text-xs text-plum-light/70 dark:text-cream/70">Expected Completion / Delivery Date</label>
              <input type="date" value={form.estimatedDelivery} onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <textarea placeholder="Admin Notes" value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} rows={2} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
            <a href={`https://wa.me/${selected.phone}`} target="_blank" rel="noreferrer" className="text-xs text-rose underline">Contact customer on WhatsApp</a>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelected(null)} className="btn-outline text-sm w-full">Close</button>
              <button onClick={saveUpdate} className="btn-primary text-sm w-full">Save</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Reference full size" className="max-w-full max-h-full rounded-lg" />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-2xl">✕</button>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete this custom order?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              #{deleteTarget.customOrderNumber} will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetConfirmOpen(false)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete all custom orders?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              This will permanently remove every custom order request from the database. This action cannot be undone.
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

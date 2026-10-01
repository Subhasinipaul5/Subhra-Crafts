import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { useNotifications } from "../../context/NotificationContext";

const STATUS_OPTIONS = ["pending", "confirmed", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({ orderStatus: "", courier: "", trackingNumber: "", expectedDelivery: "", paymentStatus: "" });
  const { refresh: refreshNotifications } = useNotifications();

  const load = () => api.get("/orders").then((res) => setOrders(res.data));

  useEffect(() => {
    load();
    // Opening this page is what marks new orders as seen - the Reset button never does this,
    // it only deletes. Only show a toast if there was actually something new to mark.
    api.put("/orders/admin/mark-seen").then((res) => {
      if (res.data.markedCount > 0) {
        toast.success("Orders marked as seen");
        refreshNotifications();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openOrder = (o) => {
    setSelected(o);
    setForm({
      orderStatus: o.orderStatus, courier: o.courier || "", trackingNumber: o.trackingNumber || "",
      expectedDelivery: o.expectedDelivery ? o.expectedDelivery.slice(0, 10) : "", paymentStatus: o.paymentStatus,
    });
  };

  const saveUpdate = async () => {
    await api.put(`/orders/${selected._id}/status`, form);
    toast.success("Order updated");
    setSelected(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/orders/${deleteTarget._id}`);
      toast.success("Order removed from admin order history. The customer's order history and revenue are unaffected.");
      setDeleteTarget(null);
      await load();
      refreshNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete order");
    } finally {
      setDeleting(false);
    }
  };

  // Reset = hide every order from THIS admin view only (see deleteAllOrders in
  // orderController.js) - never a real delete of the order or its Payment/revenue record, and
  // never touches any customer's own order history. This is a DIFFERENT action from the
  // automatic mark-as-seen above - it never touches the read/unread flag by itself, and
  // mark-as-seen never hides anything. The two must never be mixed.
  const confirmReset = async () => {
    setResetting(true);
    try {
      await api.delete("/orders/admin/delete-all");
      toast.success("Orders cleared from the admin order-history view. Customer order histories and revenue are unaffected.");
      setResetConfirmOpen(false);
      await load(); // refetch from MongoDB - must come back empty, not just setOrders([])
      refreshNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not clear orders");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum dark:text-cream">Orders</h1>
        <button onClick={() => setResetConfirmOpen(true)} className="text-sm border border-plum text-plum px-4 py-1.5 rounded-full">
          Clear Orders
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-plum-light/70 border-b border-blush">
              <th className="p-3">Order ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} className="border-b border-blush/50">
                <td className="p-3">#{o.orderNumber}</td>
                <td>{o.user?.name}</td>
                <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td>₹{o.totalAmount}</td>
                <td className="capitalize">{o.paymentStatus}</td>
                <td className="capitalize">{o.orderStatus.replace("_", " ")}</td>
                <td><button onClick={() => openOrder(o)} className="text-plum underline">Manage</button></td>
                <td><button onClick={() => setDeleteTarget(o)} className="text-rose underline">Delete</button></td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-plum-light/60">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {orders.map((o) => (
          <div key={o._id} className="bg-white rounded-xl2 shadow-card border border-blush p-4 text-sm">
            <div className="flex justify-between items-start mb-1">
              <span className="font-medium text-plum-dark">#{o.orderNumber}</span>
              <span className="font-display text-lg text-plum">₹{o.totalAmount}</span>
            </div>
            <div className="text-xs text-plum-light/70 space-y-0.5 mb-2">
              <div>{o.user?.name} • {new Date(o.createdAt).toLocaleDateString()}</div>
              <div className="capitalize">{o.paymentStatus} • {o.orderStatus.replace("_", " ")}</div>
            </div>
            <div className="flex gap-4 text-xs">
              <button onClick={() => openOrder(o)} className="text-plum underline">Manage</button>
              <button onClick={() => setDeleteTarget(o)} className="text-rose underline">Delete</button>
            </div>
          </div>
        ))}
        {orders.length === 0 && <p className="text-center text-plum-light/60 py-6">No orders yet.</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-lg w-full space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-plum">Order #{selected.orderNumber}</h3>
            <div className="text-xs text-plum-light/70">{selected.user?.name} • {selected.user?.email} • {selected.user?.phone}</div>
            {selected.deliveryDistanceKm != null && (
              <div className="text-xs text-plum-dark bg-blush/20 rounded-lg px-3 py-2">
                📏 {selected.deliveryDistanceKm} km away • Shipping charged: ₹{selected.shippingFee}
                {selected.preferredDeliveryDate && <> • Customer requested: {new Date(selected.preferredDeliveryDate).toLocaleDateString()}</>}
              </div>
            )}
            <div className="text-sm">
              {selected.items.map((it, i) => <div key={i}>{it.name} × {it.quantity} — ₹{it.price * it.quantity}</div>)}
            </div>
            <select value={form.orderStatus} onChange={(e) => setForm({ ...form, orderStatus: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm">
              {["pending", "paid", "failed", "refunded"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="Courier Name" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Tracking Number" value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setSelected(null)} className="btn-outline text-sm w-full">Close</button>
              <button onClick={saveUpdate} className="btn-primary text-sm w-full">Save</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete this order from your admin order history?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              Order #{deleteTarget.orderNumber} will be removed from this admin view only. The customer will still see it in their own order
              history, and it will still count toward business revenue.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {deleting ? "Removing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetConfirmOpen(false)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Clear all orders from the admin order-history view?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              Customer order histories and business revenue will NOT be affected — this only clears what shows up here in the admin panel.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setResetConfirmOpen(false)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmReset} disabled={resetting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {resetting ? "Clearing..." : "Clear All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

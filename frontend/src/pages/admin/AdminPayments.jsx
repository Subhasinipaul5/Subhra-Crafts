import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // the payment object, or null
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    api.get("/payments").then((res) => setPayments(res.data));
    api.get("/payments/revenue").then((res) => setRevenue(res.data));
  };

  useEffect(() => { load(); }, []);

  const doDelete = async (alsoDeleteOrder) => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/payments/${confirmTarget._id}${alsoDeleteOrder ? "?alsoDeleteOrder=true" : ""}`);
      toast.success(
        alsoDeleteOrder
          ? "Payment and order removed from admin view. Revenue and the customer's own history are unaffected."
          : "Transaction removed from admin view. Revenue is unaffected."
      );
      setConfirmTarget(null);
      load(); // refreshes the table - revenue figures deliberately do NOT change from this, see paymentController.js
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove transaction");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-2">Payments & Revenue</h1>
      {revenue && (
        <div className="mb-8">
          <div className="bg-plum text-cream rounded-xl2 p-6 mb-4 text-center">
            <div className="text-xs uppercase tracking-widest text-gold">Total Revenue</div>
            <div className="font-display text-4xl mt-1">₹{revenue.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-center">
            {[["Today", revenue.today], ["This Week", revenue.thisWeek], ["This Month", revenue.thisMonth]].map(([l, v]) => (
              <div key={l} className="bg-white rounded-xl shadow-card border border-blush p-3">
                <div className="text-plum-light/70 dark:text-cream/70 text-xs">{l}</div>
                <div className="font-display text-xl text-plum dark:text-cream">₹{v.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-plum-light/70 dark:text-cream/70 border-b border-blush">
              <th className="p-3">Transaction ID</th><th>Customer</th><th>Order</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-b border-blush/50">
                <td className="p-3 font-mono text-xs">{p._id}</td>
                <td>
                  <div>{p.user?.name}</div>
                  <div className="text-xs text-plum-light/60 dark:text-cream/60">{p.user?.email}</div>
                </td>
                <td>{p.order?.orderNumber}</td>
                <td>₹{p.amount}</td>
                <td className="capitalize">{p.paymentMethod}</td>
                <td className="capitalize">{p.status}</td>
                <td>{new Date(p.date).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => setConfirmTarget(p)} className="text-rose text-xs underline">Delete</button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-plum-light/60 dark:text-cream/60">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {payments.map((p) => (
          <div key={p._id} className="bg-white rounded-xl2 shadow-card border border-blush p-4 text-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium text-plum-dark">{p.user?.name}</div>
                <div className="text-xs text-plum-light/60 dark:text-cream/60">{p.user?.email}</div>
              </div>
              <span className="font-display text-lg text-plum dark:text-cream">₹{p.amount}</span>
            </div>
            <div className="text-xs text-plum-light/70 dark:text-cream/70 space-y-0.5">
              <div>Order: {p.order?.orderNumber}</div>
              <div className="capitalize">Method: {p.paymentMethod} • Status: {p.status}</div>
              <div>{new Date(p.date).toLocaleDateString()}</div>
              <div className="font-mono break-all">ID: {p._id}</div>
            </div>
            <button onClick={() => setConfirmTarget(p)} className="text-rose text-xs underline mt-2">Delete</button>
          </div>
        ))}
        {payments.length === 0 && <p className="text-center text-plum-light/60 dark:text-cream/60 py-6">No transactions yet.</p>}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmTarget(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            {confirmTarget.order ? (
              <>
                <p className="text-plum-dark mb-1 font-medium">Remove this transaction from your admin view?</p>
                <p className="text-sm text-plum-light/70 mb-5">
                  This only hides it from the admin panel — the customer's own payment history and total revenue are unaffected. It's linked to
                  order #{confirmTarget.order.orderNumber} — also hide that order from Admin → Orders?
                </p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => doDelete(true)} disabled={deleting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                    {deleting ? "Removing..." : "Remove Payment + Order"}
                  </button>
                  <button onClick={() => doDelete(false)} disabled={deleting} className="btn-outline text-sm w-full">
                    Remove Payment Only
                  </button>
                  <button onClick={() => setConfirmTarget(null)} className="text-xs text-plum-light/70 mt-1">Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-plum-dark mb-1 font-medium">Remove this transaction from your admin view?</p>
                <p className="text-sm text-plum-light/70 mb-5">
                  This only hides it from the admin panel — the customer's own payment history and total revenue are unaffected.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmTarget(null)} className="btn-outline text-sm w-full">Cancel</button>
                  <button onClick={() => doDelete(false)} disabled={deleting} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                    {deleting ? "Removing..." : "Remove"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

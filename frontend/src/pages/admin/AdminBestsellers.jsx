import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";

// Threshold used only to surface a *suggestion* to the admin - it never sets anything itself.
// NOTE: an earlier, more detailed spec explicitly said sales performance must never
// auto-apply the Bestseller label, only inform the admin's decision. That rule is kept here;
// only the suggestion threshold number (20 units) has been updated to match your latest note.
const HIGH_PERFORMER_UNITS = 20;

export default function AdminBestsellers() {
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/products/admin/performance").then((res) => setPerformance(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleLabel = async (product, field, value) => {
    try {
      await api.put(`/products/${product._id}`, { [field]: value });
      toast.success(
        field === "bestseller"
          ? value
            ? `${product.name} marked as Bestseller`
            : `${product.name} removed from Bestseller`
          : "Updated"
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update");
    }
  };

  const highPerformers = performance.filter((p) => p.unitsSold >= HIGH_PERFORMER_UNITS && !p.bestseller);

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-2">Bestseller Management</h1>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-8 max-w-2xl">
        Sales figures below are for your information only — nothing here is ever labeled automatically.
        You decide which products carry the Bestseller badge on the website, based on whatever you feel
        matters (sales, season, personal favorites, stock on hand, etc).
      </p>

      {highPerformers.length > 0 && (
        <div className="mb-8 space-y-3">
          <h2 className="font-display text-xl text-plum dark:text-cream">🔥 High Performing Products</h2>
          {highPerformers.map((p) => (
            <div key={p._id} className="bg-white rounded-xl2 shadow-card border border-gold/40 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={p.image || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div>
                  <div className="font-medium text-plum-dark">{p.name}</div>
                  <div className="text-xs text-plum-light/70 dark:text-cream/70">has sold {p.unitsSold} units across {p.orderCount} orders</div>
                </div>
              </div>
              <button onClick={() => toggleLabel(p, "bestseller", true)} className="btn-primary text-xs whitespace-nowrap">
                Mark as Bestseller
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display text-xl text-plum dark:text-cream mb-3">Product Performance</h2>
      {loading ? (
        <p className="text-plum-light/60 dark:text-cream/60 text-sm">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-plum-light/70 dark:text-cream/70 border-b border-blush">
                <th className="p-3">Product</th><th>Units Sold</th><th>Orders</th><th>Stock</th><th>Rating</th><th>Current Labels</th><th>Bestseller</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr key={p._id} className="border-b border-blush/50">
                  <td className="p-3 flex items-center gap-2">
                    <img src={p.image || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt="" className="w-9 h-9 rounded-lg object-cover" />
                    {p.name}
                  </td>
                  <td>{p.unitsSold}</td>
                  <td>{p.orderCount}</td>
                  <td className={p.stock === 0 ? "text-rose" : ""}>{p.stock}</td>
                  <td>{p.rating > 0 ? `${p.rating.toFixed(1)} ★${p.isAdminRating ? " (set)" : ""}` : "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {p.bestseller && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">Bestseller</span>}
                      {p.featured && <span className="text-[10px] bg-plum/10 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">Featured</span>}
                      {p.newArrival && <span className="text-[10px] bg-rose/10 text-rose px-1.5 py-0.5 rounded-full">New</span>}
                      {p.handcrafted && <span className="text-[10px] bg-lavender/20 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">Handcrafted</span>}
                      {p.limitedStockLabel && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Limited</span>}
                      {p.saleLabel && <span className="text-[10px] bg-rose/20 text-rose px-1.5 py-0.5 rounded-full">Sale</span>}
                      {!p.bestseller && !p.featured && !p.newArrival && !p.handcrafted && !p.limitedStockLabel && !p.saleLabel && (
                        <span className="text-plum-light/40 dark:text-cream/40">Normal</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {p.bestseller ? (
                      <button onClick={() => toggleLabel(p, "bestseller", false)} className="text-xs text-rose underline">
                        Remove from Bestseller
                      </button>
                    ) : (
                      <button onClick={() => toggleLabel(p, "bestseller", true)} className="text-xs text-plum dark:text-cream underline">
                        Mark as Bestseller
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

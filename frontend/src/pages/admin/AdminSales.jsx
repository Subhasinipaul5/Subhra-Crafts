import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";
import NumberInput from "../../components/NumberInput";

const emptyForm = {
  name: "",
  description: "",
  bannerImage: { url: "", publicId: "" },
  discountType: "percentage",
  discountValue: 10,
  products: [],
  categories: [],
  startAt: "",
  endAt: "",
  active: true,
};

const STATUS_META = {
  active: { label: "🟢 Active", cls: "bg-green-100 text-green-700" },
  upcoming: { label: "🟡 Upcoming", cls: "bg-amber-100 text-amber-700" },
  expired: { label: "🔴 Expired", cls: "bg-gray-100 text-gray-500" },
  paused: { label: "⏸ Paused", cls: "bg-gray-100 text-gray-500" },
};

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the browser's local time, with no timezone
// suffix - this converts both directions. Dates are stored/sent as plain ISO strings; the
// backend compares them against server time directly (see SaleCampaign.getStatus), so what
// matters is that the admin's local wall-clock time is what gets saved, not UTC math here.
const toDatetimeLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const computePreviewPrice = (price, discountType, discountValue) => {
  if (price == null || !discountValue) return price;
  const raw = discountType === "percentage" ? price - (price * discountValue) / 100 : price - discountValue;
  return Math.max(0, Math.round(raw * 100) / 100);
};

export default function AdminSales() {
  const [campaigns, setCampaigns] = useState([]);
  const [tab, setTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  const load = () => {
    api.get("/sales/admin/all").then((res) => setCampaigns(res.data)).catch(() => toast.error("Could not load sales"));
  };

  useEffect(() => {
    load();
    api.get("/products/admin/all").then((res) => setAllProducts(res.data));
    api.get("/categories?all=true").then((res) => setAllCategories(res.data));
  }, []);

  const counts = useMemo(() => {
    const c = { active: 0, upcoming: 0, expired: 0, paused: 0 };
    let productsOnSale = 0;
    for (const camp of campaigns) {
      c[camp.status] = (c[camp.status] || 0) + 1;
      if (camp.status === "active") productsOnSale += camp.productCount;
    }
    return { ...c, productsOnSale };
  }, [campaigns]);

  const visibleCampaigns = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name || "",
      description: c.description || "",
      bannerImage: c.bannerImage || { url: "", publicId: "" },
      discountType: c.discountType || "percentage",
      discountValue: c.discountValue || 0,
      products: (c.products || []).map((p) => (p._id ? p._id : p)),
      categories: (c.categories || []).map((cat) => (cat._id ? cat._id : cat)),
      startAt: toDatetimeLocal(c.startAt),
      endAt: toDatetimeLocal(c.endAt),
      active: c.active !== false,
    });
    setEditingId(c._id);
    setShowForm(true);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, bannerImage: res.data.images[0] }));
    } catch {
      toast.error("Banner upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeBanner = async () => {
    if (form.bannerImage?.publicId) {
      try {
        await api.delete("/upload", { data: { publicId: form.bannerImage.publicId } });
      } catch {
        // Best-effort, same as everywhere else this pattern is used.
      }
    }
    setForm((f) => ({ ...f, bannerImage: { url: "", publicId: "" } }));
  };

  const toggleProduct = (id) => {
    setForm((f) => ({
      ...f,
      products: f.products.includes(id) ? f.products.filter((p) => p !== id) : [...f.products, id],
    }));
  };

  const toggleCategory = (id) => {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));
  };

  const filteredProducts = productSearch
    ? allProducts.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : allProducts;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.startAt || !form.endAt) return toast.error("Start and end date/time are required");
    if (new Date(form.endAt) <= new Date(form.startAt)) return toast.error("End date/time must be after start date/time");
    if (form.active && form.products.length === 0 && form.categories.length === 0) {
      return toast.error("Select at least one product or category before activating this sale");
    }
    setSaving(true);
    try {
      const payload = { ...form, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() };
      if (editingId) {
        await api.put(`/sales/${editingId}`, payload);
        toast.success("Sale updated");
      } else {
        await api.post("/sales", payload);
        toast.success("Sale created");
      }
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save sale");
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (c) => {
    try {
      await api.put(`/sales/${c._id}`, { active: !c.active });
      toast.success(c.active ? "Sale paused" : "Sale resumed");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update sale");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this sale? Products immediately return to normal pricing.")) return;
    try {
      await api.delete(`/sales/${id}`);
      toast.success("Sale deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete sale");
    }
  };

  const selectedProductObjs = form.products.map((id) => allProducts.find((p) => p._id === id)).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum dark:text-cream">🔥 Sales & Offers</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Create New Sale</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          ["Active Sales", counts.active, "text-green-700"],
          ["Upcoming Sales", counts.upcoming, "text-amber-700"],
          ["Expired Sales", counts.expired, "text-gray-500"],
          ["Products on Sale", counts.productsOnSale, "text-rose"],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-white dark:bg-[#24152f] rounded-xl2 shadow-card border border-blush p-4">
            <div className="text-xs text-plum-light/70 dark:text-cream/70">{label}</div>
            <div className={`text-2xl font-display mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["active", "upcoming", "expired", "all"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm capitalize whitespace-nowrap border transition-colors ${
              tab === t ? "bg-plum text-cream border-plum" : "border-blush text-plum-dark hover:border-rose"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* CAMPAIGN FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#24152f] rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-5">
          <h3 className="font-display text-xl text-plum dark:text-cream">{editingId ? "Edit Sale" : "New Sale"}</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Sale Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Festival Flash Sale" className="w-full border border-blush rounded-lg px-3 py-2" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-plum dark:text-cream">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active (uncheck to pause without deleting)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Start Date & Time</label>
              <input required type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">End Date & Time</label>
              <input required type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Discount Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
                Discount Value {form.discountType === "percentage" ? "(%)" : "(₹)"}
              </label>
              <NumberInput
                required
                min="0"
                max={form.discountType === "percentage" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                className="w-full border border-blush rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Sale Banner (optional)</label>
            <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploading} />
            {uploading && <span className="text-xs text-plum-light/60 ml-2">Uploading...</span>}
            {form.bannerImage?.url && (
              <div className="mt-3 relative w-fit">
                <img src={form.bannerImage.url} alt="Sale banner" className="w-48 h-28 object-cover rounded-lg" />
                <button type="button" onClick={removeBanner} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs">✕</button>
              </div>
            )}
          </div>

          {/* CATEGORY TARGETING */}
          <div>
            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
              Target Whole Categories (optional — every current and future product in a checked category goes on sale)
            </label>
            <div className="max-h-32 overflow-y-auto border border-blush rounded-lg p-3 grid sm:grid-cols-2 gap-2">
              {allCategories.map((c) => (
                <label key={c._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.categories.includes(c._id)} onChange={() => toggleCategory(c._id)} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          {/* PRODUCT TARGETING */}
          <div>
            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Select Individual Products</label>
            <input
              type="text"
              placeholder="Search products..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full border border-blush rounded-lg px-3 py-2 mb-2 text-sm"
            />
            <div className="max-h-56 overflow-y-auto border border-blush rounded-lg p-3 grid sm:grid-cols-2 gap-2">
              {filteredProducts.map((p) => (
                <label key={p._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggleProduct(p._id)} />
                  {p.name}
                </label>
              ))}
              {filteredProducts.length === 0 && <p className="text-xs text-plum-light/50 italic">No matching products.</p>}
            </div>
          </div>

          {/* LIVE PRICE PREVIEW */}
          {selectedProductObjs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Preview — Individually Selected Products</label>
              <div className="border border-blush rounded-lg divide-y divide-blush/60 max-h-56 overflow-y-auto">
                {selectedProductObjs.map((p) => {
                  const finalPrice = computePreviewPrice(p.price, form.discountType, form.discountValue);
                  return (
                    <div key={p._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <img src={p.images?.[0]?.url || placeholder} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-plum-light/60 line-through">₹{p.price}</span>
                      <span className="font-medium text-rose">₹{finalPrice}</span>
                      <button type="button" onClick={() => toggleProduct(p._id)} className="text-xs text-plum-light/60 hover:text-rose">Remove</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-outline text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? "Saving..." : editingId ? "Save Changes" : "Create Sale"}</button>
          </div>
        </form>
      )}

      {/* CAMPAIGN LIST */}
      <div className="space-y-3">
        {visibleCampaigns.map((c) => {
          const meta = STATUS_META[c.status] || STATUS_META.paused;
          return (
            <div key={c._id} className="bg-white dark:bg-[#24152f] rounded-xl2 shadow-card border border-blush p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-plum-dark">{c.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                </div>
                <div className="text-xs text-plum-light/60 dark:text-cream/60 mt-1">
                  {c.productCount} product(s) · {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`} ·{" "}
                  {new Date(c.startAt).toLocaleString()} → {new Date(c.endAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-3 text-xs shrink-0">
                <button onClick={() => openEdit(c)} className="text-plum dark:text-cream underline">Edit / Manage Products</button>
                <button onClick={() => togglePause(c)} className="text-plum dark:text-cream underline">{c.active ? "Pause" : "Activate"}</button>
                <button onClick={() => remove(c._id)} className="text-rose underline">Delete</button>
              </div>
            </div>
          );
        })}
        {visibleCampaigns.length === 0 && <p className="text-sm text-plum-light/60 dark:text-cream/60">No sales in this tab.</p>}
      </div>
    </div>
  );
}

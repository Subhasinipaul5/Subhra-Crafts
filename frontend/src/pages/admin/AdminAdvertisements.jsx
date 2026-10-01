import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";

const emptyForm = {
  title: "", description: "", platform: "instagram", status: "draft",
  destinationUrl: "", startDate: "", endDate: "", image: null,
  products: [], // [{ product, variantId }]
};

const STATUS_STYLES = {
  draft: "bg-plum-light/10 text-plum-light",
  scheduled: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blush/60 text-plum-dark",
};

export default function AdminAdvertisements() {
  const [dashboard, setDashboard] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [metaConnected, setMetaConnected] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState(null); // campaign object while its analytics modal is open
  const [analyticsData, setAnalyticsData] = useState(null);

  const load = () => {
    api.get("/ads/dashboard").then((res) => {
      setDashboard(res.data);
      setMetaConnected(res.data.metaConnected);
    });
    api.get("/ads").then((res) => setCampaigns(res.data));
  };

  useEffect(() => {
    load();
    api.get("/products/admin/all").then((res) => setProducts(res.data));
  }, []);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p._id, p])), [products]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({
      title: c.title, description: c.description || "", platform: c.platform, status: c.status,
      destinationUrl: c.destinationUrl, startDate: c.startDate ? c.startDate.slice(0, 10) : "",
      endDate: c.endDate ? c.endDate.slice(0, 10) : "", image: c.image,
      products: c.products.map((p) => ({ product: p.product?._id || p.product, variantId: p.variantId || null })),
    });
    setEditingId(c._id);
    setShowForm(true);
  };

  const toggleProduct = (productId) => {
    setForm((f) => {
      const exists = f.products.find((p) => p.product === productId);
      if (exists) return { ...f, products: f.products.filter((p) => p.product !== productId) };
      return { ...f, products: [...f.products, { product: productId, variantId: null }] };
    });
  };
  const setProductVariant = (productId, variantId) => {
    setForm((f) => ({
      ...f,
      products: f.products.map((p) => (p.product === productId ? { ...p, variantId: variantId || null } : p)),
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, image: res.data.images[0] }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.products.length === 0) return toast.error("Select at least one product.");
    setSaving(true);
    try {
      const payload = { ...form, startDate: form.startDate || null, endDate: form.endDate || null };
      if (editingId) {
        await api.put(`/ads/${editingId}`, payload);
        toast.success("Advertisement updated");
      } else {
        await api.post("/ads", payload);
        toast.success("Advertisement created");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save advertisement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this advertisement campaign? The advertised products will NOT be affected.")) return;
    await api.delete(`/ads/${id}`);
    toast.success("Campaign deleted");
    load();
  };

  const viewAnalytics = async (c) => {
    setAnalyticsFor(c);
    setAnalyticsData(null);
    const res = await api.get(`/ads/${c._id}/analytics`);
    setAnalyticsData(res.data);
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Tracking link copied");
  };

  const downloadContent = (c) => {
    const text = `${c.title}\n\n${c.description || ""}\n\nTracking link: ${c.trackingUrl}\nFinal destination: ${c.finalUrl}\nPlatform: ${c.platform}\nImage: ${c.image?.url || "(none)"}`;
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${c.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-ad-content.txt`;
    link.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum dark:text-cream">Advertisements</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Create Advertisement</button>
      </div>

      {!metaConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Meta Business Account not connected.</strong> Campaigns aren't automatically posted to Instagram/Facebook yet.
          Create a campaign below to get a tracking link and ad content you can copy or download and post manually. Once you
          connect a Meta Business account (add <code className="bg-amber-100 px-1 rounded">META_ACCESS_TOKEN</code> and{" "}
          <code className="bg-amber-100 px-1 rounded">META_AD_ACCOUNT_ID</code> to the backend), automatic posting can be enabled.
        </div>
      )}

      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 text-sm">
          {[
            ["Total Campaigns", dashboard.totalCampaigns],
            ["Active", dashboard.activeCampaigns],
            ["Scheduled", dashboard.scheduledCampaigns],
            ["Completed", dashboard.completedCampaigns],
            ["Total Clicks", dashboard.totalClicks],
            ["Visitors Generated", dashboard.totalVisitors],
          ].map(([l, v]) => (
            <div key={l} className="bg-white rounded-xl shadow-card border border-blush p-3 text-center">
              <div className="text-plum-light/70 dark:text-cream/70 text-xs">{l}</div>
              <div className="font-display text-2xl text-plum dark:text-cream">{v}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-4">
          <h3 className="font-display text-xl text-plum dark:text-cream">{editingId ? "Edit Advertisement" : "New Advertisement"}</h3>

          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Advertisement Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="border border-blush rounded-lg px-3 py-2">
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="instagram_facebook">Instagram + Facebook</option>
            </select>
          </div>

          <textarea placeholder="Description / caption" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-blush rounded-lg px-3 py-2" />

          <div className="grid sm:grid-cols-2 gap-3">
            <input required type="url" placeholder="Destination URL (e.g. product page)" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-blush rounded-lg px-3 py-2">
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-plum-light/70 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-plum-light/70 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Advertisement Image</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            {uploading && <span className="text-xs text-plum-light/60 ml-2">Uploading...</span>}
            {form.image?.url && <img src={form.image.url} alt="" className="w-20 h-20 rounded-lg object-cover mt-2" />}
          </div>

          <div>
            <label className="block text-sm font-medium text-plum-dark mb-2">Select Product(s)</label>
            <div className="border border-blush rounded-xl max-h-64 overflow-y-auto divide-y divide-blush/50">
              {products.map((p) => {
                const selection = form.products.find((s) => s.product === p._id);
                return (
                  <div key={p._id} className="p-2.5 flex items-center gap-3">
                    <input type="checkbox" checked={!!selection} onChange={() => toggleProduct(p._id)} />
                    <img src={p.images?.[0]?.url || placeholder} alt="" className="w-8 h-8 rounded object-cover" />
                    <span className="text-sm flex-1">{p.name}</span>
                    {selection && p.variants?.length > 0 && (
                      <select
                        value={selection.variantId || ""}
                        onChange={(e) => setProductVariant(p._id, e.target.value)}
                        className="border border-blush rounded px-2 py-1 text-xs"
                      >
                        <option value="">All colors</option>
                        {p.variants.map((v) => <option key={v._id} value={v._id}>{v.colorName}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
            <button disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save Changes" : "Create Campaign"}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-plum-light/70 dark:text-cream/70 border-b border-blush">
              <th className="p-3">Campaign</th><th>Platform</th><th>Products</th><th>Dates</th><th>Status</th><th>Clicks</th><th>Visitors</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-plum-light/60">No campaigns yet — create your first one above.</td></tr>
            )}
            {campaigns.map((c) => (
              <tr key={c._id} className="border-b border-blush/50 align-top">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {c.image?.url && <img src={c.image.url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
                    <div>
                      <div className="font-medium text-plum-dark">{c.title}</div>
                      <button onClick={() => copyLink(c.trackingUrl)} className="text-[11px] text-plum underline">Copy tracking link</button>
                    </div>
                  </div>
                </td>
                <td className="capitalize">{c.platform.replace("_", " + ")}</td>
                <td>
                  {c.products.map((p) => (
                    <div key={p.product?._id || p.product} className="text-xs">{productMap[p.product?._id || p.product]?.name || p.product?.name}</div>
                  ))}
                </td>
                <td className="text-xs whitespace-nowrap">
                  {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"} → {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                </td>
                <td><span className={`text-[10px] uppercase px-2 py-1 rounded-full ${STATUS_STYLES[c.status]}`}>{c.status}</span></td>
                <td>{c.clicks}</td>
                <td>{c.visitors}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button onClick={() => viewAnalytics(c)} className="text-plum dark:text-cream underline">Analytics</button>
                  <button onClick={() => openEdit(c)} className="text-plum dark:text-cream underline">Edit</button>
                  <button onClick={() => downloadContent(c)} className="text-plum dark:text-cream underline">Download</button>
                  <button onClick={() => remove(c._id)} className="text-rose underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analyticsFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => setAnalyticsFor(null)}>
          <div className="bg-white rounded-2xl shadow-soft max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl text-plum">{analyticsFor.title}</h3>
              <button onClick={() => setAnalyticsFor(null)} className="text-2xl leading-none text-plum-light">×</button>
            </div>
            {!analyticsData ? (
              <p className="text-sm text-plum-light/60">Loading...</p>
            ) : (
              <div className="space-y-2 text-sm">
                <Row label="Impressions" value={analyticsData.impressionsAvailable ? analyticsData.impressions : "Not available (Meta API not connected)"} />
                <Row label="Clicks" value={analyticsData.clicks} />
                <Row label="Website Visitors" value={analyticsData.visitors} />
                <Row label="Product Views" value={analyticsData.productViews} />
                <Row label="Add to Cart" value={analyticsData.addToCart} />
                <Row label="Purchases" value={analyticsData.purchases} />
                <Row label="Conversion Rate" value={`${analyticsData.conversionRate}%`} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-blush/50 py-1.5">
      <span className="text-plum-light/70">{label}</span>
      <span className="font-medium text-plum-dark">{value}</span>
    </div>
  );
}

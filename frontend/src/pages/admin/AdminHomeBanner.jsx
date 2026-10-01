import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import NumberInput from "../../components/NumberInput";
import ProductPicker from "../../components/ProductPicker";

const MAX_SLIDES = 10;
const emptyForm = { title: "", subtitle: "", buttonText: "", linkedProduct: null, durationSeconds: 5, active: true, image: null };

const TRANSITION_OPTIONS = [
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "fade", label: "Fade" },
  { value: "blur", label: "Blur" },
  { value: "blurFade", label: "Blur + Fade" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "crossfade", label: "Crossfade" },
  { value: "random", label: "Random" },
];

const defaultBannerSettings = { transition: "fade", durationMs: 700, autoChange: true, intervalSeconds: 2, pauseOnHover: true };

// FEATURE 3 (this round) - manage up to 10 homepage hero slides. Backward compatible: if no
// slides exist, the homepage still shows the old single-banner image (see HomeBannerSlider.jsx).
export default function AdminHomeBanner() {
  const [slides, setSlides] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerSettings, setBannerSettings] = useState(defaultBannerSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = () => api.get("/home-banner/admin").then((res) => setSlides(res.data));
  const loadSettings = () =>
    api.get("/settings").then((res) => {
      if (res.data.bannerSettings) setBannerSettings(res.data.bannerSettings);
    });
  useEffect(() => { load(); loadSettings(); }, []);

  const saveBannerSettings = async (next) => {
    setBannerSettings(next);
    setSavingSettings(true);
    try {
      await api.put("/settings/home-banner-settings", next);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save banner settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const activeCount = slides.filter((s) => s.active).length;

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (s) => {
    setForm({
      title: s.title,
      subtitle: s.subtitle,
      buttonText: s.buttonText,
      // s.linkedProductId is already the POPULATED product (see getAllSlides in the backend
      // controller) - reused directly as ProductPicker's preview, no extra fetch.
      linkedProduct: s.linkedProductId || null,
      linkedProductMissing: !!s.linkedProductMissing,
      durationSeconds: s.durationSeconds,
      active: s.active,
      image: s.image,
    });
    setEditingId(s._id);
    setShowForm(true);
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
    if (!form.image?.url) return toast.error("Please choose a banner image.");
    setSaving(true);
    try {
      // Only the product's id is ever persisted (linkedProductId) - never a copy of the product
      // object itself. The full `linkedProduct` in form state exists purely so ProductPicker
      // has something to preview.
      const { linkedProduct, ...rest } = form;
      const payload = { ...rest, linkedProductId: linkedProduct?._id || null, durationSeconds: Number(form.durationSeconds) || 5 };
      if (editingId) {
        await api.put(`/home-banner/${editingId}`, payload);
        toast.success("Banner slide updated");
      } else {
        const res = await api.post("/home-banner", payload);
        if (res.data.warning) toast(res.data.warning, { icon: "⚠️" });
        else toast.success("Banner slide added");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save banner slide");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    try {
      await api.put(`/home-banner/${s._id}`, { active: !s.active });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update banner slide");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this banner slide? It will disappear from the homepage immediately.")) return;
    await api.delete(`/home-banner/${id}`);
    toast.success("Banner slide removed");
    load();
  };

  const move = async (index, dir) => {
    const next = [...slides];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setSlides(next);
    await api.put("/home-banner/reorder", { orderedIds: next.map((s) => s._id) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-3xl text-plum dark:text-cream">Home Page Banners</h1>
        <button onClick={openNew} disabled={activeCount >= MAX_SLIDES && !showForm} className="btn-primary text-sm disabled:opacity-50">+ Add Banner</button>
      </div>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-6">
        Up to {MAX_SLIDES} active slides. The homepage automatically advances to the next slide after each one's configured
        duration. With one slide, no slider controls are shown. With none, the homepage falls back to the classic single banner.
      </p>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 max-w-xl">
        <h3 className="font-display text-xl text-plum dark:text-cream mb-1">Home Banner Settings</h3>
        <p className="text-xs text-plum-light/60 mb-4">Applies to how every slide transitions into the next.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Transition</label>
            <select
              value={bannerSettings.transition}
              onChange={(e) => saveBannerSettings({ ...bannerSettings, transition: e.target.value })}
              className="w-full border border-blush rounded-lg px-3 py-2"
            >
              {TRANSITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Duration (ms)</label>
            <NumberInput
              min={150}
              max={3000}
              step={50}
              value={bannerSettings.durationMs}
              onChange={(e) => setBannerSettings({ ...bannerSettings, durationMs: Number(e.target.value) })}
              onBlur={() => saveBannerSettings(bannerSettings)}
              className="w-full border border-blush rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Interval (seconds)</label>
            <NumberInput
              min={1}
              max={30}
              value={bannerSettings.intervalSeconds}
              onChange={(e) => setBannerSettings({ ...bannerSettings, intervalSeconds: Number(e.target.value) })}
              onBlur={() => saveBannerSettings(bannerSettings)}
              className="w-full border border-blush rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bannerSettings.autoChange}
                onChange={(e) => saveBannerSettings({ ...bannerSettings, autoChange: e.target.checked })}
              />
              Auto Change
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bannerSettings.pauseOnHover}
                onChange={(e) => saveBannerSettings({ ...bannerSettings, pauseOnHover: e.target.checked })}
              />
              Pause on Hover
            </label>
          </div>
        </div>
        {savingSettings && <p className="text-xs text-plum-light/50 mt-3">Saving...</p>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-3 max-w-xl">
          <h3 className="font-display text-xl text-plum dark:text-cream mb-1">{editingId ? "Edit Banner Slide" : "New Banner Slide"}</h3>
          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Banner Image *</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            {uploading && <span className="text-xs text-plum-light/60 ml-2">Uploading...</span>}
            {form.image?.url && <img src={form.image.url} alt="" className="w-full max-w-xs rounded-lg mt-2 object-cover aspect-[4/5]" />}
          </div>
          <input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
          <textarea placeholder="Subtitle (optional)" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} rows={2} className="w-full border border-blush rounded-lg px-3 py-2" />
          <input placeholder="Button Text (optional)" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
          {/* Replaces the old free-typed "Button URL" field: the whole banner image becomes
              clickable to whichever product is linked here (see HomeBannerSlider.jsx) - no
              arbitrary URLs, no manually-typed /product/... paths. Optional: leaving this
              unset keeps the banner exactly as non-clickable as before. */}
          {form.linkedProductMissing && !form.linkedProduct && (
            <p className="text-xs text-red-600 -mt-1">Linked product is no longer available. Choose another product below, or leave it unlinked.</p>
          )}
          <ProductPicker
            value={form.linkedProduct}
            onChange={(product) => setForm({ ...form, linkedProduct: product, linkedProductMissing: false })}
          />
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-plum-light/70 mb-1">Duration (seconds)</label>
              <NumberInput min={2} max={30} value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} className="w-24 border border-blush rounded-lg px-3 py-2" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-4">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
            <button disabled={saving || uploading} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save Changes" : "Add Slide"}</button>
          </div>
        </form>
      )}

      <div className="space-y-3 max-w-3xl">
        {slides.length === 0 && (
          <p className="text-sm text-plum-light/60 dark:text-cream/60">No custom slides yet — the homepage is showing the classic single banner.</p>
        )}
        {slides.map((s, i) => (
          <div key={s._id} className="bg-white rounded-xl2 shadow-card border border-blush p-4 flex items-center gap-4">
            <img
              src={s.image.url}
              alt=""
              onError={(e) => { e.target.onerror = null; e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23f3e8ee'/%3E%3C/svg%3E"; }}
              className="w-20 h-24 object-cover rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-plum-dark truncate">{s.title || <span className="italic text-plum-light/50">Untitled slide</span>}</div>
              <div className="text-xs text-plum-light/60">
                {s.durationSeconds}s • {s.active ? <span className="text-green-600">Active</span> : <span className="text-plum-light/50">Inactive</span>}
                {s.linkedProductId && <span className="ml-2 text-rose">🔗 {s.linkedProductId.name}</span>}
                {s.linkedProductMissing && <span className="ml-2 text-red-600">⚠️ Linked product is no longer available</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-plum disabled:opacity-30">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === slides.length - 1} className="text-xs text-plum disabled:opacity-30">▼</button>
            </div>
            <div className="flex flex-col gap-1.5 text-xs whitespace-nowrap">
              <button onClick={() => toggleActive(s)} className="text-plum dark:text-cream underline">{s.active ? "Deactivate" : "Activate"}</button>
              <button onClick={() => openEdit(s)} className="text-plum dark:text-cream underline">Edit</button>
              <button onClick={() => remove(s._id)} className="text-rose underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";
import NumberInput from "../../components/NumberInput";

const emptyForm = {
  name: "", description: "", price: "", discountPrice: "", category: "", stock: 0,
  sku: "", colors: "", dimensions: "", materials: "", lowStockThreshold: 5,
  featured: false, bestseller: false, newArrival: false, handcrafted: true,
  limitedStockLabel: false, saleLabel: false, adminRating: "", adminReviewCount: "",
  homepageVisible: false, homepagePosition: 0,
  status: "active", images: [], variants: [],
};

const emptyVariant = () => ({
  _key: Math.random().toString(36).slice(2),
  colorName: "", colorHex: "#8B5CF6", name: "", images: [],
  price: "", discountPrice: "", description: "", stock: 0, sku: "",
  materials: "", dimensions: "", status: "active",
  tryOn: { enabled: false, assets: [] },
});

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    api.get("/products/admin/all").then((res) => setProducts(res.data));
    api.get("/products/admin/stats").then((res) => setStats(res.data));
  };

  useEffect(() => {
    load();
    api.get("/categories?all=true").then((res) => setCategories(res.data));
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c._id === form.category),
    [categories, form.category]
  );
  // The targets this category cares about for Virtual Try-On (e.g. ["ears","neck"]) - decides
  // which per-variant asset slots (Feature 3/9) are shown below.
  const tryOnTargets = selectedCategory?.virtualTryOn?.enabled ? selectedCategory.virtualTryOn.targets || [] : [];

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (p) => {
    setForm({
      ...p, category: p.category?._id || p.category, colors: (p.colors || []).join(", "),
      price: p.price, discountPrice: p.discountPrice || "",
      adminRating: p.adminRating ?? "", adminReviewCount: p.adminReviewCount ?? "",
      variants: (p.variants || []).map((v) => ({
        ...v,
        _key: v._id || Math.random().toString(36).slice(2),
        price: v.price ?? "", discountPrice: v.discountPrice ?? "",
        tryOn: v.tryOn || { enabled: false, assets: [] },
      })),
    });
    setEditingId(p._id);
    setShowForm(true);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("images", f));
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, images: [...(f.images || []), ...res.data.images] }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // FEATURE 1/3 - Color variant management
  // ============================================================

  const addVariant = () => setForm((f) => ({ ...f, variants: [...f.variants, emptyVariant()] }));
  const removeVariant = (key) => setForm((f) => ({ ...f, variants: f.variants.filter((v) => v._key !== key) }));
  const updateVariant = (key, patch) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v._key === key ? { ...v, ...patch } : v)) }));

  const uploadVariantImages = async (key, files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("images", f));
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({
        ...f,
        variants: f.variants.map((v) => (v._key === key ? { ...v, images: [...(v.images || []), ...res.data.images] } : v)),
      }));
    } catch {
      toast.error("Variant image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadTryOnAsset = async (key, target, file) => {
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("Please upload a transparent PNG for the try-on asset.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const uploaded = res.data.images[0];
      setForm((f) => ({
        ...f,
        variants: f.variants.map((v) => {
          if (v._key !== key) return v;
          const assets = [...(v.tryOn.assets || [])];
          const idx = assets.findIndex((a) => a.target === target);
          const next = { target, image: uploaded, widthCm: assets[idx]?.widthCm || 0, heightCm: assets[idx]?.heightCm || 0 };
          if (idx >= 0) assets[idx] = next; else assets.push(next);
          return { ...v, tryOn: { ...v.tryOn, assets } };
        }),
      }));
    } catch {
      toast.error("Try-on asset upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateTryOnAssetDims = (key, target, field, value) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => {
        if (v._key !== key) return v;
        const assets = (v.tryOn.assets || []).map((a) => (a.target === target ? { ...a, [field]: Number(value) || 0 } : a));
        return { ...v, tryOn: { ...v.tryOn, assets } };
      }),
    }));
  };

  const deleteImageFile = async (publicId) => {
    if (!publicId) return;
    try {
      await api.delete("/upload", { data: { publicId } });
    } catch {
      // Best-effort: even if the storage delete fails (e.g. already gone), we still remove the
      // image from the product/variant below so the admin is never stuck unable to detach it.
      toast.error("Removed from the product, but the file may still exist in storage.");
    }
  };

  // FEATURE 2 - delete a single BASE product image. Only that one image is removed; nothing
  // else about the product changes until "Save Changes" is pressed.
  const removeBaseImage = async (idx) => {
    if (!confirm("Permanently delete this image?")) return;
    const img = form.images[idx];
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }));
    await deleteImageFile(img.publicId);
  };

  // FEATURE 2 - delete a single VARIANT image. Removing an image never removes the variant itself.
  const removeVariantImage = async (key, idx) => {
    if (!confirm("Permanently delete this image?")) return;
    const variant = form.variants.find((v) => v._key === key);
    const img = variant?.images?.[idx];
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v._key === key ? { ...v, images: v.images.filter((_, i) => i !== idx) } : v)),
    }));
    if (img) await deleteImageFile(img.publicId);
  };

  // FEATURE 2 - delete a Virtual Try-On asset (Ears/Neck/Face/Hair PNG) for one variant. Only
  // removes that target's asset - the variant's normal product images are untouched.
  const removeTryOnAsset = async (key, target) => {
    if (!confirm("Permanently delete this Virtual Try-On image?")) return;
    const variant = form.variants.find((v) => v._key === key);
    const asset = variant?.tryOn?.assets?.find((a) => a.target === target);
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) =>
        v._key === key ? { ...v, tryOn: { ...v.tryOn, assets: v.tryOn.assets.filter((a) => a.target !== target) } } : v
      ),
    }));
    if (asset?.image?.publicId) await deleteImageFile(asset.image.publicId);
  };

  const updateTryOnAssetYOffset = (key, target, value) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => {
        if (v._key !== key) return v;
        const assets = (v.tryOn.assets || []).map((a) => (a.target === target ? { ...a, yOffset: Number(value) } : a));
        return { ...v, tryOn: { ...v.tryOn, assets } };
      }),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      price: Number(form.price),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      stock: Number(form.stock),
      lowStockThreshold: Number(form.lowStockThreshold),
      colors: form.colors.split(",").map((c) => c.trim()).filter(Boolean),
      adminRating: form.adminRating === "" ? null : Number(form.adminRating),
      adminReviewCount: form.adminReviewCount === "" ? null : Number(form.adminReviewCount),
      homepagePosition: form.homepagePosition === "" ? 0 : Number(form.homepagePosition),
      variants: form.variants
        .filter((v) => v.colorName.trim())
        .map(({ _key, ...v }) => ({
          ...v,
          price: v.price === "" ? null : Number(v.price),
          discountPrice: v.discountPrice === "" ? null : Number(v.discountPrice),
          stock: Number(v.stock) || 0,
        })),
    };
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/products", payload);
        toast.success("Product created");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save product");
    }
  };

  const quickStock = async (id, stock) => {
    await api.patch(`/products/${id}/stock`, { stock: Number(stock) });
    load();
  };

  const remove = async (id) => {
    if (!confirm("Remove this product from the store? (History is preserved)")) return;
    await api.delete(`/products/${id}`);
    toast.success("Product removed");
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum dark:text-cream">Products</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Add New Product</button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8 text-sm">
          {[["Total", stats.total], ["Active", stats.active], ["Low Stock", stats.lowStock], ["Out of Stock", stats.outOfStock], ["Hidden", stats.hidden]].map(([l, v]) => (
            <div key={l} className="bg-white rounded-xl shadow-card border border-blush p-3 text-center">
              <div className="text-plum-light/70 dark:text-cream/70 text-xs">{l}</div>
              <div className="font-display text-2xl text-plum dark:text-cream">{v}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-3">
          <h3 className="font-display text-xl text-plum dark:text-cream mb-2">{editingId ? "Edit Product" : "New Product"}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-blush rounded-lg px-3 py-2">
              <option value="">Select Category</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <textarea required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-blush rounded-lg px-3 py-2" />
          <p className="text-xs text-plum-light/60 dark:text-cream/60">
            Base price/description/images below apply when this product has no color variants, and act as the fallback
            for any variant field a color doesn't override.
          </p>
          <div className="grid sm:grid-cols-4 gap-3">
            <NumberInput required placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <NumberInput placeholder="Discount Price" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <NumberInput required placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <NumberInput placeholder="Low Stock Alert" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <input placeholder="Colors (comma separated, legacy)" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            <input placeholder="Dimensions" value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
          </div>
          <input placeholder="Materials" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />

          <div className="border-t border-blush pt-3">
            <div className="text-sm font-medium text-plum-dark mb-1">Showcase Rating (optional)</div>
            <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-2">
              Used only until this product has real customer reviews — once it has at least one approved review, the
              real rating takes over automatically and this is ignored.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <NumberInput min="0" max="5" step="0.1" placeholder="e.g. 4.8" value={form.adminRating} onChange={(e) => setForm({ ...form, adminRating: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
              <NumberInput min="0" placeholder="Showcase review count, e.g. 24" value={form.adminReviewCount} onChange={(e) => setForm({ ...form, adminReviewCount: e.target.value })} className="border border-blush rounded-lg px-3 py-2" />
            </div>
          </div>

          <div className="border-t border-blush pt-3">
            <div className="text-sm font-medium text-plum-dark mb-2">Product Labels (your choice — nothing here is set automatically)</div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.newArrival} onChange={(e) => setForm({ ...form, newArrival: e.target.checked })} /> New Arrival</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.handcrafted} onChange={(e) => setForm({ ...form, handcrafted: e.target.checked })} /> Handcrafted</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.bestseller} onChange={(e) => setForm({ ...form, bestseller: e.target.checked })} /> Bestseller</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.limitedStockLabel} onChange={(e) => setForm({ ...form, limitedStockLabel: e.target.checked })} /> Limited Stock</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.saleLabel} onChange={(e) => setForm({ ...form, saleLabel: e.target.checked })} /> Sale</label>
            </div>
          </div>

          <div className="border-t border-blush pt-3">
            <div className="text-sm font-medium text-plum-dark mb-1">Homepage</div>
            <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-2">
              Controls only the category rows on the homepage. Off doesn't hide the product — it still shows in Shop,
              its category page, and search. A new product is always Off by default and never bumps an
              already-featured product off the homepage.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.homepageVisible} onChange={(e) => setForm({ ...form, homepageVisible: e.target.checked })} /> Show on Homepage
              </label>
              {form.homepageVisible && (
                <label className="flex items-center gap-2">
                  Position
                  <NumberInput
                    value={form.homepagePosition}
                    onChange={(e) => setForm({ ...form, homepagePosition: e.target.value })}
                    className="w-20 border border-blush rounded-lg px-2 py-1"
                  />
                </label>
              )}
            </div>
          </div>

          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-blush rounded-lg px-2 py-1 text-sm">
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="inactive">Inactive</option>
          </select>
          <div>
            <label className="block text-xs text-plum-light/70 mb-1">Base Product Images</label>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} />
            {uploading && <span className="text-xs text-plum-light/60 dark:text-cream/60 ml-2">Uploading...</span>}
            <div className="flex gap-2 mt-2 flex-wrap">
              {(form.images || []).map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.url || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removeBaseImage(i)}
                    title="Delete image"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose text-white text-xs flex items-center justify-center shadow"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================
              FEATURE 1/3 - Color variants
          ============================================================ */}
          <div className="border-t-2 border-plum/20 pt-5 mt-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-display text-lg text-plum dark:text-cream">Color Variants</div>
                <p className="text-xs text-plum-light/70 dark:text-cream/70">
                  Each color below is a fully independent, purchasable version of this product with its own images,
                  price, stock and description. Leave a field blank to fall back to the base product info above.
                </p>
              </div>
              <button type="button" onClick={addVariant} className="btn-outline text-xs whitespace-nowrap">+ Add Color Variant</button>
            </div>

            {form.variants.length === 0 && (
              <p className="text-xs text-plum-light/50 dark:text-cream/50 italic py-3">
                No color variants yet — this product will behave as a single classic item using the base info above.
              </p>
            )}

            <div className="space-y-4">
              {form.variants.map((v, i) => (
                <div key={v._key} className="border border-blush rounded-xl p-4 bg-cream/20">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-plum-dark">Variant {i + 1}{v.colorName ? `: ${v.colorName}` : ""}</span>
                    <button type="button" onClick={() => removeVariant(v._key)} className="text-rose text-xs underline">Remove Variant</button>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3 mb-3">
                    <input required placeholder="Color Name (e.g. Purple)" value={v.colorName} onChange={(e) => updateVariant(v._key, { colorName: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <div className="flex items-center gap-2 border border-blush rounded-lg px-3 py-1.5">
                      <input type="color" value={v.colorHex} onChange={(e) => updateVariant(v._key, { colorHex: e.target.value })} className="w-8 h-8 border-0 bg-transparent cursor-pointer" />
                      <input placeholder="#8B5CF6" value={v.colorHex} onChange={(e) => updateVariant(v._key, { colorHex: e.target.value })} className="flex-1 text-sm outline-none bg-transparent" />
                    </div>
                    <input placeholder="Variant Display Name (optional)" value={v.name} onChange={(e) => updateVariant(v._key, { name: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <div className="grid sm:grid-cols-4 gap-3 mb-3">
                    <NumberInput placeholder="Price" value={v.price} onChange={(e) => updateVariant(v._key, { price: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <NumberInput placeholder="Original / Discount from" value={v.discountPrice} onChange={(e) => updateVariant(v._key, { discountPrice: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <NumberInput placeholder="Stock" value={v.stock} onChange={(e) => updateVariant(v._key, { stock: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <input placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(v._key, { sku: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <textarea placeholder="Variant description (optional — falls back to base description)" value={v.description} onChange={(e) => updateVariant(v._key, { description: e.target.value })} rows={2} className="w-full border border-blush rounded-lg px-3 py-2 text-sm mb-3" />

                  <div className="grid sm:grid-cols-3 gap-3 mb-3">
                    <input placeholder="Materials (optional)" value={v.materials} onChange={(e) => updateVariant(v._key, { materials: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <input placeholder="Dimensions (optional)" value={v.dimensions} onChange={(e) => updateVariant(v._key, { dimensions: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm" />
                    <select value={v.status} onChange={(e) => updateVariant(v._key, { status: e.target.value })} className="border border-blush rounded-lg px-3 py-2 text-sm">
                      <option value="active">Active</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-plum-light/70 mb-1">Variant Images</label>
                    <input type="file" accept="image/*" multiple onChange={(e) => uploadVariantImages(v._key, Array.from(e.target.files || []))} className="text-sm" />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(v.images || []).map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img.url || placeholder} alt="" className="w-12 h-12 rounded-lg object-cover" />
                          <button
                            type="button"
                            onClick={() => removeVariantImage(v._key, idx)}
                            title="Delete image"
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose text-white text-xs flex items-center justify-center shadow"
                          >
                            🗑
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-variant Virtual Try-On asset(s), one per target the category cares about */}
                  {tryOnTargets.length > 0 && (
                    <div className="border-t border-blush/60 mt-3 pt-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-plum-dark mb-2">
                        <input type="checkbox" checked={v.tryOn.enabled} onChange={(e) => updateVariant(v._key, { tryOn: { ...v.tryOn, enabled: e.target.checked } })} />
                        ✨ Enable Virtual Try-On for this color
                      </label>
                      {v.tryOn.enabled && (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {tryOnTargets.map((target) => {
                            const asset = v.tryOn.assets.find((a) => a.target === target);
                            return (
                              <div key={target} className="border border-blush rounded-lg p-3 bg-white">
                                <div className="text-xs font-medium text-plum-dark mb-1 capitalize">{target.replace("_", " + ")} PNG</div>
                                <input type="file" accept="image/png" onChange={(e) => uploadTryOnAsset(v._key, target, e.target.files?.[0])} className="text-xs" />
                                {asset?.image?.url && (
                                  <div className="relative inline-block mt-2">
                                    <img src={asset.image.url} alt="" className="w-16 h-16 object-contain border border-blush rounded bg-cream/40" />
                                    <button
                                      type="button"
                                      onClick={() => removeTryOnAsset(v._key, target)}
                                      title="Delete this try-on image"
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose text-white text-xs flex items-center justify-center shadow"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <NumberInput placeholder="Width (cm)" value={asset?.widthCm || ""} onChange={(e) => updateTryOnAssetDims(v._key, target, "widthCm", e.target.value)} className="border border-blush rounded px-2 py-1 text-xs" />
                                  <NumberInput placeholder="Height (cm)" value={asset?.heightCm || ""} onChange={(e) => updateTryOnAssetDims(v._key, target, "heightCm", e.target.value)} className="border border-blush rounded px-2 py-1 text-xs" />
                                </div>
                                <p className="text-[10px] text-plum-light/50 mt-1">
                                  This is the real, fixed try-on size customers see — they can only adjust position/gap, never resize it.
                                </p>

                                {/* FEATURE 3 - Necklace Vertical Position, neck target only. Ears (and any other
                                    target) keep their existing positioning untouched. */}
                                {target === "neck" && asset?.image?.url && (
                                  <div className="mt-3 pt-2 border-t border-blush/50">
                                    <label className="block text-[11px] font-medium text-plum-dark mb-1">
                                      Necklace Vertical Position <span className="text-plum-light/60">(Y Offset: {asset.yOffset || 0})</span>
                                    </label>
                                    <input
                                      type="range"
                                      min={-50}
                                      max={50}
                                      step={1}
                                      value={asset.yOffset || 0}
                                      onChange={(e) => updateTryOnAssetYOffset(v._key, target, e.target.value)}
                                      className="w-full accent-plum"
                                    />
                                    <div className="flex justify-between text-[10px] text-plum-light/60">
                                      <span>↑ Negative = Move Up</span>
                                      <span>↓ Positive = Move Down</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
            <button className="btn-primary text-sm">{editingId ? "Save Changes" : "Create Product"}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-plum-light/70 dark:text-cream/70 border-b border-blush">
              <th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Rating</th><th>Labels</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-b border-blush/50">
                <td className="p-3 flex items-center gap-2">
                  <img src={p.images?.[0]?.url || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt="" className="w-9 h-9 rounded-lg object-cover" />
                  {p.name}
                  {p.variants?.length > 0 && (
                    <span className="text-[10px] bg-plum/10 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">{p.variants.length} colors</span>
                  )}
                </td>
                <td>{p.category?.name}</td>
                <td>₹{p.price}{p.variants?.length > 0 && "+"}</td>
                <td>
                  {p.variants?.length > 0 ? (
                    <span className="text-plum-light/60 dark:text-cream/60 text-xs">Per variant</span>
                  ) : (
                    <NumberInput
                      defaultValue={p.stock}
                      onBlur={(e) => quickStock(p._id, e.target.value)}
                      className="w-16 border border-blush rounded px-1 py-0.5"
                    />
                  )}
                </td>
                <td className="capitalize">
                  {p.stock === 0 && !p.variants?.length ? <span className="text-rose">Out of Stock</span> : p.status}
                </td>
                <td>
                  {p.effectiveRating > 0 ? (
                    <span>{p.effectiveRating.toFixed(1)} ★ {p.isAdminRating ? <span className="text-[10px] text-plum-light/50 dark:text-cream/50">(set)</span> : `(${p.effectiveReviewCount})`}</span>
                  ) : (
                    <span className="text-plum-light/40 dark:text-cream/40">—</span>
                  )}
                </td>
                <td className="max-w-[180px]">
                  <div className="flex flex-wrap gap-1">
                    {p.homepageVisible && <span className="text-[10px] bg-lavender/30 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">Homepage #{p.homepagePosition}</span>}
                    {p.bestseller && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">Bestseller</span>}
                    {p.featured && <span className="text-[10px] bg-plum/10 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">Featured</span>}
                    {p.newArrival && <span className="text-[10px] bg-rose/10 text-rose px-1.5 py-0.5 rounded-full">New</span>}
                    {p.handcrafted && <span className="text-[10px] bg-lavender/20 text-plum dark:text-cream px-1.5 py-0.5 rounded-full">Handcrafted</span>}
                    {p.limitedStockLabel && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Limited</span>}
                    {p.saleLabel && <span className="text-[10px] bg-rose/20 text-rose px-1.5 py-0.5 rounded-full">Sale</span>}
                  </div>
                </td>
                <td className="space-x-2">
                  <button onClick={() => openEdit(p)} className="text-plum dark:text-cream underline">Edit</button>
                  <button onClick={() => remove(p._id)} className="text-rose underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

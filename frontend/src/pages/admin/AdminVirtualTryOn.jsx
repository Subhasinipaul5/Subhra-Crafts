import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import NumberInput from "../../components/NumberInput";

const TARGET_LABELS = {
  ears: "👂 Ears", neck: "📿 Neck", ears_neck: "👂📿 Ears + Neck", hair: "💇 Hair",
  wrist: "⌚ Wrist", hand: "✋ Hand", table: "🪑 Table / Surface", wall: "🖼️ Wall (Canvas Painting)", face: "🙂 Face", custom: "📦 Custom",
};

// FEATURE 6 - Category-based Virtual Try-On management: pick a category (its AI targets are
// configured in Admin > Categories - see AdminCategories.jsx), pick a product in that category,
// pick which color variant you're configuring (or the product itself if it has no variants),
// then upload one transparent PNG per target the category cares about.
//
// This writes into the SAME data the storefront reads (variant.tryOn / product.tryOn on
// Product.js) - there is no separate/parallel try-on data store, so what you save here is
// exactly what customers see in the Product Details "Virtual Try-On" button.
export default function AdminVirtualTryOn() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(""); // "" = product itself (no variants)
  const [draft, setDraft] = useState({ enabled: false, assets: [] });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/categories?all=true").then((res) => setCategories(res.data)).catch(() => toast.error("Could not load categories"));
    api.get("/products/admin/all").then((res) => setProducts(res.data)).catch(() => toast.error("Could not load products"));
  };
  useEffect(load, []);

  const selectedCategory = useMemo(() => categories.find((c) => c._id === selectedCategoryId), [categories, selectedCategoryId]);
  const targets = selectedCategory?.virtualTryOn?.targets || [];
  const tryOnEnabledForCategory = !!selectedCategory?.virtualTryOn?.enabled;

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter((p) => (p.category?._id || p.category) === selectedCategory._id);
  }, [products, selectedCategory]);

  const selectedProduct = useMemo(() => products.find((p) => p._id === selectedProductId), [products, selectedProductId]);
  const productHasVariants = selectedProduct?.variants?.length > 0;
  const selectedVariant = useMemo(
    () => selectedProduct?.variants?.find((v) => v._id === selectedVariantId),
    [selectedProduct, selectedVariantId]
  );

  const handleCategoryChange = (id) => {
    setSelectedCategoryId(id);
    setSelectedProductId("");
    setSelectedVariantId("");
    setDraft({ enabled: false, assets: [] });
  };

  const handleProductChange = (id) => {
    setSelectedProductId(id);
    const product = products.find((p) => p._id === id);
    if (product?.variants?.length > 0) {
      setSelectedVariantId(product.variants[0]._id);
      setDraft(product.variants[0].tryOn || { enabled: false, assets: [] });
    } else {
      setSelectedVariantId("");
      setDraft(product?.tryOn || { enabled: false, assets: [] });
    }
  };

  const handleVariantChange = (id) => {
    setSelectedVariantId(id);
    const variant = selectedProduct?.variants?.find((v) => v._id === id);
    setDraft(variant?.tryOn || { enabled: false, assets: [] });
  };

  const uploadAsset = async (target, file) => {
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("Please upload a transparent PNG image.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const uploaded = res.data.images[0];
      setDraft((d) => {
        const assets = [...(d.assets || [])];
        const idx = assets.findIndex((a) => a.target === target);
        const next = { target, image: uploaded, widthCm: assets[idx]?.widthCm || 0, heightCm: assets[idx]?.heightCm || 0 };
        if (idx >= 0) assets[idx] = next; else assets.push(next);
        return { ...d, assets };
      });
    } catch {
      toast.error("Could not upload the try-on image");
    } finally {
      setUploading(false);
    }
  };

  const updateDims = (target, field, value) => {
    setDraft((d) => ({
      ...d,
      assets: (d.assets || []).map((a) => (a.target === target ? { ...a, [field]: Number(value) || 0 } : a)),
    }));
  };

  // FEATURE 2 - delete a single try-on PNG (e.g. just the Ears image, keeping Neck untouched).
  const removeAsset = async (target) => {
    if (!confirm("Permanently delete this Virtual Try-On image?")) return;
    const asset = (draft.assets || []).find((a) => a.target === target);
    setDraft((d) => ({ ...d, assets: (d.assets || []).filter((a) => a.target !== target) }));
    if (asset?.image?.publicId) {
      try {
        await api.delete("/upload", { data: { publicId: asset.image.publicId } });
      } catch {
        toast.error("Removed from the draft, but the file may still exist in storage.");
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCategory) return toast.error("Please select a category.");
    if (!tryOnEnabledForCategory) return toast.error("Virtual Try-On is disabled for this category. Enable it from Admin → Categories.");
    if (!selectedProduct) return toast.error("Please select a product.");
    if (productHasVariants && !selectedVariantId) return toast.error("Please select a color variant.");
    if (draft.enabled && (!draft.assets || draft.assets.length === 0)) {
      return toast.error("Upload at least one try-on PNG before enabling.");
    }

    setSaving(true);
    try {
      if (productHasVariants) {
        const variants = selectedProduct.variants.map((v) => (v._id === selectedVariantId ? { ...v, tryOn: draft } : v));
        await api.put(`/products/${selectedProduct._id}`, { variants });
      } else {
        await api.put(`/products/${selectedProduct._id}`, { tryOn: draft });
      }
      toast.success("Virtual Try-On settings saved successfully.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save Virtual Try-On settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-plum dark:text-cream">Virtual Try-On</h1>
        <p className="mt-2 text-sm text-plum-light/70 dark:text-cream/60 max-w-3xl">
          Configure AI Virtual Try-On per product color. What the AI should detect (ears, neck, wrist...) is decided
          once per category in <strong>Admin → Categories</strong>; here you just upload the transparent product PNG(s)
          and real-world size for each color.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-card border border-blush p-5 md:p-7 space-y-6">
        {/* STEP 1 */}
        <div>
          <label className="block text-sm font-medium text-plum mb-2">Step 1 — Select Category</label>
          <select value={selectedCategoryId} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full border border-blush rounded-xl px-4 py-3 bg-white">
            <option value="">Select category</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        {selectedCategory && (
          <div className="border border-blush rounded-xl p-5 bg-cream/30 text-sm space-y-1">
            <div>Virtual Try-On: <strong>{tryOnEnabledForCategory ? "Enabled" : "Disabled"}</strong></div>
            <div>Product Type: <strong>{selectedCategory.virtualTryOn?.productType || "custom"}</strong></div>
            <div>Detection Target(s): <strong>{targets.length ? targets.map((t) => TARGET_LABELS[t] || t).join(", ") : "None selected"}</strong></div>
            {!tryOnEnabledForCategory && (
              <p className="text-red-500 mt-2">Enable Virtual Try-On for this category from Admin → Categories first.</p>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {tryOnEnabledForCategory && (
          <div>
            <label className="block text-sm font-medium text-plum mb-2">Step 2 — Select Product</label>
            <select value={selectedProductId} onChange={(e) => handleProductChange(e.target.value)} disabled={!selectedCategory} className="w-full border border-blush rounded-xl px-4 py-3 bg-white disabled:opacity-50">
              <option value="">{selectedCategory ? "Select product" : "Select category first"}</option>
              {categoryProducts.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {/* STEP 3 */}
        {selectedProduct && productHasVariants && (
          <div>
            <label className="block text-sm font-medium text-plum mb-2">Step 3 — Select Color Variant</label>
            <select value={selectedVariantId} onChange={(e) => handleVariantChange(e.target.value)} className="w-full border border-blush rounded-xl px-4 py-3 bg-white">
              {selectedProduct.variants.map((v) => <option key={v._id} value={v._id}>{v.colorName}</option>)}
            </select>
          </div>
        )}
        {selectedProduct && !productHasVariants && (
          <p className="text-xs text-plum-light/70 dark:text-cream/70">
            This product has no color variants, so Virtual Try-On is configured for the product itself.
          </p>
        )}

        {/* STEP 4 - upload assets */}
        {selectedProduct && (!productHasVariants || selectedVariantId) && (
          <div className="border border-blush rounded-2xl p-5">
            <label className="flex items-center gap-3 cursor-pointer mb-5">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} className="w-5 h-5" />
              <div>
                <div className="font-medium text-plum">Enable Virtual Try-On</div>
                <div className="text-xs text-plum-light/60">Customers will see the "✨ Virtual Try-On" button for this {productHasVariants ? "color" : "product"}.</div>
              </div>
            </label>

            <h3 className="font-display text-lg text-plum mb-3">Step 4 — Upload Try-On PNG{targets.length > 1 ? "s" : ""}</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {targets.map((target) => {
                const asset = (draft.assets || []).find((a) => a.target === target);
                return (
                  <div key={target} className="border border-blush rounded-xl p-4">
                    <div className="text-sm font-medium text-plum mb-2">{TARGET_LABELS[target] || target}</div>
                    <input type="file" accept="image/png" onChange={(e) => uploadAsset(target, e.target.files?.[0])} className="text-sm" />
                    {asset?.image?.url && (
                      <div className="relative inline-block mt-3">
                        <div className="w-28 h-28 border border-blush rounded-xl bg-white flex items-center justify-center p-2">
                          <img src={asset.image.url} alt="" className="max-w-full max-h-full object-contain" />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAsset(target)}
                          title="Delete this image"
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose text-white text-xs flex items-center justify-center shadow"
                        >
                          🗑
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs text-plum-light mb-1">Width (cm)</label>
                        <NumberInput min="0.1" step="0.1" value={asset?.widthCm || ""} onChange={(e) => updateDims(target, "widthCm", e.target.value)} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-plum-light mb-1">Height (cm)</label>
                        <NumberInput min="0.1" step="0.1" value={asset?.heightCm || ""} onChange={(e) => updateDims(target, "heightCm", e.target.value)} className="w-full border border-blush rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <p className="text-[10px] text-plum-light/50 mt-1">
                      This is the real, fixed try-on size customers see — they can only adjust position/gap in their own preview, never resize it.
                    </p>

                    {/* FEATURE 3 - Necklace Vertical Position, neck target only. */}
                    {target === "neck" && asset?.image?.url && (
                      <div className="mt-3 pt-3 border-t border-blush/50">
                        <label className="block text-xs font-medium text-plum-dark mb-1">
                          Necklace Vertical Position <span className="text-plum-light/60">(Y Offset: {asset.yOffset || 0})</span>
                        </label>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          step={1}
                          value={asset.yOffset || 0}
                          onChange={(e) => updateDims(target, "yOffset", e.target.value)}
                          className="w-full accent-plum"
                        />
                        <div className="flex justify-between text-[10px] text-plum-light/60">
                          <span>↑ Negative = Move Up</span>
                          <span>↓ Positive = Move Down</span>
                        </div>
                        <p className="text-[10px] text-plum-light/50 mt-1">This only nudges vertical position — width/height and horizontal centering are unaffected.</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {targets.length === 0 && (
                <p className="text-xs text-rose">This category has no detection targets selected yet — set them in Admin → Categories.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || uploading || !selectedProduct} className="btn-primary disabled:opacity-50">
            {uploading ? "Uploading..." : saving ? "Saving..." : "Save Try-On Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

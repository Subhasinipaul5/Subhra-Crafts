import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";
import NumberInput from "../../components/NumberInput";

// Category-wise picker for the homepage's per-category rows (see Home.jsx's "Latest Jewelry
// Pieces" section). This is deliberately a separate page from Admin > Products: picking
// homepage products is a "browse one category, choose a handful" task, not a "find one product
// and edit its details" task, and doing it here means the admin never has to open 100 individual
// product forms one at a time to curate a single category row.
//
// Reuses the existing endpoints rather than adding new ones:
//   GET  /products/admin/all?category=<id>   (already supports this filter)
//   PUT  /products/:id { homepageVisible, homepagePosition }   (already accepts these fields)
const emptyNavSettings = { maxVisible: 4, allCategoriesImages: [], slideshow: { intervalSeconds: 3, pauseOnHover: true } };

export default function AdminHomepage() {
  const [categories, setCategories] = useState([]);
  const [openCat, setOpenCat] = useState(null);
  const [productsByCat, setProductsByCat] = useState({}); // catId -> locally-editable product list
  const [loadingCat, setLoadingCat] = useState(null);
  const [savingCat, setSavingCat] = useState(null);

  // ===== Navbar Categories (which categories appear in the "Categories" mega-menu, how many
  // before it falls back to "All Categories", and that tile's own slideshow image) =====
  const [navOpen, setNavOpen] = useState(false);
  const [navCats, setNavCats] = useState([]); // local editable copy of {_id, name, navbarVisible, navbarPosition}
  const [navSettings, setNavSettings] = useState(emptyNavSettings);
  const [navUploading, setNavUploading] = useState(false);
  const [navSaving, setNavSaving] = useState(false);

  // ===== Featured Categories (which categories appear in Home.jsx's "Featured Categories" row,
  // and in what order) - reuses Category.featured/Category.order, the same fields the homepage
  // query and the rest of the admin already read/write; nothing new was added to the data model
  // for this. Deliberately a separate accordion from Navbar Categories above even though both
  // edit "categories" - they control two different, unrelated parts of the site (the homepage
  // grid vs. the navbar dropdown), same as each individual category's own product-picker below
  // is its own accordion.
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [featuredCats, setFeaturedCats] = useState([]); // local editable copy of {_id, name, featured, order}
  const [featuredSaving, setFeaturedSaving] = useState(false);

  useEffect(() => {
    api.get("/categories?all=true").then((res) => {
      setCategories(res.data);
      setNavCats(res.data.map((c) => ({ _id: c._id, name: c.name, navbarVisible: c.navbarVisible !== false, navbarPosition: c.navbarPosition || 0 })));
      setFeaturedCats(res.data.map((c) => ({ _id: c._id, name: c.name, featured: !!c.featured, order: c.order || 0 })));
    });
    api.get("/settings").then((res) => {
      if (res.data.navbarCategories) setNavSettings(res.data.navbarCategories);
    });
  }, []);

  const toggleNavVisible = (id) => {
    setNavCats((list) => list.map((c) => (c._id === id ? { ...c, navbarVisible: !c.navbarVisible } : c)));
  };
  const setNavPosition = (id, value) => {
    setNavCats((list) => list.map((c) => (c._id === id ? { ...c, navbarPosition: value } : c)));
  };

  const handleNavImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = 10 - navSettings.allCategoriesImages.length;
    if (remainingSlots <= 0) {
      toast.error("At most 10 images are allowed — remove one before adding another.");
      e.target.value = "";
      return;
    }
    const filesToUpload = files.slice(0, remainingSlots);
    setNavUploading(true);
    try {
      const formData = new FormData();
      filesToUpload.forEach((f) => formData.append("images", f));
      const res = await api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setNavSettings((s) => ({ ...s, allCategoriesImages: [...s.allCategoriesImages, ...res.data.images] }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setNavUploading(false);
      e.target.value = "";
    }
  };

  const removeNavImage = async (idx) => {
    const img = navSettings.allCategoriesImages[idx];
    if (img?.publicId) {
      try {
        await api.delete("/upload", { data: { publicId: img.publicId } });
      } catch {
        // Best-effort, same as the category gallery.
      }
    }
    setNavSettings((s) => ({ ...s, allCategoriesImages: s.allCategoriesImages.filter((_, i) => i !== idx) }));
  };

  const saveNavCategories = async () => {
    setNavSaving(true);
    try {
      await Promise.all(
        navCats.map((c) => api.put(`/categories/${c._id}`, { navbarVisible: c.navbarVisible, navbarPosition: Number(c.navbarPosition) || 0 }))
      );
      await api.put("/settings/navbar-categories", navSettings);
      toast.success("Navbar Categories saved");
      setCategories((prev) => prev.map((c) => {
        const edited = navCats.find((n) => n._id === c._id);
        return edited ? { ...c, navbarVisible: edited.navbarVisible, navbarPosition: edited.navbarPosition } : c;
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save Navbar Categories");
    } finally {
      setNavSaving(false);
    }
  };

  const toggleFeatured = (id) => {
    setFeaturedCats((list) => list.map((c) => (c._id === id ? { ...c, featured: !c.featured } : c)));
  };
  const setFeaturedOrder = (id, value) => {
    setFeaturedCats((list) => list.map((c) => (c._id === id ? { ...c, order: value } : c)));
  };

  const saveFeaturedCategories = async () => {
    const selectedCount = featuredCats.filter((c) => c.featured).length;
    if (selectedCount > 6) {
      toast.error(`Only 6 categories can be featured at once — ${selectedCount} are currently selected. Unselect some before saving.`);
      return;
    }
    setFeaturedSaving(true);
    try {
      await Promise.all(
        featuredCats.map((c) => api.put(`/categories/${c._id}`, { featured: c.featured, order: Number(c.order) || 0 }))
      );
      toast.success("Featured Categories saved");
      setCategories((prev) => prev.map((c) => {
        const edited = featuredCats.find((f) => f._id === c._id);
        return edited ? { ...c, featured: edited.featured, order: edited.order } : c;
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save Featured Categories");
    } finally {
      setFeaturedSaving(false);
    }
  };

  const openCategory = async (catId) => {
    if (openCat === catId) {
      setOpenCat(null);
      return;
    }
    setOpenCat(catId);
    if (productsByCat[catId]) return; // already loaded this session
    setLoadingCat(catId);
    try {
      const res = await api.get("/products/admin/all", { params: { category: catId } });
      setProductsByCat((m) => ({
        ...m,
        [catId]: res.data.map((p) => ({
          _id: p._id,
          name: p.name,
          image: p.images?.[0]?.url || "",
          status: p.status,
          homepageVisible: !!p.homepageVisible,
          homepagePosition: p.homepagePosition || 0,
        })),
      }));
    } catch {
      toast.error("Could not load products for this category");
      setOpenCat(null);
    } finally {
      setLoadingCat(null);
    }
  };

  const toggleVisible = (catId, productId) => {
    setProductsByCat((m) => {
      const list = m[catId];
      const highestPosition = Math.max(0, ...list.filter((x) => x.homepageVisible).map((x) => x.homepagePosition));
      return {
        ...m,
        [catId]: list.map((p) => {
          if (p._id !== productId) return p;
          const nowVisible = !p.homepageVisible;
          // Turning one on for the first time: default it to the end of the current lineup so
          // the admin isn't forced to type a position just to add one more product.
          const nextPosition = nowVisible && !p.homepagePosition ? highestPosition + 1 : p.homepagePosition;
          return { ...p, homepageVisible: nowVisible, homepagePosition: nextPosition };
        }),
      };
    });
  };

  const setPosition = (catId, productId, value) => {
    setProductsByCat((m) => ({
      ...m,
      [catId]: m[catId].map((p) => (p._id === productId ? { ...p, homepagePosition: value } : p)),
    }));
  };

  const saveCategory = async (catId) => {
    setSavingCat(catId);
    try {
      const products = productsByCat[catId];
      await Promise.all(
        products.map((p) =>
          api.put(`/products/${p._id}`, {
            homepageVisible: p.homepageVisible,
            homepagePosition: Number(p.homepagePosition) || 0,
          })
        )
      );
      toast.success("Homepage selection saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save homepage selection");
    } finally {
      setSavingCat(null);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-2">Homepage Management</h1>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-6">
        Choose exactly which products appear in each category's row on the homepage, and in what order. Turning a
        product Off here doesn't hide it anywhere else — it still shows in Shop, its category page, and search. A
        category you haven't curated yet shows its newest products automatically so the homepage is never empty;
        the moment you pick anything here, your selection takes over completely.
      </p>

      {/* ===== NAVBAR CATEGORIES ===== */}
      <div className="bg-white rounded-xl2 shadow-card border border-blush mb-8">
        <button onClick={() => setNavOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="font-medium text-plum-dark">Navbar Categories</span>
          <span className="text-xs text-plum-light/60 dark:text-cream/60">{navOpen ? "▲" : "▼"}</span>
        </button>
        {navOpen && (
          <div className="border-t border-blush p-4 space-y-6">
            <p className="text-sm text-plum-light/70 dark:text-cream/70">
              Choose which categories appear in the "Categories" dropdown in the navbar, their order, and how many
              show as columns. Turning a category off here only hides it from the navbar dropdown — it's still
              fully browsable everywhere else on the site. The "All Categories" tile is always shown alongside them
              as a permanent link to the full list, however many columns you choose.
            </p>

            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Categories shown in navbar</label>
              <div className="border border-blush rounded-lg divide-y divide-blush/60">
                {navCats.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 flex-1">
                      <input type="checkbox" checked={c.navbarVisible} onChange={() => toggleNavVisible(c._id)} />
                      {c.name}
                    </label>
                    {c.navbarVisible && (
                      <NumberInput
                        value={c.navbarPosition}
                        onChange={(e) => setNavPosition(c._id, e.target.value)}
                        title="Position — lower shows first"
                        className="w-14 border border-blush rounded-lg px-1.5 py-1 text-xs shrink-0"
                      />
                    )}
                  </div>
                ))}
                {navCats.length === 0 && <div className="px-3 py-2 text-xs text-plum-light/50 italic">No categories yet.</div>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
                Category columns to show
              </label>
              <NumberInput
                min="1"
                max="12"
                value={navSettings.maxVisible}
                onChange={(e) => setNavSettings((s) => ({ ...s, maxVisible: Number(e.target.value) || 1 }))}
                className="w-24 border border-blush rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
                "All Categories" tile image ({navSettings.allCategoriesImages.length}/10)
              </label>
              <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-2">
                With 2+ images, this tile cycles through them on its own — pausing on whichever image is showing
                while the mouse is over it, and resuming once the mouse moves away.
              </p>
              <input type="file" accept="image/*" multiple onChange={handleNavImageUpload} disabled={navUploading || navSettings.allCategoriesImages.length >= 10} />
              {navUploading && <span className="text-xs text-plum-light/60 ml-2">Uploading...</span>}
              {navSettings.allCategoriesImages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {navSettings.allCategoriesImages.map((img, idx) => (
                    <div key={img.publicId || img.url} className="relative group">
                      <img src={img.url} alt={`All Categories tile ${idx + 1}`} className="w-24 h-20 object-cover rounded-lg border border-blush" />
                      <button
                        type="button"
                        onClick={() => removeNavImage(idx)}
                        title="Delete this image"
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {navSettings.allCategoriesImages.length > 1 && (
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-plum dark:text-cream mb-1">Seconds Per Image</label>
                    <NumberInput
                      min="1"
                      max="15"
                      value={navSettings.slideshow.intervalSeconds}
                      onChange={(e) => setNavSettings((s) => ({ ...s, slideshow: { ...s.slideshow, intervalSeconds: Number(e.target.value) || 1 } }))}
                      className="w-full border border-blush rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-6">
                    <input
                      type="checkbox"
                      checked={navSettings.slideshow.pauseOnHover}
                      onChange={(e) => setNavSettings((s) => ({ ...s, slideshow: { ...s.slideshow, pauseOnHover: e.target.checked } }))}
                    />
                    Pause on hover
                  </label>
                </div>
              )}
            </div>

            <button onClick={saveNavCategories} disabled={navSaving} className="btn-primary text-sm">
              {navSaving ? "Saving..." : "Save Navbar Categories"}
            </button>
          </div>
        )}
      </div>

      {/* ===== FEATURED CATEGORIES ===== */}
      <div className="bg-white rounded-xl2 shadow-card border border-blush mb-8">
        <button onClick={() => setFeaturedOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <span className="font-medium text-plum-dark">Featured Categories</span>
          <span className="text-xs text-plum-light/60 dark:text-cream/60">{featuredOpen ? "▲" : "▼"}</span>
        </button>
        {featuredOpen && (
          <div className="border-t border-blush p-4 space-y-6">
            <p className="text-sm text-plum-light/70 dark:text-cream/70">
              Choose which categories appear in the homepage's "Featured Categories" row, and their order. Up to 6 can be featured at once — they
              always display in a single row that never wraps, scrolling horizontally on narrower screens if needed. Unchecked categories are
              still fully browsable everywhere else on the site.
            </p>

            <div>
              <label className="block text-sm font-medium text-plum dark:text-cream mb-2">Categories featured on the homepage</label>
              <div className="border border-blush rounded-lg divide-y divide-blush/60">
                {featuredCats.map((c) => (
                  <div key={c._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 flex-1">
                      <input type="checkbox" checked={c.featured} onChange={() => toggleFeatured(c._id)} />
                      {c.name}
                    </label>
                    {c.featured && (
                      <NumberInput
                        value={c.order}
                        onChange={(e) => setFeaturedOrder(c._id, e.target.value)}
                        title="Order — lower shows first"
                        className="w-14 border border-blush rounded-lg px-1.5 py-1 text-xs shrink-0"
                      />
                    )}
                  </div>
                ))}
                {featuredCats.length === 0 && <div className="px-3 py-2 text-xs text-plum-light/50 italic">No categories yet.</div>}
              </div>
            </div>

            <button onClick={saveFeaturedCategories} disabled={featuredSaving} className="btn-primary text-sm">
              {featuredSaving ? "Saving..." : "Save Featured Categories"}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {categories.map((cat) => {
          const products = productsByCat[cat._id];
          const visibleCount = products ? products.filter((p) => p.homepageVisible).length : null;
          return (
            <div key={cat._id} className="bg-white rounded-xl2 shadow-card border border-blush">
              <button onClick={() => openCategory(cat._id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="font-medium text-plum-dark">{cat.name}</span>
                <span className="text-xs text-plum-light/60 dark:text-cream/60 flex items-center gap-2">
                  {visibleCount !== null && (
                    <span>{visibleCount > 0 ? `${visibleCount} shown on homepage` : "using newest products (not curated yet)"}</span>
                  )}
                  {openCat === cat._id ? "▲" : "▼"}
                </span>
              </button>

              {openCat === cat._id && (
                <div className="border-t border-blush p-4">
                  {loadingCat === cat._id && <div className="text-sm text-plum-light/60">Loading products...</div>}
                  {products && products.length === 0 && (
                    <div className="text-sm text-plum-light/60 italic">No products in this category yet.</div>
                  )}
                  {products && products.length > 0 && (
                    <>
                      {visibleCount > 6 && (
                        <p className="text-xs text-gold mb-3">
                          {visibleCount} products selected — for a tidy homepage row, 4–6 usually looks best.
                        </p>
                      )}
                      <div className="grid sm:grid-cols-2 gap-3 mb-4">
                        {products.map((p) => (
                          <div key={p._id} className="flex items-center gap-3 border border-blush/60 rounded-lg px-3 py-2">
                            <img
                              src={p.image || placeholder}
                              onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
                              alt=""
                              className="w-10 h-10 rounded-md object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate text-plum-dark">{p.name}</div>
                              {p.status !== "active" && <div className="text-[10px] text-plum-light/50 capitalize">{p.status}</div>}
                            </div>
                            <label className="flex items-center gap-1 text-xs shrink-0">
                              <input type="checkbox" checked={p.homepageVisible} onChange={() => toggleVisible(cat._id, p._id)} />
                              Show
                            </label>
                            {p.homepageVisible && (
                              <NumberInput
                                value={p.homepagePosition}
                                onChange={(e) => setPosition(cat._id, p._id, e.target.value)}
                                title="Position — lower shows first"
                                className="w-14 border border-blush rounded-lg px-1.5 py-1 text-xs shrink-0"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-xs text-plum-light/60 dark:text-cream/60">Lower position number shows first.</p>
                        <button onClick={() => saveCategory(cat._id)} disabled={savingCat === cat._id} className="btn-primary text-sm shrink-0">
                          {savingCat === cat._id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && <div className="text-sm text-plum-light/60">No categories yet.</div>}
      </div>
    </div>
  );
}

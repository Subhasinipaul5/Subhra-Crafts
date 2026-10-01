import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import placeholder from "../../assets/placeholder.svg";
import NumberInput from "../../components/NumberInput";

const emptyForm = {
  name: "",
  description: "",
  order: 0,
  featured: false,
  active: true,
  image: {
    url: "",
    publicId: "",
  },
  // Up to 10 images for the hover slideshow (index 0 doubles as the legacy cover image - see
  // Category.js's pre-save hook, which keeps `image` synced to images[0] automatically).
  images: [],
  slideshow: {
    transition: "fade",
    durationSeconds: 2,
  },

  // ============================
  // VIRTUAL TRY-ON SETTINGS
  // ============================
  virtualTryOn: {
    enabled: false,
    targets: [],
    productType: "custom",
  },
};

const productTypeTargets = {
  earrings: ["ears"],
  necklace: ["neck"],
  earrings_necklace_set: ["ears", "neck"],
  backclip: ["hair"],
  rakhi: ["wrist"],
  photoframe: ["table"],
  // Prepared for the future Canvas Paintings category (see AdminVirtualTryOn.jsx /
  // VirtualTryOn.jsx ManualAdapter) - "wall" uses the same manual drag/resize/rotate fallback
  // already built for any target without a shipped AI landmark model.
  canvas_painting: ["wall"],
  custom: [],
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  // ==========================================
  // LOAD CATEGORIES
  // ==========================================

  const load = () => {
    api
      .get("/categories?all=true")
      .then((res) => setCategories(res.data))
      .catch(() => toast.error("Could not load categories"));
  };

  useEffect(() => {
    load();
  }, []);

  // ==========================================
  // OPEN NEW CATEGORY
  // ==========================================

  const openNew = () => {
    setForm({
      ...emptyForm,
      virtualTryOn: {
        enabled: false,
        targets: [],
        productType: "custom",
      },
    });

    setEditingId(null);
    setShowForm(true);
  };

  // ==========================================
  // OPEN EDIT CATEGORY
  // ==========================================

  const openEdit = (c) => {
    setForm({
      name: c.name || "",
      description: c.description || "",
      order: c.order || 0,
      featured: c.featured || false,
      active: c.active !== false,

      image: c.image || {
        url: "",
        publicId: "",
      },

      // Migrates a legacy single-image category into the gallery automatically the first time
      // it's opened here - the admin sees their existing image already in the list, not an
      // empty gallery.
      images: c.images?.length > 0 ? c.images : c.image?.url ? [c.image] : [],
      slideshow: c.slideshow || { transition: "fade", durationSeconds: 2 },

      virtualTryOn: c.virtualTryOn || {
        enabled: false,
        targets: [],
        productType: "custom",
      },
    });

    setEditingId(c._id);
    setShowForm(true);
  };

  // ==========================================
  // IMAGE UPLOAD
  // ==========================================

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    const remainingSlots = 10 - form.images.length;
    if (remainingSlots <= 0) {
      toast.error("A category can have at most 10 images — remove one before adding another.");
      e.target.value = "";
      return;
    }
    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > filesToUpload.length) {
      toast.error(`Only ${remainingSlots} more image(s) can be added (10 max) — uploading the first ${filesToUpload.length}.`);
    }

    setUploading(true);

    try {
      const formData = new FormData();

      filesToUpload.forEach((f) => formData.append("images", f));

      const res = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...res.data.images],
      }));

      toast.success(filesToUpload.length > 1 ? "Category images uploaded" : "Category image uploaded");
    } catch (error) {
      console.error(error);
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Permanently removes one image from the category's gallery. Best-effort on the storage side:
  // even if the Cloudinary delete fails (e.g. the file's already gone), the image still comes
  // out of the form below so the admin is never stuck unable to detach a wrong image.
  const removeGalleryImage = async (idx) => {
    const img = form.images[idx];
    if (!confirm("Permanently delete this image?")) return;
    if (img?.publicId) {
      try {
        await api.delete("/upload", { data: { publicId: img.publicId } });
      } catch {
        toast.error("Removed from the category, but the file may still exist in storage.");
      }
    }
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  };

  const moveGalleryImage = (idx, direction) => {
    setForm((prev) => {
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= prev.images.length) return prev;
      const next = [...prev.images];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...prev, images: next };
    });
  };

  // ==========================================
  // CHANGE VIRTUAL TRY-ON ENABLE
  // ==========================================

  const handleVirtualTryOnEnable = (enabled) => {
    setForm((prev) => ({
      ...prev,

      virtualTryOn: {
        ...prev.virtualTryOn,
        enabled,
      },
    }));
  };

  // ==========================================
  // CHANGE PRODUCT TYPE
  // ==========================================

  const handleProductTypeChange = (productType) => {
    const automaticTargets =
      productTypeTargets[productType] || [];

    setForm((prev) => ({
      ...prev,

      virtualTryOn: {
        ...prev.virtualTryOn,
        productType,
        targets: automaticTargets,
      },
    }));
  };

  // ==========================================
  // CHANGE TARGET
  // ==========================================

  const toggleTarget = (target) => {
    setForm((prev) => {
      const currentTargets =
        prev.virtualTryOn?.targets || [];

      const alreadySelected =
        currentTargets.includes(target);

      const newTargets = alreadySelected
        ? currentTargets.filter(
            (item) => item !== target
          )
        : [...currentTargets, target];

      return {
        ...prev,

        virtualTryOn: {
          ...prev.virtualTryOn,
          targets: newTargets,
        },
      };
    });
  };

  // ==========================================
  // SAVE CATEGORY
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingId) {
        await api.put(
          `/categories/${editingId}`,
          form
        );

        toast.success("Category updated");
      } else {
        await api.post("/categories", form);

        toast.success(
          "Category created — it will appear on the site immediately"
        );
      }

      setShowForm(false);
      setEditingId(null);

      load();
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message ||
          "Could not save category"
      );
    }
  };

  // ==========================================
  // DELETE CATEGORY
  // ==========================================

  const remove = async (id) => {
    if (!confirm("Delete this category?")) return;

    try {
      await api.delete(`/categories/${id}`);

      toast.success("Category deleted");

      load();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Could not delete category"
      );
    }
  };

  // ==========================================
  // ACTIVE / HIDDEN
  // ==========================================

  const toggleActive = async (c) => {
    try {
      await api.put(`/categories/${c._id}`, {
        active: !c.active,
      });

      load();
    } catch {
      toast.error("Could not update category");
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div>

      {/* ======================================
          HEADER
      ====================================== */}

      <div className="flex items-center justify-between mb-6">

        <h1 className="font-display text-3xl text-plum dark:text-cream">
          Categories
        </h1>

        <button
          onClick={openNew}
          className="btn-primary text-sm"
        >
          + Add Category
        </button>

      </div>


      {/* ======================================
          CATEGORY FORM
      ====================================== */}

      {showForm && (

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#24152f] rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-5"
        >

          <h3 className="font-display text-xl text-plum dark:text-cream">
            {editingId
              ? "Edit Category"
              : "New Category"}
          </h3>


          {/* CATEGORY NAME */}

          <div>

            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
              Category Name
            </label>

            <input
              required
              placeholder="Example: Resin Trays"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              className="w-full border border-blush rounded-lg px-3 py-2"
            />

          </div>


          {/* DESCRIPTION */}

          <div>

            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
              Description
            </label>

            <textarea
              placeholder="Category description"
              value={form.description}
              onChange={(e) =>
                setForm({
                  ...form,
                  description: e.target.value,
                })
              }
              rows={2}
              className="w-full border border-blush rounded-lg px-3 py-2"
            />

          </div>


          {/* ORDER / FEATURED / ACTIVE */}

          <div className="grid sm:grid-cols-3 gap-3 items-center">

            <NumberInput
              placeholder="Display Order"
              value={form.order}
              onChange={(e) =>
                setForm({
                  ...form,
                  order: Number(e.target.value),
                })
              }
              className="border border-blush rounded-lg px-3 py-2"
            />


            <label className="flex items-center gap-2 text-sm text-plum dark:text-cream">

              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({
                    ...form,
                    featured: e.target.checked,
                  })
                }
              />

              Feature on Homepage

            </label>


            <label className="flex items-center gap-2 text-sm text-plum dark:text-cream">

              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({
                    ...form,
                    active: e.target.checked,
                  })
                }
              />

              Active

            </label>

          </div>


          {/* CATEGORY IMAGES */}

          <div>

            <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
              Category Images ({form.images.length}/10)
            </label>

            <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-2">
              The first image is the card's resting image. Add 2 or more and customers will see them cycle through
              as a slideshow when they hover over this category on the site.
            </p>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={uploading || form.images.length >= 10}
            />

            {uploading && (
              <span className="text-xs text-plum-light/60 ml-2">
                Uploading...
              </span>
            )}

            {form.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {form.images.map((img, idx) => (
                  <div key={img.publicId || img.url} className="relative group">
                    <img
                      src={img.url}
                      alt={`Category image ${idx + 1}`}
                      className={`w-24 h-20 object-cover rounded-lg border ${idx === 0 ? "border-rose" : "border-blush"}`}
                    />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 text-[9px] bg-rose text-white px-1.5 py-0.5 rounded-full">Cover</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(idx)}
                      title="Delete this image"
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveGalleryImage(idx, -1)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        disabled={idx === form.images.length - 1}
                        onClick={() => moveGalleryImage(idx, 1)}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SLIDESHOW SETTINGS - only meaningful once there's something to slide between */}

            {form.images.length > 1 && (
              <div className="mt-4 border-t border-blush pt-3 grid sm:grid-cols-2 gap-3">

                <div>
                  <label className="block text-xs font-medium text-plum dark:text-cream mb-1">
                    Slideshow Transition
                  </label>
                  <select
                    value={form.slideshow.transition}
                    onChange={(e) =>
                      setForm({ ...form, slideshow: { ...form.slideshow, transition: e.target.value } })
                    }
                    className="w-full border border-blush rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="fade">Fade</option>
                    <option value="slide-left">Slide (right → left)</option>
                    <option value="slide-right">Slide (left → right)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-plum dark:text-cream mb-1">
                    Seconds Per Image
                  </label>
                  <NumberInput
                    min="1"
                    max="15"
                    value={form.slideshow.durationSeconds}
                    onChange={(e) =>
                      setForm({ ...form, slideshow: { ...form.slideshow, durationSeconds: Number(e.target.value) || 1 } })
                    }
                    className="w-full border border-blush rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <p className="text-xs text-plum-light/60 dark:text-cream/60 sm:col-span-2">
                  Customers only see this while hovering the category card — it stays on the cover image otherwise.
                </p>

              </div>
            )}

          </div>


          {/* ======================================
              AI VIRTUAL TRY-ON
          ====================================== */}

          <div className="border-t border-blush pt-6">

            <h3 className="font-display text-2xl text-plum dark:text-cream">
              ✨ AI Virtual Try-On
            </h3>

            <p className="text-sm text-plum-light/70 dark:text-cream/70 mt-1 mb-5">
              Configure what the AI should detect when
              customers use Virtual Try-On for this category.
            </p>


            {/* ENABLE VIRTUAL TRY-ON */}

            <label className="flex items-start gap-3 cursor-pointer mb-6">

              <input
                type="checkbox"
                checked={
                  form.virtualTryOn?.enabled || false
                }
                onChange={(e) =>
                  handleVirtualTryOnEnable(
                    e.target.checked
                  )
                }
                className="w-5 h-5 mt-1"
              />

              <div>

                <div className="font-medium text-plum dark:text-cream">
                  Enable Virtual Try-On
                </div>

                <div className="text-xs text-plum-light/70 dark:text-cream/70">
                  Customers will be able to click
                  "Try It On" on products from this category.
                </div>

              </div>

            </label>


            {/* ONLY SHOW SETTINGS WHEN ENABLED */}

            {form.virtualTryOn?.enabled && (

              <div className="space-y-6">


                {/* PRODUCT TYPE */}

                <div>

                  <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
                    Product Type
                  </label>

                  <select
                    value={
                      form.virtualTryOn?.productType ||
                      "custom"
                    }
                    onChange={(e) =>
                      handleProductTypeChange(
                        e.target.value
                      )
                    }
                    className="w-full border border-blush rounded-lg px-3 py-3"
                  >

                    <option value="custom">
                      Custom
                    </option>

                    <option value="earrings">
                      Earrings
                    </option>

                    <option value="necklace">
                      Necklace
                    </option>

                    <option value="earrings_necklace_set">
                      Earrings + Necklace Set
                    </option>

                    <option value="backclip">
                      Backclip
                    </option>

                    <option value="rakhi">
                      Rakhi
                    </option>

                    <option value="photoframe">
                      Photoframe
                    </option>

                    <option value="canvas_painting">
                      Canvas Painting (coming soon)
                    </option>

                  </select>

                </div>


                {/* AI TARGET */}

                <div>

                  <label className="block text-sm font-medium text-plum dark:text-cream mb-2">
                    AI Detection Target
                  </label>

                  <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-3">
                    Select the body/object area where AI
                    should place the product.
                  </p>


                  <div className="grid sm:grid-cols-2 gap-3">

                    {[
                      ["ears", "👂 Ears"],
                      ["neck", "📿 Neck"],
                      ["hair", "💇 Hair"],
                      ["wrist", "⌚ Wrist"],
                      ["hand", "✋ Hand"],
                      ["table", "🪑 Table / Surface"],
                      ["wall", "🖼️ Wall (Canvas Painting - coming soon)"],
                      ["face", "🙂 Face"],
                    ].map(
                      ([value, label]) => {

                        const checked =
                          form.virtualTryOn?.targets?.includes(
                            value
                          );

                        return (

                          <label
                            key={value}
                            className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition ${
                              checked
                                ? "border-purple-500 bg-purple-50"
                                : "border-blush"
                            }`}
                          >

                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleTarget(value)
                              }
                              className="w-4 h-4"
                            />

                            <span className="text-sm text-plum dark:text-cream">
                              {label}
                            </span>

                          </label>

                        );
                      }
                    )}

                  </div>

                </div>


                {/* CURRENT CONFIGURATION PREVIEW */}

                <div className="rounded-xl border border-blush bg-purple-50 dark:bg-[#301c3c] p-4">

                  <h4 className="font-medium text-plum dark:text-cream mb-2">
                    AI Configuration Preview
                  </h4>

                  <p className="text-sm text-plum-light dark:text-cream/80">

                    <strong>Product Type:</strong>{" "}

                    {form.virtualTryOn?.productType ||
                      "Custom"}

                  </p>

                  <p className="text-sm text-plum-light dark:text-cream/80">

                    <strong>Detect:</strong>{" "}

                    {form.virtualTryOn?.targets?.length
                      ? form.virtualTryOn.targets.join(
                          " + "
                        )
                      : "Nothing selected"}

                  </p>

                </div>

              </div>

            )}

          </div>


          {/* ======================================
              BUTTONS
          ====================================== */}

          <div className="flex gap-3 pt-2">

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="btn-outline text-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary text-sm"
            >
              {editingId
                ? "Save Changes"
                : "Create Category"}
            </button>

          </div>

        </form>

      )}


      {/* ======================================
          CATEGORY CARDS
      ====================================== */}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {categories.map((c) => (

          <div
            key={c._id}
            className="bg-white dark:bg-[#24152f] rounded-xl2 shadow-card border border-blush overflow-hidden"
          >

            <img
              src={
                c.image?.url || placeholder
              }
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = placeholder;
              }}
              alt=""
              className="w-full h-32 object-cover bg-ivory"
            />

            {c.images?.length > 1 && (
              <div className="px-4 pt-2 text-[10px] text-plum-light/60 dark:text-cream/60">
                {c.images.length} images · slideshow on hover
              </div>
            )}


            <div className="p-4">

              <div className="flex justify-between items-center">

                <h4 className="font-display text-lg text-plum dark:text-cream">
                  {c.name}
                </h4>

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    c.active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.active
                    ? "Active"
                    : "Hidden"}
                </span>

              </div>


              <p className="text-xs text-plum-light/70 dark:text-cream/70 mt-1">
                {c.description}
              </p>


              {/* VIRTUAL TRY-ON STATUS */}

              {c.virtualTryOn?.enabled && (

                <div className="mt-3 text-xs bg-purple-50 text-purple-700 rounded-lg px-3 py-2">

                  ✨ Virtual Try-On Enabled

                  <br />

                  <span>
                    Type:{" "}
                    {c.virtualTryOn.productType}
                  </span>

                  <br />

                  <span>
                    Target:{" "}
                    {c.virtualTryOn.targets?.join(
                      " + "
                    ) || "Not selected"}
                  </span>

                </div>

              )}


              <div className="flex gap-2 mt-3 text-xs">

                <button
                  onClick={() => openEdit(c)}
                  className="text-plum dark:text-cream underline"
                >
                  Edit
                </button>

                <button
                  onClick={() => toggleActive(c)}
                  className="text-plum dark:text-cream underline"
                >
                  {c.active
                    ? "Hide"
                    : "Show"}
                </button>

                <button
                  onClick={() =>
                    remove(c._id)
                  }
                  className="text-rose underline"
                >
                  Delete
                </button>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}
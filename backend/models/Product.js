const mongoose = require("mongoose");
const slugify = require("slugify");

// Shared "AR asset" shape used by both the legacy top-level product and every variant.
// Placement (which body part(s), which product type) is decided once at the CATEGORY level
// (Category.virtualTryOn.targets/productType) - see backend/models/Category.js. A variant just
// supplies one transparent PNG per target the category cares about - e.g. an "Earrings +
// Necklace Set" category has targets ["ears","neck"], so a variant can carry one asset tagged
// "ears" (the earring PNG) and a separate one tagged "neck" (the necklace PNG), rendered
// together. A category with a single target (e.g. just "neck") only ever needs one asset.
const tryOnAssetItemSchema = new mongoose.Schema(
  {
    target: { type: String, default: "" }, // one of the category's virtualTryOn.targets, e.g. "ears", "neck", "wrist"
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    widthCm: { type: Number, default: 0, min: 0 },
    heightCm: { type: Number, default: 0, min: 0 },
    // Fine vertical placement adjustment, currently only exposed in the admin UI for the
    // "neck" target (see AdminProducts.jsx / AdminVirtualTryOn.jsx) - negative moves the item
    // UP, positive moves it DOWN, relative to where the landmark-based placement puts it by
    // default. Horizontal centering and width/height scaling are untouched by this value.
    yOffset: { type: Number, default: 0, min: -50, max: 50 },
  },
  { _id: false }
);

const tryOnAssetSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    assets: { type: [tryOnAssetItemSchema], default: [] },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

// A single color/variant of a product. Any field left blank/null FALLS BACK to the parent
// product's own field (see Product.virtual("displayVariants") below) - so an admin can add a
// new color and only fill in what's different (e.g. just price + images) without retyping the
// whole description every time.
const variantSchema = new mongoose.Schema({
  colorName: { type: String, required: true, trim: true },
  colorHex: { type: String, default: "#8B5CF6", trim: true },
  name: { type: String, trim: true, default: "" },
  images: { type: [imageSchema], default: [] },
  price: { type: Number, min: 0, default: null },
  discountPrice: { type: Number, min: 0, default: null },
  description: { type: String, default: "" },
  stock: { type: Number, default: 0, min: 0 },
  sku: { type: String, trim: true, default: "" },
  materials: { type: String, default: "" },
  dimensions: { type: String, default: "" },
  status: { type: String, enum: ["active", "hidden"], default: "active" },
  tryOn: { type: tryOnAssetSchema, default: () => ({}) },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true },
    description: { type: String, required: true },
    images: [imageSchema],
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0, default: null }, // if set & < price, shown as sale price
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    sku: { type: String, trim: true, unique: true, sparse: true },

    // Deprecated: a plain list of color names with no images/price/stock of their own. Kept
    // ONLY so products created before the variant system still display their color names.
    // New/edited products should use `variants` instead - see FEATURE 1.
    colors: [{ type: String }],

    // Full color-variant system (FEATURE 1). Each entry is a complete, independently
    // purchasable version of this product: its own images, price, stock, description, etc.
    // Empty array = this product has no variants; it behaves exactly as a classic single-SKU
    // product using the fields above.
    variants: { type: [variantSchema], default: [] },

    // Try-on config for a product that has NO variants. Ignored once `variants` is non-empty -
    // in that case each variant carries its own `tryOn` block instead.
    tryOn: { type: tryOnAssetSchema, default: () => ({}) },

    dimensions: { type: String, default: "" },
    materials: { type: String, default: "" },

    // Marketing / merchandising labels — ALL fully admin controlled. None of these are ever
    // set automatically by the system based on sales, stock, or any other metric. The admin
    // decides every label, every time, using their own judgement (see productController's
    // getProductPerformance for the *read-only* sales data that informs that judgement).
    featured: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    handcrafted: { type: Boolean, default: true },
    limitedStockLabel: { type: Boolean, default: false }, // manual "Limited Stock" badge, independent of actual stock count
    saleLabel: { type: Boolean, default: false }, // manual "Sale" badge, independent of discountPrice

    // Product visibility lifecycle:
    // active -> visible & purchasable
    // hidden -> exists in DB, not shown to customers (e.g. temporarily paused)
    // inactive -> soft-deleted, preserved for historical order integrity
    status: { type: String, enum: ["active", "hidden", "inactive"], default: "active" },

    // Two separate ratings, per spec:
    // 1) ratingAverage/ratingCount - the REAL rating, auto-calculated from approved customer
    //    reviews. The admin never edits these directly; they're recalculated whenever a review
    //    is approved/unapproved/deleted (see reviewController.recalcProductRating).
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    // 2) adminRating/adminReviewCount - an optional admin-set "showcase" rating, used only as a
    //    fallback for brand-new products that don't have real reviews yet. Once a product has
    //    at least one approved review, the real rating always takes over automatically.
    adminRating: { type: Number, min: 0, max: 5, default: null },
    adminReviewCount: { type: Number, min: 0, default: null },

    // Homepage curation (admin-controlled only - see productController.getProducts homepage=true
    // handling and Home.jsx's per-category "Latest Jewelry Pieces" rows). Deliberately opt-in:
    // a brand-new product defaults to OFF, so adding a product can never silently bump an
    // existing product off the homepage. Position only matters among a product's own category's
    // homepageVisible:true products - it is not a global ranking.
    homepageVisible: { type: Boolean, default: false },
    homepagePosition: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.pre("validate", function (next) {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = slugify(this.name, { lower: true, strict: true }) + "-" + Math.random().toString(36).slice(2, 7);
  }
  next();
});

productSchema.virtual("isOutOfStock").get(function () {
  return this.stock <= 0;
});

productSchema.virtual("isLowStock").get(function () {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
});

// What the storefront should actually display: real reviews win once they exist,
// otherwise fall back to the admin's showcase rating.
productSchema.virtual("effectiveRating").get(function () {
  return this.ratingCount > 0 ? this.ratingAverage : this.adminRating || 0;
});
productSchema.virtual("effectiveReviewCount").get(function () {
  return this.ratingCount > 0 ? this.ratingCount : this.adminReviewCount || 0;
});
productSchema.virtual("isAdminRating").get(function () {
  return this.ratingCount === 0 && !!this.adminRating;
});

productSchema.virtual("hasVariants").get(function () {
  return Array.isArray(this.variants) && this.variants.length > 0;
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

productSchema.index({ name: "text", description: "text", colors: "text" });

module.exports = mongoose.model("Product", productSchema);

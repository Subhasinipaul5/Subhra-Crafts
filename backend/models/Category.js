const mongoose = require("mongoose");
const slugify = require("slugify");

const categoryImageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, publicId: { type: String, default: "" } },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    slug: {
      type: String,
      unique: true,
    },

    description: {
      type: String,
      default: "",
    },

    // Legacy single image - left in place untouched for any code that still reads it directly.
    // Kept in sync with images[0] automatically by the pre("save") hook below, so it never goes
    // stale once the admin starts using the multi-image gallery.
    image: {
      url: {
        type: String,
        default: "",
      },

      publicId: {
        type: String,
        default: "",
      },
    },

    // Up to 10 images for the category card's hover slideshow (see CategoryImageSlideshow.jsx
    // on the storefront and AdminCategories.jsx's image gallery in the admin panel). Empty by
    // default - a category with zero or one image behaves exactly like before (a static image,
    // no slideshow chrome).
    images: {
      type: [categoryImageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "A category can have at most 10 images.",
      },
    },

    // Hover slideshow behaviour for this category's card (Home.jsx's Featured Categories row,
    // and the full /categories page) - only ever matters when `images` has 2+ entries.
    slideshow: {
      transition: {
        type: String,
        enum: ["fade", "slide-left", "slide-right"],
        default: "fade",
      },
      durationSeconds: {
        type: Number,
        default: 2,
        min: 1,
        max: 15,
      },
    },

    active: {
      type: Boolean,
      default: true,
    },

    featured: {
      type: Boolean,
      default: false,
    },

    order: {
      type: Number,
      default: 0,
    },

    // Navbar mega-menu visibility (separate from `featured`, which drives the homepage's
    // Featured Categories grid, and separate from `active`, which is "does this category exist
    // at all"). Defaults to true so every existing category keeps showing in the navbar exactly
    // as before - this is purely an opt-OUT control, not opt-in, unlike Product.homepageVisible.
    navbarVisible: {
      type: Boolean,
      default: true,
    },

    // Order among navbarVisible categories in the mega-menu - lower shows first. Falls back to
    // `order` when equal (see getMegaMenu's sort), so a category nobody has touched this field
    // on yet still sorts sensibly rather than randomly.
    navbarPosition: {
      type: Number,
      default: 0,
    },

    // ======================================
    // AI VIRTUAL TRY-ON
    // ======================================

    virtualTryOn: {
      enabled: {
        type: Boolean,
        default: false,
      },

      targets: {
        type: [String],

        // Kept open-ended on purpose (not a hard mongoose enum) - a brand-new category (e.g.
        // Canvas Paintings -> "wall") should never require a schema migration. This list is
        // just what the Admin > Categories UI currently offers as quick-pick options.
        default: [],
      },

      productType: {
        type: String,

        // Same reasoning as `targets` above - free-form string, not a hard enum, so future
        // product types (e.g. "canvas_painting") work without a migration. See
        // AdminCategories.jsx for the current UI options.
        default: "custom",
      },
    },
  },

  {
    timestamps: true,
  }
);


categorySchema.pre("validate", function (next) {

  if (this.name) {

    this.slug = slugify(this.name, {
      lower: true,
      strict: true,
    });

  }

  next();

});

// Keeps the legacy single `image` field pointed at the first slideshow image whenever `images`
// is non-empty, so every place that still reads `category.image.url` directly (mega-menu,
// admin lists, etc.) automatically shows the current first image without needing its own
// update. Only touches `image` when `images` actually has something in it - a category that
// still just uses the old single-image field is completely unaffected.
categorySchema.pre("save", function (next) {
  if (this.images && this.images.length > 0) {
    this.image = this.images[0];
  }
  next();
});


module.exports =
  mongoose.model("Category", categorySchema);
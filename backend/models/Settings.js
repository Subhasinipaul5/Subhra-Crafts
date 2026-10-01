const mongoose = require("mongoose");

const shippingTierSchema = new mongoose.Schema(
  {
    // maxDistanceKm = null means "above the previous tier's max" (the final catch-all tier)
    maxDistanceKm: { type: Number, default: null },
    charge: { type: Number, required: true, min: 0 },
    estimateDaysMin: { type: Number, required: true, min: 0 },
    estimateDaysMax: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    // Singleton document - there is only ever one Settings row, found by a fixed key.
    key: { type: String, default: "singleton", unique: true },

    businessLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, default: "" },
    },

    // Ordered ascending by maxDistanceKm; last tier should have maxDistanceKm: null.
    shippingTiers: {
      type: [shippingTierSchema],
      default: [
        { maxDistanceKm: 100, charge: 50, estimateDaysMin: 3, estimateDaysMax: 5 },
        { maxDistanceKm: 300, charge: 100, estimateDaysMin: 5, estimateDaysMax: 7 },
        { maxDistanceKm: 700, charge: 150, estimateDaysMin: 7, estimateDaysMax: 10 },
        { maxDistanceKm: null, charge: 200, estimateDaysMin: 10, estimateDaysMax: 14 },
      ],
    },

    // Home page hero/banner image, admin-managed. When empty, the frontend falls back to its
    // own bundled default image - the site never breaks just because no custom image was set.
    homeBanner: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // Navbar "Categories" mega-menu - how many category columns show before the panel falls
    // back to an "All Categories" link (see categoryController.getMegaMenu, which returns every
    // admin-visible category; this is purely a display cap), plus the small slideshow image on
    // that "All Categories" tile itself. Unlike a category card's own hover-to-start slideshow
    // (Category.slideshow), this one autoplays continuously and pauses ON hover - the opposite
    // trigger, because this tile represents "browse everything" rather than one specific
    // category, so it's meant to always be doing something to catch the eye.
    navbarCategories: {
      maxVisible: { type: Number, default: 4, min: 1, max: 12 },
      allCategoriesImages: {
        type: [{ url: { type: String, default: "" }, publicId: { type: String, default: "" } }],
        default: [],
        validate: {
          validator: (arr) => arr.length <= 10,
          message: "At most 10 images are allowed.",
        },
      },
      slideshow: {
        intervalSeconds: { type: Number, default: 3, min: 1, max: 15 },
        pauseOnHover: { type: Boolean, default: true },
      },
    },

    // FEATURE (this round) - admin-configurable hero banner slide TRANSITION behavior (separate
    // from the per-slide content in HomeBannerSlide). One shared config applies to every slide.
    bannerSettings: {
      transition: {
        type: String,
        enum: ["slideLeft", "slideRight", "slideUp", "slideDown", "fade", "blur", "blurFade", "zoomIn", "zoomOut", "crossfade", "random"],
        default: "fade",
      },
      durationMs: { type: Number, default: 700, min: 150, max: 3000 },
      autoChange: { type: Boolean, default: true },
      intervalSeconds: { type: Number, default: 2, min: 1, max: 30 },
      pauseOnHover: { type: Boolean, default: true },
    },

    // Admin-controllable display size for the Contact section's interactive 3D model
    // (TwoSistersModel3D). Implemented as a camera-framing zoom factor rather than a literal
    // mesh scale - see the frontend component for why - but the effect is exactly "how large
    // the model appears", 0.5x-2.0x, defaulting to a comfortably larger-than-before 1.4x.
    modelDisplayScale: { type: Number, default: 1.4, min: 0.5, max: 2.0 },

    // Saved alongside displayScale above (see TwoSistersModel3D.jsx for how each is applied):
    //  - modelHorizontalRotation (0-360°) is the MAXIMUM angle the mouse-follow gaze is allowed
    //    to turn the model left/right from its true front-facing orientation - a clamp on the
    //    existing cursor-follow, not a rotation of the resting pose. At 0°, the mouse has no
    //    horizontal effect and the model always faces forward at rest.
    //  - modelVerticalRotation (0-20°, kept small on purpose - a tilt, not a headstand) IS a
    //    resting-orientation offset, applied on top of the model's base tilt - a deliberate
    //    difference from how horizontal works above.
    // Both default to 0 = the original, unmodified behavior.
    modelHorizontalRotation: { type: Number, default: 0, min: 0, max: 360 },
    modelVerticalRotation: { type: Number, default: 0, min: 0, max: 20 },

    // FEATURE 4 - Multi-currency. Every product price in the database stays in INR (the base
    // currency products are entered in) - this ONLY controls what currency the storefront
    // converts and displays those prices in, using the admin-managed exchange rate below.
    // Nothing here ever rewrites a product's stored price.
    currency: {
      baseCurrency: { type: String, default: "INR" },
      displayCurrency: { type: String, enum: ["INR", "USD", "EUR"], default: "INR" },
      exchangeRates: {
        INR: { type: Number, default: 1 },
        USD: { type: Number, default: 0.012 },
        EUR: { type: Number, default: 0.011 },
      },
      // Set automatically whenever a LIVE fetch succeeds (see backend/utils/exchangeRates.js) -
      // these two fields are what a fetch failure falls back to, so the site keeps working with
      // the last known-good rate instead of a hardcoded guess.
      ratesUpdatedAt: { type: Date, default: null },
      ratesSource: { type: String, enum: ["live", "manual", "fallback"], default: "fallback" },
    },
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ key: "singleton" });
  if (!settings) {
    settings = await this.create({ key: "singleton" });
  }
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);

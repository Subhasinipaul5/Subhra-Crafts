const mongoose = require("mongoose");

// FEATURE 3 (this round) - replaces the old single Settings.homeBanner image with up to 10
// manageable slides. The old single-image field on Settings is left completely untouched (not
// deleted, not migrated) - Home.jsx falls back to it, then to the bundled default image, if no
// active slides exist yet. This is purely additive, so no existing data is at risk.
const homeBannerSlideSchema = new mongoose.Schema(
  {
    image: {
      url: { type: String, required: true },
      publicId: { type: String, default: "" },
    },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    buttonText: { type: String, default: "" },
    // Legacy manual-URL field - left in the schema (existing data untouched) but no longer
    // exposed in the admin banner form; product linking below replaces it as the way a banner
    // becomes clickable.
    buttonUrl: { type: String, default: "" },
    // Stores a stable reference (the product's _id), never a copy of the product itself - the
    // name/slug/image are always resolved fresh from the live Product document at render time
    // (see getActiveSlides in the controller), so the link survives the product being renamed
    // and never goes stale. null/unset = banner has no product link and is not clickable.
    linkedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    order: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 5, min: 2, max: 30 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

homeBannerSlideSchema.index({ order: 1 });

module.exports = mongoose.model("HomeBannerSlide", homeBannerSlideSchema);

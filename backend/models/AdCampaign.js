const mongoose = require("mongoose");
const crypto = require("crypto");
const slugify = require("slugify");

// FEATURE 1 (ads) - one product can be featured in a campaign together with a specific color
// variant, e.g. "advertise the Blue Bloom Elegance variant of Lavender Bloom Elegance". variant
// is left null when the campaign is just about the base product / all its colors.
const productSelectionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false }
);

const adCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    platform: { type: String, enum: ["instagram", "facebook", "instagram_facebook"], required: true },
    status: { type: String, enum: ["draft", "scheduled", "active", "completed"], default: "draft" },
    products: { type: [productSelectionSchema], default: [] },

    // Where the ad ultimately sends the visitor - usually a product page on this site, but left
    // free-text so the admin can point it at the Shop page, Home page, etc.
    destinationUrl: { type: String, required: true },

    // The short code used to build this campaign's trackable link:
    // {BACKEND_URL}/api/ads/track/{trackingSlug} - see adController.trackClick. Never reused.
    trackingSlug: { type: String, unique: true, index: true },

    // Auto-generated UTM parameters, appended to destinationUrl whenever someone follows the
    // tracking link - see adController.trackClick.
    utm: {
      source: { type: String, default: "" }, // "instagram" | "facebook"
      medium: { type: String, default: "social" },
      campaign: { type: String, default: "" }, // slugified campaign title
      content: { type: String, default: "" }, // first product id, or "multi"
    },

    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },

    // Cheap running counters, updated at click-time (see adController.trackClick) so the
    // dashboard/list view never needs a heavy aggregation just to show clicks/visitors.
    // Deeper stats (product views, add-to-cart, purchases attributed to this campaign) are
    // computed on demand from AnalyticsEvent - see analyticsController / adController.getCampaignAnalytics.
    clicks: { type: Number, default: 0 },
    visitors: { type: Number, default: 0 }, // unique sessions that landed via this campaign's link

    // FEATURE 1 - structured so a real Meta Marketing API integration can be dropped in later
    // (see backend/config/meta.js) without changing this schema. Never faked - see meta.js.
    metaCampaignId: { type: String, default: "" },
    metaSyncedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

adCampaignSchema.pre("validate", function (next) {
  if (!this.trackingSlug) {
    this.trackingSlug = crypto.randomBytes(5).toString("hex");
  }
  if (this.isModified("title") || !this.utm?.campaign) {
    const campaignSlug = slugify(this.title || "campaign", { lower: true, strict: true });
    this.utm = {
      source: this.platform === "facebook" ? "facebook" : this.platform === "instagram_facebook" ? "instagram_facebook" : "instagram",
      medium: "social",
      campaign: campaignSlug,
      content: this.products?.[0]?.product ? String(this.products[0].product) : this.products?.length > 1 ? "multi" : "",
    };
  }
  next();
});

adCampaignSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AdCampaign", adCampaignSchema);

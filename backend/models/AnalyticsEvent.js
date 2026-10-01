const mongoose = require("mongoose");

// FEATURE 2 (analytics) - one document per tracked interaction. Kept intentionally narrow
// (a type + a few optional references) so the whole conversion journey - campaign click ->
// page view -> product view -> variant selection -> add to cart -> purchase - can be
// reconstructed later purely by querying on sessionId/campaign/productId, without ever storing
// anything personally identifying on the event itself.
const EVENT_TYPES = [
  "page_view",
  "product_view",
  "product_click",
  "color_variant_selected",
  "add_to_cart",
  "wishlist_add",
  "buy_now",
  "checkout_start",
  "purchase",
  "advertisement_click",
  "virtual_tryon_open",
];

const analyticsEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: EVENT_TYPES, required: true },
    sessionId: { type: String, required: true, index: true },
    path: { type: String, default: "" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "AdCampaign", default: null, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    // Small, non-identifying extra context only - e.g. { quantity, amount } for a purchase event.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ product: 1, type: 1 });
analyticsEventSchema.index({ campaign: 1, type: 1 });

analyticsEventSchema.statics.EVENT_TYPES = EVENT_TYPES;

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);

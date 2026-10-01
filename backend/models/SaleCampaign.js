const mongoose = require("mongoose");

// A "Sales & Offers" campaign never touches Product.price or Product.discountPrice in the
// database - it's purely a rule ("these products/categories get X% or ₹X off between these two
// timestamps"). The actual discounted price is computed fresh on every request by
// utils/salePricing.js, which is what makes automatic start/end work with zero cron jobs: once
// `endAt` passes, the campaign simply stops matching in getActiveCampaigns() and every product
// it covered silently reverts to its real stored price - nothing to "restore" because nothing
// was ever overwritten.
const saleCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    bannerImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },

    // Either/both may be set - a campaign can target specific products, whole categories, or
    // both at once. Category targeting is resolved live (not snapshotted), so a new product
    // added to a targeted category picks up the sale automatically - see salePricing.js.
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },

    // Admin pause/resume switch - independent of the date window. A campaign can be within its
    // active date range and still not apply if the admin has paused it.
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

saleCampaignSchema.pre("validate", function (next) {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    return next(new Error("End date/time must be after start date/time."));
  }
  if (this.discountType === "percentage" && (this.discountValue <= 0 || this.discountValue > 100)) {
    return next(new Error("Percentage discount must be between 1 and 100."));
  }
  if (this.discountType === "fixed" && this.discountValue <= 0) {
    return next(new Error("Fixed discount amount must be greater than 0."));
  }
  if (this.active && (this.products?.length || 0) === 0 && (this.categories?.length || 0) === 0) {
    return next(new Error("A sale needs at least one product or category selected before it can be active."));
  }
  next();
});

// Single source of truth for "what state is this campaign in right now" - used by both the
// admin dashboard (status badges, tab filtering) and anywhere else that needs it. Takes `now`
// as a parameter (instead of always using `new Date()`) purely so it's easy to unit-test.
saleCampaignSchema.methods.getStatus = function (now = new Date()) {
  if (!this.active) return "paused";
  if (now < this.startAt) return "upcoming";
  if (now > this.endAt) return "expired";
  return "active";
};

module.exports = mongoose.model("SaleCampaign", saleCampaignSchema);

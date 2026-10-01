const mongoose = require("mongoose");

const websiteSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "Festive Resin Collection"
    description: { type: String, default: "" },
    type: { type: String, enum: ["product_collection", "banner"], default: "product_collection" },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    displayLocation: [{ type: String, enum: ["homepage", "shop", "category_page"], default: "homepage" }],
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebsiteSection", websiteSectionSchema);

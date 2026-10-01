const mongoose = require("mongoose");

const customOrderSchema = new mongoose.Schema(
  {
    customOrderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional - guests can also request
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    productType: { type: String, required: true },
    preferredColor: { type: String, default: "" },
    preferredDesign: { type: String, default: "" },
    size: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    budget: { type: String, default: "" },
    additionalRequirements: { type: String, default: "" },
    referenceImages: [{ type: String }],
    message: { type: String, default: "" },

    status: {
      type: String,
      enum: [
        "requested",
        "under_discussion",
        "price_proposed",
        "accepted",
        "rejected",
        "in_production",
        "shipped",
        "delivered",
      ],
      default: "requested",
    },
    proposedPrice: { type: Number, default: null },
    shippingCharge: { type: Number, default: 0 }, // set by admin, since custom pieces vary in size/weight
    estimatedDelivery: { type: Date }, // admin's expected completion/delivery date
    adminNotes: { type: String, default: "" },
    isAdminSeen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CustomOrder", customOrderSchema);

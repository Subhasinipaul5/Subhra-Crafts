const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true }, // snapshot - survives product edits/deletion
    image: { type: String, default: "" },
    price: { type: Number, required: true }, // price actually paid, frozen at purchase time
    quantity: { type: Number, required: true, min: 1 },

    // Which color/variant of the product was purchased, if the product has variants.
    // Left blank/null for classic single-SKU products - fully backward compatible.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    colorName: { type: String, default: "" },
  },
  { _id: false }
);

const addressSnapshotSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    house: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String,
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // e.g. SR10245
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    shippingAddress: addressSnapshotSchema,
    itemsTotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    deliveryDistanceKm: { type: Number, default: null }, // calculated server-side from admin's saved business location
    preferredDeliveryDate: { type: Date, default: null }, // what the customer asked for
    estimatedDeliveryMin: { type: Date, default: null }, // system estimate, based on distance tier
    estimatedDeliveryMax: { type: Date, default: null },
    totalAmount: { type: Number, required: true },

    paymentMethod: { type: String, enum: ["razorpay", "upi", "whatsapp", "cod"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },

    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "shipped", "out_for_delivery", "delivered", "cancelled"],
      default: "pending",
    },

    courier: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    expectedDelivery: { type: Date },

    statusHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],

    // For the admin "new order" notification badge. Never auto-toggled by viewing the list -
    // only the explicit Reset button (or, once, order creation defaulting to false) changes it.
    isAdminSeen: { type: Boolean, default: false },

    // Independent visibility state per side (see the "Reset Orders" bug this fixes: it used to
    // hard-delete the single shared Order document, which is why deleting from Admin also wiped
    // it from the customer's My Orders, and cascade-deleted its Payment record along with it -
    // wiping revenue too). Deleting is now just "hide from this side's list" - the underlying
    // record, and its Payment/revenue record, are untouched either way. Only becomes truly
    // absent from the database if BOTH sides have deleted it (see the cleanup note on
    // deleteOrder/deleteOrderForCustomer in orderController.js).
    deletedByAdmin: { type: Boolean, default: false },
    deletedByCustomer: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);

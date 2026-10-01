const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["razorpay", "upi", "whatsapp", "cod"], required: true },
    transactionId: { type: String, default: "" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    status: { type: String, enum: ["pending", "success", "failed", "refunded"], default: "pending" },
    date: { type: Date, default: Date.now },

    // Same independent-visibility pattern as Order.deletedByAdmin/deletedByCustomer (see
    // Order.js) - deleting a transaction row from either side only hides it from that side's
    // list. Revenue figures (getRevenueStats) are NEVER filtered by these flags, so neither
    // side's deletion ever changes a revenue total - only a real DB delete would, and nothing
    // in the app does that to a Payment anymore (see deletePayment in paymentController.js).
    deletedByAdmin: { type: Boolean, default: false },
    deletedByCustomer: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);

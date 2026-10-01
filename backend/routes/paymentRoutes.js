const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getMyPayments,
  getAllPayments,
  getRevenueStats,
  deletePayment,
  deletePaymentForCustomer,
} = require("../controllers/paymentController");

// Razorpay order-creation/verification now lives in orderRoutes.js (POST
// /api/orders/razorpay/initiate and /api/orders/razorpay/verify-and-create) since the order
// itself is only ever created there, immediately after verification succeeds.

router.get("/mine", protect, getMyPayments);
router.get("/", protect, adminOnly, getAllPayments);
router.get("/revenue", protect, adminOnly, getRevenueStats);
// Customer-facing "remove from my payment history" - a distinct path from the plain "/:id"
// admin-hide route below, so both can coexist safely.
router.delete("/:id/mine", protect, deletePaymentForCustomer);
router.delete("/:id", protect, adminOnly, deletePayment);

module.exports = router;

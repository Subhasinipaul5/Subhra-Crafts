const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  placeOrder,
  initiateRazorpayOrder,
  verifyRazorpayAndCreateOrder,
  calculateShipping,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  deleteAllOrders,
  deleteOrderForCustomer,
  markOrdersSeen,
  getOrderInvoice,
} = require("../controllers/orderController");

// specific routes before /:id catch-all
router.put("/admin/mark-seen", protect, adminOnly, markOrdersSeen);
router.delete("/admin/delete-all", protect, adminOnly, deleteAllOrders);

router.post("/calculate-shipping", protect, calculateShipping);
router.post("/razorpay/initiate", protect, initiateRazorpayOrder);
router.post("/razorpay/verify-and-create", protect, verifyRazorpayAndCreateOrder);
router.post("/", protect, placeOrder);
router.get("/mine", protect, getMyOrders);
router.get("/", protect, adminOnly, getAllOrders);
router.get("/:id", protect, getOrderById);
router.get("/:id/invoice", protect, getOrderInvoice);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);
// Customer-facing "remove from my order history" - a distinct path from the plain "/:id"
// admin-delete route below, so both can coexist safely.
router.delete("/:id/mine", protect, deleteOrderForCustomer);
router.delete("/:id", protect, adminOnly, deleteOrder);

module.exports = router;

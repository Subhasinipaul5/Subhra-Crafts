const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getProducts,
  getProductBySlug,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getProductStats,
  getProductPerformance,
} = require("../controllers/productController");

// IMPORTANT: specific admin routes must be declared BEFORE the /:slug catch-all
router.get("/admin/all", protect, adminOnly, getAdminProducts);
router.get("/admin/stats", protect, adminOnly, getProductStats);
router.get("/admin/performance", protect, adminOnly, getProductPerformance);

router.get("/", getProducts);
router.post("/", protect, adminOnly, createProduct);

router.get("/:slug", getProductBySlug);
router.put("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);
router.patch("/:id/stock", protect, adminOnly, updateStock);

module.exports = router;

const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getProductReviews,
  createReview,
  getAllReviews,
  moderateReview,
  deleteReview,
  deleteAllReviews,
  markReviewsSeen,
} = require("../controllers/reviewController");

router.get("/product/:productId", getProductReviews);
router.post("/", protect, createReview);
router.get("/", protect, adminOnly, getAllReviews);
router.put("/admin/mark-seen", protect, adminOnly, markReviewsSeen);
router.delete("/admin/delete-all", protect, adminOnly, deleteAllReviews);
router.put("/:id/moderate", protect, adminOnly, moderateReview);
router.delete("/:id", protect, adminOnly, deleteReview);

module.exports = router;

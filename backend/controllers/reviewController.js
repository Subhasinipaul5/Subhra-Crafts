const asyncHandler = require("express-async-handler");
const Review = require("../models/Review");
const Order = require("../models/Order");
const Product = require("../models/Product");

const recalcProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: productId, approved: true } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const { avg = 0, count = 0 } = stats[0] || {};
  await Product.findByIdAndUpdate(productId, { ratingAverage: avg, ratingCount: count });
};

// @desc Get approved reviews for a product (public)
// @route GET /api/reviews/product/:productId
const getProductReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId, approved: true })
    .populate("user", "name")
    .sort({ createdAt: -1 });
  res.json(reviews);
});

// @desc Submit a review - only for products the user actually purchased & received
// @route POST /api/reviews
const createReview = asyncHandler(async (req, res) => {
  const { product, order, rating, comment, images } = req.body;

  const orderDoc = await Order.findOne({ _id: order, user: req.user._id, "items.product": product });
  if (!orderDoc) {
    res.status(403);
    throw new Error("You can only review products you have purchased");
  }
  if (orderDoc.orderStatus !== "delivered") {
    res.status(400);
    throw new Error("You can review this product once your order is delivered");
  }

  const review = await Review.create({
    user: req.user._id,
    product,
    order,
    rating,
    comment,
    images,
    verifiedPurchase: true,
    approved: false, // admin must approve
  });

  res.status(201).json(review);
});

// @desc Admin: list all reviews (pending + approved)
// @route GET /api/reviews
const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({})
    .populate("user", "name email")
    .populate("product", "name")
    .sort({ createdAt: -1 });
  res.json(reviews);
});

// @desc Admin: approve or reject a review
// @route PUT /api/reviews/:id/moderate
const moderateReview = asyncHandler(async (req, res) => {
  const { approved } = req.body;
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }
  review.approved = approved;
  await review.save();
  await recalcProductRating(review.product);
  res.json(review);
});

// @desc Admin: delete inappropriate review
// @route DELETE /api/reviews/:id
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }
  await recalcProductRating(review.product);
  res.json({ message: "Review deleted" });
});

// @desc Admin: PERMANENTLY DELETE every review, and reset every product's rating back to
// zero since no reviews remain. Real bulk database delete - see markReviewsSeen for the
// separate, non-destructive notification reset.
// @route DELETE /api/reviews/admin/delete-all
const deleteAllReviews = asyncHandler(async (req, res) => {
  const result = await Review.deleteMany({});
  await Product.updateMany({}, { ratingAverage: 0, ratingCount: 0 });
  res.json({ message: "All reviews have been deleted successfully.", deletedCount: result.deletedCount });
});

// @desc Admin: mark all unseen reviews as seen, resetting the notification badge. Purely a
// read-state flag - never deletes anything. Called automatically when the admin opens the
// Reviews page, NOT by the Reset/delete-all button.
// @route PUT /api/reviews/admin/mark-seen
const markReviewsSeen = asyncHandler(async (req, res) => {
  const result = await Review.updateMany({ isAdminSeen: false }, { isAdminSeen: true });
  res.json({ message: "Reviews marked as seen", markedCount: result.modifiedCount });
});

module.exports = { getProductReviews, createReview, getAllReviews, moderateReview, deleteReview, deleteAllReviews, markReviewsSeen };

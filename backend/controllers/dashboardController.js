const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const CustomOrder = require("../models/CustomOrder");
const Review = require("../models/Review");

// @desc Admin dashboard overview stats
// @route GET /api/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalOrders,
    pending,
    processing,
    shipped,
    delivered,
    cancelled,
    totalProducts,
    activeProducts,
    outOfStock,
    totalCustomers,
    newCustomOrders,
  ] = await Promise.all([
    Order.countDocuments({}),
    Order.countDocuments({ orderStatus: "pending" }),
    Order.countDocuments({ orderStatus: { $in: ["confirmed", "preparing"] } }),
    Order.countDocuments({ orderStatus: "shipped" }),
    Order.countDocuments({ orderStatus: "delivered" }),
    Order.countDocuments({ orderStatus: "cancelled" }),
    Product.countDocuments({}),
    Product.countDocuments({ status: "active" }),
    Product.countDocuments({ stock: 0, status: { $ne: "inactive" } }),
    User.countDocuments({ role: "customer" }),
    CustomOrder.countDocuments({ status: "requested" }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newCustomers = await User.countDocuments({ role: "customer", createdAt: { $gte: thirtyDaysAgo } });

  res.json({
    orders: { total: totalOrders, pending, processing, shipped, delivered, cancelled },
    products: { total: totalProducts, active: activeProducts, outOfStock },
    customers: { total: totalCustomers, new: newCustomers },
    customOrders: { new: newCustomOrders },
  });
});

// @desc Independent unseen-notification counts for the admin navbar (Orders, Custom Orders,
// Reviews). Each is counted and reset separately - never combined into one number.
// @route GET /api/dashboard/notifications
const getNotificationCounts = asyncHandler(async (req, res) => {
  const [orders, customOrders, reviews] = await Promise.all([
    Order.countDocuments({ isAdminSeen: false }),
    CustomOrder.countDocuments({ isAdminSeen: false }),
    Review.countDocuments({ isAdminSeen: false }),
  ]);
  res.json({ orders, customOrders, reviews });
});

module.exports = { getDashboardStats, getNotificationCounts };

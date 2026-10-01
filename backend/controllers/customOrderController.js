const asyncHandler = require("express-async-handler");
const CustomOrder = require("../models/CustomOrder");
const { generateCustomOrderNumber } = require("../utils/generateOrderNumber");

// @desc Submit a custom order request (logged-in users; user field attached if available)
// @route POST /api/custom-orders
const createCustomOrder = asyncHandler(async (req, res) => {
  const customOrderNumber = await generateCustomOrderNumber();
  const payload = { ...req.body, customOrderNumber };
  if (req.user) payload.user = req.user._id;

  const customOrder = await CustomOrder.create(payload);
  res.status(201).json(customOrder);
});

// @desc Logged-in user's own custom order requests
// @route GET /api/custom-orders/mine
const getMyCustomOrders = asyncHandler(async (req, res) => {
  const orders = await CustomOrder.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc Admin: list all custom order requests
// @route GET /api/custom-orders
const getAllCustomOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const orders = await CustomOrder.find(filter).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc Admin: update status, proposed price, notes, delivery estimate
// @route PUT /api/custom-orders/:id
const updateCustomOrder = asyncHandler(async (req, res) => {
  const order = await CustomOrder.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Custom order request not found");
  }
  Object.assign(order, req.body);
  await order.save();
  res.json(order);
});

// @desc Admin: permanently delete a custom order request
// @route DELETE /api/custom-orders/:id
const deleteCustomOrder = asyncHandler(async (req, res) => {
  const order = await CustomOrder.findByIdAndDelete(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Custom order request not found");
  }
  res.json({ message: "Custom order deleted" });
});

// @desc Admin: PERMANENTLY DELETE every custom order request. Real bulk database delete -
// see markCustomOrdersSeen for the separate, non-destructive notification reset.
// @route DELETE /api/custom-orders/admin/delete-all
const deleteAllCustomOrders = asyncHandler(async (req, res) => {
  const result = await CustomOrder.deleteMany({});
  res.json({ message: "All custom orders have been deleted successfully.", deletedCount: result.deletedCount });
});

// @desc Admin: mark all unseen custom orders as seen, resetting the notification badge.
// Purely a read-state flag - never deletes anything. Called automatically when the admin
// opens the Custom Orders page, NOT by the Reset/delete-all button.
// @route PUT /api/custom-orders/admin/mark-seen
const markCustomOrdersSeen = asyncHandler(async (req, res) => {
  const result = await CustomOrder.updateMany({ isAdminSeen: false }, { isAdminSeen: true });
  res.json({ message: "Custom orders marked as seen", markedCount: result.modifiedCount });
});

module.exports = {
  createCustomOrder,
  getMyCustomOrders,
  getAllCustomOrders,
  updateCustomOrder,
  deleteCustomOrder,
  deleteAllCustomOrders,
  markCustomOrdersSeen,
};

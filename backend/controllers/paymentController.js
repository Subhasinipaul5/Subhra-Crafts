const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

// @desc Customer's own payment history. Excludes transactions this customer has removed from
// their own view - see deletePaymentForCustomer; the underlying record (and the admin's own
// view of it) is completely unaffected by that.
// @route GET /api/payments/mine
const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user._id, deletedByCustomer: { $ne: true } })
    .populate("order", "orderNumber")
    .sort({ createdAt: -1 });
  res.json(payments);
});

// @desc Admin: all payments. Excludes transactions the admin has removed from their own view -
// see deletePayment below; a customer's own payment history is completely unaffected by that.
// @route GET /api/payments
const getAllPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ deletedByAdmin: { $ne: true } })
    .populate("user", "name email")
    .populate("order", "orderNumber")
    .sort({ createdAt: -1 });
  res.json(payments);
});

// @desc Admin: revenue analytics (only successful/confirmed payments count). Deliberately never
// filtered by deletedByAdmin/deletedByCustomer - a transaction hidden from either side's list
// view still happened and still counts toward historical revenue. This is the "revenue must be
// completely separate from list-visibility deletion" rule, applied consistently to payments the
// same way it already is for orders (see orderController.js).
// @route GET /api/payments/revenue
const getRevenueStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const sumSince = async (date) => {
    const result = await Payment.aggregate([
      { $match: { status: "success", createdAt: { $gte: date } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total || 0;
  };

  const [today, week, month, year, allTime] = await Promise.all([
    sumSince(startOfToday),
    sumSince(startOfWeek),
    sumSince(startOfMonth),
    sumSince(startOfYear),
    sumSince(new Date(0)),
  ]);

  res.json({ today, thisWeek: week, thisMonth: month, thisYear: year, totalRevenue: allTime });
});

// @desc Admin: hide a transaction from the ADMIN Payments & Revenue list view only. Never a real
// delete - the record, its contribution to revenue totals (getRevenueStats never filters by
// these flags), and the customer's own view of it are all completely unaffected. Optionally also
// hides the linked order from the admin's Orders view the same way (see Order.deletedByAdmin) -
// never a real order delete either.
// @route DELETE /api/payments/:id
const deletePayment = asyncHandler(async (req, res) => {
  const alsoHideOrder = req.query.alsoDeleteOrder === "true";
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error("Transaction not found");
  }

  if (alsoHideOrder && payment.order) {
    await Order.findByIdAndUpdate(payment.order, { deletedByAdmin: true });
  }
  payment.deletedByAdmin = true;
  if (payment.deletedByCustomer) {
    await payment.deleteOne(); // hidden on both sides now - nothing left that needs the record
  } else {
    await payment.save();
  }

  res.json({ message: alsoHideOrder ? "Transaction and its order removed from admin view. Revenue is unaffected." : "Transaction removed from admin view. Revenue is unaffected." });
});

// @desc Customer: hide a transaction from THEIR OWN "My Payments" view only. Never a real
// delete - the admin's copy and revenue totals are completely unaffected.
// @route DELETE /api/payments/:id/mine
const deletePaymentForCustomer = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error("Transaction not found");
  }
  if (payment.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to remove this transaction");
  }
  payment.deletedByCustomer = true;
  if (payment.deletedByAdmin) {
    await payment.deleteOne(); // hidden on both sides now - nothing left that needs the record
  } else {
    await payment.save();
  }
  res.json({ message: "Transaction removed from your payment history." });
});

module.exports = {
  getMyPayments,
  getAllPayments,
  getRevenueStats,
  deletePayment,
  deletePaymentForCustomer,
};

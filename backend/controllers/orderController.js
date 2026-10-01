const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const Product = require("../models/Product");
const Settings = require("../models/Settings");
const { generateOrderNumber } = require("../utils/generateOrderNumber");
const { calculateShippingForLocation } = require("../utils/geo");
const { getActiveCampaigns, buildCampaignLookup, applyCampaignPricing } = require("../utils/salePricing");

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

// Shared validation used by every entry point that needs delivery info to be complete
// before anything is created or charged.
function validateDeliveryInfo(shippingAddress, preferredDeliveryDate) {
  const missing = [];
  if (!shippingAddress?.name) missing.push("full name");
  if (!shippingAddress?.phone) missing.push("phone number");
  // House / Flat No. is intentionally optional (some addresses don't have one) - only Street is
  // required here. This is the one line that previously forced House / Flat No., which is what
  // produced the misleading "Please complete your delivery information" error for addresses that
  // were otherwise perfectly valid.
  if (!shippingAddress?.street) missing.push("street");
  if (!shippingAddress?.city) missing.push("city");
  if (!shippingAddress?.state) missing.push("state");
  if (!shippingAddress?.pincode) missing.push("pincode");
  if (shippingAddress?.lat == null || shippingAddress?.lng == null) missing.push("delivery location on the map");
  if (!preferredDeliveryDate) missing.push("preferred delivery date");
  if (missing.length > 0) {
    const err = new Error(`Please complete your delivery information before proceeding to payment. Missing: ${missing.join(", ")}.`);
    err.statusCode = 400;
    throw err;
  }
}

// Validates stock + snapshots current prices WITHOUT touching the database. Used both to
// preview a Razorpay charge amount (no order created yet) and, moments later, to actually
// build the order. Re-run fresh at order-creation time too, in case stock changed in between.
//
// FEATURE 10 (variant-aware cart/orders): each cart line can optionally carry a `variantId`.
// When present, price/stock/name/image are all read from that specific color variant instead
// of the parent product, and stock is validated/decremented on the variant, not the product -
// so two different colors of the same product are fully independent for ordering purposes.
// Everything still works unchanged for products that have no variants at all.
async function buildOrderItemsAndTotals(items) {
  if (!items || items.length === 0) {
    const err = new Error("Your cart is empty");
    err.statusCode = 400;
    throw err;
  }
  const orderItems = [];
  let itemsTotal = 0;
  // Fetched once for the whole cart, not once per line item - and applied to each product
  // in-place right after it's fetched, BEFORE any variant is resolved via `.id(...)` below (see
  // applyCampaignPricing's own comment on why it never reassigns `product.variants` wholesale -
  // that's what keeps `.id(...)` working on the real Mongoose document here).
  const activeCampaigns = await getActiveCampaigns();
  const campaignLookup = activeCampaigns.length > 0 ? buildCampaignLookup(activeCampaigns) : null;
  for (const it of items) {
    const product = await Product.findById(it.productId);
    if (!product || product.status !== "active") {
      const err = new Error(`Product not available: ${it.productId}`);
      err.statusCode = 400;
      throw err;
    }
    if (campaignLookup) applyCampaignPricing(product, campaignLookup);

    let variant = null;
    if (it.variantId) {
      variant = product.variants.id(it.variantId);
      if (!variant || variant.status !== "active") {
        const err = new Error(`Selected color for "${product.name}" is no longer available.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const stock = variant ? variant.stock : product.stock;
    const displayName = variant ? variant.name || `${product.name} - ${variant.colorName}` : product.name;
    if (stock < it.quantity) {
      const err = new Error(`Not enough stock for "${displayName}". Only ${stock} left.`);
      err.statusCode = 400;
      throw err;
    }

    const basePrice = variant ? (variant.price ?? product.price) : product.price;
    const baseDiscountPrice = variant ? variant.discountPrice : product.discountPrice;
    const price = baseDiscountPrice && baseDiscountPrice < basePrice ? baseDiscountPrice : basePrice;
    const image = variant ? variant.images?.[0]?.url || product.images?.[0]?.url || "" : product.images?.[0]?.url || "";

    orderItems.push({
      product: product._id,
      name: displayName,
      image,
      price,
      quantity: it.quantity,
      variantId: variant ? variant._id : null,
      colorName: variant ? variant.colorName : "",
    });
    itemsTotal += price * it.quantity;
  }
  return { orderItems, itemsTotal };
}

async function calculateShippingFor(shippingAddress) {
  const settings = await Settings.getSingleton();
  if (settings.businessLocation?.lat == null) {
    const err = new Error("The shop hasn't set its business location yet - orders can't be placed until it does. Please contact us.");
    err.statusCode = 503;
    throw err;
  }
  return calculateShippingForLocation({
    businessLocation: settings.businessLocation,
    customerLat: shippingAddress.lat,
    customerLng: shippingAddress.lng,
    tiers: settings.shippingTiers,
  });
}

// The ONLY place an Order document is ever created and stock ever decremented. Called either
// immediately (UPI/WhatsApp - unverified manual methods, pending status) or only after a
// Razorpay signature has been verified (paid status) - never before payment for gateway
// methods, which is what previously let a cancelled/retried payment create duplicate orders
// and double-decrement stock.
async function createOrderRecord({ user, items, shippingAddress, preferredDeliveryDate, paymentMethod, paymentStatus, orderStatus, razorpayInfo }) {
  const { orderItems, itemsTotal } = await buildOrderItemsAndTotals(items);
  const shippingResult = await calculateShippingFor(shippingAddress);
  const shippingFee = shippingResult.shippingFee;
  const totalAmount = itemsTotal + shippingFee;
  const orderNumber = await generateOrderNumber();

  const estimatedDeliveryMin = new Date();
  estimatedDeliveryMin.setDate(estimatedDeliveryMin.getDate() + shippingResult.estimateDaysMin);

  const order = await Order.create({
    orderNumber,
    user: user._id,
    items: orderItems,
    shippingAddress,
    itemsTotal,
    shippingFee,
    deliveryDistanceKm: shippingResult.distanceKm,
    preferredDeliveryDate,
    estimatedDeliveryMin,
    estimatedDeliveryMax: shippingResult.estimatedDeliveryDate,
    totalAmount,
    paymentMethod,
    paymentStatus,
    orderStatus,
    statusHistory: [{ status: orderStatus, note: paymentStatus === "paid" ? "Payment verified, order confirmed" : "Order placed" }],
  });

  // Stock is only ever decremented here, at the single point an order actually exists.
  for (const it of orderItems) {
    if (it.variantId) {
      await Product.updateOne(
        { _id: it.product, "variants._id": it.variantId },
        { $inc: { "variants.$.stock": -it.quantity } }
      );
    } else {
      await Product.findByIdAndUpdate(it.product, { $inc: { stock: -it.quantity } });
    }
  }

  await Payment.create({
    user: user._id,
    order: order._id,
    amount: totalAmount,
    paymentMethod,
    status: paymentStatus === "paid" ? "success" : "pending",
    razorpayOrderId: razorpayInfo?.razorpayOrderId || "",
    razorpayPaymentId: razorpayInfo?.razorpayPaymentId || "",
    transactionId: razorpayInfo?.razorpayPaymentId || "",
  });

  return order;
}

// @desc Preview shipping charge + delivery estimate for a given delivery location, BEFORE placing
// an order. Purely informational for the checkout UI - order creation always recalculates this
// itself from the submitted coordinates, so a tampered frontend value can never change what's charged.
// @route POST /api/orders/calculate-shipping
const calculateShipping = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    res.status(400);
    throw new Error("Delivery location (latitude/longitude) is required");
  }
  const result = await calculateShippingFor({ lat, lng });
  res.json(result);
});

// @desc Place an order immediately for manual/unverified payment methods (UPI screenshot
// confirmation, WhatsApp order). These have no automated gateway verification step, so - like
// before - the order is created right away in "pending" status and confirmed manually by the
// admin later. NEVER used for Razorpay - see initiateRazorpayOrder/verifyRazorpayAndCreateOrder.
// @route POST /api/orders
const placeOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, preferredDeliveryDate } = req.body;
  if (paymentMethod === "razorpay") {
    res.status(400);
    throw new Error("Razorpay orders must go through /orders/razorpay/initiate, not this endpoint");
  }
  validateDeliveryInfo(shippingAddress, preferredDeliveryDate);
  const order = await createOrderRecord({
    user: req.user,
    items,
    shippingAddress,
    preferredDeliveryDate,
    paymentMethod,
    paymentStatus: "pending",
    orderStatus: "pending",
  });
  res.status(201).json(order);
});

// @desc Step 1 of the Razorpay flow: validates the cart and delivery info, computes the real
// server-side total, and opens a Razorpay payment order for that amount. Deliberately does
// NOT create a SubhRa order or touch stock yet - if the customer cancels or the payment fails,
// nothing was ever created, so retrying is always safe and never produces a duplicate order.
// @route POST /api/orders/razorpay/initiate
const initiateRazorpayOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, preferredDeliveryDate } = req.body;
  validateDeliveryInfo(shippingAddress, preferredDeliveryDate);

  const { itemsTotal } = await buildOrderItemsAndTotals(items);
  const shippingResult = await calculateShippingFor(shippingAddress);
  const totalAmount = itemsTotal + shippingResult.shippingFee;

  const instance = getRazorpayInstance();
  if (!instance) {
    res.status(503);
    throw new Error("Razorpay is not configured yet. Add RAZORPAY_KEY_ID/SECRET to the backend .env file.");
  }

  const razorpayOrder = await instance.orders.create({
    amount: Math.round(totalAmount * 100), // paise
    currency: "INR",
    receipt: `checkout-${req.user._id}-${Date.now()}`,
  });

  res.json({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    totalAmount,
  });
});

// @desc Step 2: verifies the Razorpay signature, and ONLY on success creates the actual order,
// decrements stock, and records the payment as successful - all in one place
// (createOrderRecord). This is the fix for orders/stock being created before payment
// succeeded, and for the duplicate-orderNumber bug on retried payments.
// @route POST /api/orders/razorpay/verify-and-create
const verifyRazorpayAndCreateOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, preferredDeliveryDate, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    res.status(400);
    throw new Error("Payment verification failed - signature mismatch");
  }

  validateDeliveryInfo(shippingAddress, preferredDeliveryDate);

  const order = await createOrderRecord({
    user: req.user,
    items,
    shippingAddress,
    preferredDeliveryDate,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    orderStatus: "confirmed",
    razorpayInfo: { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id },
  });

  res.status(201).json({ message: "Payment verified", order });
});

// @desc Get logged-in user's orders. Excludes orders this customer has deleted from their own
// view - deletion here never touches the underlying record (see deleteOrderForCustomer), so
// this is purely a visibility filter, not "orders that still exist".
// @route GET /api/orders/mine
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, deletedByCustomer: { $ne: true } }).sort({ createdAt: -1 });
  res.json(orders);
});

// @desc Get single order (owner of order, or admin)
// @route GET /api/orders/:id
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isStaff = req.user.role === "admin" || req.user.role === "owner";
  if (!isOwner && !isStaff) {
    res.status(403);
    throw new Error("Not authorized to view this order");
  }
  res.json(order);
});

// @desc Admin: list all orders
// @desc Admin: list all orders. Excludes orders the admin has deleted from their own view -
// deletion here never touches the underlying record (see deleteOrder), so this is purely a
// visibility filter; the customer's own My Orders list is entirely unaffected by it.
// @route GET /api/orders
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, search } = req.query;
  const filter = { deletedByAdmin: { $ne: true } };
  if (status) filter.orderStatus = status;
  if (search) filter.orderNumber = { $regex: search, $options: "i" };
  const orders = await Order.find(filter).populate("user", "name email phone").sort({ createdAt: -1 });
  res.json(orders);
});

// @desc Admin: update order status / tracking info
// @route PUT /api/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus, courier, trackingNumber, expectedDelivery, note, paymentStatus } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (orderStatus) {
    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, note: note || "" });
  }
  if (courier !== undefined) order.courier = courier;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (expectedDelivery) order.expectedDelivery = expectedDelivery;
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
    await Payment.findOneAndUpdate(
      { order: order._id },
      { status: paymentStatus === "paid" ? "success" : paymentStatus }
    );
  }
  await order.save();
  res.json(order);
});

// @desc Admin: hide an order from the ADMIN order-history view only. Never deletes the order
// record or its Payment/revenue record - see the deletedByAdmin/deletedByCustomer split on the
// Order model. The customer's own My Orders is completely unaffected. If the customer has
// already removed their own view of this order too, the now-invisible-to-everyone order record
// is garbage-collected - its Payment record is NEVER touched here regardless, so revenue is
// unaffected either way, forever, until an explicit Payments & Revenue delete action.
// @route DELETE /api/orders/:id
const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  order.deletedByAdmin = true;
  if (order.deletedByCustomer) {
    await order.deleteOne(); // hidden on both sides now - nothing left that needs the record
  } else {
    await order.save();
  }
  res.json({ message: "Order removed from admin order history. The customer's own order history and revenue are unaffected." });
});

// @desc Admin: hide EVERY currently-visible order from the ADMIN order-history view only - same
// visibility-only semantics as deleteOrder above, applied in bulk. Never touches Payment
// records, so Payments & Revenue is completely unaffected, and customer order histories are
// untouched.
// @route DELETE /api/orders/admin/delete-all
const deleteAllOrders = asyncHandler(async (req, res) => {
  const result = await Order.updateMany({ deletedByAdmin: { $ne: true } }, { deletedByAdmin: true });
  await Order.deleteMany({ deletedByAdmin: true, deletedByCustomer: true }); // see deleteOrder's comment
  res.json({
    message: "All orders cleared from the admin order-history view. Customer order histories and business revenue are unaffected.",
    clearedCount: result.modifiedCount,
  });
});

// @desc Customer: hide an order from THEIR OWN "My Orders" view only. Never deletes the order
// record, its Payment/revenue record, or the admin's copy.
// @route DELETE /api/orders/:id/mine
const deleteOrderForCustomer = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to remove this order");
  }
  order.deletedByCustomer = true;
  if (order.deletedByAdmin) {
    await order.deleteOne(); // hidden on both sides now - nothing left that needs the record
  } else {
    await order.save();
  }
  res.json({ message: "Order removed from your order history." });
});

// @desc Admin: mark all currently-unseen orders as seen, resetting the notification badge.
// Purely a read-state flag - never deletes or otherwise modifies order data. Called
// automatically when the admin opens the Orders page, NOT by the Reset/delete-all button.
// @route PUT /api/orders/admin/mark-seen
const markOrdersSeen = asyncHandler(async (req, res) => {
  const result = await Order.updateMany({ isAdminSeen: false }, { isAdminSeen: true });
  res.json({ message: "Orders marked as seen", markedCount: result.modifiedCount });
});

// @desc Generate a per-order PDF invoice. Only available once payment is confirmed, and only
// to the order's own customer or staff. Contains ONLY this one order's data - no other
// customers, no site-wide revenue.
// @route GET /api/orders/:id/invoice
const getOrderInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isStaff = req.user.role === "admin" || req.user.role === "owner";
  if (!isOwner && !isStaff) {
    res.status(403);
    throw new Error("Not authorized to view this invoice");
  }
  if (order.paymentStatus !== "paid") {
    res.status(400);
    throw new Error("An invoice is only available once payment has been confirmed");
  }

  const { streamInvoicePdf } = require("../utils/invoice");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="SubhRa-Crafts-Invoice-${order.orderNumber}.pdf"`);
  streamInvoicePdf(order, res);
});

module.exports = {
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
};

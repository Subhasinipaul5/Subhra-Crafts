const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  createCustomOrder,
  getMyCustomOrders,
  getAllCustomOrders,
  updateCustomOrder,
  deleteCustomOrder,
  deleteAllCustomOrders,
  markCustomOrdersSeen,
} = require("../controllers/customOrderController");

// Optional auth: attach user if a valid token is present, but don't require login
const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return next();
  try {
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch (e) {
    /* ignore invalid token for optional auth */
  }
  next();
};

router.put("/admin/mark-seen", protect, adminOnly, markCustomOrdersSeen);
router.delete("/admin/delete-all", protect, adminOnly, deleteAllCustomOrders);

router.post("/", optionalAuth, createCustomOrder);
router.get("/mine", protect, getMyCustomOrders);
router.get("/", protect, adminOnly, getAllCustomOrders);
router.put("/:id", protect, adminOnly, updateCustomOrder);
router.delete("/:id", protect, adminOnly, deleteCustomOrder);

module.exports = router;

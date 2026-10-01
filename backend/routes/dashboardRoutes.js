const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const { getDashboardStats, getNotificationCounts } = require("../controllers/dashboardController");

router.get("/", protect, adminOnly, getDashboardStats);
router.get("/notifications", protect, adminOnly, getNotificationCounts);

module.exports = router;

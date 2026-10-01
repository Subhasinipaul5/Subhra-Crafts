const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getDashboard,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignAnalytics,
  trackClick,
  getMetaStatus,
} = require("../controllers/adController");

// Public - this is the actual link shared on Instagram/Facebook, must not require login.
router.get("/track/:slug", trackClick);

// Admin only
router.get("/dashboard", protect, adminOnly, getDashboard);
router.get("/meta-status", protect, adminOnly, getMetaStatus);
router.get("/", protect, adminOnly, getCampaigns);
router.post("/", protect, adminOnly, createCampaign);
router.get("/:id", protect, adminOnly, getCampaign);
router.put("/:id", protect, adminOnly, updateCampaign);
router.delete("/:id", protect, adminOnly, deleteCampaign);
router.get("/:id/analytics", protect, adminOnly, getCampaignAnalytics);

module.exports = router;

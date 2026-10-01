const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const {
  getActiveSales,
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} = require("../controllers/saleCampaignController");

// Public
router.get("/", getActiveSales);

// Admin - /admin/all must be declared before /:id so Express doesn't treat "admin" as an :id
router.get("/admin/all", protect, adminOnly, getAllCampaigns);
router.get("/:id", protect, adminOnly, getCampaignById);
router.post("/", protect, adminOnly, createCampaign);
router.put("/:id", protect, adminOnly, updateCampaign);
router.delete("/:id", protect, adminOnly, deleteCampaign);

module.exports = router;

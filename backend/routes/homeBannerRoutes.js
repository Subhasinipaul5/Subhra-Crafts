const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const { getActiveSlides, getAllSlides, createSlide, updateSlide, reorderSlides, deleteSlide } = require("../controllers/homeBannerController");

router.get("/", getActiveSlides);
router.get("/admin", protect, adminOnly, getAllSlides);
router.post("/", protect, adminOnly, createSlide);
router.put("/reorder", protect, adminOnly, reorderSlides);
router.put("/:id", protect, adminOnly, updateSlide);
router.delete("/:id", protect, adminOnly, deleteSlide);

module.exports = router;

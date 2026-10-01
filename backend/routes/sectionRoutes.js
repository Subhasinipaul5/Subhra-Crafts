const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const { getSections, getSection, createSection, updateSection, deleteSection } = require("../controllers/sectionController");

router.get("/", getSections);
router.get("/:id", getSection);
router.post("/", protect, adminOnly, createSection);
router.put("/:id", protect, adminOnly, updateSection);
router.delete("/:id", protect, adminOnly, deleteSection);

module.exports = router;

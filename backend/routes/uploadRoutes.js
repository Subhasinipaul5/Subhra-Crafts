const express = require("express");
const router = express.Router();
const asyncHandler = require("express-async-handler");
const { protect, adminOnly } = require("../middleware/auth");
const { upload, isCloudinaryConfigured } = require("../config/cloudinary");

const requireCloudinary = (req, res, next) => {
  if (!isCloudinaryConfigured) {
    res.status(503);
    throw new Error(
      "Image uploads aren't set up yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and " +
        "CLOUDINARY_API_SECRET to backend/.env (free account at cloudinary.com), then restart the server."
    );
  }
  next();
};

// @desc Admin: upload one or more images (products, categories, sections, reviews)
// @route POST /api/upload
router.post(
  "/",
  protect,
  adminOnly,
  requireCloudinary,
  upload.array("images", 8),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error("No files uploaded");
    }
    const images = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
    res.status(201).json({ images });
  })
);

// @desc Any logged-in user: upload images for their OWN profile photo or a product review.
// Deliberately NOT adminOnly - customers need this for reviews & profile pictures.
// @route POST /api/upload/personal
router.post(
  "/personal",
  protect,
  requireCloudinary,
  upload.array("images", 4),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error("No files uploaded");
    }
    const images = req.files.map((f) => ({ url: f.path, publicId: f.filename }));
    res.status(201).json({ images });
  })
);

// @desc Admin: permanently delete a single uploaded image from Cloudinary storage. The
// frontend removes the image from whatever array it belonged to (base product images, a
// variant's images, or a variant's Virtual Try-On asset) in its own state and saves the
// product as normal - this endpoint only ever deletes the one file named, nothing else.
// @route DELETE /api/upload
router.delete(
  "/",
  protect,
  adminOnly,
  requireCloudinary,
  asyncHandler(async (req, res) => {
    const { publicId } = req.body;
    if (!publicId) {
      res.status(400);
      throw new Error("publicId is required");
    }
    const { cloudinary } = require("../config/cloudinary");
    const result = await cloudinary.uploader.destroy(publicId);
    res.json({ result });
  })
);

module.exports = router;

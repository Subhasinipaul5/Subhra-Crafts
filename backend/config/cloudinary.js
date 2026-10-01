const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (!isCloudinaryConfigured) {
  console.warn(
    "\n⚠️  Cloudinary is not configured (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET missing in .env).\n" +
    "   Image uploads will fail until you add your Cloudinary credentials to backend/.env.\n" +
    "   Sign up free at https://cloudinary.com and copy the values from your dashboard.\n"
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "subhra-crafts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  },
});

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

module.exports = { cloudinary, upload, isCloudinaryConfigured };

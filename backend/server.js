require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

connectDB().then(() => require("./utils/ensureCounters")().catch((err) => console.error("Counter seed error:", err)));

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

// GETs (product listings, categories, settings, sales, etc.) are read-only and not a brute-
// force/abuse risk the way auth or write endpoints are - a single page load can easily fire
// 15-20+ of them (more in dev, where React StrictMode double-invokes effects), so counting them
// against the same tight budget as everything else caused real, hard-to-diagnose failures:
// browsing the site during normal use/testing could exhaust the limit, after which EVERY
// request started failing - including login, which then showed a misleading "invalid
// credentials" message instead of the real cause (see the auth-specific limiter below for why
// that's now a distinct, clearer failure).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: (req) => req.method === "GET",
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a moment and try again." },
});
app.use("/api", apiLimiter);

// A separate, stricter limiter scoped ONLY to auth (login/register/password endpoints) - this is
// the one that actually matters for brute-force protection, so it stays tight regardless of how
// generous the general limiter above is. Returns a real JSON body with a `message` field so the
// frontend can show an accurate "too many attempts" toast instead of falling through to a
// generic (and here, actively misleading) error message.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again." },
});
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", store: "SubhRa Crafts API" }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api/custom-orders", require("./routes/customOrderRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/sections", require("./routes/sectionRoutes"));
app.use("/api/admin/users", require("./routes/adminUserRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/home-banner", require("./routes/homeBannerRoutes"));
app.use("/api/ads", require("./routes/adRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/sales", require("./routes/saleRoutes"));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SubhRa Crafts API running on port ${PORT}`));

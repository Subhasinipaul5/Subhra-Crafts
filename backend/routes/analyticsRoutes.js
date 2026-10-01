const express = require("express");
const router = express.Router();
const { protect, adminOnly, optionalAuth } = require("../middleware/auth");
const {
  startSession,
  trackEvent,
  getSummary,
  getVisitorsOverTime,
  getTrafficSources,
  getCountries,
  getTopProducts,
  getFunnel,
  getRecentVisitors,
  getFilterOptions,
} = require("../controllers/analyticsController");

// Public - called anonymously (or, if logged in, with identity) by every visitor's browser (see
// frontend/src/lib/analytics.js). optionalAuth decodes the token when present WITHOUT requiring
// one - this is what lets the controller tell "logged-in customer" apart from "anonymous
// visitor" apart from "admin/owner" (whose activity is then dropped entirely, server-side).
router.post("/session", optionalAuth, startSession);
router.post("/event", optionalAuth, trackEvent);

// Admin only - the dashboard itself.
router.get("/summary", protect, adminOnly, getSummary);
router.get("/visitors-over-time", protect, adminOnly, getVisitorsOverTime);
router.get("/traffic-sources", protect, adminOnly, getTrafficSources);
router.get("/countries", protect, adminOnly, getCountries);
router.get("/top-products", protect, adminOnly, getTopProducts);
router.get("/funnel", protect, adminOnly, getFunnel);
router.get("/recent-visitors", protect, adminOnly, getRecentVisitors);
router.get("/filter-options", protect, adminOnly, getFilterOptions);

module.exports = router;

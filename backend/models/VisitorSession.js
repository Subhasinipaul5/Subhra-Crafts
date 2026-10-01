const mongoose = require("mongoose");

// FEATURE 2 (analytics) - one document per anonymous browser session. Deliberately minimal:
// no names, emails, or raw IP addresses are ever stored here - just enough to power the admin
// analytics dashboard (source/device/approx. location/activity counters). If the visitor is
// logged in, `user` links to their account for internal use only; nothing here is shown next
// to a name anywhere in the UI (see AdminAnalytics.jsx - it always displays the anonymized
// `sessionId` prefix instead, e.g. "Visitor #A81F").
const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Denormalized on purpose (avoids a populate() on every analytics query) - only ever set
    // for a logged-in, non-admin customer. See analyticsController.startSession/trackEvent for
    // where this is populated, and the hard admin-exclusion check that runs before it.
    email: { type: String, default: "" },

    isNewVisitor: { type: Boolean, default: true }, // set once, from the frontend, on first-ever visit from that browser

    // Where this visitor's FIRST session in our records came from. Detected from the referrer
    // header + UTM params at session-start (see analyticsController.startSession).
    source: {
      type: String,
      enum: ["instagram", "facebook", "google", "whatsapp", "direct", "campaign", "other"],
      default: "direct",
    },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "AdCampaign", default: null },
    utm: {
      source: { type: String, default: "" },
      medium: { type: String, default: "" },
      campaign: { type: String, default: "" },
      content: { type: String, default: "" },
    },

    device: { type: String, enum: ["mobile", "tablet", "desktop", "unknown"], default: "unknown" },
    browser: { type: String, default: "Unknown" },
    os: { type: String, default: "Unknown" },

    // Best-effort, coarse geolocation resolved ONCE from the request IP at session creation via
    // a free IP-geolocation lookup (see backend/utils/geoip.js) - the raw IP itself is hashed,
    // never stored in the clear, and never surfaced in the admin UI.
    country: { type: String, default: "" },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    ipHash: { type: String, default: "" },

    lastPath: { type: String, default: "" },
    lastPageTitle: { type: String, default: "" },
    pageViews: { type: Number, default: 0 },
    eventsCount: { type: Number, default: 0 },

    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

visitorSessionSchema.index({ createdAt: -1 });
visitorSessionSchema.index({ source: 1, createdAt: -1 });
visitorSessionSchema.index({ campaign: 1 });
visitorSessionSchema.index({ country: 1 });

module.exports = mongoose.model("VisitorSession", visitorSessionSchema);

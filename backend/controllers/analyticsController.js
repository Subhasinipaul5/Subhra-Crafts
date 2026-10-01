const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const crypto = require("crypto");
const VisitorSession = require("../models/VisitorSession");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const AdCampaign = require("../models/AdCampaign");
const Product = require("../models/Product");
const { lookupGeoIP } = require("../utils/geoip");
const { parseUserAgent } = require("../utils/userAgent");

// Staff roles (see User.js: owner/admin/customer) whose OWN activity must never appear in
// customer analytics - browsing their own storefront to test something is not a real visit.
const isStaff = (user) => !!user && (user.role === "admin" || user.role === "owner");

// ============================================================================
// Public tracking endpoints - called by frontend/src/lib/analytics.js. Sit behind `optionalAuth`
// (see analyticsRoutes.js) so a logged-in customer's activity can be attributed to their
// account, while an anonymous visitor can still call the same endpoint. Deliberately tiny
// payloads and no unnecessary PII, and the whole /api router already sits behind the global
// rate limiter (see server.js).
// ============================================================================

const detectSource = (referrer = "", utm = {}) => {
  if (utm?.source) {
    const s = utm.source.toLowerCase();
    if (s.includes("instagram")) return "instagram";
    if (s.includes("facebook")) return "facebook";
    if (s.includes("google")) return "google";
    if (s.includes("whatsapp")) return "whatsapp";
    return "campaign";
  }
  const r = (referrer || "").toLowerCase();
  if (!r) return "direct";
  if (r.includes("instagram.com")) return "instagram";
  if (r.includes("facebook.com") || r.includes("fb.com")) return "facebook";
  if (r.includes("google.")) return "google";
  if (r.includes("whatsapp.com") || r.includes("wa.me")) return "whatsapp";
  return "other";
};

const hashIp = (ip) => (ip ? crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16) : "");

const getClientIp = (req) => (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString();

// @desc Create (or refresh) a visitor session. Called once per browser tab session by
// analytics.js. `sessionId` is a random ID the frontend generates and keeps in localStorage.
// If a valid customer token is attached, the session is linked to that account (user id +
// email); if the token belongs to an admin/owner, NOTHING is recorded at all - this is the
// backend enforcement of admin-exclusion, independent of whatever the frontend does or doesn't
// call (see FEATURE: admin exclusion in the task doc).
// @route POST /api/analytics/session
const startSession = asyncHandler(async (req, res) => {
  // Backend-enforced admin exclusion - the single source of truth. A frontend that never calls
  // this at all for an admin session is just a bandwidth optimization on top of this check.
  if (isStaff(req.user)) return res.json({ ok: true, skipped: true });

  const { sessionId, isNewVisitor, referrer, utm, path, campaignSlug } = req.body;
  if (!sessionId) {
    res.status(400);
    throw new Error("sessionId is required");
  }

  const identity = req.user ? { user: req.user._id, email: req.user.email || "" } : {};

  let session = await VisitorSession.findOne({ sessionId });
  if (session) {
    session.lastSeenAt = new Date();
    if (path) session.lastPath = path;
    // A visitor can be anonymous at first, then log in mid-session - attach identity once known.
    if (req.user && !session.user) Object.assign(session, identity);
    await session.save();
    return res.json({ ok: true });
  }

  const { device, browser, os } = parseUserAgent(req.headers["user-agent"] || "");
  const ip = getClientIp(req);

  let campaign = null;
  if (campaignSlug) {
    campaign = await AdCampaign.findOne({ trackingSlug: campaignSlug }).select("_id");
  }

  session = await VisitorSession.create({
    sessionId,
    ...identity,
    isNewVisitor: !!isNewVisitor,
    source: campaign ? "campaign" : detectSource(referrer, utm),
    campaign: campaign?._id || null,
    utm: utm || {},
    device,
    browser,
    os,
    lastPath: path || "",
    ipHash: hashIp(ip),
  });

  // Geolocation is best-effort and never blocks the response - resolve after replying.
  lookupGeoIP(ip).then(async (geo) => {
    if (!geo.country) return;
    await VisitorSession.updateOne({ _id: session._id }, { $set: geo }).catch(() => {});
  });

  res.json({ ok: true });
});

// @desc Log one analytics event. See AnalyticsEvent.EVENT_TYPES for the allowed `type` values.
// Same backend-enforced admin exclusion as startSession - an admin/owner token means this is a
// silent no-op, never a recorded event.
//
// De-duplication: "view" events (page_view/product_view) are naturally idempotent per page
// load - a customer opening one product page should only ever count as ONE product_view, no
// matter how many times an effect happens to re-run (React 18 StrictMode intentionally
// double-invokes effects in dev - see main.jsx - and fast re-renders/retries can too). Rather
// than trying to guarantee this client-side (fragile - refs don't reliably survive StrictMode's
// mount/unmount/remount cycle), the server treats an identical view event for the same
// session+type+product/path arriving within a few seconds as a duplicate and drops it. Action
// events (add_to_cart, wishlist_add, purchase, etc.) are NOT de-duped this way, since a customer
// legitimately clicking "Add to Cart" twice in a row should count twice.
// @route POST /api/analytics/event
const VIEW_EVENT_TYPES = ["page_view", "product_view"];
const DEDUPE_WINDOW_MS = 4000;

const trackEvent = asyncHandler(async (req, res) => {
  if (isStaff(req.user)) return res.status(201).json({ ok: true, skipped: true });

  const { sessionId, type, path, productId, variantId, campaignSlug, orderId, meta } = req.body;
  if (!sessionId || !type) {
    res.status(400);
    throw new Error("sessionId and type are required");
  }
  if (!AnalyticsEvent.EVENT_TYPES.includes(type)) {
    res.status(400);
    throw new Error("Unknown event type");
  }

  if (VIEW_EVENT_TYPES.includes(type)) {
    const dupeQuery = { sessionId, type, createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } };
    if (type === "product_view") dupeQuery.product = productId || null;
    else dupeQuery.path = path || "";
    const recent = await AnalyticsEvent.findOne(dupeQuery).select("_id").lean();
    if (recent) return res.status(201).json({ ok: true, deduped: true });
  }

  let campaign = null;
  if (campaignSlug) {
    campaign = await AdCampaign.findOne({ trackingSlug: campaignSlug }).select("_id");
  }

  await AnalyticsEvent.create({
    sessionId,
    type,
    path: path || "",
    product: productId || null,
    variantId: variantId || null,
    campaign: campaign?._id || null,
    order: orderId || null,
    meta: meta || {},
  });

  const identity = req.user ? { user: req.user._id, email: req.user.email || "" } : {};
  await VisitorSession.updateOne(
    { sessionId },
    {
      $set: { lastSeenAt: new Date(), ...(path ? { lastPath: path } : {}), ...identity },
      $inc: { eventsCount: 1, ...(type === "page_view" ? { pageViews: 1 } : {}) },
    }
  ).catch(() => {});

  res.status(201).json({ ok: true });
});

// ============================================================================
// Admin dashboard endpoints - all protected+adminOnly (see analyticsRoutes.js). Every number
// below comes from an actual aggregation over VisitorSession/AnalyticsEvent - nothing is
// hard-coded, and an empty database simply produces zeros/empty arrays.
// ============================================================================

const RANGE_PRESETS = {
  today: () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to: new Date() };
  },
  yesterday: () => {
    const from = new Date();
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  },
  last7: () => ({ from: new Date(Date.now() - 7 * 86400000), to: new Date() }),
  last30: () => ({ from: new Date(Date.now() - 30 * 86400000), to: new Date() }),
  thisMonth: () => {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date() };
  },
};

function resolveRange(query) {
  const { range, from, to } = query;
  if (range === "custom" && from && to) {
    return { from: new Date(from), to: new Date(new Date(to).setHours(23, 59, 59, 999)) };
  }
  const preset = RANGE_PRESETS[range] || RANGE_PRESETS.last30;
  return preset();
}

// Resolves the shared query filters (country/source/platform/campaign/product/device) into
// Mongo match fragments. `platform` is a campaign attribute, so it's resolved to a set of
// campaign ids first.
//
// IMPORTANT: aggregate() pipelines do NOT get Mongoose's automatic string->ObjectId casting
// that find()/findOne() give you for free - a raw hex string compared against an ObjectId field
// in $match simply never matches. This was the exact bug behind "Product Views = 48 overall but
// 0 when filtered by a specific product": `eventMatch.product` was being set to the raw string
// from the query param instead of a real ObjectId. Every id-shaped filter below is now
// explicitly cast.
async function resolveFilters(query) {
  const { country, source, platform, campaign, product, device } = query;
  const sessionMatch = {};
  const eventMatch = {};

  if (country) sessionMatch.country = country;
  if (source) sessionMatch.source = source;
  if (device) sessionMatch.device = device;

  const toObjectId = (id) => {
    try {
      return new mongoose.Types.ObjectId(id);
    } catch {
      return null; // malformed id - filter to "matches nothing" rather than throwing
    }
  };

  let campaignIds = null;
  if (campaign) {
    const id = toObjectId(campaign);
    campaignIds = id ? [id] : [];
  } else if (platform) {
    const campaigns = await AdCampaign.find({ platform }).select("_id");
    campaignIds = campaigns.map((c) => c._id);
  }
  if (campaignIds) {
    sessionMatch.campaign = { $in: campaignIds };
    eventMatch.campaign = { $in: campaignIds };
  }

  if (product) {
    const id = toObjectId(product);
    // An unparseable id should match nothing, not "no filter" (null) and not "product is
    // unset" (which is what {product: null} would actually match in Mongo) - a fresh random
    // ObjectId guarantees zero matches without special-casing either of those.
    eventMatch.product = id || new mongoose.Types.ObjectId();
  }

  return { sessionMatch, eventMatch };
}

// @desc Top summary cards.
// @route GET /api/analytics/summary
const getSummary = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { sessionMatch, eventMatch } = await resolveFilters(req.query);
  const dateMatch = { createdAt: { $gte: from, $lte: to } };

  const [sessions, newVisitors, eventCounts] = await Promise.all([
    VisitorSession.countDocuments({ ...sessionMatch, ...dateMatch }),
    VisitorSession.countDocuments({ ...sessionMatch, ...dateMatch, isNewVisitor: true }),
    AnalyticsEvent.aggregate([
      { $match: { ...eventMatch, ...dateMatch } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const counts = Object.fromEntries(eventCounts.map((e) => [e._id, e.count]));
  const pageViews = counts.page_view || 0;
  const productViews = counts.product_view || 0;
  const addToCart = counts.add_to_cart || 0;
  const checkoutVisits = counts.checkout_start || 0;
  const orders = counts.purchase || 0;
  const adClicks = counts.advertisement_click || 0;
  const virtualTryOnOpens = counts.virtual_tryon_open || 0;

  res.json({
    totalVisitors: sessions,
    uniqueVisitors: sessions, // one document per browser session already = unique per session
    sessions,
    newVisitors,
    returningVisitors: Math.max(sessions - newVisitors, 0),
    pageViews,
    productViews,
    addToCart,
    wishlistAdds: counts.wishlist_add || 0,
    buyNowClicks: counts.buy_now || 0,
    checkoutVisits,
    orders,
    advertisementClicks: adClicks,
    virtualTryOnOpens,
    conversionRate: sessions > 0 ? Number(((orders / sessions) * 100).toFixed(2)) : 0,
  });
});

// @desc Visitors + page views per day, for a line chart.
// @route GET /api/analytics/visitors-over-time
const getVisitorsOverTime = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { sessionMatch } = await resolveFilters(req.query);

  const rows = await VisitorSession.aggregate([
    { $match: { ...sessionMatch, createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        visitors: { $sum: 1 },
        pageViews: { $sum: "$pageViews" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(rows.map((r) => ({ date: r._id, visitors: r.visitors, pageViews: r.pageViews })));
});

// @desc Visitor count grouped by traffic source, for a pie/bar chart.
// @route GET /api/analytics/traffic-sources
const getTrafficSources = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { sessionMatch } = await resolveFilters(req.query);

  const rows = await VisitorSession.aggregate([
    { $match: { ...sessionMatch, createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: "$source", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json(rows.map((r) => ({ source: r._id, count: r.count })));
});

// @desc Visitor count grouped by (best-effort) country.
// @route GET /api/analytics/countries
const getCountries = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { sessionMatch } = await resolveFilters(req.query);

  const rows = await VisitorSession.aggregate([
    { $match: { ...sessionMatch, createdAt: { $gte: from, $lte: to }, country: { $ne: "" } } },
    { $group: { _id: { country: "$country", region: "$region", city: "$city" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 30 },
  ]);

  res.json(
    rows.map((r) => ({ country: r._id.country, region: r._id.region, city: r._id.city, count: r.count }))
  );
});

// @desc "Most Interested Products" - views/unique viewers/add-to-cart/wishlist/purchases per product.
// @route GET /api/analytics/top-products
const getTopProducts = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { eventMatch } = await resolveFilters(req.query);
  // `product: { $ne: null }` only makes sense as a DEFAULT ("exclude non-product events") - if
  // resolveFilters already narrowed eventMatch.product to one specific id, that must win, so
  // eventMatch is spread AFTER dateMatch here (object spread: later keys override earlier ones).
  const dateMatch = { createdAt: { $gte: from, $lte: to }, product: { $ne: null } };

  const rows = await AnalyticsEvent.aggregate([
    { $match: { ...dateMatch, ...eventMatch } },
    {
      $group: {
        _id: "$product",
        views: { $sum: { $cond: [{ $eq: ["$type", "product_view"] }, 1, 0] } },
        uniqueViewers: { $addToSet: { $cond: [{ $eq: ["$type", "product_view"] }, "$sessionId", "$$REMOVE"] } },
        addToCart: { $sum: { $cond: [{ $eq: ["$type", "add_to_cart"] }, 1, 0] } },
        wishlist: { $sum: { $cond: [{ $eq: ["$type", "wishlist_add"] }, 1, 0] } },
        buyNow: { $sum: { $cond: [{ $eq: ["$type", "buy_now"] }, 1, 0] } },
        purchases: { $sum: { $cond: [{ $eq: ["$type", "purchase"] }, 1, 0] } },
      },
    },
    {
      $addFields: {
        uniqueViewers: { $size: "$uniqueViewers" },
        interestScore: {
          $add: [
            "$views",
            { $multiply: ["$addToCart", 3] },
            { $multiply: ["$wishlist", 2] },
            { $multiply: ["$purchases", 5] },
          ],
        },
      },
    },
    { $sort: { interestScore: -1 } },
    { $limit: 20 },
    { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        productId: "$_id",
        name: "$product.name",
        slug: "$product.slug",
        image: { $arrayElemAt: ["$product.images.url", 0] },
        views: 1,
        uniqueViewers: 1,
        addToCart: 1,
        wishlist: 1,
        buyNow: 1,
        purchases: 1,
        interestScore: 1,
      },
    },
  ]);

  res.json(rows.filter((r) => r.name)); // drop rows for since-deleted products
});

// @desc Conversion funnel: visitors -> product views -> add to cart -> checkout -> purchase.
// @route GET /api/analytics/funnel
const getFunnel = asyncHandler(async (req, res) => {
  const { from, to } = resolveRange(req.query);
  const { sessionMatch, eventMatch } = await resolveFilters(req.query);
  const dateMatch = { createdAt: { $gte: from, $lte: to } };

  const [visitors, counts] = await Promise.all([
    VisitorSession.countDocuments({ ...sessionMatch, ...dateMatch }),
    AnalyticsEvent.aggregate([
      { $match: { ...eventMatch, ...dateMatch, type: { $in: ["product_view", "add_to_cart", "checkout_start", "purchase"] } } },
      { $group: { _id: "$type", sessions: { $addToSet: "$sessionId" } } },
    ]),
  ]);

  const bySessionCount = Object.fromEntries(counts.map((c) => [c._id, c.sessions.length]));
  res.json({
    visitors,
    productViews: bySessionCount.product_view || 0,
    addToCart: bySessionCount.add_to_cart || 0,
    checkout: bySessionCount.checkout_start || 0,
    purchase: bySessionCount.purchase || 0,
  });
});

// @desc Most recent visitor sessions. Logged-in customers are shown by email (never a password
// or other account detail); anonymous visitors get a short anonymized label. Admin/owner
// sessions are never present here at all, because startSession/trackEvent never create them.
// @route GET /api/analytics/recent-visitors
const getRecentVisitors = asyncHandler(async (req, res) => {
  const sessions = await VisitorSession.find({}).sort({ lastSeenAt: -1 }).limit(25).lean();
  res.json(
    sessions.map((s) => ({
      visitorLabel: s.email || `Anonymous Visitor #${s.sessionId.slice(-4).toUpperCase()}`,
      isLoggedIn: !!s.email,
      country: s.country || "Unknown",
      source: s.source,
      device: s.device,
      browser: s.browser,
      lastPath: s.lastPath || "Unknown",
      lastSeenAt: s.lastSeenAt,
    }))
  );
});

// @desc Lightweight lists for populating the filter dropdowns (countries/sources/campaigns/products).
// @route GET /api/analytics/filter-options
const getFilterOptions = asyncHandler(async (req, res) => {
  const [countries, campaigns, products] = await Promise.all([
    VisitorSession.distinct("country", { country: { $ne: "" } }),
    AdCampaign.find({}).select("title _id").sort({ createdAt: -1 }).limit(100),
    Product.find({ status: { $ne: "inactive" } }).select("name _id").sort({ name: 1 }).limit(300),
  ]);
  res.json({
    countries: countries.sort(),
    sources: ["instagram", "facebook", "google", "whatsapp", "direct", "campaign", "other"],
    devices: ["mobile", "tablet", "desktop"],
    campaigns: campaigns.map((c) => ({ id: c._id, title: c.title })),
    products: products.map((p) => ({ id: p._id, name: p.name })),
  });
});

module.exports = {
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
};

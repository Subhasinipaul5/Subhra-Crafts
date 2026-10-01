const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const AdCampaign = require("../models/AdCampaign");
const VisitorSession = require("../models/VisitorSession");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Product = require("../models/Product");
const { isMetaConfigured } = require("../config/meta");

const trackingUrlFor = (req, slug) => {
  const base = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/api/ads/track/${slug}`;
};

const withComputed = (req, campaign) => ({
  ...campaign,
  trackingUrl: trackingUrlFor(req, campaign.trackingSlug),
  finalUrl: `${campaign.destinationUrl}${campaign.destinationUrl.includes("?") ? "&" : "?"}utm_source=${campaign.utm.source}&utm_medium=${campaign.utm.medium}&utm_campaign=${campaign.utm.campaign}&utm_content=${campaign.utm.content}`,
});

// @desc Admin dashboard summary cards.
// @route GET /api/ads/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [total, active, scheduled, completed, totals] = await Promise.all([
    AdCampaign.countDocuments({}),
    AdCampaign.countDocuments({ status: "active" }),
    AdCampaign.countDocuments({ status: "scheduled" }),
    AdCampaign.countDocuments({ status: "completed" }),
    AdCampaign.aggregate([{ $group: { _id: null, clicks: { $sum: "$clicks" }, visitors: { $sum: "$visitors" } } }]),
  ]);
  res.json({
    totalCampaigns: total,
    activeCampaigns: active,
    scheduledCampaigns: scheduled,
    completedCampaigns: completed,
    totalClicks: totals[0]?.clicks || 0,
    totalVisitors: totals[0]?.visitors || 0,
    metaConnected: isMetaConfigured(),
  });
});

// @desc List all campaigns.
// @route GET /api/ads
const getCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await AdCampaign.find({})
    .sort({ createdAt: -1 })
    .populate("products.product", "name slug images")
    .lean();
  res.json(campaigns.map((c) => withComputed(req, c)));
});

// @desc Single campaign.
// @route GET /api/ads/:id
const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await AdCampaign.findById(req.params.id).populate("products.product", "name slug images variants").lean();
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  res.json(withComputed(req, campaign));
});

// @desc Create a campaign. trackingSlug + utm are generated automatically (see AdCampaign.pre("validate")).
// @route POST /api/ads
const createCampaign = asyncHandler(async (req, res) => {
  const { title, description, image, platform, status, products, destinationUrl, startDate, endDate } = req.body;
  if (!title || !platform || !destinationUrl) {
    res.status(400);
    throw new Error("Title, platform, and destination URL are required.");
  }
  if (!products || products.length === 0) {
    res.status(400);
    throw new Error("Select at least one product for this campaign.");
  }
  const campaign = await AdCampaign.create({
    title,
    description,
    image,
    platform,
    status: status || "draft",
    products,
    destinationUrl,
    startDate: startDate || null,
    endDate: endDate || null,
    createdBy: req.user._id,
  });
  res.status(201).json(withComputed(req, campaign.toObject()));
});

// @desc Update a campaign.
// @route PUT /api/ads/:id
const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await AdCampaign.findById(req.params.id);
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const editable = ["title", "description", "image", "platform", "status", "products", "destinationUrl", "startDate", "endDate"];
  editable.forEach((key) => {
    if (req.body[key] !== undefined) campaign[key] = req.body[key];
  });
  await campaign.save();
  res.json(withComputed(req, campaign.toObject()));
});

// @desc Delete a campaign. IMPORTANT: only ever deletes the AdCampaign document itself - it
// only ever references Products by ObjectId, so the products/variants advertised are never
// touched, let alone deleted.
// @route DELETE /api/ads/:id
const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await AdCampaign.findById(req.params.id);
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  await campaign.deleteOne();
  res.json({ message: "Campaign deleted. The advertised products were not affected." });
});

// @desc Deeper per-campaign performance, computed from AnalyticsEvent - product views, add to
// cart, and purchases genuinely attributed to this campaign's clicks, plus a real conversion
// rate. Impressions are only ever shown if a real Meta API integration has synced them -
// otherwise this always honestly reports "not available" rather than inventing a number.
// @route GET /api/ads/:id/analytics
const getCampaignAnalytics = asyncHandler(async (req, res) => {
  const campaign = await AdCampaign.findById(req.params.id);
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  const match = { campaign: campaign._id };
  const counts = await AnalyticsEvent.aggregate([
    { $match: match },
    { $group: { _id: "$type", sessions: { $addToSet: "$sessionId" }, count: { $sum: 1 } } },
  ]);
  const byType = Object.fromEntries(counts.map((c) => [c._id, { count: c.count, uniqueSessions: c.sessions.length }]));

  const productViews = byType.product_view?.count || 0;
  const addToCart = byType.add_to_cart?.count || 0;
  const purchases = byType.purchase?.count || 0;

  res.json({
    campaignId: campaign._id,
    title: campaign.title,
    clicks: campaign.clicks,
    visitors: campaign.visitors,
    impressions: null, // "Not available" until Meta API is connected - see backend/config/meta.js
    impressionsAvailable: false,
    productViews,
    addToCart,
    purchases,
    conversionRate: campaign.clicks > 0 ? Number(((purchases / campaign.clicks) * 100).toFixed(2)) : 0,
  });
});

// @desc Public: follow a campaign's tracking link. Logs the click + creates the visitor
// session's campaign attribution, then redirects to the real destination with UTM params
// attached. This is the URL the admin copies into an Instagram/Facebook bio or post.
// @route GET /api/ads/track/:slug
const trackClick = asyncHandler(async (req, res) => {
  const campaign = await AdCampaign.findOne({ trackingSlug: req.params.slug });
  if (!campaign) {
    return res.status(404).send("This advertisement link is no longer valid.");
  }

  const sessionId = crypto.randomBytes(12).toString("hex");
  campaign.clicks += 1;
  campaign.visitors += 1;
  await campaign.save();

  AnalyticsEvent.create({ sessionId, type: "advertisement_click", campaign: campaign._id }).catch(() => {});

  const params = new URLSearchParams({
    utm_source: campaign.utm.source,
    utm_medium: campaign.utm.medium,
    utm_campaign: campaign.utm.campaign,
    utm_content: campaign.utm.content,
    sr_sid: sessionId,
    sr_campaign: campaign.trackingSlug,
  });
  const separator = campaign.destinationUrl.includes("?") ? "&" : "?";
  res.redirect(302, `${campaign.destinationUrl}${separator}${params.toString()}`);
});

// @desc Meta Business connection status, so the admin UI can show the right state instead of
// pretending a connection exists.
// @route GET /api/ads/meta-status
const getMetaStatus = asyncHandler(async (req, res) => {
  res.json({ connected: isMetaConfigured() });
});

module.exports = {
  getDashboard,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignAnalytics,
  trackClick,
  getMetaStatus,
};

const asyncHandler = require("express-async-handler");
const SaleCampaign = require("../models/SaleCampaign");
const Product = require("../models/Product");
const { getActiveCampaigns, computeSalePrice } = require("../utils/salePricing");

// De-dupes a product list that may contain the same product twice (e.g. it's both individually
// selected AND its category is targeted by the same campaign).
function dedupeProducts(list) {
  const seen = new Set();
  return list.filter((p) => {
    const key = String(p._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Resolves a campaign's full, LIVE product list - its directly-selected products plus every
// active product currently in any of its targeted categories. Live on purpose: a category
// target is a standing rule, not a snapshot, so a product added to that category tomorrow is
// on sale tomorrow without anyone touching this campaign again.
async function resolveCampaignProducts(campaign, { onlyActiveProducts = true } = {}) {
  let categoryProducts = [];
  if (campaign.categories?.length > 0) {
    const filter = { category: { $in: campaign.categories.map((c) => c._id || c) } };
    if (onlyActiveProducts) filter.status = "active";
    categoryProducts = await Product.find(filter).populate("category", "name slug");
  }
  return dedupeProducts([...(campaign.products || []), ...categoryProducts]);
}

// @desc Public: every currently-active sale, with its products already priced - powers the
// storefront Sales & Offers page and the navbar's "active sale" indicator.
// @route GET /api/sales
const getActiveSales = asyncHandler(async (req, res) => {
  const campaigns = await getActiveCampaigns();
  const populated = await SaleCampaign.populate(campaigns, [
    { path: "products", match: { status: "active" }, populate: { path: "category", select: "name slug" } },
    { path: "categories", select: "name slug" },
  ]);

  const results = await Promise.all(
    populated.map(async (camp) => {
      const allProducts = await resolveCampaignProducts(camp);
      const priced = allProducts.map((p) => {
        const obj = p.toObject ? p.toObject() : p;
        const salePrice = computeSalePrice(obj.price, camp);
        // ROOT-CAUSE FIX: previously only `obj.price` (the parent product) was ever run through
        // computeSalePrice, so a product with variants (e.g. Lavender Ocean Resin Stud
        // Earrings, Royal Purple Gold Hoop Resin Earrings - both have a color variant) got a
        // top-level `discountPrice` here but its `variants[].discountPrice` was left completely
        // untouched. The frontend's per-variant pricing (getCardPricing/getDisplayProduct in
        // utils/variants.js) reads the VARIANT's own discountPrice first, so those two products
        // silently showed no discount at all while variant-less sale products (no color option,
        // e.g. Blue Flower Resin Necklace & Earrings Set) - which only ever needed the top-level
        // field - displayed correctly. Every variant's OWN price is now run through the same
        // computeSalePrice, so a variant priced differently from its parent still gets the
        // correct percentage-or-flat discount applied to ITS price, not the parent's.
        const variants = Array.isArray(obj.variants)
          ? obj.variants.map((v) => ({ ...v, discountPrice: computeSalePrice(v.price ?? obj.price, camp) }))
          : obj.variants;
        return {
          ...obj,
          discountPrice: salePrice,
          variants,
          saleLabel: true,
          effectivePrice: salePrice,
          activeSale: { campaignId: camp._id, name: camp.name, discountType: camp.discountType, discountValue: camp.discountValue, endAt: camp.endAt },
        };
      });
      return {
        _id: camp._id,
        name: camp.name,
        description: camp.description,
        bannerImage: camp.bannerImage,
        discountType: camp.discountType,
        discountValue: camp.discountValue,
        startAt: camp.startAt,
        endAt: camp.endAt,
        products: priced,
      };
    })
  );

  res.json(results);
});

// @desc Admin: every campaign regardless of status, with a computed `status` and product count
// - powers the dashboard's summary cards and Active/Upcoming/Expired/All tabs.
// @route GET /api/sales/admin/all
const getAllCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await SaleCampaign.find().sort({ createdAt: -1 }).populate("products", "name").populate("categories", "name");
  const now = new Date();
  const withCounts = await Promise.all(
    campaigns.map(async (c) => {
      const resolved = await resolveCampaignProducts(c, { onlyActiveProducts: false });
      return { ...c.toObject(), status: c.getStatus(now), productCount: resolved.length };
    })
  );
  res.json(withCounts);
});

// @desc Admin: one campaign's full detail, with its resolved + priced product list - powers
// View / Edit / Manage Products.
// @route GET /api/sales/:id
const getCampaignById = asyncHandler(async (req, res) => {
  const campaign = await SaleCampaign.findById(req.params.id).populate("products").populate("categories", "name");
  if (!campaign) {
    res.status(404);
    throw new Error("Sale not found");
  }
  const allProducts = await resolveCampaignProducts(campaign, { onlyActiveProducts: false });
  const priced = allProducts.map((p) => {
    const obj = p.toObject ? p.toObject() : p;
    return { ...obj, salePrice: computeSalePrice(obj.price, campaign) };
  });
  res.json({ ...campaign.toObject(), status: campaign.getStatus(), resolvedProducts: priced });
});

// @desc Admin: create a sale campaign
// @route POST /api/sales
const createCampaign = asyncHandler(async (req, res) => {
  const { name, description, bannerImage, discountType, discountValue, products, categories, startAt, endAt, active } = req.body;
  const campaign = await SaleCampaign.create({
    name,
    description,
    bannerImage,
    discountType,
    discountValue,
    products,
    categories,
    startAt,
    endAt,
    active,
  });
  res.status(201).json(campaign);
});

// @desc Admin: update a campaign - products, discount, dates, and pause/resume (via `active`)
// all go through this one endpoint.
// @route PUT /api/sales/:id
const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await SaleCampaign.findById(req.params.id);
  if (!campaign) {
    res.status(404);
    throw new Error("Sale not found");
  }
  Object.assign(campaign, req.body);
  await campaign.save();
  res.json(campaign);
});

// @desc Admin: delete a campaign. Nothing to "restore" on any product - a campaign never wrote
// to a product record in the first place, so deleting it just means nothing matches it anymore
// the next time salePricing.js runs.
// @route DELETE /api/sales/:id
const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await SaleCampaign.findById(req.params.id);
  if (!campaign) {
    res.status(404);
    throw new Error("Sale not found");
  }
  await campaign.deleteOne();
  res.json({ message: "Sale deleted" });
});

module.exports = { getActiveSales, getAllCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign };

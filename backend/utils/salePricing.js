const SaleCampaign = require("../models/SaleCampaign");

// Every campaign that is BOTH turned on by the admin AND currently within its date window, most
// recently created first. Cheap for a small handmade-jewellery catalog - called once per
// request (product list, single product, or order pricing), never once per item.
async function getActiveCampaigns() {
  const now = new Date();
  return SaleCampaign.find({ active: true, startAt: { $lte: now }, endAt: { $gte: now } }).sort({ createdAt: -1 });
}

// O(1) lookup by product/category id. If a product is covered by more than one active campaign
// (e.g. it's individually selected in one AND its category is targeted by another, or two
// campaigns overlap), the most recently created campaign wins - `campaigns` is already sorted
// newest-first, and the first match found for a given id is kept. This is the "prevent
// conflicting discounts" rule: exactly one campaign ever applies to a given product at a time.
function buildCampaignLookup(campaigns) {
  const byProduct = new Map();
  const byCategory = new Map();
  for (const camp of campaigns) {
    for (const pid of camp.products || []) {
      const key = String(pid);
      if (!byProduct.has(key)) byProduct.set(key, camp);
    }
    for (const cid of camp.categories || []) {
      const key = String(cid);
      if (!byCategory.has(key)) byCategory.set(key, camp);
    }
  }
  return { byProduct, byCategory };
}

// Never allowed to go negative or exceed the original price either direction - a fixed discount
// bigger than the product's price just floors out at ₹0, it never becomes a negative price.
function computeSalePrice(originalPrice, campaign) {
  if (originalPrice == null) return null;
  let price;
  if (campaign.discountType === "percentage") {
    price = originalPrice - (originalPrice * campaign.discountValue) / 100;
  } else {
    price = originalPrice - campaign.discountValue;
  }
  return Math.max(0, Math.round(price * 100) / 100);
}

// Mutates a product (plain object OR Mongoose document - both work, see the in-place variant
// mutation below) to overlay campaign pricing, ONLY if an active campaign actually covers it.
// Deliberately never reassigns `product.variants` as a whole array (that would break
// `product.variants.id(...)` on a real Mongoose document, which backend/controllers/
// orderController.js relies on) - each variant's `discountPrice` is set in place instead.
//
// Nothing here is ever persisted: callers must never call .save() on a product after this runs
// (see orderController.js's buildOrderItemsAndTotals, which uses the override only to compute
// the order total in memory). That's what makes expiry automatic - the real stored
// price/discountPrice is never touched, so there's nothing to "restore" once a campaign ends.
function applyCampaignPricing(product, lookup) {
  const categoryId = product.category?._id ? String(product.category._id) : String(product.category || "");
  const campaign = lookup.byProduct.get(String(product._id)) || lookup.byCategory.get(categoryId);
  if (!campaign) return product;

  const basePrice = product.price;
  const baseSale = computeSalePrice(basePrice, campaign);
  let appliedAny = false;

  if (baseSale != null && baseSale < basePrice) {
    product.discountPrice = baseSale;
    appliedAny = true;
  }

  if (product.variants && product.variants.length) {
    for (const v of product.variants) {
      const vPrice = v.price != null ? v.price : basePrice;
      const vSale = computeSalePrice(vPrice, campaign);
      if (vSale != null && vSale < vPrice) {
        v.discountPrice = vSale;
        appliedAny = true;
      }
    }
  }

  if (appliedAny) {
    product.saleLabel = true;
    product.activeSale = {
      campaignId: campaign._id,
      name: campaign.name,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue,
      endAt: campaign.endAt,
    };
  }

  // Recompute the display "effectivePrice" so a value already computed upstream (e.g. by
  // productController's EFFECTIVE_PRICE_STAGES aggregation, which runs BEFORE this overlay and
  // knows nothing about campaigns) reflects the campaign price too - mirrors that pipeline's
  // own "lowest current variant price, else base" rule exactly.
  if (product.variants && product.variants.length) {
    const activeVariants = product.variants.filter((v) => v.status !== "hidden");
    const pool = activeVariants.length > 0 ? activeVariants : product.variants;
    const prices = pool.map((v) => {
      const vPrice = v.price != null ? v.price : basePrice;
      return v.discountPrice != null && v.discountPrice < vPrice ? v.discountPrice : vPrice;
    });
    product.effectivePrice = Math.min(...prices);
  } else {
    product.effectivePrice = product.discountPrice != null && product.discountPrice < basePrice ? product.discountPrice : basePrice;
  }

  return product;
}

module.exports = { getActiveCampaigns, buildCampaignLookup, computeSalePrice, applyCampaignPricing };

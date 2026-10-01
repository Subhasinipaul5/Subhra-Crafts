const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { getActiveCampaigns, buildCampaignLookup, applyCampaignPricing } = require("../utils/salePricing");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeQuery = (q) => q.toLowerCase().trim().replace(/\s+/g, " ");

// Lightweight, dependency-free typo tolerance (no external fuzzy-search library needed).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function wordsApproximatelyMatch(a, b) {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen < 4) return a === b; // too short for fuzzy matching to mean anything
  return levenshtein(a, b) <= Math.min(2, Math.floor(maxLen * 0.3));
}

// Resolves a free-text search query to a list of matching product IDs. Searches name,
// description, colors, AND the joined category's name (which a plain Mongo $text index can't
// reach, since category lives in a separate collection). Falls back to a typo-tolerant pass
// (e.g. "Resgin Earings" -> "Resin Earrings") only if the exact/partial pass finds nothing.
async function resolveSearchProductIds(search) {
  const words = normalizeQuery(search).split(" ").filter(Boolean);
  if (words.length === 0) return null;

  const wordRegexes = words.map((w) => new RegExp(escapeRegex(w), "i"));
  const matchingCategories = await Category.find({ $or: wordRegexes.map((r) => ({ name: r })) }, "_id");
  const matchingCategoryIds = matchingCategories.map((c) => c._id);

  // Every query word must match SOMEWHERE (name, description, colors, or category name) -
  // this is what lets "resin earrings" find a product even if the words appear in a
  // different order, or one word is in the name and another only in the category.
  const regexFilter = {
    status: "active",
    $and: words.map((r, i) => ({
      $or: [{ name: wordRegexes[i] }, { description: wordRegexes[i] }, { colors: wordRegexes[i] }, { category: { $in: matchingCategoryIds } }],
    })),
  };

  let matched = await Product.find(regexFilter, "_id");

  if (matched.length === 0) {
    const allActive = await Product.find({ status: "active" }, "_id name").populate("category", "name");
    matched = allActive.filter((p) => {
      const haystack = normalizeQuery(`${p.name} ${p.category?.name || ""}`).split(" ");
      return words.some((qw) => haystack.some((hw) => wordsApproximatelyMatch(qw, hw)));
    });
  }

  return matched.map((p) => p._id);
}

// Mirrors frontend `getCardPricing` (utils/variants.js) EXACTLY, but as a Mongo aggregation
// expression, so server-side sorting/filtering by price agrees with what the product card
// displays. For a product with variants, the "effective" price is the lowest CURRENT SELLING
// price among active variants (a variant's own discountPrice if it undercuts its price, else
// its price, else falls back to the parent product's price) - NEVER the original/compare-at
// price. A product with no variants uses its own discountPrice-vs-price the same way.
const EFFECTIVE_PRICE_STAGES = [
  {
    $addFields: {
      _activeVariants: {
        $filter: { input: { $ifNull: ["$variants", []] }, as: "v", cond: { $ne: ["$$v.status", "hidden"] } },
      },
    },
  },
  {
    $addFields: {
      _variantPool: {
        $cond: [{ $gt: [{ $size: "$_activeVariants" }, 0] }, "$_activeVariants", { $ifNull: ["$variants", []] }],
      },
    },
  },
  {
    $addFields: {
      _variantEffectivePrices: {
        $map: {
          input: "$_variantPool",
          as: "v",
          in: {
            $let: {
              vars: { vPrice: { $ifNull: ["$$v.price", "$price"] } },
              in: {
                $cond: [
                  { $and: [{ $ne: ["$$v.discountPrice", null] }, { $lt: ["$$v.discountPrice", "$$vPrice"] }] },
                  "$$v.discountPrice",
                  "$$vPrice",
                ],
              },
            },
          },
        },
      },
      _baseEffectivePrice: {
        $cond: [
          { $and: [{ $ne: ["$discountPrice", null] }, { $lt: ["$discountPrice", "$price"] }] },
          "$discountPrice",
          "$price",
        ],
      },
    },
  },
  {
    $addFields: {
      effectivePrice: {
        $cond: [
          { $gt: [{ $size: "$_variantEffectivePrices" }, 0] },
          { $min: "$_variantEffectivePrices" },
          "$_baseEffectivePrice",
        ],
      },
      effectiveRating: {
        $cond: [{ $gt: ["$ratingCount", 0] }, "$ratingAverage", { $ifNull: ["$adminRating", 0] }],
      },
      effectiveReviewCount: {
        $cond: [{ $gt: ["$ratingCount", 0] }, "$ratingCount", { $ifNull: ["$adminReviewCount", 0] }],
      },
      hasVariants: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
    },
  },
  { $project: { _activeVariants: 0, _variantPool: 0, _variantEffectivePrices: 0, _baseEffectivePrice: 0 } },
];

// @desc Browse products (public shop) with filters, sorting, search
// @route GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    rating,
    newArrival,
    bestseller,
    inStock,
    sort,
    homepage,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = { status: "active" };
  if (category && mongoose.Types.ObjectId.isValid(category)) filter.category = new mongoose.Types.ObjectId(category);
  // homepage=true - used by Home.jsx's per-category rows. Admin-curated only: a product must be
  // explicitly marked homepageVisible by the admin (see Product.homepageVisible) to ever appear
  // here, so adding a new product never bumps an existing homepage selection. Always sorted by
  // the admin-chosen homepagePosition, never by recency - see the sortStage override below.
  if (homepage === "true") filter.homepageVisible = true;
  if (search) {
    const matchedIds = await resolveSearchProductIds(search);
    filter._id = { $in: matchedIds || [] };
  }
  if (newArrival === "true") filter.newArrival = true;
  if (bestseller === "true") filter.bestseller = true;
  if (inStock === "true") filter.stock = { $gt: 0 };
  if (rating) filter.ratingAverage = { $gte: Number(rating) };

  // Price range filtering also has to use the effective selling price, not the raw/original
  // `price` field, or a product on sale could be wrongly excluded/included by its old price.
  const priceMatch = {};
  if (minPrice) priceMatch.$gte = Number(minPrice);
  if (maxPrice) priceMatch.$lte = Number(maxPrice);

  let sortStage = { createdAt: -1 };
  if (sort === "price_asc") sortStage = { effectivePrice: 1 };
  if (sort === "price_desc") sortStage = { effectivePrice: -1 };
  if (sort === "rating") sortStage = { ratingAverage: -1 };
  if (sort === "popular") sortStage = { ratingCount: -1 };
  // Homepage rows are always admin-ordered, regardless of any other sort param - recency must
  // never override the admin's explicit homepagePosition choice.
  if (homepage === "true") sortStage = { homepagePosition: 1, createdAt: -1 };

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline = [
    { $match: filter },
    ...EFFECTIVE_PRICE_STAGES,
    ...(Object.keys(priceMatch).length ? [{ $match: { effectivePrice: priceMatch } }] : []),
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category",
        pipeline: [{ $project: { name: 1, slug: 1 } }],
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    { $sort: sortStage },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: Number(limit) }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  let products = result?.data || [];
  const total = result?.totalCount?.[0]?.count || 0;

  // Overlay any active sale-campaign pricing (see utils/salePricing.js). Deliberately a
  // post-aggregation step, not a pipeline stage - the aggregation above still sorts/filters by
  // each product's stored price, so a campaigned product's position in a price-sorted list or a
  // price-range filter can lag its true sale price slightly; every price, badge, and countdown
  // actually shown to the customer is always exactly correct, which matters far more.
  const activeCampaigns = await getActiveCampaigns();
  if (activeCampaigns.length > 0) {
    const lookup = buildCampaignLookup(activeCampaigns);
    products = products.map((p) => applyCampaignPricing(p, lookup));
  }

  res.json({ products, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// @desc Get single product by slug (public)
// @route GET /api/products/:slug
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: { $ne: "inactive" } }).populate(
    "category",
    "name slug virtualTryOn"
  );
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    status: "active",
  }).limit(4);

  // Same campaign overlay as getProducts above - the detail page's price/badge/countdown must
  // never disagree with what the customer saw on the listing they clicked in from.
  const activeCampaigns = await getActiveCampaigns();
  let productObj = product.toObject();
  let relatedObjs = related.map((r) => r.toObject());
  if (activeCampaigns.length > 0) {
    const lookup = buildCampaignLookup(activeCampaigns);
    productObj = applyCampaignPricing(productObj, lookup);
    relatedObjs = relatedObjs.map((r) => applyCampaignPricing(r, lookup));
  }

  res.json({ product: productObj, related: relatedObjs });
});

// @desc Admin: list ALL products (any status) for the admin product table
// @route GET /api/products/admin/all
const getAdminProducts = asyncHandler(async (req, res) => {
  const { search, category, status } = req.query;
  const filter = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (category) filter.category = category;
  if (status) filter.status = status;

  const products = await Product.find(filter).populate("category", "name").sort({ createdAt: -1 });
  res.json(products);
});

// @desc Admin: create product
// @route POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// @desc Admin: update product (price, details, everything). Price changes never touch past orders.
// @route PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  Object.assign(product, req.body);
  await product.save();
  res.json(product);
});

// @desc Admin: soft-delete (set inactive) - preserves product for historical orders
// @route DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  product.status = "inactive";
  await product.save();
  res.json({ message: "Product removed from the store (history preserved)." });
});

// @desc Admin: quick stock edit - set exact quantity
// @route PATCH /api/products/:id/stock
const updateStock = asyncHandler(async (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || stock < 0) {
    res.status(400);
    throw new Error("Provide a valid non-negative stock number");
  }
  const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json(product);
});

// @desc Admin: product management dashboard stats
// @route GET /api/products/admin/stats
const getProductStats = asyncHandler(async (req, res) => {
  const [total, active, hidden, inactive, outOfStock, lowStock] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ status: "active" }),
    Product.countDocuments({ status: "hidden" }),
    Product.countDocuments({ status: "inactive" }),
    Product.countDocuments({ stock: 0, status: { $ne: "inactive" } }),
    Product.countDocuments({
      status: { $ne: "inactive" },
      $expr: { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockThreshold"] }] },
    }),
  ]);
  res.json({ total, active, hidden, inactive, outOfStock, lowStock });
});

// @desc Admin: product performance data (units sold, order count) to INFORM the admin's own
// bestseller/label decisions. This never auto-applies any label - it's read-only reporting.
// @route GET /api/products/admin/performance
const getProductPerformance = asyncHandler(async (req, res) => {
  const salesAgg = await Order.aggregate([
    { $match: { orderStatus: { $ne: "cancelled" } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        unitsSold: { $sum: "$items.quantity" },
        orderCount: { $sum: 1 },
      },
    },
  ]);
  const salesMap = {};
  salesAgg.forEach((s) => {
    if (s._id) salesMap[s._id.toString()] = s;
  });

  const products = await Product.find({ status: { $ne: "inactive" } }).populate("category", "name");

  const performance = products
    .map((p) => {
      const sales = salesMap[p._id.toString()] || { unitsSold: 0, orderCount: 0 };
      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        image: p.images?.[0]?.url || "",
        category: p.category?.name || "",
        unitsSold: sales.unitsSold,
        orderCount: sales.orderCount,
        stock: p.stock,
        rating: p.effectiveRating,
        ratingCount: p.effectiveReviewCount,
        isAdminRating: p.isAdminRating,
        featured: p.featured,
        bestseller: p.bestseller,
        newArrival: p.newArrival,
        handcrafted: p.handcrafted,
        limitedStockLabel: p.limitedStockLabel,
        saleLabel: p.saleLabel,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold);

  res.json(performance);
});

module.exports = {
  getProducts,
  getProductBySlug,
  getAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getProductStats,
  getProductPerformance,
};

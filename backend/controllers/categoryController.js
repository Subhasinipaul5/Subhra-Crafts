const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const Product = require("../models/Product");

// @desc Get all active categories (public) - or all (admin, via ?all=true)
// @route GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === "true" ? {} : { active: true };
  const categories = await Category.find(filter).sort({ order: 1, createdAt: 1 });
  res.json(categories);
});

// @desc FEATURE 4 - Categories mega-menu: every active category with a handful of its active
// products (name/slug/thumbnail only) so the navbar can render "category name -> its products"
// without the frontend having to make one request per category. Categories/products come
// straight from the DB - nothing here is hard-coded, so a new category/product shows up
// automatically the next time the menu data is fetched.
// @route GET /api/categories/mega-menu
const getMegaMenu = asyncHandler(async (req, res) => {
  // Admin-controlled: only categories the admin left/marked "Show in navbar" appear here at
  // all (see Category.navbarVisible, managed from Admin > Homepage Management > Navbar
  // Categories), ordered by the admin's chosen navbarPosition - falling back to the category's
  // general `order` field when two categories tie on position, so an untouched category still
  // sorts sensibly. Capping to a specific count is left to the frontend, which reads the
  // admin's configured max from GET /settings rather than a hardcoded number here.
  const categories = await Category.find({ active: true, navbarVisible: { $ne: false } })
    .sort({ navbarPosition: 1, order: 1, createdAt: 1 })
    .lean();

  const menu = await Promise.all(
    categories.map(async (cat) => {
      const products = await Product.find({ category: cat._id, status: "active" })
        .sort({ createdAt: -1 })
        .limit(4)
        .select("name slug images")
        .lean();
      return {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        products: products.map((p) => ({ _id: p._id, name: p.name, slug: p.slug, image: p.images?.[0]?.url || "" })),
      };
    })
  );

  res.json(menu);
});
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json(category);
});

// @desc Create category (admin)
// @route POST /api/categories
// const createCategory = asyncHandler(async (req, res) => {
//   const { name, description, order, featured, active, image } = req.body;
//   const category = await Category.create({ name, description, order, featured, active, image });
//   res.status(201).json(category);
// });

const createCategory = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    order,
    featured,
    active,
    image,
    images,
    slideshow,
    virtualTryOn,
    navbarVisible,
    navbarPosition,
  } = req.body;

  const category = await Category.create({
    name,
    description,
    order,
    featured,
    active,
    image,
    images,
    slideshow,
    virtualTryOn,
    navbarVisible,
    navbarPosition,
  });

  res.status(201).json(category);
});


// @desc Update category (admin) - edits reflect on the site immediately, no code changes needed
// @route PUT /api/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  Object.assign(category, req.body);
  await category.save();
  res.json(category);
});


// @desc Delete category (admin) - blocked if products still reference it
// @route DELETE /api/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const productCount = await Product.countDocuments({ category: req.params.id });
  if (productCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete: ${productCount} product(s) still use this category. Reassign or remove them first.`
    );
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.json({ message: "Category deleted" });
});

module.exports = { getCategories, getMegaMenu, getCategoryBySlug, createCategory, updateCategory, deleteCategory };

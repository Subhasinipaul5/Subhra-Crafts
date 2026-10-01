const asyncHandler = require("express-async-handler");
const HomeBannerSlide = require("../models/HomeBannerSlide");
const { cloudinary } = require("../config/cloudinary");

const MAX_SLIDES = 10;

// @desc Public: active slides in display order, for the homepage hero slider. Populates
// linkedProductId with just enough of the live product (name/slug/image/sku) for the customer-
// side slider to render a preview and build the correct link - not a stored copy, so it's
// always current even if the product was renamed after the banner was linked.
// @route GET /api/home-banner
const getActiveSlides = asyncHandler(async (req, res) => {
  const slides = await HomeBannerSlide.find({ active: true })
    .sort({ order: 1, createdAt: 1 })
    .limit(MAX_SLIDES)
    .populate("linkedProductId", "name slug images sku");
  res.json(slides);
});

// @desc Admin: every slide, active or not, for the management screen. Also flags
// `linkedProductMissing: true` on any slide whose linked product was deleted since it was
// linked (populate() silently resolves a dangling reference to null, which is indistinguishable
// from "never linked" unless the raw id is captured beforehand, as done here) - the admin UI
// uses this to show "Linked product is no longer available" instead of just looking unlinked.
// @route GET /api/home-banner/admin
const getAllSlides = asyncHandler(async (req, res) => {
  const slides = await HomeBannerSlide.find({}).sort({ order: 1, createdAt: 1 });
  const rawIds = slides.map((s) => (s.linkedProductId ? String(s.linkedProductId) : null));
  await HomeBannerSlide.populate(slides, { path: "linkedProductId", select: "name slug images sku" });
  const withFlags = slides.map((s, i) => {
    const obj = s.toObject();
    obj.linkedProductMissing = !!rawIds[i] && !obj.linkedProductId;
    return obj;
  });
  res.json(withFlags);
});

// @desc Admin: add a slide. Max 10 ACTIVE slides at once (per spec) - creating beyond that is
// still allowed but the slide is created inactive, so the admin can swap it in deliberately.
// @route POST /api/home-banner
const createSlide = asyncHandler(async (req, res) => {
  const { image, title, subtitle, buttonText, buttonUrl, linkedProductId, durationSeconds, active } = req.body;
  if (!image?.url) {
    res.status(400);
    throw new Error("A banner image is required.");
  }
  const activeCount = await HomeBannerSlide.countDocuments({ active: true });
  const wantsActive = active !== false;
  const maxOrder = await HomeBannerSlide.findOne({}).sort({ order: -1 }).select("order");

  const slide = await HomeBannerSlide.create({
    image,
    title,
    subtitle,
    buttonText,
    buttonUrl,
    linkedProductId: linkedProductId || null,
    durationSeconds: durationSeconds || 5,
    active: wantsActive && activeCount < MAX_SLIDES,
    order: (maxOrder?.order ?? -1) + 1,
  });
  await slide.populate("linkedProductId", "name slug images sku");

  if (wantsActive && activeCount >= MAX_SLIDES) {
    return res.status(201).json({ ...slide.toObject(), warning: `Maximum of ${MAX_SLIDES} active banners reached - this slide was saved but left inactive. Deactivate another slide first.` });
  }
  res.status(201).json(slide);
});

// @desc Admin: edit a slide's content, or its active/inactive state.
// @route PUT /api/home-banner/:id
const updateSlide = asyncHandler(async (req, res) => {
  const slide = await HomeBannerSlide.findById(req.params.id);
  if (!slide) {
    res.status(404);
    throw new Error("Banner slide not found");
  }

  if (req.body.active === true && !slide.active) {
    const activeCount = await HomeBannerSlide.countDocuments({ active: true });
    if (activeCount >= MAX_SLIDES) {
      res.status(400);
      throw new Error(`Maximum of ${MAX_SLIDES} active banners reached. Deactivate another slide first.`);
    }
  }

  const editable = ["image", "title", "subtitle", "buttonText", "buttonUrl", "durationSeconds", "active"];
  editable.forEach((key) => {
    if (req.body[key] !== undefined) slide[key] = req.body[key];
  });
  // linkedProductId is handled separately from the loop above: an empty string/falsy value
  // here explicitly means "Clear Product" (see AdminHomeBanner.jsx), which must clear it to
  // null - not skip the field the way `undefined` (key never sent) does.
  if (req.body.linkedProductId !== undefined) {
    slide.linkedProductId = req.body.linkedProductId || null;
  }
  await slide.save();
  await slide.populate("linkedProductId", "name slug images sku");
  res.json(slide);
});

// @desc Admin: reorder slides - body: { orderedIds: [id, id, id, ...] }
// @route PUT /api/home-banner/reorder
const reorderSlides = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    res.status(400);
    throw new Error("orderedIds must be an array");
  }
  await Promise.all(orderedIds.map((id, index) => HomeBannerSlide.updateOne({ _id: id }, { $set: { order: index } })));
  const slides = await HomeBannerSlide.find({}).sort({ order: 1 });
  res.json(slides);
});

// @desc Admin: delete a slide. Only removes the slide document + its own Cloudinary image -
// never touches products or anything else that might share an image.
// @route DELETE /api/home-banner/:id
const deleteSlide = asyncHandler(async (req, res) => {
  const slide = await HomeBannerSlide.findById(req.params.id);
  if (!slide) {
    res.status(404);
    throw new Error("Banner slide not found");
  }
  if (slide.image?.publicId && cloudinary) {
    await cloudinary.uploader.destroy(slide.image.publicId).catch(() => {});
  }
  await slide.deleteOne();
  res.json({ message: "Banner slide removed" });
});

module.exports = { getActiveSlides, getAllSlides, createSlide, updateSlide, reorderSlides, deleteSlide };

const asyncHandler = require("express-async-handler");
const WebsiteSection = require("../models/WebsiteSection");

// @desc Get active sections (public), optionally filtered by location
// @route GET /api/sections
const getSections = asyncHandler(async (req, res) => {
  const { location, all } = req.query;
  const filter = all === "true" ? {} : { active: true };
  if (location) filter.displayLocation = location;
  const sections = await WebsiteSection.find(filter).populate("products").sort({ order: 1 });
  res.json(sections);
});

// @desc Get one section with its full product list (public) - used by the "View All" page for
// a homepage collection, since the homepage itself only ever displays the first 4.
// @route GET /api/sections/:id
const getSection = asyncHandler(async (req, res) => {
  const section = await WebsiteSection.findOne({ _id: req.params.id, active: true }).populate("products");
  if (!section) {
    res.status(404);
    throw new Error("Collection not found");
  }
  res.json(section);
});

// @desc Admin: create section
// @route POST /api/sections
const createSection = asyncHandler(async (req, res) => {
  const section = await WebsiteSection.create(req.body);
  res.status(201).json(section);
});

// @desc Admin: update section (products, order, active state, etc.)
// @route PUT /api/sections/:id
const updateSection = asyncHandler(async (req, res) => {
  const section = await WebsiteSection.findById(req.params.id);
  if (!section) {
    res.status(404);
    throw new Error("Section not found");
  }
  Object.assign(section, req.body);
  await section.save();
  res.json(section);
});

// @desc Admin: delete section
// @route DELETE /api/sections/:id
const deleteSection = asyncHandler(async (req, res) => {
  const section = await WebsiteSection.findByIdAndDelete(req.params.id);
  if (!section) {
    res.status(404);
    throw new Error("Section not found");
  }
  res.json({ message: "Section deleted" });
});

module.exports = { getSections, getSection, createSection, updateSection, deleteSection };

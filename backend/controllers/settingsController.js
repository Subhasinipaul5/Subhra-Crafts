const asyncHandler = require("express-async-handler");
const Settings = require("../models/Settings");
const { cloudinary } = require("../config/cloudinary");
const { getExchangeRates } = require("../utils/exchangeRates");

// @desc Public: get business location (for centering the customer's map), shipping tiers
// (so checkout can preview rates - the actual charge is still always recalculated server-side),
// the current home page banner image, and live currency conversion rates.
// @route GET /api/settings
const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const { rates, source, updatedAt } = await getExchangeRates();
  res.json({
    businessLocation: settings.businessLocation,
    shippingTiers: settings.shippingTiers,
    homeBanner: settings.homeBanner,
    bannerSettings: settings.bannerSettings,
    navbarCategories: settings.navbarCategories,
    modelDisplayScale: settings.modelDisplayScale,
    modelHorizontalRotation: settings.modelHorizontalRotation,
    modelVerticalRotation: settings.modelVerticalRotation,
    currency: {
      baseCurrency: "INR",
      displayCurrency: settings.currency.displayCurrency,
      exchangeRates: rates,
      ratesSource: source, // "live" | "cache" | "stale" | "fallback" - lets the admin see whether the live API is actually reachable
      ratesUpdatedAt: updatedAt,
    },
  });
});

// @desc Admin: update the hero banner's shared transition/timing behavior (Home Banner Settings
// panel) - applies to every slide the same way; per-slide content stays in HomeBannerSlide.
// @route PUT /api/settings/home-banner-settings
const updateBannerSettings = asyncHandler(async (req, res) => {
  const { transition, durationMs, autoChange, intervalSeconds, pauseOnHover } = req.body;
  const settings = await Settings.getSingleton();
  const VALID_TRANSITIONS = ["slideLeft", "slideRight", "slideUp", "slideDown", "fade", "blur", "blurFade", "zoomIn", "zoomOut", "crossfade", "random"];

  if (transition !== undefined) {
    if (!VALID_TRANSITIONS.includes(transition)) {
      res.status(400);
      throw new Error("Unsupported transition type.");
    }
    settings.bannerSettings.transition = transition;
  }
  if (durationMs !== undefined) settings.bannerSettings.durationMs = Math.min(3000, Math.max(150, Number(durationMs)));
  if (autoChange !== undefined) settings.bannerSettings.autoChange = !!autoChange;
  if (intervalSeconds !== undefined) settings.bannerSettings.intervalSeconds = Math.min(30, Math.max(1, Number(intervalSeconds)));
  if (pauseOnHover !== undefined) settings.bannerSettings.pauseOnHover = !!pauseOnHover;

  await settings.save();
  res.json(settings.bannerSettings);
});

// @desc Admin: update the Contact section's 3D model display scale (0.5x-2.0x) and its resting
// orientation - horizontal rotation (0-360°) and vertical tilt (0-20°). All three are saved
// together from the one "Save 3D Model Settings" panel. Renamed from the old
// updateModelDisplayScale now that it covers rotation too - see routes/settingsRoutes.js.
// @route PUT /api/settings/contact-model
const updateContactModelSettings = asyncHandler(async (req, res) => {
  const { scale, horizontalRotation, verticalRotation } = req.body;
  const settings = await Settings.getSingleton();

  if (scale !== undefined) {
    const value = Number(scale);
    if (Number.isNaN(value) || value < 0.5 || value > 2.0) {
      res.status(400);
      throw new Error("Model scale must be a number between 0.5 and 2.0.");
    }
    settings.modelDisplayScale = value;
  }

  if (horizontalRotation !== undefined) {
    const value = Number(horizontalRotation);
    if (Number.isNaN(value) || value < 0 || value > 360) {
      res.status(400);
      throw new Error("Horizontal rotation must be a number between 0 and 360.");
    }
    settings.modelHorizontalRotation = value;
  }

  if (verticalRotation !== undefined) {
    const value = Number(verticalRotation);
    if (Number.isNaN(value) || value < 0 || value > 20) {
      res.status(400);
      throw new Error("Vertical rotation must be a number between 0 and 20.");
    }
    settings.modelVerticalRotation = value;
  }

  await settings.save();
  res.json({
    modelDisplayScale: settings.modelDisplayScale,
    modelHorizontalRotation: settings.modelHorizontalRotation,
    modelVerticalRotation: settings.modelVerticalRotation,
  });
});

// @desc Admin: set the storefront's DEFAULT display currency (what new visitors see before they
// pick one themselves) and/or update the manual FALLBACK exchange rates used only when the live
// rate API can't be reached. Product prices are always stored in INR - this never changes them.
// @route PUT /api/settings/currency
const updateCurrency = asyncHandler(async (req, res) => {
  const { displayCurrency, fallbackRates } = req.body;
  const settings = await Settings.getSingleton();

  if (displayCurrency) {
    if (!["INR", "USD", "EUR"].includes(displayCurrency)) {
      res.status(400);
      throw new Error("Unsupported currency. Choose INR, USD, or EUR.");
    }
    settings.currency.displayCurrency = displayCurrency;
  }

  if (fallbackRates) {
    for (const code of ["USD", "EUR"]) {
      if (fallbackRates[code] != null) {
        const rate = Number(fallbackRates[code]);
        if (!(rate > 0)) {
          res.status(400);
          throw new Error(`Fallback rate for ${code} must be a positive number.`);
        }
        settings.currency.exchangeRates[code] = rate;
      }
    }
    settings.currency.exchangeRates.INR = 1;
    settings.currency.ratesSource = "manual";
    settings.currency.ratesUpdatedAt = new Date();
  }

  await settings.save();
  const { rates, source, updatedAt } = await getExchangeRates();
  res.json({
    baseCurrency: "INR",
    displayCurrency: settings.currency.displayCurrency,
    exchangeRates: rates,
    ratesSource: source,
    ratesUpdatedAt: updatedAt,
  });
});

// @desc Admin: force an immediate live exchange-rate refresh (bypasses the 6-hour cache) - used
// by the "Refresh Rates Now" button so the admin can confirm the live API is actually working.
// @route POST /api/settings/currency/refresh
const refreshCurrencyRates = asyncHandler(async (req, res) => {
  const { rates, source, updatedAt } = await getExchangeRates({ forceRefresh: true });
  res.json({ exchangeRates: rates, ratesSource: source, ratesUpdatedAt: updatedAt });
});

// @desc Admin: update the saved business/shop location
// @route PUT /api/settings/location
const updateBusinessLocation = asyncHandler(async (req, res) => {
  const { lat, lng, address } = req.body;
  if (lat == null || lng == null) {
    res.status(400);
    throw new Error("Latitude and longitude are required");
  }
  const settings = await Settings.getSingleton();
  settings.businessLocation = { lat, lng, address: address || "" };
  await settings.save();
  res.json(settings);
});

// @desc Admin: update distance-based shipping tiers
// @route PUT /api/settings/shipping
const updateShippingTiers = asyncHandler(async (req, res) => {
  const { shippingTiers } = req.body;
  if (!Array.isArray(shippingTiers) || shippingTiers.length === 0) {
    res.status(400);
    throw new Error("Provide at least one shipping tier");
  }
  const settings = await Settings.getSingleton();
  settings.shippingTiers = shippingTiers;
  await settings.save();
  res.json(settings);
});

// @desc Admin: set a new home page hero/banner image (already uploaded to Cloudinary via
// the /api/upload endpoint - this just saves the resulting URL as the active banner)
// @route PUT /api/settings/home-banner
const updateHomeBanner = asyncHandler(async (req, res) => {
  const { url, publicId } = req.body;
  if (!url) {
    res.status(400);
    throw new Error("An image URL is required");
  }
  const settings = await Settings.getSingleton();
  const previousPublicId = settings.homeBanner?.publicId;
  settings.homeBanner = { url, publicId: publicId || "" };
  await settings.save();

  // best-effort cleanup of the old Cloudinary asset - never blocks the response
  if (previousPublicId) {
    cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  res.json(settings.homeBanner);
});

// @desc Admin: remove the custom banner, reverting the Home page to its bundled default image
// @route DELETE /api/settings/home-banner
const resetHomeBanner = asyncHandler(async (req, res) => {
  const settings = await Settings.getSingleton();
  const previousPublicId = settings.homeBanner?.publicId;
  settings.homeBanner = { url: "", publicId: "" };
  await settings.save();

  if (previousPublicId) {
    cloudinary.uploader.destroy(previousPublicId).catch(() => {});
  }

  res.json({ message: "Reset to default banner image" });
});

// @desc Admin: update the navbar "Categories" mega-menu's display cap, the small "All
// Categories" tile's slideshow images, and its autoplay/pause-on-hover timing.
// @route PUT /api/settings/navbar-categories
const updateNavbarCategoriesSettings = asyncHandler(async (req, res) => {
  const { maxVisible, allCategoriesImages, slideshow } = req.body;
  const settings = await Settings.getSingleton();

  if (maxVisible !== undefined) settings.navbarCategories.maxVisible = Math.min(12, Math.max(1, Number(maxVisible)));
  if (allCategoriesImages !== undefined) {
    if (allCategoriesImages.length > 10) {
      res.status(400);
      throw new Error("At most 10 images are allowed.");
    }
    settings.navbarCategories.allCategoriesImages = allCategoriesImages;
  }
  if (slideshow?.intervalSeconds !== undefined) {
    settings.navbarCategories.slideshow.intervalSeconds = Math.min(15, Math.max(1, Number(slideshow.intervalSeconds)));
  }
  if (slideshow?.pauseOnHover !== undefined) settings.navbarCategories.slideshow.pauseOnHover = !!slideshow.pauseOnHover;

  await settings.save();
  res.json(settings.navbarCategories);
});

module.exports = {
  getPublicSettings,
  updateBusinessLocation,
  updateShippingTiers,
  updateHomeBanner,
  resetHomeBanner,
  updateCurrency,
  refreshCurrencyRates,
  updateBannerSettings,
  updateContactModelSettings,
  updateNavbarCategoriesSettings,
};

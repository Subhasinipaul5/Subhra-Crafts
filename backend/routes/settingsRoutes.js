const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const { getPublicSettings, updateBusinessLocation, updateShippingTiers, updateHomeBanner, resetHomeBanner, updateCurrency, refreshCurrencyRates, updateBannerSettings, updateContactModelSettings, updateNavbarCategoriesSettings } = require("../controllers/settingsController");

router.get("/", getPublicSettings);
router.put("/location", protect, adminOnly, updateBusinessLocation);
router.put("/shipping", protect, adminOnly, updateShippingTiers);
router.put("/home-banner", protect, adminOnly, updateHomeBanner);
router.delete("/home-banner", protect, adminOnly, resetHomeBanner);
router.put("/home-banner-settings", protect, adminOnly, updateBannerSettings);
router.put("/contact-model", protect, adminOnly, updateContactModelSettings);
router.put("/currency", protect, adminOnly, updateCurrency);
router.post("/currency/refresh", protect, adminOnly, refreshCurrencyRates);
router.put("/navbar-categories", protect, adminOnly, updateNavbarCategoriesSettings);

module.exports = router;

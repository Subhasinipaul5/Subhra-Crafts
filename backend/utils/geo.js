// Great-circle distance between two lat/lng points, in kilometers.
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Given a distance and the admin's configured tiers (ascending, last tier's maxDistanceKm = null),
// find the matching tier. This is the ONLY place shipping charges are decided - always call this
// from the backend, never trust a shipping fee sent from the browser.
function resolveShippingTier(distanceKm, tiers) {
  const sorted = [...tiers].sort((a, b) => {
    if (a.maxDistanceKm === null) return 1;
    if (b.maxDistanceKm === null) return -1;
    return a.maxDistanceKm - b.maxDistanceKm;
  });
  const tier = sorted.find((t) => t.maxDistanceKm === null || distanceKm <= t.maxDistanceKm);
  return tier || sorted[sorted.length - 1];
}

function calculateShippingForLocation({ businessLocation, customerLat, customerLng, tiers }) {
  if (
    businessLocation?.lat == null ||
    businessLocation?.lng == null ||
    customerLat == null ||
    customerLng == null
  ) {
    return null;
  }
  const distanceKm = haversineDistanceKm(businessLocation.lat, businessLocation.lng, customerLat, customerLng);
  const tier = resolveShippingTier(distanceKm, tiers);
  const estimatedDeliveryDate = new Date();
  estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + tier.estimateDaysMax);

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    shippingFee: tier.charge,
    estimateDaysMin: tier.estimateDaysMin,
    estimateDaysMax: tier.estimateDaysMax,
    estimatedDeliveryDate,
  };
}

module.exports = { haversineDistanceKm, resolveShippingTier, calculateShippingForLocation };

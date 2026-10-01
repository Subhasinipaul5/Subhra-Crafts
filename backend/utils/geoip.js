// FEATURE 2 (analytics) - resolves a coarse country/region/city from a request IP, ONCE per
// new session (see analyticsController.startSession), using ip-api.com's free tier (no API key,
// no signup, generous enough for a small storefront). If the lookup fails, is rate-limited, or
// the visitor is on localhost/a private IP during local dev, this degrades gracefully to empty
// strings rather than throwing - geolocation is a nice-to-have, never a hard requirement.
async function lookupGeoIP(ip) {
  const empty = { country: "", region: "", city: "" };
  if (!ip) return empty;

  const cleanIp = ip.split(",")[0].trim().replace("::ffff:", "");
  if (!cleanIp || cleanIp === "::1" || cleanIp.startsWith("127.") || cleanIp.startsWith("10.") || cleanIp.startsWith("192.168.")) {
    return empty; // local/private IP - nothing a public geo API could resolve anyway
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return empty;
    const data = await res.json();
    if (data.status !== "success") return empty;
    return { country: data.country || "", region: data.regionName || "", city: data.city || "" };
  } catch (err) {
    console.error("GeoIP lookup failed (non-fatal):", err.message);
    return empty;
  }
}

module.exports = { lookupGeoIP };

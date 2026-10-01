const Settings = require("../models/Settings");

// FEATURE 1 (this round) - live INR -> USD/EUR conversion. Frankfurter is a free, no-API-key,
// CORS-enabled exchange rate service backed by the European Central Bank - reliable enough for
// display purposes and needs no secret to manage. Product prices are NEVER touched by this;
// it only ever produces a multiplier used at display time (see CurrencyContext on the frontend).
const LIVE_RATE_URL = "https://api.frankfurter.app/latest?from=INR&to=USD,EUR";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // re-fetch at most every 6 hours
const FALLBACK_RATES = { INR: 1, USD: 0.012, EUR: 0.011 };

let memoryCache = { rates: null, fetchedAt: 0 };

async function fetchLiveRates() {
  const res = await fetch(LIVE_RATE_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Exchange rate API responded with ${res.status}`);
  const data = await res.json();
  if (!data?.rates?.USD || !data?.rates?.EUR) throw new Error("Exchange rate API returned an unexpected response");
  return { INR: 1, USD: data.rates.USD, EUR: data.rates.EUR };
}

// Always resolves, never throws - a currency API hiccup must never break the storefront.
// Waterfall: fresh live fetch -> this process's short-lived cache -> last rates saved in the
// database (survives server restarts) -> hardcoded safe fallback.
async function getExchangeRates({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.rates && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return { rates: memoryCache.rates, source: "cache", updatedAt: new Date(memoryCache.fetchedAt) };
  }

  try {
    const rates = await fetchLiveRates();
    memoryCache = { rates, fetchedAt: now };
    // Persist as the fallback for next time, best-effort - a DB hiccup shouldn't break this request.
    Settings.getSingleton()
      .then((s) => {
        s.currency.exchangeRates = rates;
        s.currency.ratesUpdatedAt = new Date();
        s.currency.ratesSource = "live";
        return s.save();
      })
      .catch((err) => console.error("Could not persist live exchange rates:", err.message));
    return { rates, source: "live", updatedAt: new Date(now) };
  } catch (err) {
    console.error("Live exchange rate fetch failed, using fallback:", err.message);
    try {
      const settings = await Settings.getSingleton();
      if (settings.currency?.exchangeRates?.USD && settings.currency?.exchangeRates?.EUR) {
        return {
          rates: settings.currency.exchangeRates,
          source: "stale",
          updatedAt: settings.currency.ratesUpdatedAt || null,
        };
      }
    } catch (dbErr) {
      console.error("Could not load fallback exchange rates from Settings:", dbErr.message);
    }
    return { rates: FALLBACK_RATES, source: "fallback", updatedAt: null };
  }
}

module.exports = { getExchangeRates, FALLBACK_RATES };

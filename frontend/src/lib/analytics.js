import api from "../api/client";

// FEATURE 2 (analytics) - the ONE place that talks to /api/analytics/*. Everything here is
// anonymous: a random session id kept in localStorage, never a name/email/IP.
//
// Session id: generated once per browser (persists across visits, like a typical analytics
// cookie) so "new vs returning visitor" can be measured, but nothing about who that browser
// belongs to is ever sent.
//
// UTM/campaign attribution: if the visitor arrived via an ad's tracking link
// (backend/controllers/adController.trackClick redirects with ?utm_..., ?sr_sid=, ?sr_campaign=),
// we adopt that session id as our own (so the click-side session and the on-site session are the
// SAME document) and remember the campaign slug for the rest of this browser tab's session, so
// every event fired afterwards - product view, add to cart, purchase - can be attributed back to
// that campaign. This is what lets the admin see "Instagram ad -> product view -> cart -> purchase".

const SESSION_KEY = "sr_analytics_sid";
const RETURNING_KEY = "sr_analytics_seen";
const UTM_KEY = "sr_analytics_utm"; // sessionStorage - scoped to this browser tab/visit only
const CAMPAIGN_KEY = "sr_analytics_campaign";

function randomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function isNewVisitor() {
  const seen = localStorage.getItem(RETURNING_KEY);
  if (!seen) {
    localStorage.setItem(RETURNING_KEY, "1");
    return true;
  }
  return false;
}

// Reads utm_* and sr_campaign params from the current URL (present once, right after following
// an ad link or any manually-tagged marketing URL) and remembers them for the rest of this tab's
// session. Also adopts sr_sid from the ad-click redirect as our session id, and strips all the
// tracking params from the visible address bar so the URL stays clean for the visitor.
export function captureAttributionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const srSid = params.get("sr_sid");
  const srCampaign = params.get("sr_campaign");
  const utm = {
    source: params.get("utm_source") || "",
    medium: params.get("utm_medium") || "",
    campaign: params.get("utm_campaign") || "",
    content: params.get("utm_content") || "",
  };

  let changed = false;
  if (srSid) {
    localStorage.setItem(SESSION_KEY, srSid);
    changed = true;
  }
  if (srCampaign) {
    sessionStorage.setItem(CAMPAIGN_KEY, srCampaign);
    changed = true;
  }
  if (utm.source) {
    sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    changed = true;
  }

  if (changed) {
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "sr_sid", "sr_campaign"].forEach((k) => params.delete(k));
    const clean = params.toString();
    const url = window.location.pathname + (clean ? `?${clean}` : "") + window.location.hash;
    window.history.replaceState({}, "", url);
  }
}

function getStoredUtm() {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) || "{}");
  } catch {
    return {};
  }
}
function getCampaignSlug() {
  return sessionStorage.getItem(CAMPAIGN_KEY) || undefined;
}

let sessionStarted = false;
let staffMode = false;

// Called from App.jsx whenever auth state changes. This is a bandwidth/UX optimization ONLY -
// the real, unbypassable admin-exclusion enforcement lives server-side (see
// analyticsController.js: isStaff(req.user) check in startSession/trackEvent). Even if this
// flag were somehow wrong or skipped, the backend still refuses to record anything for an
// admin/owner token.
export function setAnalyticsStaffMode(isStaff) {
  staffMode = !!isStaff;
}

// Call once, as early as possible (see App.jsx). Bootstraps/refreshes the VisitorSession record.
export function initAnalytics() {
  if (staffMode) return;
  captureAttributionFromUrl();
  if (sessionStarted) return;
  sessionStarted = true;

  const payload = {
    sessionId: getSessionId(),
    isNewVisitor: isNewVisitor(),
    referrer: document.referrer || "",
    utm: getStoredUtm(),
    path: window.location.pathname,
    campaignSlug: getCampaignSlug(),
  };
  sendBeaconOrPost("/analytics/session", payload);
}

function sendBeaconOrPost(path, payload) {
  const body = JSON.stringify(payload);
  const url = `${api.defaults.baseURL}${path}`;
  const token = localStorage.getItem("sr_token");

  // navigator.sendBeacon cannot carry custom headers (no Authorization), so a logged-in
  // customer's identity would never reach the backend if we always used it. When a token
  // exists, use fetch (which can set the header) so optionalAuth on the backend can actually
  // identify them; `keepalive: true` gives it a similar "survives page unload" guarantee to
  // sendBeacon. Anonymous visitors (no token, nothing to attach) still get sendBeacon's
  // slightly stronger delivery guarantee where available.
  if (!token && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // fall through to fetch
    }
  }

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
}

// Fires one analytics event. Never throws, never blocks the UI - this must not be able to break
// the shopping experience if the request fails or is slow.
export function track(type, { productId, variantId, path, meta } = {}) {
  if (staffMode) return;
  sendBeaconOrPost("/analytics/event", {
    sessionId: getSessionId(),
    type,
    path: path || window.location.pathname,
    productId,
    variantId,
    campaignSlug: getCampaignSlug(),
    meta,
  });
}

export function trackPageView(path) {
  track("page_view", { path });
}

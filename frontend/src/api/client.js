import axios from "axios";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// DIAGNOSTIC (this round): a production build with no VITE_API_URL configured on the hosting
// platform (e.g. Netlify's environment variables) silently falls back to localhost, which every
// real visitor's browser obviously can't reach - every single API call fails, and the site looks
// exactly like "the server is failing" or "the page won't load". This makes that specific
// misconfiguration loud and immediately diagnosable in the browser console (open it on the live
// site - if this prints, VITE_API_URL is missing from the production build/deploy settings) 
// instead of manifesting as a mysterious, hard-to-trace blank/broken page.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "VITE_API_URL is not set in this production build - API calls are falling back to " +
      API_BASE +
      ", which will fail for every real visitor. Set VITE_API_URL in the hosting platform's environment variables and redeploy."
  );
}

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sr_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A single toast id for 429s so rapid-fire requests (a page load firing many calls at once,
// say) can't stack a dozen identical toasts on top of each other - they just replace one
// another. This exists because a LOT of call sites across the app do `.catch(() => {})` or
// `.catch(() => setX([]))` on read requests, which is normally fine (a failed optional fetch
// just leaves that section empty), but meant a rate-limit response was completely invisible -
// the page just silently showed nothing, with no way to tell that from "there's genuinely
// nothing there". This makes that failure visible everywhere, once, without having to touch
// every individual call site.
const RATE_LIMIT_TOAST_ID = "rate-limited";
// Same reasoning, for the "backend genuinely unreachable" case (no response at all - network
// down, CORS misconfigured, DNS failure, the API_BASE misconfiguration diagnosed above, etc.):
// most individual call sites just do a silent .catch(), which is fine for degrading a single
// optional section gracefully, but left the visitor with zero indication of what's actually
// wrong. One stable-id toast surfaces it once, site-wide, without needing every call site to
// handle it individually or repeating the same toast for every failed request on the page.
const NETWORK_ERROR_TOAST_ID = "network-error";

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sr_token");
      localStorage.removeItem("sr_user");
    }
    if (err.response?.status === 429) {
      toast.error(err.response?.data?.message || "Too many requests - please wait a moment and try again.", { id: RATE_LIMIT_TOAST_ID });
    }
    if (!err.response && err.code !== "ERR_CANCELED") {
      // No `response` at all means the request never got a reply from the server - genuinely
      // unreachable, not a 4xx/5xx from it. Logged for developers, and surfaced once (via the
      // stable toast id) so a visitor sees "can't reach the server" instead of pages/sections
      // just silently failing to load with no explanation.
      console.error("Network error - could not reach the server:", err.message, err.config?.url);
      toast.error("Having trouble reaching the server. Please check your connection and try again.", { id: NETWORK_ERROR_TOAST_ID });
    }
    return Promise.reject(err);
  }
);

export default api;

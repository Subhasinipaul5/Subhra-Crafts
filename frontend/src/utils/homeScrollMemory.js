// Tiny, single-purpose helper backing the Home page's "return to the exact section I clicked a
// product from" restoration (see Home.jsx's own restoration effect and ScrollRestoration.jsx,
// which deliberately excludes Home and defers to this instead).
//
// Deliberately NOT implemented via router `location.state`: state passed when navigating FORWARD
// (Home -> Product) isn't what's present on the Home location when the user later goes BACK to
// it (browser Back just re-activates Home's original history entry/state, not anything the
// Product page saw). A tiny sessionStorage marker, set at the moment of the click and read back
// when Home next mounts, sidesteps that entirely and works identically for the in-app Back
// button and the real browser Back button.
//
// Deliberately generic: the marker stores the exact target element's `id` (e.g.
// "category-64f...", "home-section-64f..."), NOT a category ID that the restoration code then
// has to guess a prefix for. This is what makes it work uniformly for the auto-generated
// per-category rows AND any admin-curated Home section (e.g. "Festival Resin Collection") - both
// just need a stable id + a call to markPendingHomeTarget at click time, and the source is
// recorded at the exact click site rather than derived from the product's own category field
// (which may not even match the section it was actually shown in).
const KEY = "sr_pending_home_target";

export function markPendingHomeTarget(elementId) {
  try {
    sessionStorage.setItem(KEY, elementId);
  } catch {
    // Non-fatal - worst case the user just doesn't get auto-scrolled back, navigation itself
    // still works fine.
  }
}

// Reads WITHOUT clearing. Deliberately non-destructive: React 18 StrictMode double-invokes
// mount effects in dev (mount -> cleanup -> mount again, synchronously, before either commit
// paints), so Home's restoration effect body runs twice on a single real mount. A read-and-clear
// "consume" here would let the first (throwaway, immediately-cleaned-up) invocation delete the
// marker before the second (surviving) invocation ever gets to act on it - which is exactly the
// bug this replaces: the target id was being silently eaten before the real scroll attempt could
// use it. Safe to call this as many times as an effect happens to run; it always returns the same
// value until something explicitly clears it.
export function peekPendingHomeTarget() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Explicit, one-time clear. Call this only once a restoration attempt has actually concluded
// (found the target and finished settling, gave up after the hard deadline, or the user started
// scrolling manually) - never eagerly at read time. See Home.jsx's restoration effect.
export function clearPendingHomeTarget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Non-fatal - worst case a stale marker lingers for this tab only.
  }
}

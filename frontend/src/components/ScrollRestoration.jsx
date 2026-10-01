import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "sr_scroll_positions";
const MAX_ENTRIES = 40; // small ring buffer - this is just scroll pixel offsets, not real data
const MAX_WAIT_MS = 2500; // give async content this long to grow before giving up

function loadMap() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage can throw in private-browsing edge cases - scroll restoration is a nicety,
    // never worth breaking navigation over, so just skip persisting for this tab.
  }
}

/**
 * Sitewide scroll-restoration, mounted once near the top of the app (inside the router).
 *
 * IMPORTANT: the Home page ("/") is deliberately EXCLUDED from the generic restoration below -
 * see Home.jsx's own restoration effect. Home needs to land on a specific CATEGORY SECTION (an
 * element that may not exist yet while its data is still loading), not a raw scroll pixel, and
 * having Home own that logic (it already knows when its own category data has finished loading)
 * avoids two competing systems fighting over the same page - the exact bug this replaces: a
 * previous version tried to restore a raw pixel offset here for every page including Home, and
 * on Home specifically that pixel could easily exceed the page's height while its categories
 * were still loading, so scrollTo() silently clamped to the bottom/footer.
 *
 * Rules, in priority order, for every OTHER page:
 *  1. Product detail pages ALWAYS open at the top - every time, regardless of how the user got
 *     there (a fresh click, browser Back/Forward landing on a product, or a hard refresh).
 *  2. Any other page reached via browser Back/Forward ("POP" navigation) restores the scroll
 *     pixel offset it had when the user left it, keyed by the router's own per-history-entry
 *     `location.key`. Restoration WAITS (polling, not a single frame) until the document is
 *     actually tall enough to contain that offset, so a still-loading Shop/search page can't
 *     silently clamp to a shorter, wrong position either.
 *  3. Any other page reached via a normal click/navigate (PUSH/REPLACE) starts at the top.
 */
export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollMapRef = useRef(loadMap());
  const currentKeyRef = useRef(location.key);
  const waitTimerRef = useRef(null);

  // Take full manual control of scroll restoration so the browser's own native per-history-entry
  // restoration (which several modern browsers do even for pushState/SPA navigation) never
  // fights with - or double-applies alongside - the logic below.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      const previous = window.history.scrollRestoration;
      window.history.scrollRestoration = "manual";
      return () => { window.history.scrollRestoration = previous; };
    }
  }, []);

  // Continuously persist the scroll position of whatever page is currently showing (Home
  // included - harmless to record even though Home doesn't use this map, kept simple/uniform).
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        scrollMapRef.current[currentKeyRef.current] = window.scrollY;
        ticking = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const flush = () => saveMap(scrollMapRef.current);
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  useEffect(() => {
    currentKeyRef.current = location.key;
    if (waitTimerRef.current) cancelAnimationFrame(waitTimerRef.current);

    const isProductPage = location.pathname.startsWith("/product/");
    const isHome = location.pathname === "/";

    if (isProductPage) {
      // Rule 1 - never restore/keep an old position on a product page, ever.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }

    if (isHome) {
      // Home owns its own restoration entirely (see Home.jsx) - do nothing here, and
      // importantly do NOT scroll to top either, since that would race with Home's effect.
      return;
    }

    if (navigationType === "POP") {
      const saved = scrollMapRef.current[location.key];
      if (typeof saved === "number" && saved > 0) {
        const startedAt = performance.now();
        const tryRestore = () => {
          const tallEnough = document.documentElement.scrollHeight - window.innerHeight >= saved;
          if (tallEnough || performance.now() - startedAt > MAX_WAIT_MS) {
            window.scrollTo({ top: saved, left: 0, behavior: "instant" });
            return;
          }
          waitTimerRef.current = requestAnimationFrame(tryRestore);
        };
        waitTimerRef.current = requestAnimationFrame(tryRestore);
        return;
      }
    }

    // Fresh PUSH/REPLACE navigation to a non-product, non-Home page - start at the top.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const keys = Object.keys(scrollMapRef.current);
    if (keys.length > MAX_ENTRIES) {
      keys.slice(0, keys.length - MAX_ENTRIES).forEach((k) => delete scrollMapRef.current[k]);
    }
    saveMap(scrollMapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.key, navigationType]);

  useEffect(() => () => { if (waitTimerRef.current) cancelAnimationFrame(waitTimerRef.current); }, []);

  return null;
}

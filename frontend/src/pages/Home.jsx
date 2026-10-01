import { useEffect, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useTranslation } from "react-i18next";
import SectionHeading from "../components/SectionHeading";
import CategoryImageSlideshow from "../components/CategoryImageSlideshow";
import HomeSalesSection from "../components/HomeSalesSection";
import ProductCard from "../components/ProductCard";
import HomeBannerSlider from "../components/HomeBannerSlider";
import HomeContactSection from "../components/HomeContactSection";
import DecorativeBackground from "../components/three/DecorativeBackground";
import LeafDoodles from "../components/LeafDoodles";
import AnimatedDoodles from "../components/AnimatedDoodles";
import Reveal from "../components/Reveal";
import { markPendingHomeTarget, peekPendingHomeTarget, clearPendingHomeTarget } from "../utils/homeScrollMemory";
import placeholder from "../assets/placeholder.svg";

export default function Home() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});

  useEffect(() => {
    // Each fetch is independent and .catch()'d on its own: one section's data failing to load
    // (e.g. the sections API being briefly unavailable) must not stop the other two from
    // rendering, and must not leave an unhandled promise rejection sitting around. Errors are
    // logged (not swallowed silently) so a real backend/API problem is still diagnosable from
    // the console, while the UI itself just falls back to each section's existing empty state
    // (already handled below, e.g. "Categories will appear here once added...") rather than
    // crashing or showing nothing with no explanation.
    api.get("/categories?all=false").then((res) => setCategories(res.data.filter((c) => c.featured))).catch((err) => console.error("Failed to load featured categories:", err));
    api.get("/sections?location=homepage").then((res) => setSections(res.data)).catch((err) => console.error("Failed to load homepage sections:", err));
    api.get("/products?bestseller=true&limit=8").then((res) => setBestsellers(res.data.products)).catch((err) => console.error("Failed to load bestsellers:", err));
  }, []);

  // Restores the exact Home section (a category row, or an admin-curated collection - anything
  // with a stable id) that the user clicked a product FROM, when they come back to Home (either
  // the in-app Back button or the browser's own Back/Forward). See utils/homeScrollMemory.js for
  // why this is a sessionStorage marker holding the exact target element id, and
  // ScrollRestoration.jsx for why Home handles this itself instead of the generic pixel-based
  // restoration used by every other page.
  //
  // THE BUG THIS FIXES (found by inspection, not guessed): the first version of this effect
  // scrolled to the target exactly once, the instant the element first appeared in the DOM. But
  // several OTHER Home sections load independently/asynchronously too (the curated
  // "sections.map" collections, the hero banner image, product images, decorative 3D canvases),
  // and any of those finishing layout AFTER our one-time scroll shifts everything below it -
  // including our target - so the page visibly drifted away from the intended section after
  // landing on it (in the worst case, several late-loading sections above the target
  // collectively push it far enough that the user ends up looking at the footer). The fix is to
  // keep RE-CORRECTING the scroll position for a short "settle" window after first finding the
  // element, not just once - but stop immediately the moment the user actually touches the
  // scroll themselves, so this never fights a real user action.
  useEffect(() => {
    // Non-destructive read on purpose - see peekPendingHomeTarget's comment in
    // utils/homeScrollMemory.js for why a read-and-clear "consume" here was the actual bug
    // (StrictMode's double-invoked mount effect was losing the marker before the surviving
    // invocation could act on it). The marker is cleared explicitly below, only once this
    // restoration attempt actually concludes.
    const targetId = peekPendingHomeTarget();
    if (!targetId) return;

    let frame;
    let settleUntil = null; // set once we've found+scrolled at least once
    let userTookOver = false;
    const HARD_DEADLINE_MS = 4000; // covers "waiting for the element to exist" + the settle window
    const SETTLE_MS = 1200; // how long we keep re-correcting for layout shifts after first landing
    const startedAt = performance.now();

    const onUserInput = () => { userTookOver = true; };
    window.addEventListener("wheel", onUserInput, { passive: true });
    window.addEventListener("touchmove", onUserInput, { passive: true });
    window.addEventListener("keydown", onUserInput);

    const tick = () => {
      if (userTookOver) {
        clearPendingHomeTarget(); // user took over - this attempt is done, don't retry later
        return;
      }
      const el = document.getElementById(targetId);
      if (el) {
        const headerEl = document.querySelector("header");
        const headerHeight = headerEl?.getBoundingClientRect().height || 0;
        const targetY = window.scrollY + el.getBoundingClientRect().top - headerHeight - 16;
        window.scrollTo({ top: Math.max(targetY, 0), left: 0, behavior: "instant" });
        if (settleUntil === null) settleUntil = performance.now() + SETTLE_MS;
      }
      const elapsed = performance.now() - startedAt;
      const stillSettling = settleUntil !== null && performance.now() < settleUntil;
      const stillWaitingForElement = settleUntil === null && elapsed < HARD_DEADLINE_MS;
      if (stillSettling || stillWaitingForElement) {
        frame = requestAnimationFrame(tick);
      } else {
        // Concluded either way (found it and finished settling, or gave up waiting for an
        // element that never showed up) - clear now so a stale marker can't cause a surprise
        // scroll on some unrelated later Home visit.
        clearPendingHomeTarget();
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", onUserInput);
      window.removeEventListener("touchmove", onUserInput);
      window.removeEventListener("keydown", onUserInput);
    };
    // Intentionally runs once per mount only - a fresh Home visit with no pending marker must
    // never scroll anywhere on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build a "Latest Jewelry Pieces" strip - a row of products per category. Admin-curated when
  // available: homepage=true only returns products the admin explicitly marked "Show on
  // Homepage" for (see Product.homepageVisible/homepagePosition, set from Admin > Homepage
  // Management), ordered by the admin's chosen position - never automatically by recency, so a
  // curated category is never disturbed by adding a new product. A category the admin hasn't
  // curated YET falls back to the original "newest products" behavior so the homepage never
  // shows an empty section - the moment the admin curates even one product for that category,
  // the fallback stops and the admin's own selection takes over completely.
  useEffect(() => {
    if (categories.length === 0) return;
    // Promise.allSettled (not Promise.all): a single category's request failing must only drop
    // THAT category's row, not discard every other category's already-successful results too -
    // Promise.all would reject the whole batch the moment any one entry rejects, wiping out an
    // otherwise-fine "Latest Jewelry Pieces" strip because of one unrelated hiccup.
    Promise.allSettled(
      categories.map((c) =>
        api.get("/products", { params: { category: c._id, homepage: true, limit: 8 } }).then((res) => {
          if (res.data.products.length > 0) return { category: c, products: res.data.products };
          return api.get("/products", { params: { category: c._id, limit: 4 } }).then((res2) => ({
            category: c,
            products: res2.data.products,
          }));
        })
      )
    ).then((results) => {
      const map = {};
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value.products.length > 0) map[r.value.category._id] = r.value;
        else if (r.status === "rejected") console.error("Failed to load products for a homepage category:", r.reason);
      });
      setProductsByCategory(map);
    });
  }, [categories]);

  return (
    <div>
      {/* HERO */}
      <HomeBannerSlider />

      {/* FEATURED CATEGORIES - data-driven, max 5 categories shown in one row; if there are
          more, the section shows the first 5 plus a "View All" link to the full listing page
          instead of trying to cram every category in. */}
      <section className="relative max-w-7xl mx-auto px-6 py-20">
        <AnimatedDoodles variant="corners" />
        <div className="relative">
          {/* Unconditional, same as every other row's "View all →" (see the per-category rows
              below) - a store with 5 or fewer categories still benefits from a direct link to
              the full listing, same as a category with 4 or fewer products still gets one.
              Passed as `action` into SectionHeading's flex header row (align="left") instead of
              being absolutely positioned over the heading - that's what previously let it
              overlap a wrapped/long title on narrow screens; now it's a normal sibling flex
              item that can never sit on top of the text. */}
          <Reveal>
            <SectionHeading
              eyebrow={t("home.exploreEyebrow")}
              title={t("home.featuredCategories")}
              subtitle="Every piece is hand-poured and finished with care."
              align="left"
              action={
                categories.length > 0 && (
                  <Link to="/categories" className="text-sm text-rose hover:underline whitespace-nowrap">
                    View All →
                  </Link>
                )
              }
            />
          </Reveal>
        </div>
        {/* grid-flow-col + auto-cols instead of the previous fixed-column grid: this lays every
            card out in ONE row that scrolls horizontally rather than wrapping once it runs out
            of columns - which is exactly what caused a 6th item to drop alone onto a second row
            before. auto-cols is sized so 6 cards fit exactly within the container width at each
            breakpoint (calc() accounts for the 5 gaps between them), never forcing a scrollbar
            on desktop when there are 6 or fewer, while still comfortably swipeable on mobile. */}
        <div className="grid grid-flow-col auto-cols-[42%] sm:auto-cols-[30%] lg:auto-cols-[calc((100%-5rem)/6)] gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
          {categories.slice(0, 6).map((cat) => (
            <Link
              key={cat._id}
              to={`/shop?category=${cat._id}`}
              className="group card overflow-hidden text-center snap-start"
            >
              <div className="aspect-square overflow-hidden bg-ivory">
                <CategoryImageSlideshow
                  images={cat.images}
                  fallbackSrc={cat.image?.url || placeholder}
                  alt={cat.name}
                  slideshow={cat.slideshow}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-3 font-display text-sm text-plum dark:text-cream">{cat.name}</div>
            </Link>
          ))}
        </div>
        {categories.length === 0 && (
          <p className="text-center text-plum-light/60 dark:text-cream/60 text-sm">
            Categories will appear here once added from the admin dashboard.
          </p>
        )}
      </section>

      {/* ADMIN-BUILT SECTIONS - exactly 4 products per row on desktop, never wraps to a 2nd row;
          if a collection has more than 4, only the first 4 show plus a "View All" link to the
          full collection page. Fully dynamic - works for any section/category the admin creates. */}
      {sections.map((section) => (
        <section key={section._id} id={`home-section-${section._id}`} className="max-w-7xl mx-auto px-6 py-16">
          <div className="relative">
            <Reveal>
              <SectionHeading
                eyebrow={t("home.collectionEyebrow")}
                title={section.title}
                subtitle={section.description}
                align="left"
                action={
                  section.products.length > 4 && (
                    <Link to={`/collections/${section._id}`} className="text-sm text-rose hover:underline whitespace-nowrap">
                      {t("home.viewAll")} →
                    </Link>
                  )
                }
              />
            </Reveal>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {section.products.slice(0, 4).map((p) => (
              <ProductCard key={p._id} product={p} onNavigate={() => markPendingHomeTarget(`home-section-${section._id}`)} />
            ))}
          </div>
        </section>
      ))}

      {/* LATEST JEWELRY PIECES - catalogue style rows, one per category */}
      {Object.keys(productsByCategory).length > 0 && (
        <section className="relative max-w-7xl mx-auto px-6 py-16">
          <AnimatedDoodles variant="edges" />
          <div className="space-y-12">
            {Object.values(productsByCategory).map(({ category, products }, i) => (
              <Fragment key={category._id}>
                <div id={`category-${category._id}`}>
                  <Reveal className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
                    <h3 className="section-title text-xl sm:text-2xl text-plum dark:text-cream break-words">{category.name}</h3>
                    <Link to={`/shop?category=${category._id}`} className="text-sm text-rose hover:underline whitespace-nowrap">
                      View all →
                    </Link>
                  </Reveal>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {products.map((p) => (
                      <ProductCard key={p._id} product={p} onNavigate={() => markPendingHomeTarget(`category-${category._id}`)} />
                    ))}
                  </div>
                </div>
                {/* Sales & Offers sits right after the first category row on purpose - "between
                    the first two category sections" is what was asked for, and doing it by
                    position (not by matching a category's name) means this keeps working no
                    matter what the admin names or reorders their categories to later. Renders
                    nothing at all when there's no active sale - see HomeSalesSection.jsx. */}
                {i === 0 && <HomeSalesSection />}
              </Fragment>
            ))}
          </div>
        </section>
      )}

      {/* BESTSELLER BANNER */}
      {bestsellers[0] && (
        <section id="home-section-bestseller-banner" className="relative overflow-hidden bg-plum-light/90">
          <div className="max-w-7xl mx-auto grid sm:grid-cols-2 items-center">
            <div className="px-6 sm:px-12 py-14 text-cream">
              <div className="text-xs tracking-[0.3em] uppercase text-gold mb-3">Our Bestseller</div>
              <h2 className="font-display text-3xl sm:text-4xl mb-3">{bestsellers[0].name}</h2>
              <p className="text-cream/80 max-w-sm mb-6 leading-relaxed">{bestsellers[0].description}</p>
              <Link
                to={`/product/${bestsellers[0].slug}`}
                onClick={() => markPendingHomeTarget("home-section-bestseller-banner")}
                className="inline-block bg-gold text-plum-dark px-6 py-3 rounded-full text-sm hover:bg-gold/90 transition-colors"
              >
                Shop This Piece
              </Link>
            </div>
            <div className="aspect-[4/3] sm:aspect-[3/4] sm:max-h-[480px] w-full mx-auto bg-black">
              <img
                src={bestsellers[0].images?.[0]?.url || placeholder}
                alt={bestsellers[0].name}
                onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </section>
      )}

      {bestsellers.length > 1 && (
        <section id="home-section-more-bestsellers" className="relative max-w-7xl mx-auto px-6 py-16">
          <LeafDoodles />
          <Reveal><SectionHeading eyebrow="Loved by Customers" title="More Best Sellers" /></Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {bestsellers.slice(1).map((p) => (
              <ProductCard key={p._id} product={p} onNavigate={() => markPendingHomeTarget("home-section-more-bestsellers")} />
            ))}
          </div>
        </section>
      )}

      {/* STORY STRIP */}
      <section className="relative overflow-hidden bg-plum text-cream py-20 mt-10">
        <DecorativeBackground theme="sparkles" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <Reveal>
            <div className="section-eyebrow text-gold mb-3">Our Story</div>
            <h2 className="section-title mb-4">Made by Two Sisters, Crafted with Love.</h2>
            <p className="text-cream/75 leading-relaxed">
              SubhRa Crafts began as a shared love for creativity between two sisters — every resin piece is designed,
              poured, and finished by hand, made to be treasured.
            </p>
            <Link to="/about" className="inline-block mt-6 text-gold underline underline-offset-4 text-sm">
              Read our story
            </Link>
          </Reveal>
        </div>
      </section>

      <HomeContactSection />
    </div>
  );
}

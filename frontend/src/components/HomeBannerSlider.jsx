import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import heroModel from "../assets/hero-model.jpg";
import HeroImageLayer from "./HeroImageLayer";
import HeroDecorations from "./HeroDecorations";

const DEFAULT_BANNER_SETTINGS = { transition: "fade", durationMs: 700, autoChange: true, intervalSeconds: 2, pauseOnHover: true };

// The homepage hero, driven by up to 10 admin-managed slides (see AdminHomeBanner.jsx /
// backend/models/HomeBannerSlide.js) instead of one fixed image. Backward compatible by design:
// if the admin hasn't added any slides yet, this renders exactly the old single-image hero
// (falling back to Settings.homeBanner, then the bundled default image).
//
// IMPORTANT: only the <HeroImageLayer> below is ever re-rendered/animated on the auto-advance
// interval - the text block is a plain sibling that just displays whatever the current slide's
// title/subtitle is, with no key/remount and no enter animation, so it never flickers.
export default function HomeBannerSlider() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [slides, setSlides] = useState(null); // null = loading
  const [legacyBannerUrl, setLegacyBannerUrl] = useState("");
  const [bannerSettings, setBannerSettings] = useState(DEFAULT_BANNER_SETTINGS);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get("/home-banner").then((res) => setSlides(res.data)).catch(() => setSlides([]));
    api.get("/settings").then((res) => {
      setLegacyBannerUrl(res.data.homeBanner?.url || "");
      if (res.data.bannerSettings) setBannerSettings(res.data.bannerSettings);
    }).catch(() => {});
  }, []);

  const hasSlides = slides && slides.length > 0;
  const activeSlide = hasSlides ? slides[index] : null;
  const intervalMs = (bannerSettings.intervalSeconds || 2) * 1000;
  const isPausedForHover = paused && bannerSettings.pauseOnHover;

  useEffect(() => {
    if (!hasSlides || slides.length < 2 || !bannerSettings.autoChange || isPausedForHover) return;
    timerRef.current = setTimeout(() => setIndex((i) => (i + 1) % slides.length), intervalMs);
    return () => clearTimeout(timerRef.current);
  }, [index, hasSlides, slides, isPausedForHover, intervalMs, bannerSettings.autoChange]);

  const goTo = (i) => setIndex((i + (slides?.length || 1)) % (slides?.length || 1));

  // Per-slide fields are admin-entered DATABASE content, so they are deliberately NOT run
  // through i18next - only the static fallback copy (used when a slide leaves a field blank, or
  // no slides exist at all) is translated.
  const title = activeSlide?.title || t("home.title");
  const subtitle = activeSlide?.subtitle || t("home.subtitle");
  const buttonText = activeSlide?.buttonText || t("home.shopCollection");
  const imageUrl = activeSlide?.image?.url || legacyBannerUrl || heroModel;

  // "Banner -> linked product" instead of a manually-typed URL: admin picks an existing
  // product (see AdminHomeBanner.jsx's ProductPicker), stored as `linkedProductId` (just the
  // id - see backend/models/HomeBannerSlide.js) and resolved fresh here via the populated
  // product on the slide, so the link always points at that product's CURRENT slug/route even
  // if it was renamed after the banner was linked. If the linked product was since deleted,
  // populate() resolves it to null server-side - isImageClickable is false and the banner just
  // behaves as if nothing were linked, never a broken link/crash. Image AND button always go to
  // the same place, per the requirement that they must never diverge.
  const linkedProduct = activeSlide?.linkedProductId;
  const isImageClickable = !!linkedProduct?.slug;
  const buttonHref = linkedProduct?.slug ? `/product/${linkedProduct.slug}` : "/shop";

  const goToLinkedProduct = () => {
    if (isImageClickable) navigate(`/product/${linkedProduct.slug}`);
  };

  // Distinguishes an intentional horizontal swipe (changes slide) from a genuine tap (opens the
  // linked product) with a small movement threshold - same pattern as the draggable Help
  // button's click-vs-drag threshold elsewhere in the app. `swiped` lives in a ref, not state,
  // since it's read/reset synchronously inside the click handler that follows touchend and
  // doesn't need to trigger a re-render itself.
  const touchRef = useRef({ startX: 0, startY: 0, swiped: false });
  const SWIPE_THRESHOLD_PX = 35;

  const onFrameTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiped: false };
  };
  const onFrameTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = t.clientY - touchRef.current.startY;
    if (!touchRef.current.swiped && Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      touchRef.current.swiped = true;
    }
  };
  const onFrameTouchEnd = (e) => {
    if (touchRef.current.swiped && hasSlides && slides.length > 1) {
      const dx = e.changedTouches[0].clientX - touchRef.current.startX;
      if (dx < 0) goTo(index + 1);
      else goTo(index - 1);
    }
  };
  const handleFrameClick = () => {
    if (touchRef.current.swiped) {
      // A swipe just moved the slide - the browser's synthetic click that follows a touch
      // sequence is swallowed here so it can never also open a product mid-swipe.
      touchRef.current.swiped = false;
      return;
    }
    goToLinkedProduct();
  };

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-blush/40 via-cream to-cream"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroDecorations />
      <div className="max-w-7xl mx-auto px-6 py-8 lg:py-10 grid lg:grid-cols-2 gap-10 items-center">
        {/* Text block: NO key tied to `index`, no enter/remount animation on slide change - only
            its text content updates then, so it never re-renders visibly/flickers. The
            heroFadeInUp entrance below plays once on mount (page load), not on slide change. */}
        <div>
          <div
            className="section-eyebrow text-rose mb-3 opacity-0 [animation:heroFadeInUp_1s_cubic-bezier(0.22,1,0.36,1)_0.05s_both]"
          >
            {t("home.eyebrow")}
          </div>
          <h1
            className="hero-title text-plum dark:text-cream whitespace-pre-line opacity-0 [animation:heroFadeInUp_1s_cubic-bezier(0.22,1,0.36,1)_0.18s_both]"
          >
            {title}
          </h1>
          <p
            className="mt-5 text-plum-light/90 dark:text-cream/90 max-w-md leading-relaxed opacity-0 [animation:heroFadeInUp_1s_cubic-bezier(0.22,1,0.36,1)_0.32s_both]"
          >
            {subtitle}
          </p>
          <div
            className="mt-7 flex flex-wrap gap-4 opacity-0 [animation:heroFadeInUp_1s_cubic-bezier(0.22,1,0.36,1)_0.46s_both]"
          >
            <Link to={buttonHref} className="btn-primary">{buttonText}</Link>
            <Link to="/custom-order" className="btn-outline">{t("home.customiseYourOwn")}</Link>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full bg-lavender/40 blur-2xl" />
          <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-gold/20 blur-2xl" />
          {/* Fills its frame edge-to-edge at 100% zoom - larger + taller cap than before so the
              hero uses more of the viewport, while object-cover/object-position keeps it from
              ever looking "too small" inside its frame.
              Clickable as a whole (image -> linked product) only when a product is linked;
              otherwise behaves exactly as before. role="link"/tabIndex/onKeyDown make this
              keyboard-accessible without nesting a real <a> around the prev/next/pause buttons
              below, which would be invalid HTML - those buttons each stop propagation so
              clicking THEM never triggers this navigation.
              Touch handling distinguishes an intentional horizontal SWIPE (changes slide, same
              as the arrow buttons - navigation is suppressed) from a genuine TAP (opens the
              linked product) using a small movement threshold, so a visitor swiping through
              banners on mobile never gets accidentally sent to a product mid-swipe. */}
          <div
            className={`relative rounded-xl2 overflow-hidden shadow-soft border border-blush aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5] max-h-[560px] lg:max-h-[72vh] mx-auto ${
              isImageClickable ? "cursor-pointer" : ""
            }`}
            onClick={handleFrameClick}
            onTouchStart={onFrameTouchStart}
            onTouchMove={onFrameTouchMove}
            onTouchEnd={onFrameTouchEnd}
            role={isImageClickable ? "link" : undefined}
            tabIndex={isImageClickable ? 0 : undefined}
            aria-label={isImageClickable ? `View ${linkedProduct.name}` : undefined}
            onKeyDown={
              isImageClickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToLinkedProduct();
                    }
                  }
                : undefined
            }
          >
            <HeroImageLayer
              src={imageUrl}
              alt="Model wearing SubhRa Crafts handmade resin jewelry"
              transition={bannerSettings.transition}
              durationMs={bannerSettings.durationMs}
              fallbackSrc={heroModel}
            />

            {hasSlides && slides.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(index - 1); }}
                  aria-label="Previous banner"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-plum flex items-center justify-center shadow z-10"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goTo(index + 1); }}
                  aria-label="Next banner"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-plum flex items-center justify-center shadow z-10"
                >
                  ›
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPaused((p) => !p); }}
                  aria-label={paused ? "Play banner slideshow" : "Pause banner slideshow"}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/80 hover:bg-white text-plum text-xs flex items-center justify-center shadow z-10"
                >
                  {paused ? "▶" : "❚❚"}
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); goTo(i); }}
                      aria-label={`Go to banner ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === index ? "bg-white w-5" : "bg-white/60 w-1.5"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

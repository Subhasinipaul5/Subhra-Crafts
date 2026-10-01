import { useRef, useState } from "react";
import placeholder from "../assets/placeholder.svg";

// FEATURE 1 (this round) - a single reusable carousel used everywhere product images are shown
// (ProductCard thumbnails, ProductDetails main image). Falls back to a plain static image
// automatically when there's only one image, so nothing changes visually for single-image
// products - per spec, arrows/dots/swipe only ever appear when there's something to swipe to.
//
// - Touch: swipe left/right (native touch events, no library).
// - Desktop: hover reveals prev/next arrow buttons.
// - Dots: small tappable indicators under the image when `showDots` is true.
export default function ImageCarousel({
  images,
  alt = "",
  className = "",
  imageClassName = "object-cover",
  showDots = false,
  showArrows = true,
  index: controlledIndex,
  onIndexChange,
}) {
  const [internalIndex, setInternalIndex] = useState(0);
  const isControlled = controlledIndex !== undefined;
  const index = isControlled ? controlledIndex : internalIndex;
  const touchStartX = useRef(null);
  const touchDeltaX = useRef(0);

  const list = images && images.length > 0 ? images : [{ url: "" }];
  const hasMultiple = list.length > 1;

  const goTo = (i) => {
    const next = (i + list.length) % list.length;
    if (!isControlled) setInternalIndex(next);
    onIndexChange?.(next);
  };

  const handleTouchStart = (e) => {
    // Without touch-action: pan-y (set below), a mobile browser can decide a horizontal drag is
    // actually a vertical page-scroll attempt and consume the gesture itself before these
    // handlers ever see a meaningful touchmove - this is the usual reason a hand-rolled swipe
    // carousel "doesn't work" on a real phone even though the JS logic is correct.
    if (!hasMultiple) return;
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };
  const handleTouchMove = (e) => {
    if (!hasMultiple || touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const handleTouchEnd = () => {
    if (!hasMultiple) return;
    if (touchDeltaX.current > 40) goTo(index - 1);
    else if (touchDeltaX.current < -40) goTo(index + 1);
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className="relative w-full h-full overflow-hidden select-none"
        style={{ touchAction: hasMultiple ? "pan-y" : "auto" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={list[index]?.url || placeholder}
          alt={alt}
          draggable={false}
          onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
          className={`w-full h-full ${imageClassName}`}
        />

        {hasMultiple && showArrows && (
          <>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(index - 1); }}
              aria-label="Previous image"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-plum items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(index + 1); }}
              aria-label="Next image"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-plum items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              ›
            </button>
          </>
        )}

        {hasMultiple && showDots && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(i); }}
                aria-label={`Go to image ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? "bg-white w-4" : "bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import placeholder from "../assets/placeholder.svg";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;
const SWIPE_THRESHOLD_PX = 50;

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

// Keeps a panned/zoomed image from being dragged completely off-screen - a simple bound
// proportional to how far zoomed in it currently is, enough to keep the photo reachable at any
// zoom level without needing pixel-perfect edge math (this is a lightbox, not an image editor).
function clampTranslate(t, scale) {
  const bound = 180 * (scale - 1);
  return {
    x: Math.min(bound, Math.max(-bound, t.x)),
    y: Math.min(bound, Math.max(-bound, t.y)),
  };
}

function touchDistance(t1, t2) {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

/**
 * Props:
 *  - images: flattened gallery list from utils/reviewGallery's buildReviewGallery -
 *    [{ url, review }, ...], review = { rating, comment, user: { name } }
 *  - startIndex: which image to open on
 *  - onClose: called on any close action (X button, Escape, tap outside the image/panel)
 *
 * A pure overlay (fixed position, own top-level z-index) - closing it never navigates anywhere,
 * so the underlying page's scroll position is exactly where it was, automatically.
 */
export default function ReviewGalleryLightbox({ images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [imgError, setImgError] = useState(false);

  const gesture = useRef({ mode: null, startX: 0, startY: 0, startTranslate: { x: 0, y: 0 }, startDist: 0, startScale: 1 });
  const lastTapRef = useRef(0);

  const total = images.length;
  const current = images[index];

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setImgError(false);
  }, [index]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const goTo = useCallback((next) => setIndex(((next % total) + total) % total), [total]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  const toggleZoom = () => {
    setScale((s) => (s > 1 ? 1 : 2.5));
    setTranslate({ x: 0, y: 0 });
  };

  const onTouchStart = (e) => {
    const g = gesture.current;
    if (e.touches.length === 2) {
      g.mode = "pinch";
      g.startDist = touchDistance(e.touches[0], e.touches[1]);
      g.startScale = scale;
      setIsGesturing(true);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      g.startX = t.clientX;
      g.startY = t.clientY;
      g.startTranslate = { ...translate };
      g.mode = scale > 1 ? "pan" : "swipe";
      setIsGesturing(true);

      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        toggleZoom();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  };

  const onTouchMove = (e) => {
    const g = gesture.current;
    if (g.mode === "pinch" && e.touches.length === 2) {
      e.preventDefault();
      const d = touchDistance(e.touches[0], e.touches[1]);
      setScale(clampScale(g.startScale * (d / (g.startDist || d))));
    } else if (g.mode === "pan" && e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      setTranslate(
        clampTranslate(
          { x: g.startTranslate.x + (t.clientX - g.startX), y: g.startTranslate.y + (t.clientY - g.startY) },
          scale
        )
      );
    }
    // mode === "swipe": no live drag-translate on purpose - direction/distance is evaluated
    // once on touchend instead, so the swipe never fights a "snap back" transition.
  };

  const onTouchEnd = (e) => {
    const g = gesture.current;
    if (g.mode === "swipe" && e.changedTouches.length) {
      const t = e.changedTouches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }
    g.mode = null;
    setIsGesturing(false);
  };

  const onWheel = (e) => {
    e.preventDefault();
    setScale((s) => clampScale(s - e.deltaY * 0.0025));
  };

  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={onBackdropClick} role="dialog" aria-modal="true" aria-label="Review image viewer">
      <div className="flex items-center justify-between px-4 py-3 text-white/90 text-sm shrink-0" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
        <span className="tabular-nums">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setScale((s) => clampScale(s - 0.5)); }}
            className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-lg items-center justify-center"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setScale((s) => clampScale(s + 0.5)); }}
            className="hidden sm:flex w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-lg items-center justify-center"
            aria-label="Zoom in"
          >
            +
          </button>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-2xl flex items-center justify-center" aria-label="Close viewer">
            ×
          </button>
        </div>
      </div>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden touch-none select-none"
        onClick={onBackdropClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          e.stopPropagation();
          toggleZoom();
        }}
      >
        {total > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl items-center justify-center"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl items-center justify-center"
              aria-label="Next image"
            >
              ›
            </button>
          </>
        )}

        <img
          src={imgError ? placeholder : current.url}
          alt="Customer review"
          draggable={false}
          onError={() => setImgError(true)}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transition: isGesturing ? "none" : "transform 0.15s ease-out",
            cursor: scale > 1 ? "grab" : "default",
          }}
        />
      </div>

      <div
        className="shrink-0 bg-black/80 px-5 py-4 text-white"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-gold text-sm">
            {"★".repeat(current.review.rating)}
            {"☆".repeat(5 - current.review.rating)}
          </span>
          <span className="text-sm font-medium">{current.review.user?.name || "Customer"}</span>
        </div>
        {current.review.comment && <p className="text-sm text-white/85 max-w-2xl line-clamp-3">{current.review.comment}</p>}
      </div>
    </div>
  );
}

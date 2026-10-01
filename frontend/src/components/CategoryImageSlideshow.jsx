import { useEffect, useRef, useState } from "react";

// Two trigger modes, sharing the same rendering/transition logic:
//
// mode="hover" (default) - for a single category's own card (Home.jsx's Featured Categories
// row, the /categories page). Only animates while the mouse is over it; on mouse leave it
// resets straight back to the first image, so the grid always looks the same at rest. Admin
// controls come from Category.slideshow (transition + durationSeconds) - see AdminCategories.jsx.
//
// mode="auto" - for the navbar mega-menu's "All Categories" tile (see CategoriesMegaMenu.jsx).
// Cycles continuously on its own regardless of hover, and PAUSES on the current image while
// hovered (when `pauseOnHover` is true) instead of resetting - the opposite trigger scheme,
// since this tile represents "browse everything" rather than one specific category and is meant
// to always be doing something to catch the eye. Controls come from
// Settings.navbarCategories.slideshow - see AdminHomepage.jsx's Navbar Categories section.
//
// Either way, a source with 0 or 1 images renders as a completely plain static image - the
// slideshow machinery (interval, multiple stacked <img>s) only kicks in once there are 2+.
export default function CategoryImageSlideshow({ images, fallbackSrc, alt = "", slideshow, className = "", mode = "hover" }) {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef(null);

  const list = images && images.length > 0 ? images : fallbackSrc ? [{ url: fallbackSrc }] : [];
  const canSlide = list.length > 1;
  const transition = slideshow?.transition || "fade";
  const durationMs = (slideshow?.durationSeconds ?? slideshow?.intervalSeconds ?? 2) * 1000;
  const pauseOnHover = slideshow?.pauseOnHover ?? false;

  const running = mode === "auto" ? canSlide && !(pauseOnHover && hovering) : hovering && canSlide;

  useEffect(() => {
    if (!running) return;
    // Loops continuously for as long as it's running - wraps back to the first image after the
    // last one and keeps going, exactly like the home banner slider.
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % list.length), durationMs);
    return () => clearInterval(timerRef.current);
  }, [running, durationMs, list.length]);

  const handleLeave = () => {
    setHovering(false);
    if (mode === "hover") setIndex(0); // back to the main/first image at rest - "auto" mode just keeps cycling from wherever it was
  };

  if (list.length === 0) {
    return (
      <div className={className}>
        <img src={fallbackSrc} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleLeave}
    >
      {list.map((img, i) => {
        let position = "opacity-0"; // default: fade transition, hidden
        if (i === index) {
          position = "opacity-100 translate-x-0";
        } else if (transition === "slide-left") {
          position = i < index ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full";
        } else if (transition === "slide-right") {
          position = i < index ? "opacity-0 translate-x-full" : "opacity-0 -translate-x-full";
        }
        return (
          <img
            key={img.url + i}
            src={img.url}
            alt={i === 0 ? alt : ""}
            onError={(e) => { e.target.onerror = null; e.target.src = fallbackSrc; }}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-in-out ${position}`}
            style={{ zIndex: i === index ? 2 : 1 }}
          />
        );
      })}
    </div>
  );
}

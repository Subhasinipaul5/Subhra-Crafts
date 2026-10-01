import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme, COLOR_THEMES } from "../context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { colorTheme, setColorTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const current = COLOR_THEMES.find((t) => t.id === colorTheme) || COLOR_THEMES[0];

  const POPOVER_WIDTH = 240;
  const POPOVER_EST_HEIGHT = 400; // rough estimate for 9 theme rows + header

  const openPopover = () => {
    const rect = btnRef.current.getBoundingClientRect();
    // Anchor to the button's actual screen position (not a CSS-relative ancestor), then
    // clamp horizontally so it never runs off either edge of the viewport, and flip
    // vertically if there isn't room to open downward (e.g. button near viewport bottom).
    let left = rect.right - POPOVER_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_WIDTH - 8));

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < POPOVER_EST_HEIGHT && rect.top > POPOVER_EST_HEIGHT;

    setCoords(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 8, left, maxHeight: rect.top - 16 }
        : { top: rect.bottom + 8, left, maxHeight: window.innerHeight - rect.bottom - 16 }
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const pick = (id) => {
    setColorTheme(id);
    setOpen(false);
  };

  const popover = coords && (
    <div
      ref={popoverRef}
      className="fixed w-60 bg-white rounded-xl2 shadow-soft border border-blush py-2 text-sm overflow-y-auto"
      style={{
        top: coords.top,
        bottom: coords.bottom,
        left: coords.left,
        maxHeight: coords.maxHeight,
        zIndex: 10001,
      }}
    >
      <div className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-rose">Theme</div>
      {COLOR_THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => pick(t.id)}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-blush/30 text-left"
        >
          <span
            className="w-5 h-5 rounded-full border border-black/10 shrink-0"
            style={{ background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]}, ${t.colors[2]})` }}
          />
          <span className="flex-1 text-plum-dark">{t.emoji} {t.name}</span>
          {colorTheme === t.id && <span className="text-gold">✓</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label="Choose theme"
        className="w-9 h-9 rounded-full border border-blush flex items-center justify-center text-sm hover:bg-blush/30 transition-colors shrink-0"
        style={{ background: `linear-gradient(135deg, ${current.colors[0]}, ${current.colors[1]})` }}
      >
        <span className="text-base leading-none">{current.emoji}</span>
      </button>

      {/* Rendered via portal with position:fixed computed from the button's real screen
          position - this is what makes it float correctly above the content regardless of
          which page/layout (customer site, admin sidebar, mobile drawer) it's opened from. */}
      {open && createPortal(popover, document.body)}
    </div>
  );
}

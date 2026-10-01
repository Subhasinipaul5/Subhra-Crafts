import { buildWhatsAppUrl } from "../config";

// The floating "Help" button present on every customer-facing page (mounted once, above
// <Routes>, in App.jsx - it never unmounts/remounts on navigation, so there is only ever one
// instance). Bottom-LEFT corner, with a small safe margin from both edges - plain CSS fixed
// positioning (bottom/left), not JS-computed pixel coordinates. Opens the SubhRa Crafts WhatsApp
// conversation via buildWhatsAppUrl. Screen-reader accessible via aria-label="Help" even though
// nothing reads "Help" visually.
//
// WHY PLAIN CSS, NOT A DRAGGABLE/JS-POSITIONED BUTTON: an earlier version computed its on-screen
// position in JavaScript (from window.innerWidth/innerHeight) and remembered a dragged position
// in localStorage so it could be moved out of the way. That's what caused the button to show up
// clipped in a corner on some screens (e.g. a position saved while testing on a wide desktop
// viewport doesn't translate correctly to a narrow mobile one, since the two layouts are
// unrelated) - exactly the "only 20% of the button visible at the top-left on mobile" bug this
// replaces. Plain `position: fixed; bottom/left: <margin>` is anchored directly to the viewport
// by the browser itself for every screen size, so there's no stale coordinate to ever go wrong.
//
// Uses the 🙋🏻‍♀️ emoji directly (per explicit request, reverting the brief SVG "?" swap). Note
// for the future: this is a compound emoji (base gesture + skin-tone modifier + ZWJ + female
// sign), and that exact combination can fail to render on some older/uncommon OS+browser emoji-
// font combinations - if it ever looks invisible again on a specific device, that's the first
// thing to check, separately from the positioning fix above (the two bugs looked identical from
// a screenshot but have unrelated causes).
//
// BOTTOM_OFFSET is taller than a plain safe-area margin on purpose: Netlify's own "Powered by
// Netlify" watermark is injected by Netlify's hosting itself (outside this codebase, so we can
// neither move it nor restyle it) and sits at the very bottom of the page too. On a real phone,
// the browser's own address bar + gesture bar shrink the visible height, leaving much less
// vertical room near the bottom than a desktop/responsive-mode preview shows - so a small margin
// that looks perfectly clear of the watermark on a laptop ends up overlapping it on an actual
// phone. This bigger offset keeps a clear gap above the watermark either way.
const VIEWPORT_MARGIN = 16; // horizontal margin from the left edge
const BOTTOM_OFFSET = 76; // vertical clearance from the bottom - see note above
const BUTTON_SIZE = 52; // compact, touch-friendly circle

export default function WhatsAppButton({ message }) {
  return (
    <a
      href={buildWhatsAppUrl(message)}
      target="_blank"
      rel="noreferrer"
      aria-label="Help"
      title="Need help? Chat with us on WhatsApp"
      style={{
        position: "fixed",
        left: VIEWPORT_MARGIN,
        bottom: `calc(${BOTTOM_OFFSET}px + env(safe-area-inset-bottom, 0px))`,
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
      }}
      className="z-40 flex items-center justify-center rounded-full bg-plum text-cream shadow-soft hover:shadow-lg motion-safe:animate-[helpPulse_3s_ease-in-out_infinite] transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
    >
      <span aria-hidden="true" className="text-2xl leading-none">🙋🏻‍♀️</span>
    </a>
  );
}

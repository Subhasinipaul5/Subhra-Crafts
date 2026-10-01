// Lightweight, hand-drawn-style botanical doodles used across the site's pages for a subtle,
// handmade decorative touch. Pure inline SVG (no image asset), colored in the existing palette,
// purely decorative: pointer-events-none so they never interfere with clicks/scrolling, and
// tucked toward corners/edges away from headings/content.
function Leaf({ className = "", color = "#cdb8e8", rotate = 0, flip = false }) {
  return (
    <svg
      viewBox="0 0 60 100"
      className={className}
      style={{ transform: `rotate(${rotate}deg) scaleX(${flip ? -1 : 1})` }}
      fill="none"
    >
      <path
        d="M30 4 C 46 18, 54 40, 44 62 C 38 76, 30 88, 30 96 C 30 88, 22 76, 16 62 C 6 40, 14 18, 30 4 Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M30 12 C 30 34, 30 60, 30 90" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M30 30 C 22 34, 18 38, 15 42" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M30 30 C 38 34, 42 38, 45 42" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M30 52 C 24 56, 20 59, 17 62" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M30 52 C 36 56, 40 59, 43 62" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/**
 * Absolutely-positioned scattered leaf doodles. Drop this once inside a `relative` container;
 * it fills that container with `absolute inset-0` and stays out of the way of everything else
 * (pointer-events-none, low opacity, tucked toward corners/edges).
 *
 * Hidden below `sm` by default, matching every other decorative doodle on the site (to avoid
 * crowding small screens) - pass `mobile` to keep it visible on phones too instead, with each
 * leaf sized down a step so it doesn't feel cramped on a narrow screen. Opt-in per page rather
 * than a global default, so this doesn't change how any existing page looks.
 */
export default function LeafDoodles({ className = "", mobile = false }) {
  return (
    <div className={`${mobile ? "block" : "hidden sm:block"} absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      <Leaf className={`absolute -top-2 left-2 ${mobile ? "w-9 h-16 sm:w-12 sm:h-20" : "w-12 h-20"} opacity-60`} color="#cdb8e8" rotate={-18} />
      <Leaf className={`absolute top-10 left-[8%] ${mobile ? "w-6 h-10 sm:w-8 sm:h-14" : "w-8 h-14"} opacity-50`} color="#e78ea1" rotate={24} flip />
      <Leaf className={`absolute bottom-4 left-4 ${mobile ? "w-8 h-12 sm:w-10 sm:h-16" : "w-10 h-16"} opacity-50`} color="#e0b877" rotate={12} />
      <Leaf className={`absolute top-4 right-2 ${mobile ? "w-9 h-14 sm:w-11 sm:h-18" : "w-11 h-18"} opacity-55`} color="#cdb8e8" rotate={20} flip />
      <Leaf className={`absolute bottom-10 right-[6%] ${mobile ? "w-7 h-12 sm:w-9 sm:h-16" : "w-9 h-16"} opacity-45`} color="#e78ea1" rotate={-14} />
    </div>
  );
}

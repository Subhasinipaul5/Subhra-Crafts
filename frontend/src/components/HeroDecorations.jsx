import DoodlePhrase from "./DoodlePhrase";
import { HalfMandala } from "./AnimatedDoodles";

// Hand-drawn-style botanical doodles + handwritten captions for the hero section. Pure inline
// SVG/text (no image asset), purely decorative: pointer-events-none + aria-hidden so they never
// interfere with clicks/scrolling/screen readers, kept clear of the heading/CTA/model.
// Colors are the more saturated end of the brand palette (not pastel-to-invisible) per repeated
// feedback that earlier doodles were too small/faint to read as intentional decoration.
function Leaf({ className = "", color = "#6b8f5a", rotate = 0, flip = false }) {
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
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M30 12 C 30 34, 30 60, 30 90" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M30 30 C 22 34, 18 38, 15 42" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      <path d="M30 30 C 38 34, 42 38, 45 42" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      <path d="M30 52 C 24 56, 20 59, 17 62" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
      <path d="M30 52 C 36 56, 40 59, 43 62" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function Heart({ className = "", color = "#d6538a" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 20 C 6 15, 2 11, 2 7.2 C 2 4.4 4.2 2.5 6.8 2.5 C 8.6 2.5 10.4 3.6 12 5.6 C 13.6 3.6 15.4 2.5 17.2 2.5 C 19.8 2.5 22 4.4 22 7.2 C 22 11, 18 15, 12 20 Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Flower({ className = "", color = "#8b5cf6" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" stroke={color} strokeWidth="1.6">
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cx="20" cy="10" rx="5" ry="8" transform={`rotate(${deg} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="3" fill={color} stroke="none" />
    </svg>
  );
}

function CurvedArrow({ className = "", color = "#8b5cf6", flip = false }) {
  return (
    <svg viewBox="0 0 60 40" className={className} style={{ transform: flip ? "scaleX(-1)" : undefined }} fill="none">
      <path d="M4 6 C 24 2, 48 10, 54 28" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M46 22 L 54 28 L 48 36" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function Sparkle({ className = "", color = "#c98a3e" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color}>
      <path d="M12 2 L13.8 9.5 L21 12 L13.8 14.5 L12 22 L10.2 14.5 L3 12 L10.2 9.5 Z" />
    </svg>
  );
}

/**
 * Absolutely-positioned scattered leaf/flower/heart/arrow doodles + handwritten captions
 * ("Handcrafted with Love", "Art in every detail", "Made specially for you"), plus a
 * partially-off-canvas corner mandala. Drop this once inside a `relative` hero container; it
 * fills that container with `absolute inset-0`. Hidden below the `sm` breakpoint - mobile
 * doesn't have the spare margin to place these without risking overlap with the heading/CTAs,
 * so they simply don't render there rather than crowd the page.
 */
export default function HeroDecorations({ className = "" }) {
  return (
    <div className={`hidden sm:block absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      <HalfMandala className="hidden lg:block -top-16 -right-16 w-52 h-52" opacity={0.4} />

      {/*
        SAFE-ZONE RULE for this hero: the text column (left ~50%) only has two bands that are
        reliably empty regardless of how long the heading/paragraph run - a thin strip above the
        "SUBHRA CRAFTS" eyebrow, and the strip below the CTA buttons. Everything between those
        (roughly 25%-80% vertically, in the left half) is live text and must stay doodle-free.
        Anything more decorative than that is placed over the RIGHT column (the model photo),
        which has much more open margin around it.
      */}
      <Leaf className="absolute -top-2 left-2 w-14 h-24 opacity-70" color="#6b8f5a" rotate={-18} />
      <Leaf className="absolute bottom-4 left-4 w-12 h-20 opacity-60" color="#c98a3e" rotate={12} />
      <Leaf className="absolute top-4 right-2 w-12 h-20 opacity-65" color="#6b8f5a" rotate={20} flip />
      <Leaf className="absolute bottom-10 right-[6%] w-10 h-18 opacity-55" color="#d6538a" rotate={-14} />
      <Flower className="hidden md:block absolute top-[70%] right-[10%] w-9 h-9 opacity-70" color="#8b5cf6" />
      <Flower className="hidden lg:block absolute top-[8%] right-[36%] w-7 h-7 opacity-55" color="#d6538a" />
      <Heart className="absolute top-14 right-[9%] w-5 h-5 opacity-70" color="#d6538a" />
      <Heart className="hidden md:block absolute bottom-[8%] left-[18%] w-4 h-4 opacity-60" color="#8b5cf6" />
      <Sparkle className="absolute top-6 right-[26%] w-4 h-4 opacity-70" />
      <Sparkle className="hidden md:block absolute bottom-[22%] right-[12%] w-3.5 h-3.5 opacity-60" />

      <DoodlePhrase text="Handcrafted with Love ♡" className="top-2 left-[6%] opacity-80" color="#7a2f4b" rotate={-4} size="text-xl" />
      <DoodlePhrase text="Art in every detail ♡" className="top-8 right-[4%] opacity-70" color="#7a2f4b" rotate={5} size="text-lg" />
    </div>
  );
}

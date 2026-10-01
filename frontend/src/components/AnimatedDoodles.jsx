// Lightweight, CSS-driven decorative motion: a handful of falling petals/leaves, floating
// hearts, twinkling sparkles, and a slowly-rotating half-mandala. Deliberately few DOM nodes
// (never "hundreds") and animated purely with transform/opacity, so it's cheap even with several
// instances on one page. Always decorative: pointer-events-none + aria-hidden. Respects
// prefers-reduced-motion via the `motion-safe:` variant already configured in this project's
// Tailwind build (paired with the CSS-level media query in index.css that disables/shortens
// keyframe animations globally) - the individual animation classes are only ever applied when
// the OS hasn't asked for reduced motion.
function Petal({ className = "", color = "#d6538a", delay = "0s", duration = "9s" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute motion-safe:animate-[fallDrift_var(--dur)_linear_infinite] ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill={color}
      opacity="0.75"
    >
      <path d="M12 2 C 18 6, 20 12, 12 22 C 4 12, 6 6, 12 2 Z" />
    </svg>
  );
}

function Leaf({ className = "", color = "#6b8f5a", delay = "0s", duration = "11s" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute motion-safe:animate-[floatRotate_var(--dur)_ease-in-out_infinite] ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      opacity="0.7"
    >
      <path d="M12 21 C 4 17, 3 8, 12 3 C 21 8, 20 17, 12 21 Z" />
      <path d="M12 5 L 12 19" />
    </svg>
  );
}

function Heart({ className = "", color = "#d6538a", delay = "0s", duration = "6s" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute motion-safe:animate-[floatUp_var(--dur)_ease-in-out_infinite] ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      opacity="0.7"
    >
      <path d="M12 20 C 6 15, 2 11, 2 7.2 C 2 4.4 4.2 2.5 6.8 2.5 C 8.6 2.5 10.4 3.6 12 5.6 C 13.6 3.6 15.4 2.5 17.2 2.5 C 19.8 2.5 22 4.4 22 7.2 C 22 11, 18 15, 12 20 Z" />
    </svg>
  );
}

function Sparkle({ className = "", color = "#c98a3e", delay = "0s", duration = "3.5s" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`absolute motion-safe:animate-[twinkle_var(--dur)_ease-in-out_infinite] ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill={color}
    >
      <path d="M12 2 L13.8 9.5 L21 12 L13.8 14.5 L12 22 L10.2 14.5 L3 12 L10.2 9.5 Z" />
    </svg>
  );
}

export function HalfMandala({ className = "", color = "#8b5cf6", delay = "0s", duration = "50s", animate = true, opacity = 0.5 }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`absolute ${animate ? "motion-safe:animate-[spinSlow_var(--dur)_linear_infinite]" : ""} ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      opacity={opacity}
    >
      <circle cx="50" cy="50" r="46" strokeDasharray="5 7" />
      <circle cx="50" cy="50" r="36" strokeDasharray="3 6" />
      <circle cx="50" cy="50" r="26" />
      <circle cx="50" cy="50" r="10" strokeWidth="1" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line key={deg} x1="50" y1="50" x2="50" y2="4" transform={`rotate(${deg} 50 50)`} strokeWidth="0.8" />
      ))}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <circle key={deg} cx="50" cy="14" r="3" transform={`rotate(${deg} 50 50)`} />
      ))}
    </svg>
  );
}

function Butterfly({ className = "", color = "#8b5cf6", delay = "0s", duration = "8s" }) {
  return (
    <svg
      viewBox="0 0 32 24"
      className={`absolute motion-safe:animate-[flutterDrift_var(--dur)_ease-in-out_infinite] ${className}`}
      style={{ "--dur": duration, animationDelay: delay }}
      fill="none"
      stroke={color}
      strokeWidth="1.4"
    >
      <path d="M16 4 C 12 -1, 2 0, 2 8 C 2 13, 9 13, 16 8" opacity="0.85" />
      <path d="M16 4 C 20 -1, 30 0, 30 8 C 30 13, 23 13, 16 8" opacity="0.85" />
      <path d="M16 8 C 13 12, 6 15, 4 20 C 8 19, 13 16, 16 12" opacity="0.7" />
      <path d="M16 8 C 19 12, 26 15, 28 20 C 24 19, 19 16, 16 12" opacity="0.7" />
      <line x1="16" y1="4" x2="16" y2="14" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * Drop into a `relative` container - fills it with `absolute inset-0`. `variant` picks a preset
 * arrangement so different sections don't all look identical; positions are still hand-placed
 * per variant rather than randomized, so they stay "intentionally designed" rather than
 * scattered. Hidden below `sm` by default via each preset's own classes to avoid crowding small
 * screens.
 */
export default function AnimatedDoodles({ variant = "corners", className = "" }) {
  const presets = {
    // Falling petals/leaves down both edges - good for tall hero-like sections.
    corners: (
      <>
        <Petal className="hidden sm:block top-0 left-[6%] w-5 h-5" color="#d6538a" delay="0s" duration="10s" />
        <Petal className="hidden sm:block top-0 left-[85%] w-4 h-4" color="#8b5cf6" delay="2.5s" duration="12s" />
        <Petal className="hidden md:block top-0 left-[45%] w-4 h-4" color="#d6538a" delay="4s" duration="14s" />
        <Leaf className="hidden sm:block top-[10%] left-[92%] w-8 h-8" delay="0.5s" />
        <Leaf className="hidden md:block top-[60%] left-[3%] w-7 h-7" delay="3s" duration="13s" />
        <Sparkle className="hidden sm:block top-[15%] left-[15%] w-4 h-4" delay="1s" />
        <Sparkle className="hidden sm:block top-[70%] left-[80%] w-4 h-4" delay="2s" duration="4s" />
      </>
    ),
    // A quieter set for content-dense sections - fewer elements, tucked to the far edges.
    edges: (
      <>
        <Heart className="hidden sm:block top-[8%] left-[2%] w-5 h-5" delay="0s" />
        <Petal className="hidden sm:block top-0 left-[96%] w-4 h-4" delay="1.5s" duration="11s" />
        <Sparkle className="hidden sm:block top-[85%] left-[6%] w-4 h-4" delay="0.8s" />
        <Leaf className="hidden md:block top-[40%] left-[97%] w-6 h-6" delay="2s" duration="12s" />
      </>
    ),
    // Includes the slow-rotating half-mandala, for sections with more open background space.
    mandala: (
      <>
        <HalfMandala className="hidden md:block -top-14 -right-14 w-56 h-56" />
        <HalfMandala className="hidden lg:block -bottom-16 -left-16 w-48 h-48" color="#d6538a" opacity={0.35} duration="60s" />
        <Leaf className="hidden sm:block top-[20%] left-[4%] w-7 h-7" delay="1s" />
        <Petal className="hidden sm:block top-0 left-[10%] w-4 h-4" delay="3s" duration="9s" />
        <Sparkle className="hidden sm:block top-[75%] left-[90%] w-4 h-4" delay="1.2s" />
      </>
    ),
    // For narrow-centered-card pages (Login/Register) - everything lives in the wide open
    // margins either side of the card, never near the vertical center strip where the form is.
    loginSides: (
      <>
        <HalfMandala className="hidden lg:block -top-20 -left-20 w-56 h-56" opacity={0.35} duration="55s" />
        <HalfMandala className="hidden lg:block -bottom-20 -right-20 w-48 h-48" color="#d6538a" opacity={0.3} duration="65s" />
        <Leaf className="hidden md:block top-[15%] left-[6%] w-7 h-7" delay="0.5s" />
        <Leaf className="hidden md:block bottom-[18%] right-[7%] w-6 h-6" color="#c98a3e" delay="2s" duration="12s" />
        <Heart className="hidden md:block top-[68%] left-[9%] w-5 h-5" delay="1s" />
        <Heart className="hidden md:block top-[10%] right-[10%] w-4 h-4" delay="0s" duration="7s" />
        <Sparkle className="hidden md:block top-[40%] left-[4%] w-4 h-4" delay="1.5s" />
        <Sparkle className="hidden md:block bottom-[35%] right-[5%] w-3.5 h-3.5" delay="0.8s" />
        <Butterfly className="hidden lg:block top-[30%] right-[12%] w-8 h-6" delay="0.4s" />
        <Petal className="hidden md:block top-0 left-[20%] w-4 h-4" delay="3s" duration="10s" />
        <Petal className="hidden md:block top-0 right-[22%] w-3.5 h-3.5" color="#8b5cf6" delay="1.8s" duration="11s" />
      </>
    ),
  };

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      {presets[variant] || presets.corners}
    </div>
  );
}

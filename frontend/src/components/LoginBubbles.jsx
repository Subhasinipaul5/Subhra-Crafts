// Soft, glassy "3D" bubbles for the Login page background - pure CSS (radial-gradient highlight
// + a drop-shadow for depth), no image assets, no WebGL. Purely decorative: pointer-events-none
// + aria-hidden, and kept in the wide side margins around the centered login card so they can
// never cover the form/logo/text (the card is `max-w-md`, i.e. narrow, leaving generous open
// space on either side on anything wider than a phone).
function Bubble({ size, top, left, right, color, delay, duration }) {
  return (
    <div
      className="absolute rounded-full motion-safe:animate-[bubbleFloat_var(--dur)_ease-in-out_infinite]"
      style={{
        width: size,
        height: size,
        top,
        left,
        right,
        "--dur": duration,
        animationDelay: delay,
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), ${color} 42%, ${color} 100%)`,
        boxShadow: `0 12px 28px -8px ${color}66, inset 0 -6px 12px rgba(0,0,0,0.06)`,
        opacity: 0.6,
      }}
    />
  );
}

/**
 * `variant="loginSides"` (default) - the original 6-bubble spread, sized for a narrow centered
 * form (Login/Register) where the wide side margins are guaranteed empty.
 * `variant="compact"` - just 3 smaller bubbles pinned to the true page corners, for wider
 * content pages (Wishlist/Cart product grids) where the full-width layout doesn't leave the
 * same generous side margins - these stay clear of any reasonably-wide grid/card content.
 */
export default function LoginBubbles({ variant = "loginSides" }) {
  if (variant === "compact") {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        <Bubble size={90} top="2%" left="1%" color="#cdb8e8" delay="0s" duration="9s" />
        <Bubble size={70} top="4%" right="1.5%" color="#f3c9d6" delay="1s" duration="8s" />
        <Bubble size={50} top="82%" right="2%" color="#e0b877" delay="2s" duration="7s" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      <Bubble size={110} top="8%" left="4%" color="#cdb8e8" delay="0s" duration="9s" />
      <Bubble size={70} top="60%" left="10%" color="#f3c9d6" delay="1.2s" duration="7s" />
      <Bubble size={50} top="20%" left="18%" color="#e0b877" delay="2.5s" duration="8s" />
      <Bubble size={130} top="12%" right="6%" color="#f3c9d6" delay="0.6s" duration="10s" />
      <Bubble size={60} top="55%" right="14%" color="#cdb8e8" delay="1.8s" duration="7.5s" />
      <Bubble size={40} top="75%" right="4%" color="#e0b877" delay="0.3s" duration="6.5s" />
    </div>
  );
}

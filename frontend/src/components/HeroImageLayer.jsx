import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const RANDOMIZABLE = ["slideLeft", "slideRight", "slideUp", "slideDown", "fade", "blur", "blurFade", "zoomIn", "zoomOut", "crossfade"];

// Builds the gsap "from" vars for the INCOMING layer and the "to" vars for the OUTGOING layer,
// for a given transition name. Both layers animate simultaneously (crossfade-style) except the
// slide variants, which also displace the outgoing layer in the opposite direction.
function getTransitionVars(name) {
  switch (name) {
    case "slideLeft":
      return { inFrom: { xPercent: 100, opacity: 1 }, inTo: { xPercent: 0 }, outTo: { xPercent: -100 } };
    case "slideRight":
      return { inFrom: { xPercent: -100, opacity: 1 }, inTo: { xPercent: 0 }, outTo: { xPercent: 100 } };
    case "slideUp":
      return { inFrom: { yPercent: 100, opacity: 1 }, inTo: { yPercent: 0 }, outTo: { yPercent: -100 } };
    case "slideDown":
      return { inFrom: { yPercent: -100, opacity: 1 }, inTo: { yPercent: 0 }, outTo: { yPercent: 100 } };
    case "blur":
      return { inFrom: { opacity: 1, filter: "blur(24px)" }, inTo: { filter: "blur(0px)" }, outTo: { opacity: 0 } };
    case "blurFade":
      return { inFrom: { opacity: 0, filter: "blur(24px)" }, inTo: { opacity: 1, filter: "blur(0px)" }, outTo: { opacity: 0 } };
    case "zoomIn":
      return { inFrom: { opacity: 0, scale: 1.15 }, inTo: { opacity: 1, scale: 1 }, outTo: { opacity: 0 } };
    case "zoomOut":
      return { inFrom: { opacity: 0, scale: 0.85 }, inTo: { opacity: 1, scale: 1 }, outTo: { opacity: 0 } };
    case "fade":
    case "crossfade":
    default:
      return { inFrom: { opacity: 0 }, inTo: { opacity: 1 }, outTo: { opacity: 0 } };
  }
}

/**
 * Renders exactly the current image, animated in with GSAP whenever `src` changes. Two stacked
 * <img> layers are cross-faded/slid/zoomed between - this component owns NOTHING about the hero
 * text, so a parent re-rendering this on an interval never touches (or flickers) the text block
 * sitting beside it.
 */
export default function HeroImageLayer({ src, alt, transition = "fade", durationMs = 700, className = "", fallbackSrc }) {
  const [layers, setLayers] = useState([{ url: src, key: 0 }]);
  const refs = useRef({});
  const prevSrc = useRef(src);
  const keyCounter = useRef(1);
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (src === prevSrc.current) return;
    prevSrc.current = src;
    const newKey = keyCounter.current++;

    setLayers((prev) => {
      // Keep at most the outgoing + incoming layer around; older ones are already gone visually.
      const outgoing = prev[prev.length - 1];
      return [outgoing, { url: src, key: newKey }];
    });

    // Wait a tick for the new <img> to mount before animating it.
    requestAnimationFrame(() => {
      const outgoingEl = refs.current[layers[layers.length - 1]?.key];
      const incomingEl = refs.current[newKey];
      if (!incomingEl) return;

      if (reducedMotion.current) {
        gsap.set(incomingEl, { opacity: 1, xPercent: 0, yPercent: 0, scale: 1, filter: "blur(0px)" });
        if (outgoingEl) gsap.set(outgoingEl, { opacity: 0 });
        setLayers((prev) => prev.filter((l) => l.key === newKey));
        return;
      }

      const effectiveName = transition === "random" ? RANDOMIZABLE[Math.floor(Math.random() * RANDOMIZABLE.length)] : transition;
      const { inFrom, inTo, outTo } = getTransitionVars(effectiveName);
      const dur = Math.max(0.15, durationMs / 1000);

      gsap.set(incomingEl, { xPercent: 0, yPercent: 0, scale: 1, filter: "blur(0px)", opacity: 1, ...inFrom });
      const tl = gsap.timeline({
        onComplete: () => {
          // Drop the outgoing layer once the transition has fully finished.
          setLayers((prev) => prev.filter((l) => l.key === newKey));
        },
      });
      tl.to(incomingEl, { ...inTo, duration: dur, ease: "power2.out" }, 0);
      if (outgoingEl) tl.to(outgoingEl, { ...outTo, duration: dur, ease: "power2.out" }, 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {layers.map((layer, i) => (
        <img
          key={layer.key}
          ref={(el) => { if (el) refs.current[layer.key] = el; }}
          src={layer.url}
          alt={alt}
          onError={fallbackSrc ? (e) => { if (e.target.src !== fallbackSrc) { e.target.onerror = null; e.target.src = fallbackSrc; } } : undefined}
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ zIndex: i }}
        />
      ))}
    </div>
  );
}

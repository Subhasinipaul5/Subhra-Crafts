import { useEffect, useRef, useState } from "react";

/**
 * Wraps any text/content block so it fades + slides up into place the first time it scrolls
 * into view - the same visual idea as the hero's one-time entrance (opacity 0->1,
 * translateY(40px)->0, premium ease-out), just triggered by IntersectionObserver instead of
 * mount. Plays once per element (observer disconnects after the first reveal) and never
 * re-triggers on subsequent scrolls past it, so scrolling back and forth doesn't replay it.
 * Respects prefers-reduced-motion via the project's existing global CSS rule (it overrides
 * transition-duration on every element, including this one).
 */
export default function Reveal({ children, className = "", as: Tag = "div", delayMs = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

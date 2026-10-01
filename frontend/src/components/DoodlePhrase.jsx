// A single small hand-drawn-style caption used to scatter warm, handmade-feeling phrases
// around a section (hero, contact, etc). Pure text + optional squiggle underline, in the
// handwritten font - no image assets. Always decorative: aria-hidden + pointer-events-none so
// it never interferes with clicking, tabbing, or screen readers.
export default function DoodlePhrase({ text, className = "", color = "#7a2f4b", rotate = 0, size = "text-lg" }) {
  return (
    <div
      className={`absolute pointer-events-none select-none font-handwritten leading-none whitespace-nowrap ${size} ${className}`}
      style={{ color, transform: `rotate(${rotate}deg)` }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}

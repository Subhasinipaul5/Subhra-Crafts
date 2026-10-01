import { Link } from "react-router-dom";

// FEATURE (this round) - a small breadcrumb: every item except the last is a clickable Link
// (e.g. Home, category); the last item (the current page) is plain text - it should never
// "navigate to itself". Kept intentionally simple/unstyled-heavy to fit the existing design
// without introducing a new visual language.
export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-plum-light/70 dark:text-cream/60 mb-3 flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-plum-light/40">/</span>}
            {isLast || !item.to ? (
              <span className={isLast ? "text-plum-dark dark:text-cream/90" : ""}>{item.label}</span>
            ) : (
              <Link to={item.to} className="hover:text-rose transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

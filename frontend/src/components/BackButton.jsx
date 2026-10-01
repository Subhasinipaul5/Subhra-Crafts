import { useNavigate, useLocation } from "react-router-dom";

// FEATURE (this round) - "← Back" that returns to whatever page the customer/admin actually
// came from (Product A -> Product B -> Back -> Product A), NOT a hardcoded "go Home"/"go to
// list" link. This is deliberately different from "← Back to Home" elsewhere in the app, which
// always goes to a fixed destination - see AdminLayout.jsx.
//
// How the fallback works: React Router gives every location a `key`; the very first location a
// browser tab loads (a fresh page load, or a directly-typed/shared URL) always has key
// "default" - every location reached by navigating WITHIN the app gets a real, unique key. So
// `location.key !== "default"` reliably means "there is a real previous in-app page to return
// to", and only then is it safe to call `navigate(-1)`. Otherwise (direct link, or a full page
// refresh) we fall back to a sensible page instead of leaving the site or doing nothing.
export default function BackButton({ fallback = "/shop", label = "← Back", className = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasInternalHistory = location.key !== "default";

  const handleClick = () => {
    if (hasInternalHistory) navigate(-1);
    else navigate(fallback);
  };

  return (
    <button
      onClick={handleClick}
      className={className || "text-sm text-plum-light/80 dark:text-cream/80 hover:text-rose transition-colors inline-flex items-center gap-1 mb-4"}
    >
      {label}
    </button>
  );
}

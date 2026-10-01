import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import placeholder from "../assets/placeholder.svg";
import LeafDoodles from "../components/LeafDoodles";
import CategoryImageSlideshow from "../components/CategoryImageSlideshow";

// FEATURE (this round) - "View All" destination for the homepage's Featured Categories strip
// (which only ever shows the first 5). Fully dynamic - fetches every active category from the
// database, so a brand-new category (including a future one like Canvas Paintings) appears here
// automatically without any frontend code changes.
export default function AllCategories() {
  const [categories, setCategories] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // ROOT-CAUSE FIX: with no .catch(), a failed request left `categories` at its initial `null`
  // forever - and "Loading categories..." below only ever checks `=== null`, so a genuine
  // failure looked identical to "still loading", indefinitely, with no way to retry. Extracted
  // to a named function (rather than inline in useEffect) so the error state's Retry button can
  // call the exact same fetch again - just resetting state wouldn't re-issue the request, since
  // the effect below only runs once on mount.
  function loadCategories() {
    setLoadError(false);
    setCategories(null);
    api
      .get("/categories")
      .then((res) => setCategories(res.data))
      .catch((err) => {
        console.error("Failed to load categories:", err);
        setLoadError(true);
      });
  }

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-16">
      <LeafDoodles />
      <SectionHeading eyebrow="Explore" title="All Categories" subtitle="Every piece is hand-poured and finished with care." />
      {categories === null && !loadError && (
        <p className="text-center text-plum-light/60 dark:text-cream/60 text-sm">Loading categories...</p>
      )}
      {loadError && (
        <p className="text-center text-plum-light/60 dark:text-cream/60 text-sm">
          Categories are unavailable right now.{" "}
          <button onClick={loadCategories} className="text-rose hover:underline">
            Retry
          </button>
        </p>
      )}
      {categories?.length === 0 && (
        <p className="text-center text-plum-light/60 dark:text-cream/60 text-sm">No categories yet.</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories?.map((cat) => (
          <Link key={cat._id} to={`/shop?category=${cat._id}`} className="group card overflow-hidden text-center">
            <div className="aspect-square overflow-hidden bg-ivory">
              <CategoryImageSlideshow
                images={cat.images}
                fallbackSrc={cat.image?.url || placeholder}
                alt={cat.name}
                slideshow={cat.slideshow}
                className="w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-3 font-display text-sm text-plum dark:text-cream">{cat.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

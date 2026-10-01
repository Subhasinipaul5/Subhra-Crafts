import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import ProductCard from "../components/ProductCard";
import SectionHeading from "../components/SectionHeading";
import LeafDoodles from "../components/LeafDoodles";

const PRICE_RANGES = [
  { label: "Below ₹500", min: "", max: "499.99" },
  { label: "₹500 – ₹1,000", min: "500", max: "1000" },
  { label: "₹1,000 – ₹2,000", min: "1000", max: "2000" },
  { label: "₹2,000 – ₹5,000", min: "2000", max: "5000" },
  { label: "Above ₹5,000", min: "5000.01", max: "" },
];

// Shared visual language for every toolbar control (Category / Price / Sort) - same border,
// radius, background and typography, so they read as one consistent control row.
//
// ROOT-CAUSE FIX: a native <select>'s rendered width is sized by its browser from the widest
// OPTION text it contains (e.g. a long admin-created category name), not by its container - and
// with no width constraint here at all, that could make the box wider than the viewport on a
// narrow phone. Combined with the site-wide `overflow-x: hidden` safety net on <body> (see
// index.css), an overflowing select doesn't create a scrollbar - it gets silently clipped at
// the screen edge, exactly matching "the dropdown is cut off / not fully visible". `w-full
// sm:w-auto min-w-0 max-w-full` fixes this at the source on every phone width (320-430px and
// everything between, not just the ones tested): below the `sm` breakpoint each control takes
// its own full row width - it can never exceed the viewport regardless of its option text - and
// `min-w-0` lets it actually shrink inside its flex-wrap parent instead of forcing overflow
// before wrapping. From `sm` up they return to their natural inline auto-width, unchanged from
// before.
const CONTROL_CLASS = "border border-blush rounded-lg px-3 py-2 text-sm bg-white/70 text-plum-dark w-full sm:w-auto min-w-0 max-w-full box-border";

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data)).catch((err) => console.error("Failed to load categories for filter:", err)); // non-fatal - the dropdown just falls back to "All Categories" only
  }, []);

  function loadProducts() {
    setLoading(true);
    setLoadError(false);
    const params = { category, search, sort, minPrice, maxPrice, limit: 24 };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    api
      .get("/products", { params })
      .then((res) => setProducts(res.data.products))
      .catch((err) => {
        // ROOT-CAUSE FIX: previously had no .catch() - a failed request left `products` at its
        // last-known value (or the initial []) with no way to tell "genuinely no results" apart
        // from "the request actually failed", so a real backend problem silently looked like an
        // empty shop.
        console.error("Failed to load products:", err);
        setProducts([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, search, sort, minPrice, maxPrice]);

  // Same query-param based filter state as before - only the controls' visual shape changed
  // (sidebar list -> toolbar dropdowns), so category/price/sort continue to compose together
  // and stay shareable/bookmarkable via the URL exactly as they did before.
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const selectedRangeLabel = PRICE_RANGES.find((r) => (r.min || "") === minPrice && (r.max || "") === maxPrice)?.label || "";

  const setPriceRangeByLabel = (label) => {
    const range = PRICE_RANGES.find((r) => r.label === label);
    const next = new URLSearchParams(searchParams);
    if (!range) {
      next.delete("minPrice");
      next.delete("maxPrice");
    } else {
      if (range.min) next.set("minPrice", range.min); else next.delete("minPrice");
      if (range.max) next.set("maxPrice", range.max); else next.delete("maxPrice");
    }
    setSearchParams(next);
  };

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-14">
      <LeafDoodles />
      <SectionHeading eyebrow="The Boutique" title="Shop All Pieces" subtitle={search ? `Results for "${search}"` : undefined} />

      {/* Controls row - Category + Price on the left, Sort on the right, all on one horizontal
          line on desktop; each control stacks to its own full-width row below the `sm`
          breakpoint (rather than wrapping side-by-side at a width where a long category name
          could still crowd/clip its neighbour) so every control is always fully visible on
          narrow phones, then returns to the original inline layout on tablet/desktop. */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-8 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full sm:w-auto min-w-0">
          <select
            value={category}
            onChange={(e) => setParam("category", e.target.value)}
            className={CONTROL_CLASS}
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedRangeLabel}
            onChange={(e) => setPriceRangeByLabel(e.target.value)}
            className={CONTROL_CLASS}
            aria-label="Filter by price range"
          >
            <option value="">All Prices</option>
            {PRICE_RANGES.map((range) => (
              <option key={range.label} value={range.label}>{range.label}</option>
            ))}
          </select>
        </div>

        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className={CONTROL_CLASS}
          aria-label="Sort products"
        >
          <option value="">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="popular">Most Popular</option>
          <option value="rating">Highest Rated</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-plum-light/60 dark:text-cream/60 py-16">Loading pieces...</p>
      ) : loadError ? (
        <p className="text-center text-plum-light/60 dark:text-cream/60 py-16">
          Products are unavailable right now.{" "}
          <button onClick={loadProducts} className="text-rose hover:underline">
            Retry
          </button>
        </p>
      ) : products.length === 0 ? (
        <p className="text-center text-plum-light/60 dark:text-cream/60 py-16">No products found. Try adjusting your filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

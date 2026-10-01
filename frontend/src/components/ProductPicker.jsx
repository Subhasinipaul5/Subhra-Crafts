import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import placeholder from "../assets/placeholder.svg";

// Category → Search → Select workflow, built entirely on endpoints that already exist
// (GET /products/admin/all?search=&category=, GET /categories?all=true) - no new backend
// search system, and no hard-coded category list. Works fine with hundreds of products since
// filtering/searching happens server-side, not by loading everything into the browser.
//
// Props:
//  - value: the currently linked product (a populated {_id, name, slug, images, sku} object, or
//    null) - just enough to render the preview without a redundant extra fetch.
//  - onChange(product | null): fires with the full product object when one is picked, or null
//    when "Clear Product" is used. The caller stores only product._id (see AdminHomeBanner.jsx).
export default function ProductPicker({ value, onChange }) {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false); // showing the category/search picker UI at all

  useEffect(() => {
    api.get("/categories?all=true").then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  // Debounced: search-as-you-type without firing a request on every keystroke.
  useEffect(() => {
    if (!picking) return;
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .get("/products/admin/all", { params: { search: search || undefined, category: category || undefined } })
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, category, picking]);

  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c._id, name: c.name })), [categories]);

  const select = (product) => {
    onChange(product);
    setPicking(false);
    setSearch("");
  };

  if (value && !picking) {
    return (
      <div>
        <label className="block text-xs text-plum-light/70 mb-1">Linked Product</label>
        <div className="flex items-center gap-3 border border-blush rounded-lg p-2.5">
          <img
            src={value.images?.[0]?.url || placeholder}
            alt=""
            onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
            className="w-12 h-12 rounded-md object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-plum-dark truncate">{value.name}</div>
            {value.sku && <div className="text-xs text-plum-light/60">SKU: {value.sku}</div>}
          </div>
          <div className="flex flex-col gap-1 shrink-0 text-xs">
            <button type="button" onClick={() => setPicking(true)} className="text-plum underline">Change Product</button>
            <button type="button" onClick={() => onChange(null)} className="text-rose underline">Clear Product</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-plum-light/70 mb-1">Link Product (optional)</label>
      <div className="border border-blush rounded-lg p-3 space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-blush rounded-lg px-3 py-2 text-sm">
            <option value="">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPicking(true); }}
            onFocus={() => setPicking(true)}
            className="border border-blush rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {picking && (
          <div className="max-h-56 overflow-y-auto border border-blush/60 rounded-lg divide-y divide-blush/60">
            {loading && <div className="p-3 text-xs text-plum-light/60">Searching...</div>}
            {!loading && results.length === 0 && <div className="p-3 text-xs text-plum-light/60">No matching products.</div>}
            {!loading &&
              results.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-blush/20 text-left"
                >
                  <img
                    src={p.images?.[0]?.url || placeholder}
                    alt=""
                    onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
                    className="w-10 h-10 rounded-md object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-plum-dark truncate">{p.name}</div>
                    <div className="text-xs text-plum-light/60">{p.category?.name}{p.sku ? ` • SKU: ${p.sku}` : ""}</div>
                  </div>
                </button>
              ))}
          </div>
        )}
        {(value || picking) && (
          <button type="button" onClick={() => { setPicking(false); setSearch(""); }} className="text-xs text-plum-light/60 underline">
            {value ? "Cancel" : "Close"}
          </button>
        )}
      </div>
    </div>
  );
}

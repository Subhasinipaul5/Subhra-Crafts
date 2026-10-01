import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import ProductCard from "../components/ProductCard";
import SectionHeading from "../components/SectionHeading";
import SaleCountdown from "../components/SaleCountdown";

// Deliberately reuses the existing ProductCard and SectionHeading components rather than
// building new ones - the badges, add-to-cart, and countdown behaviour all come for free, and
// the page stays visually consistent with the rest of the site instead of looking like a
// bolted-on "sale page". Data comes straight from GET /api/sales, which already only ever
// returns campaigns that are both turned on AND currently within their date window - so
// whatever this page renders is always current, with nothing to filter for "is it still on".
export default function SalesOffers() {
  const [campaigns, setCampaigns] = useState(null); // null = loading
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    api.get("/sales").then((res) => setCampaigns(res.data)).catch(() => setCampaigns([]));
  }, []);

  // Flatten every campaign's products into one list, de-duplicated (a product could in theory
  // be surfaced by more than one campaign's category target).
  const allProducts = useMemo(() => {
    if (!campaigns) return [];
    const seen = new Set();
    const list = [];
    for (const camp of campaigns) {
      for (const p of camp.products) {
        if (seen.has(p._id)) continue;
        seen.add(p._id);
        list.push(p);
      }
    }
    return list;
  }, [campaigns]);

  // Only categories that actually have a product on sale right now show up as a filter - never
  // a hard-coded list, so a category with nothing currently discounted doesn't show an empty tab.
  const categoryFilters = useMemo(() => {
    const map = new Map();
    for (const p of allProducts) {
      if (p.category?._id) map.set(p.category._id, p.category.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allProducts]);

  const filteredProducts = activeFilter === "all" ? allProducts : allProducts.filter((p) => p.category?._id === activeFilter);

  // The soonest-ending active campaign drives the hero countdown - the most relevant "hurry up"
  // moment for a customer looking at this page right now.
  const soonestEndingCampaign = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return null;
    return [...campaigns].sort((a, b) => new Date(a.endAt) - new Date(b.endAt))[0];
  }, [campaigns]);

  return (
    <div className="min-h-screen">
      {/* HERO - uses the same theme-aware plum/rose/gold tokens as the rest of the site, so this
          stays a bold, high-contrast gradient in every theme the admin picks, per
          "premium handmade brand, not a discount supermarket" - just a saturated one instead of
          a pale wash that blends into the page background. */}
      <section className="relative bg-gradient-to-br from-plum-dark via-plum to-rose py-16 px-6 text-center overflow-hidden">
        <div className="relative max-w-2xl mx-auto">
          <div className="section-eyebrow text-gold mb-3">🔥 Limited Time</div>
          <h1 className="section-title text-4xl sm:text-5xl text-cream leading-tight">Limited Time Sale</h1>
          <p className="mt-4 text-cream/80 max-w-md mx-auto">Handcrafted pieces at special prices, for a little while.</p>
          {soonestEndingCampaign && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 text-sm text-cream">
              <span>{soonestEndingCampaign.name}</span>
              <span className="text-cream/40">·</span>
              <SaleCountdown endAt={soonestEndingCampaign.endAt} className="font-medium text-gold" />
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {campaigns === null && (
          <p className="text-center text-plum-light/60 text-sm">Loading sales...</p>
        )}

        {campaigns !== null && allProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-plum-light/70 text-lg font-display mb-2">No active sales right now</p>
            <p className="text-plum-light/50 text-sm">Check back soon, or browse the full collection in the meantime.</p>
          </div>
        )}

        {allProducts.length > 0 && (
          <>
            {categoryFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mb-10">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                    activeFilter === "all" ? "bg-plum text-cream border-plum" : "border-blush text-plum-dark hover:border-rose"
                  }`}
                >
                  All
                </button>
                {categoryFilters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveFilter(c.id)}
                    className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                      activeFilter === c.id ? "bg-plum text-cream border-plum" : "border-blush text-plum-dark hover:border-rose"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

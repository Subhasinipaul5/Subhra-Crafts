import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import ProductCard from "./ProductCard";
import SaleCountdown from "./SaleCountdown";
import Reveal from "./Reveal";

// Sits between the homepage's first two category rows (see Home.jsx) - a compact version of the
// full /sales page, not a duplicate of it. Renders nothing at all when there's no active
// campaign, so the homepage never shows an empty "Sales & Offers" gap - it just quietly
// reappears the next time a campaign goes active, no code change needed.
export default function HomeSalesSection() {
  const [campaigns, setCampaigns] = useState(null); // null = still loading

  useEffect(() => {
    api.get("/sales").then((res) => setCampaigns(res.data)).catch(() => setCampaigns([]));
  }, []);

  const previewProducts = useMemo(() => {
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
    return list.slice(0, 4);
  }, [campaigns]);

  const soonestEndingCampaign = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return null;
    return [...campaigns].sort((a, b) => new Date(a.endAt) - new Date(b.endAt))[0];
  }, [campaigns]);

  if (!campaigns || previewProducts.length === 0) return null;

  return (
    <section id="home-section-sales-offers" className="relative py-4">
      {/* Uses the same theme-aware plum/rose/gold tokens as the rest of the site (not a
          hardcoded literal color), so this stays a bold, contrasting gradient in every theme
          the admin picks - not just the default one - instead of the previous pale wash that
          barely stood out against the page background. */}
      <Reveal className="relative rounded-xl2 overflow-hidden bg-gradient-to-br from-plum-dark via-plum to-rose px-6 py-10 sm:px-10">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="text-xs tracking-[0.35em] uppercase text-gold mb-2">🔥 Limited Time</div>
          <h2 className="section-title text-3xl sm:text-4xl text-cream">Sales & Offers</h2>
          <p className="mt-3 text-cream/80 text-sm">Handcrafted pieces at special prices, for a little while.</p>
          {soonestEndingCampaign && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-cream">
              <span>{soonestEndingCampaign.name}</span>
              <span className="text-cream/40">·</span>
              <SaleCountdown endAt={soonestEndingCampaign.endAt} className="font-medium text-gold" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {previewProducts.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to="/sales" className="inline-block px-6 py-3 rounded-full bg-cream text-plum text-sm font-medium tracking-wide hover:bg-white transition-colors">
            Shop the Sale →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

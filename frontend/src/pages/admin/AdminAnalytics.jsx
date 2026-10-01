import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../../api/client";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "custom", label: "Custom range" },
];

const COLORS = ["#7C3A6B", "#C97B9C", "#D4A5C4", "#E8C7DB", "#F0DCE8", "#B98BC9"];

function Card({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-blush p-4">
      <div className="text-plum-light/70 dark:text-cream/70 text-xs">{label}</div>
      <div className="font-display text-2xl text-plum dark:text-cream mt-1">{value ?? "—"}</div>
      {sub && <div className="text-[11px] text-plum-light/50 mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({ title, children, empty }) {
  return (
    <div className="bg-white rounded-xl2 shadow-card border border-blush p-5">
      <h3 className="font-display text-lg text-plum dark:text-cream mb-3">{title}</h3>
      {empty ? <p className="text-sm text-plum-light/50 py-8 text-center">No data yet for this period.</p> : children}
    </div>
  );
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export default function AdminAnalytics() {
  const [range, setRange] = useState("last30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filters, setFilters] = useState({ country: "", source: "", platform: "", campaign: "", product: "", device: "" });
  const [filterOptions, setFilterOptions] = useState(null);

  const [summary, setSummary] = useState(null);
  const [timeSeries, setTimeSeries] = useState(null);
  const [sources, setSources] = useState(null);
  const [countries, setCountries] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [recentVisitors, setRecentVisitors] = useState(null);

  const query = useMemo(() => {
    const q = { range };
    if (range === "custom" && customFrom && customTo) {
      q.from = customFrom;
      q.to = customTo;
    }
    Object.entries(filters).forEach(([k, v]) => {
      if (v) q[k] = v;
    });
    return q;
  }, [range, customFrom, customTo, filters]);

  useEffect(() => {
    api.get("/analytics/filter-options").then((res) => setFilterOptions(res.data));
  }, []);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return; // wait for both dates
    const params = new URLSearchParams(query).toString();
    setSummary(null); setTimeSeries(null); setSources(null); setCountries(null); setTopProducts(null); setFunnel(null);
    api.get(`/analytics/summary?${params}`).then((r) => setSummary(r.data));
    api.get(`/analytics/visitors-over-time?${params}`).then((r) => setTimeSeries(r.data));
    api.get(`/analytics/traffic-sources?${params}`).then((r) => setSources(r.data));
    api.get(`/analytics/countries?${params}`).then((r) => setCountries(r.data));
    api.get(`/analytics/top-products?${params}`).then((r) => setTopProducts(r.data));
    api.get(`/analytics/funnel?${params}`).then((r) => setFunnel(r.data));
  }, [query]);

  useEffect(() => {
    const load = () => api.get("/analytics/recent-visitors").then((r) => setRecentVisitors(r.data));
    load();
    const interval = setInterval(load, 30000); // "real-time-ish" refresh
    return () => clearInterval(interval);
  }, []);

  const funnelSteps = funnel
    ? [
        { label: "Visitors", value: funnel.visitors },
        { label: "Product Views", value: funnel.productViews },
        { label: "Add to Cart", value: funnel.addToCart },
        { label: "Checkout", value: funnel.checkout },
        { label: "Purchase", value: funnel.purchase },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-6">Analytics</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl2 shadow-card border border-blush p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] uppercase text-plum-light/60 mb-1">Date Range</label>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="border border-blush rounded-lg px-3 py-1.5 text-sm">
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {range === "custom" && (
          <>
            <div>
              <label className="block text-[10px] uppercase text-plum-light/60 mb-1">From</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="border border-blush rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-plum-light/60 mb-1">To</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="border border-blush rounded-lg px-3 py-1.5 text-sm" />
            </div>
          </>
        )}
        {filterOptions && (
          <>
            <FilterSelect label="Country" value={filters.country} onChange={(v) => setFilters((f) => ({ ...f, country: v }))} options={filterOptions.countries.map((c) => [c, c])} />
            <FilterSelect label="Source" value={filters.source} onChange={(v) => setFilters((f) => ({ ...f, source: v }))} options={filterOptions.sources.map((s) => [s, s])} />
            <FilterSelect label="Platform" value={filters.platform} onChange={(v) => setFilters((f) => ({ ...f, platform: v }))} options={[["instagram", "Instagram"], ["facebook", "Facebook"], ["instagram_facebook", "Instagram + Facebook"]]} />
            <FilterSelect label="Campaign" value={filters.campaign} onChange={(v) => setFilters((f) => ({ ...f, campaign: v }))} options={filterOptions.campaigns.map((c) => [c.id, c.title])} />
            <FilterSelect label="Product" value={filters.product} onChange={(v) => setFilters((f) => ({ ...f, product: v }))} options={filterOptions.products.map((p) => [p.id, p.name])} />
            <FilterSelect label="Device" value={filters.device} onChange={(v) => setFilters((f) => ({ ...f, device: v }))} options={filterOptions.devices.map((d) => [d, d])} />
          </>
        )}
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3 mb-8">
        <Card label="Total Visitors" value={summary?.totalVisitors} />
        <Card label="Unique Visitors" value={summary?.uniqueVisitors} />
        <Card label="Page Views" value={summary?.pageViews} />
        <Card label="Product Views" value={summary?.productViews} />
        <Card label="Add to Cart" value={summary?.addToCart} />
        <Card label="Virtual Try-On Opens" value={summary?.virtualTryOnOpens} />
        <Card label="Orders" value={summary?.orders} />
        <Card label="Ad Clicks" value={summary?.advertisementClicks} />
        <Card label="Conversion Rate" value={summary ? `${summary.conversionRate}%` : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Visitors Over Time" empty={timeSeries && timeSeries.length === 0}>
          {timeSeries === null ? <ChartSkeleton /> : timeSeries.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e0ea" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="visitors" stroke="#7C3A6B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pageViews" stroke="#C97B9C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Traffic Sources" empty={sources && sources.length === 0}>
          {sources === null ? <ChartSkeleton /> : sources.length > 0 && (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={90} label={(d) => `${d.source} (${d.count})`}>
                  {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Visitors by Country" empty={countries && countries.length === 0}>
          {countries === null ? <ChartSkeleton /> : countries.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {countries.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-sm">
                  <span>{c.country}{c.city ? ` — ${c.city}` : ""}</span>
                  <span className="font-medium text-plum-dark">{c.count} visitors</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Conversion Funnel" empty={funnel && funnel.visitors === 0}>
          {funnel === null ? <ChartSkeleton /> : funnel.visitors > 0 && (
            <div className="space-y-2">
              {funnelSteps.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs text-plum-light/70 mb-0.5">
                    <span>{s.label}</span><span>{s.value}</span>
                  </div>
                  <div className="h-3 bg-blush/40 rounded-full overflow-hidden">
                    <div className="h-full bg-plum rounded-full" style={{ width: `${(s.value / funnelMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Most Interested Products" empty={topProducts && topProducts.length === 0}>
        {topProducts === null ? <ChartSkeleton /> : topProducts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-plum-light/70 border-b border-blush">
                  <th className="py-2">Product</th><th>Views</th><th>Unique Viewers</th><th>Add to Cart</th><th>Wishlist</th><th>Purchases</th><th>Interest Score</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} className="border-b border-blush/40">
                    <td className="py-2">{p.name}</td>
                    <td>{p.views}</td>
                    <td>{p.uniqueViewers}</td>
                    <td>{p.addToCart}</td>
                    <td>{p.wishlist}</td>
                    <td>{p.purchases}</td>
                    <td className="font-medium text-plum-dark">{p.interestScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-6">
        <Panel title="Recent Visitors" empty={recentVisitors && recentVisitors.length === 0}>
          {recentVisitors === null ? <ChartSkeleton /> : recentVisitors.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentVisitors.map((v, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between text-xs border-b border-blush/40 py-2">
                  <span className="font-medium text-plum-dark">{v.visitorLabel}</span>
                  <span className="text-plum-light/70">{v.country}</span>
                  <span className="capitalize text-plum-light/70">{v.source}</span>
                  <span className="text-plum-light/70 truncate max-w-[160px]">{v.lastPath || "—"}</span>
                  <span className="capitalize text-plum-light/70">{v.device}</span>
                  <span className="text-plum-light/50">{timeAgo(v.lastSeenAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-[10px] uppercase text-plum-light/60 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-blush rounded-lg px-3 py-1.5 text-sm max-w-[160px]">
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-64 flex items-center justify-center text-plum-light/40 text-sm">Loading...</div>;
}

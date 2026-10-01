import { useEffect, useState } from "react";
import api from "../../api/client";

const StatCard = ({ label, value, accent }) => (
  <div className="bg-white rounded-xl2 shadow-card border border-blush p-5">
    <div className="text-xs text-plum-light/70 dark:text-cream/70 uppercase tracking-wide">{label}</div>
    <div className={`font-display text-3xl mt-1 ${accent || "text-plum dark:text-cream"}`}>{value}</div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((res) => setStats(res.data));
    api.get("/payments/revenue").then((res) => setRevenue(res.data));
  }, []);

  if (!stats || !revenue) return <p className="text-plum-light dark:text-cream/90">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-8">Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Revenue" value={`₹${revenue.totalRevenue.toLocaleString()}`} accent="text-gold" />
        <StatCard label="Today's Revenue" value={`₹${revenue.today.toLocaleString()}`} />
        <StatCard label="This Month" value={`₹${revenue.thisMonth.toLocaleString()}`} />
        <StatCard label="This Year" value={`₹${revenue.thisYear.toLocaleString()}`} />
      </div>

      <h2 className="font-display text-xl text-plum dark:text-cream mb-3">Orders</h2>
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total" value={stats.orders.total} />
        <StatCard label="Pending" value={stats.orders.pending} />
        <StatCard label="Processing" value={stats.orders.processing} />
        <StatCard label="Shipped" value={stats.orders.shipped} />
        <StatCard label="Delivered" value={stats.orders.delivered} />
        <StatCard label="Cancelled" value={stats.orders.cancelled} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl2 shadow-card border border-blush p-5">
          <div className="text-xs text-plum-light/70 dark:text-cream/70 uppercase mb-2">Products</div>
          <div className="text-sm text-plum-dark">Total: {stats.products.total}</div>
          <div className="text-sm text-plum-dark">Active: {stats.products.active}</div>
          <div className="text-sm text-rose">Out of Stock: {stats.products.outOfStock}</div>
        </div>
        <div className="bg-white rounded-xl2 shadow-card border border-blush p-5">
          <div className="text-xs text-plum-light/70 dark:text-cream/70 uppercase mb-2">Customers</div>
          <div className="text-sm text-plum-dark">Total: {stats.customers.total}</div>
          <div className="text-sm text-plum-dark">New (30 days): {stats.customers.new}</div>
        </div>
        <div className="bg-white rounded-xl2 shadow-card border border-blush p-5">
          <div className="text-xs text-plum-light/70 dark:text-cream/70 uppercase mb-2">Custom Orders</div>
          <div className="text-sm text-plum-dark">New Requests: {stats.customOrders.new}</div>
        </div>
      </div>
    </div>
  );
}

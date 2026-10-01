import { NavLink, Outlet, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import ThemeToggle from "../../components/ThemeToggle";
import logo from "../../assets/logo.jpeg";

const baseLinks = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/bestsellers", label: "Bestseller Management" },
  { to: "/admin/homepage", label: "Homepage Management" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/sections", label: "Website Sections" },
  { to: "/admin/sales", label: "🔥 Sales & Offers" },
  { to: "/admin/virtual-try-on", label: "Virtual Try-On" },
  { to: "/admin/advertisements", label: "Advertisements" },
  { to: "/admin/analytics", label: "Analytics" },
  { to: "/admin/home-banner", label: "Home Page Banner" },
  { to: "/admin/orders", label: "Orders", countKey: "orders" },
  { to: "/admin/custom-orders", label: "Custom Orders", countKey: "customOrders" },
  { to: "/admin/location", label: "Business Location" },
  { to: "/admin/payments", label: "Payments & Revenue" },
  { to: "/admin/reviews", label: "Reviews", countKey: "reviews" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/profile", label: "My Profile" },
];

function SidebarBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-plum-dark text-[10px] leading-none">
      {count}
    </span>
  );
}

function SidebarLinks({ isOwner, onNavigate }) {
  const { counts } = useNotifications();
  return (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {baseLinks.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center px-4 py-2.5 rounded-lg text-sm transition-colors ${
              isActive ? "bg-cream/10 text-gold" : "text-cream/80 hover:bg-cream/5"
            }`
          }
        >
          {l.label}
          {l.countKey && <SidebarBadge count={counts?.[l.countKey]} />}
        </NavLink>
      ))}
      {isOwner && (
        <NavLink
          to="/admin/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            `block px-4 py-2.5 rounded-lg text-sm transition-colors ${
              isActive ? "bg-cream/10 text-gold" : "text-cream/80 hover:bg-cream/5"
            }`
          }
        >
          Settings & Admin Access
        </NavLink>
      )}
    </nav>
  );
}

export default function AdminLayout() {
  const { user, isOwner, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", drawerOpen);
    return () => document.body.classList.remove("drawer-open");
  }, [drawerOpen]);

  const drawer = (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 9998 }} onClick={() => setDrawerOpen(false)} />
      <aside
        className="fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-plum text-cream flex flex-col animate-[slideInLeft_0.25s_ease-out]"
        style={{ zIndex: 9999 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream/10 shrink-0">
          {/* Static branding only - NOT a navigation link. See "← Back to Home" below for the
              actual, explicit way back to the customer site. */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="SubhRa Crafts" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-display text-lg">SubhRa Crafts</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="text-2xl leading-none px-2 py-1">✕</button>
        </div>
        <Link
          to="/"
          onClick={() => setDrawerOpen(false)}
          className="mx-4 mt-4 mb-1 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-cream/5 hover:bg-cream/10 transition-colors border border-cream/10 shrink-0"
        >
          ← Back to Home
        </Link>
        <SidebarLinks isOwner={isOwner} onNavigate={() => setDrawerOpen(false)} />
        <div className="p-4 border-t border-cream/10 text-xs text-cream/60 shrink-0">
          <div className="mb-2">Logged in as {user?.name} ({user?.role})</div>
          <button onClick={logout} className="text-gold">Log out</button>
        </div>
      </aside>
    </>
  );

  return (
    <div className="h-screen bg-cream flex overflow-hidden">
      {/* Desktop sidebar - full height, never scrolls itself except its own internal nav list.
          Because <main> below is the ONLY scrolling element in this layout (not document/body),
          the sidebar can never "scroll away" regardless of any global overflow-x rule on
          html/body elsewhere in the app - that's what was silently breaking a plain
          position:sticky approach here before. */}
      <aside className="w-64 bg-plum text-cream flex-shrink-0 hidden md:flex flex-col h-screen">
        {/* Static branding only - NOT a navigation link (this was previously a <Link to="/">
            which unintentionally sent admins to the customer Home page). "← Back to Home"
            immediately below remains the one explicit, intentional way back to the storefront. */}
        <div className="p-6 border-b border-cream/10 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <img src={logo} alt="SubhRa Crafts" className="w-8 h-8 rounded-full object-cover" />
            <div className="font-display text-xl">SubhRa Crafts</div>
          </div>
          <div className="text-xs text-gold uppercase tracking-widest">Admin Panel</div>
        </div>
        <Link
          to="/"
          className="mx-4 mt-4 mb-1 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-cream/5 text-cream hover:bg-cream/10 transition-colors border border-cream/10 shrink-0"
        >
          ← Back to Home
        </Link>
        <SidebarLinks isOwner={isOwner} />
        <div className="p-4 border-t border-cream/10 text-xs text-cream/60 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span>Logged in as {user?.name} ({user?.role})</span>
            <ThemeToggle />
          </div>
          <button onClick={logout} className="text-gold">Log out</button>
        </div>
      </aside>

      {/* Mobile top bar - the sidebar is completely hidden below md, so this is the only way in */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-plum text-cream flex items-center justify-between px-4 py-3 shadow-soft" style={{ zIndex: 9997 }}>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          className="text-2xl leading-none p-2 -ml-2"
          style={{ zIndex: 10000, position: "relative" }}
        >
          ☰
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="SubhRa Crafts" className="w-7 h-7 rounded-full object-cover" />
          <span className="font-display text-base">SubhRa Crafts Admin</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Portal: renders outside this component's own DOM tree/stacking context entirely,
          so nothing in the admin layout (sticky headers, tables, etc.) can trap it behind
          page content. */}
      {drawerOpen && createPortal(drawer, document.body)}

      <main className="flex-1 h-screen overflow-y-auto p-6 md:p-10 pt-20 md:pt-10">
        <Outlet />
      </main>
    </div>
  );
}

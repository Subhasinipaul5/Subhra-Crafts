import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useNotifications } from "../context/NotificationContext";
import { useCurrency } from "../context/CurrencyContext";
import CategoriesMegaMenu from "./CategoriesMegaMenu";
import { useTranslation } from "react-i18next";
import logo from "../assets/logo.jpeg";
import api from "../api/client";

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose text-white text-[10px] leading-none">
      {count}
    </span>
  );
}

const CURRENCY_FLAGS = { INR: "🇮🇳", USD: "🇺🇸", EUR: "🇪🇺" };

function CurrencySelector({ compact = false }) {
  const { displayCurrency, setDisplayCurrency, supportedCurrencies } = useCurrency();
  if (!supportedCurrencies) return null;
  return (
    <select
      value={displayCurrency}
      onChange={(e) => setDisplayCurrency(e.target.value)}
      aria-label="Select currency"
      className={`bg-transparent border border-blush rounded-full text-plum text-xs px-2 py-1 outline-none cursor-pointer ${compact ? "" : "hover:border-plum"}`}
    >
      {supportedCurrencies.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_FLAGS[c]} {c}
        </option>
      ))}
    </select>
  );
}

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout, isStaff } = useAuth();
  const { itemCount } = useCart();
  const { counts } = useNotifications();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const accountRef = useRef(null);
  const headerRef = useRef(null);
  // ROOT CAUSE of the recurring "navbar doesn't stay fixed" reports across every previous
  // round: `overflow-x: hidden` on html/body (index.css) silently breaks `position: sticky` in
  // most browsers, even though the sticky/top-0/z-index classes were always correct. `position:
  // fixed` is immune to that (it's relative to the viewport, not a scrolling ancestor), but
  // fixed elements are removed from document flow, so the header's OWN rendered height is
  // measured here and used to push page content down by exactly that much - self-contained in
  // this component, so no other page needs to know or add its own top-padding, and it stays
  // correct automatically if the header's height ever changes (e.g. the promo bar above hiding
  // on small screens, search bar wrapping, etc.).
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/shop?search=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };

  const handleLogout = () => {
    logout();
    setAccountOpen(false);
    setOpen(false);
    navigate("/");
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [open]);

  // Just enough to show/hide the little "sale on" dot next to the nav link - the Sales & Offers
  // page itself does the real fetching. `/sales` already only ever returns campaigns that are
  // both turned on AND currently within their date window (see getActiveSales), so "any results"
  // IS "there's an active sale right now" - no extra status filtering needed here.
  const [hasActiveSale, setHasActiveSale] = useState(false);
  useEffect(() => {
    api.get("/sales").then((res) => setHasActiveSale(res.data.length > 0)).catch(() => {});
  }, []);

  // Customer-facing labels ARE translated (i18next) - staff labels below deliberately are not,
  // since this branch represents a quasi-admin view of the site.
  const customerNavLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/sales", label: "🔥 Sales & Offers", saleDot: true },
    { to: "/shop", label: t("nav.shop") },
    { to: "/custom-order", label: t("nav.customOrders") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];
  // Per spec: admin sees Home | Products | Custom Orders | Reviews | Admin - not the
  // customer-account items (those stay in the account dropdown/drawer below).
  const staffNavLinks = [
    { to: "/", label: "Home" },
    { to: "/admin/products", label: "Products" },
    { to: "/admin/custom-orders", label: "Custom Orders", badge: counts?.customOrders },
    { to: "/admin/reviews", label: "Reviews", badge: counts?.reviews },
    { to: "/admin", label: "Admin" },
  ];
  const navLinks = isStaff ? staffNavLinks : customerNavLinks;

  const accountLinks = [
    { to: "/profile", icon: "👤", label: isStaff ? "My Profile" : "Profile" },
    { to: "/profile?tab=orders", icon: "📦", label: "My Orders" },
    { to: "/profile?tab=payments", icon: "💳", label: "My Payments" },
    { to: "/profile?tab=addresses", icon: "📍", label: "Address" },
    { to: "/profile?tab=password", icon: "🔒", label: "Change Password" },
    { to: "/profile?tab=wishlist", icon: "❤️", label: "Wishlist" },
    { to: "/profile?tab=custom-orders", icon: "✨", label: "Custom Orders" },
  ];

  const drawer = (
    <>
      <div className="fixed inset-0 bg-black/40" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
      <aside
        className="fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-cream shadow-soft flex flex-col animate-[slideInLeft_0.25s_ease-out]"
        style={{ zIndex: 9999 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-blush shrink-0">
          <div className="flex items-center gap-2">
            <img src={logo} alt="SubhRa Crafts" className="w-9 h-9 rounded-full object-cover" />
            <span className="brand-title text-xl text-plum">SubhRa Crafts</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-plum text-2xl leading-none px-2 py-1">✕</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5 text-sm">
          <form onSubmit={submitSearch} className="flex items-center bg-cream rounded-full px-3 py-2 border border-blush shrink-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("nav.search")}
              className="!bg-transparent !border-0 text-sm outline-none w-full p-0"
            />
          </form>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-rose mb-1">{isStaff ? "Quick Links" : "Browse"}</span>
            {!isStaff && <CategoriesMegaMenu variant="mobile" onNavigate={() => setOpen(false)} />}
            {navLinks.map((l) => (
              <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="text-plum-dark py-2 border-b border-blush/50 flex items-center">
                {l.label} <NavBadge count={l.badge} />
                {l.saleDot && hasActiveSale && <span className="ml-1 w-2 h-2 rounded-full bg-rose animate-pulse" />}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-rose mb-1">Your Account</span>
            {user ? (
              <>
                {accountLinks.map((l) => (
                  <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-2 text-plum-dark py-2 border-b border-blush/50">
                    <span>{l.icon}</span> {l.label}
                  </Link>
                ))}
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="text-plum-dark py-2 border-b border-blush/50">{t("nav.login")}</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="text-plum-dark py-2">Register</Link>
              </>
            )}
          </div>

          {user && (
            <button onClick={handleLogout} className="text-left text-rose py-2 flex items-center gap-2">
              🚪 {t("nav.logout")}
            </button>
          )}

          {/* Theme choice removed from the customer panel - only Rose Sunset is offered to
              shoppers now (see ThemeContext.jsx); the underlying system stays available for
              the admin panel's own ThemeToggle (AdminLayout.jsx). */}
          <div className="flex items-center justify-between pt-2 mt-auto shrink-0">
            <span className="text-xs text-plum-light/70">Currency</span>
            <CurrencySelector compact />
          </div>
        </div>
      </aside>
    </>
  );

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[100] bg-cream/95 backdrop-blur-sm border-b border-blush">
        <div className="bg-plum text-cream text-center text-xs py-1.5 tracking-wide font-body hidden sm:block">
          Handcrafted with love • Made specially for you
        </div>

      {/* Desktop header row */}
      <div className="hidden lg:flex max-w-7xl mx-auto px-4 xl:px-6 py-3 items-center justify-between gap-3 xl:gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="SubhRa Crafts" className="w-11 h-11 rounded-full object-cover" />
          <div className="leading-tight">
            <div className="brand-title text-2xl text-plum">SubhRa Crafts</div>
            <div className="text-[10px] tracking-widest text-rose uppercase">Handmade with Love</div>
          </div>
        </Link>

        <nav className="flex items-center gap-4 xl:gap-6 font-body text-sm text-plum-dark shrink-0">
          {navLinks.map((l, i) => (
            <span key={l.label} className="flex items-center gap-4 xl:gap-6">
              <Link to={l.to} className={`hover:text-rose transition-colors whitespace-nowrap flex items-center ${l.label === "Admin" ? "text-gold font-medium" : ""}`}>
                {l.label} <NavBadge count={l.badge} />
                {l.saleDot && hasActiveSale && (
                  <span className="ml-1 w-2 h-2 rounded-full bg-rose animate-pulse" title="Sale on now" />
                )}
              </Link>
              {/* FEATURE - Categories mega-menu sits right after Home, customer nav only */}
              {i === 0 && !isStaff && <CategoriesMegaMenu variant="desktop" />}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 xl:gap-3.5 flex-1 justify-end min-w-0">
          <form onSubmit={submitSearch} className="flex items-center bg-cream rounded-full px-3 py-1.5 border border-blush min-w-0 w-40 xl:w-64">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("nav.search")}
              className="!bg-transparent !border-0 text-sm outline-none w-full p-0 min-w-0"
            />
          </form>
          <CurrencySelector />
          <Link to="/wishlist" aria-label={t("nav.wishlist")} className="text-plum hover:text-rose shrink-0">♡</Link>
          <Link to="/cart" aria-label={t("nav.cart")} className="relative text-plum hover:text-rose shrink-0">
            🧺
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="relative shrink-0" ref={accountRef}>
              <button onClick={() => setAccountOpen((v) => !v)} className="flex items-center gap-1 text-plum hover:text-rose text-sm font-body whitespace-nowrap">
                {user.name.split(" ")[0]}
                <span className="text-xs">{accountOpen ? "▲" : "▼"}</span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-soft border border-blush py-2 z-50 text-sm">
                  {accountLinks.map((l) => (
                    <Link key={l.label} to={l.to} onClick={() => setAccountOpen(false)} className="flex items-center gap-2 px-4 py-2 text-plum-dark hover:bg-blush/30">
                      <span>{l.icon}</span> {l.label}
                    </Link>
                  ))}
                  {isStaff && (
                    <Link to="/admin" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 px-4 py-2 text-gold hover:bg-blush/30 border-t border-blush/50 mt-1 pt-2">
                      🛠️ Admin Dashboard
                    </Link>
                  )}
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-rose hover:bg-blush/30 border-t border-blush/50 mt-1 pt-2 text-left">
                    🚪 {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm text-plum hover:text-rose shrink-0">{t("nav.login")}</Link>
          )}
        </div>
      </div>

      {/* Mobile/tablet header row: hamburger (top-left) — logo (center) — theme + cart (top-right) */}
      <div className="lg:hidden flex items-center justify-between px-3 py-3">
        <button
          className="text-plum text-2xl leading-none p-2 -ml-2 shrink-0"
          style={{ zIndex: 10000, position: "relative" }}
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="SubhRa Crafts" className="w-9 h-9 rounded-full object-cover shrink-0" />
          <span className="brand-title text-lg text-plum truncate">SubhRa Crafts</span>
        </Link>
        <div className="flex items-center gap-2 shrink-0">
          <CurrencySelector compact />
          <Link to="/cart" aria-label={t("nav.cart")} className="relative text-plum text-xl p-1">
            🧺
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 bg-rose text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {open && createPortal(drawer, document.body)}
      </header>
      {/* Spacer - pushes real page content down by exactly the fixed header's own measured
          height, so nothing ever renders underneath it, on any breakpoint. */}
      <div style={{ height: headerHeight }} aria-hidden="true" />
    </>
  );
}

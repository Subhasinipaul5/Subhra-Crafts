import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import placeholder from "../assets/placeholder.svg";
import CategoryImageSlideshow from "./CategoryImageSlideshow";

// FEATURE 4 (nav) - "Categories" mega-menu. Category + product data is fetched from
// GET /categories/mega-menu (see backend/controllers/categoryController.getMegaMenu) - nothing
// here is hard-coded, so adding a category or product in the admin panel shows up automatically
// next time this loads.
export default function CategoriesMegaMenu({ variant = "desktop", onNavigate }) {
  const [menu, setMenu] = useState(null); // null = not yet fetched
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);
  const containerRef = useRef(null);
  // Admin-configured display cap + the "All Categories" tile's own slideshow (see
  // Admin > Homepage Management > Navbar Categories). Defaults keep the panel working exactly
  // as before if these were never configured.
  const [navSettings, setNavSettings] = useState({ maxVisible: 4, allCategoriesImages: [], slideshow: { intervalSeconds: 3, pauseOnHover: true } });

  useEffect(() => {
    api.get("/settings").then((res) => {
      if (res.data.navbarCategories) setNavSettings(res.data.navbarCategories);
    }).catch(() => {});
  }, []);

  const ensureLoaded = () => {
    if (menu !== null) return;
    api.get("/categories/mega-menu").then((res) => setMenu(res.data)).catch(() => setMenu([]));
  };

  const openMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    ensureLoaded();
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => () => closeTimer.current && clearTimeout(closeTimer.current), []);

  if (variant === "mobile") {
    const visible = menu?.slice(0, navSettings.maxVisible) || [];
    return (
      <div className="border-b border-blush/50">
        <button
          onClick={() => {
            ensureLoaded();
            setOpen((v) => !v);
          }}
          className="w-full flex items-center justify-between text-plum-dark py-2"
        >
          {/* Arrow reflects the real open/closed state: collapsed = ▲ (up), expanded = ▼ (down). */}
          Categories <span className="text-xs">{open ? "▼" : "▲"}</span>
        </button>
        {open && (
          <div className="pb-2 pl-3 space-y-3">
            {menu === null && <div className="text-xs text-plum-light/60">Loading...</div>}
            {menu?.length === 0 && <div className="text-xs text-plum-light/60">No categories yet.</div>}
            {visible.map((cat) => (
              <div key={cat._id}>
                <Link to={`/shop?category=${cat._id}`} onClick={onNavigate} className="text-sm font-medium text-plum">
                  {cat.name}
                </Link>
                {cat.products.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1">
                    {cat.products.map((p) => (
                      <Link key={p._id} to={`/product/${p.slug}`} onClick={onNavigate} className="text-xs text-plum-light/80 dark:text-cream/70 pl-2">
                        {p.name}
                      </Link>
                    ))}
                    {/* Dropdown is only ever a 4-product preview (see getMegaMenu) - the category
                        page itself queries every product in the category with no cap. */}
                    <Link key={`view-all-${cat._id}`} to={`/shop?category=${cat._id}`} onClick={onNavigate} className="text-xs font-medium text-rose pl-2">
                      View All →
                    </Link>
                  </div>
                )}
              </div>
            ))}
            {/* Always present, same as desktop - see the comment on the desktop tile below. */}
            {menu !== null && (
              <Link to="/categories" onClick={onNavigate} className="flex items-center gap-3">
                {navSettings.allCategoriesImages?.length > 0 && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                    <CategoryImageSlideshow
                      images={navSettings.allCategoriesImages}
                      fallbackSrc={placeholder}
                      alt="All Categories"
                      mode="auto"
                      slideshow={navSettings.slideshow}
                      className="w-full h-full"
                    />
                  </div>
                )}
                <span className="text-sm font-medium text-rose">All Categories →</span>
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  // Desktop: hover trigger, absolute-positioned panel below the navbar. Shows up to the admin's
  // configured maxVisible category columns, PLUS the "All Categories" tile every time (not just
  // on overflow) - it's the permanent "browse everything" destination regardless of how many
  // categories the admin chose to curate into the dropdown itself, so it always needs to be
  // there whether maxVisible is 1 or 12. The grid just grows to fit both.
  const maxVisible = navSettings.maxVisible || 4;
  const columns = menu?.slice(0, maxVisible) || [];

  return (
    <div ref={containerRef} className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button className="hover:text-rose transition-colors whitespace-nowrap flex items-center gap-1">
        Categories <span className="text-[10px] mt-0.5">▼</span>
      </button>

      {open && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 bg-white rounded-2xl shadow-soft border border-blush p-6 animate-[fadeInDown_0.18s_ease-out]"
          style={{ zIndex: 60, minWidth: "min(90vw, 900px)" }}
        >
          {menu === null && <div className="text-sm text-plum-light/60 px-4 py-6">Loading categories...</div>}
          {menu?.length === 0 && <div className="text-sm text-plum-light/60 px-4 py-6">No categories yet.</div>}
          {menu && menu.length > 0 && (
            <div
              className="grid gap-x-8 gap-y-5"
              style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(columns.length + 1, 2), 6)}, minmax(0,1fr))` }}
            >
              {columns.map((cat) => (
                <div key={cat._id}>
                  <Link
                    to={`/shop?category=${cat._id}`}
                    onClick={() => setOpen(false)}
                    className="font-display text-plum text-base hover:text-rose transition-colors block mb-2"
                  >
                    {cat.name}
                  </Link>
                  {cat.products.length > 0 ? (
                    <ul className="space-y-1.5">
                      {cat.products.map((p) => (
                        <li key={p._id}>
                          <Link
                            to={`/product/${p.slug}`}
                            onClick={() => setOpen(false)}
                            className="text-sm text-plum-light/80 hover:text-rose transition-colors flex items-center gap-2"
                          >
                            <img
                              src={p.image || placeholder}
                              onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
                              alt=""
                              className="w-7 h-7 rounded-md object-cover shrink-0"
                            />
                            <span className="truncate">{p.name}</span>
                          </Link>
                        </li>
                      ))}
                      {/* Dropdown is only ever a 4-product preview (see getMegaMenu) - the full
                          category page queries every product in the category, uncapped. */}
                      <li className="pt-0.5">
                        <Link
                          to={`/shop?category=${cat._id}`}
                          onClick={() => setOpen(false)}
                          className="text-sm font-medium text-rose hover:underline"
                        >
                          View All →
                        </Link>
                      </li>
                    </ul>
                  ) : (
                    <p className="text-xs text-plum-light/50 italic">No products yet</p>
                  )}
                </div>
              ))}
              {/* Always present - a permanent "browse everything" destination, not just an
                  overflow indicator, so it shows whether maxVisible is 1 or 12. */}
              <Link to="/categories" onClick={() => setOpen(false)} className="flex flex-col border-l border-blush/60 pl-6 group">
                {navSettings.allCategoriesImages?.length > 0 && (
                  <div className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-2">
                    <CategoryImageSlideshow
                      images={navSettings.allCategoriesImages}
                      fallbackSrc={placeholder}
                      alt="All Categories"
                      mode="auto"
                      slideshow={navSettings.slideshow}
                      className="w-full h-full"
                    />
                  </div>
                )}
                <span className="font-display text-rose text-base group-hover:underline">All Categories →</span>
                <p className="text-xs text-plum-light/50 mt-1">Browse the full collection list</p>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

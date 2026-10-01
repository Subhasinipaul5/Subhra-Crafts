# SubhRa Crafts — Full-Stack E-Commerce Website

A premium, handmade-boutique e-commerce site built with **React + Vite + Tailwind** (frontend)
and **Node.js + Express + MongoDB** (backend), for a resin art & jewelry business.

---

## ⚠️ Security note — read this first

Never store real passwords in chat, notes apps, or code. This project is set up so **you set
your own admin password yourself**, on your own machine, via a `.env` file that never leaves
your computer.

---

## 1. What's included

- Public storefront: Home, Shop (filters/sort/search), Product details, Cart, Checkout,
  Wishlist, Custom Order requests, Order tracking, Reviews (with photos), About, Contact
- Customer account: profile (photo, first/last name, bio, phone), saved addresses, order
  history, payment history, password change
- Admin dashboard (separate, protected area at `/admin`): Products, Categories, Website
  Sections (dynamic homepage collections), Orders, Custom Orders, Payments & Revenue,
  Reviews moderation, Customers, and **Settings** to grant/revoke admin access
- Light & dark theme toggle (saved per device)
- Dynamic, database-driven categories & products — add new product types anytime from the
  dashboard, no code changes needed
- Stock management, low-stock warnings, out-of-stock handling
- Price-at-purchase snapshotting — changing a product's price never changes past orders
- Razorpay integration, UPI mention, and "Order via WhatsApp" checkout option
- Reviews require a delivered order and admin approval before appearing publicly

## 2. Requirements

- Node.js 18+ and npm
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account (database)
- A free [Cloudinary](https://cloudinary.com) account (image storage)
- A [Razorpay](https://razorpay.com) account (only needed for online payments)

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `backend/.env` and fill in:
- `MONGO_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — any long random string
- `CLOUDINARY_*` — from your Cloudinary dashboard
- `RAZORPAY_*` — from your Razorpay dashboard (can be left blank for now)
- `SEED_ADMIN_EMAIL` — your email (e.g. paulsubhasini31@gmail.com)
- `SEED_ADMIN_PASSWORD` — set to `Admin@123` for now if you like — **but change it from your
  Profile page after your first login**, since anyone with this file could otherwise log in
- `WHATSAPP_NUMBER` — your WhatsApp business number, country code + number, no `+` or spaces

Create your owner account (run once):

```bash
npm run seed:admin
```

> If you can't log in: this script is also safe to re-run anytime — it will reset the
> password on your account to match whatever is currently in `.env`. That's the fix if you're
> ever locked out.

Optionally add sample products so the store isn't empty:

```bash
npm run seed:demo
```

Start the server:

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

**Right after your first login on the website, go to Profile → Password and change your
password**, then remove the `SEED_ADMIN_*` lines from `.env`.

## 4. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:
- `VITE_API_URL` — `http://localhost:5000/api` for local dev
- `VITE_WHATSAPP_NUMBER` — same number as above

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:5173`.

## 5. Logging in as admin/owner

1. Go to `http://localhost:5173/login`
2. Log in with the email + password you set in `SEED_ADMIN_*`
3. You'll be taken to `/admin` — the full dashboard
4. Immediately go to **Profile → Password** and set a new password only you know

## 6. Adding your sister as an admin

1. Have her register a normal account on the website (Register page) with her own email
2. In the admin dashboard, go to **Settings & Admin Access**
3. Enter her email under "Grant Admin Access"
4. She can now log in and access `/admin` too

You (the **owner**) are the only one who can grant or revoke admin access — regular admins
cannot promote or demote anyone. You can revoke access at any time from the same page.

## 7. Deployment (when you're ready to go live)

- **Frontend** → deploy the `frontend` folder to Vercel or Netlify. Set `VITE_API_URL` to your
  deployed backend URL in their environment variable settings.
- **Backend** → deploy the `backend` folder to Render (or similar). Set all the same env vars
  from your `.env` file in their dashboard — never commit `.env` to git.
- **Database** → MongoDB Atlas (already cloud-hosted, just use the same `MONGO_URI`).
- Update `CLIENT_URL` in the backend's environment variables to your live frontend URL, so CORS
  allows requests from it.

## 8. Project structure

```
backend/
  models/        Mongoose schemas (User, Product, Category, Order, Payment, Review, ...)
  controllers/    Business logic for each resource
  routes/         Express routes, wired to controllers with role-based middleware
  middleware/     JWT auth, admin/owner guards, error handling
  utils/          Seed scripts, token & order-number helpers
  server.js       App entry point

frontend/
  src/pages/        Public + customer pages
  src/pages/admin/  Admin dashboard pages
  src/components/   Shared UI (Navbar, ProductCard, forms, theme toggle, etc.)
  src/context/      Auth, Cart, Theme state
  src/api/client.js Axios instance with JWT attached automatically
```

## 9. Distance-based shipping & delivery location

- **Maps use OpenStreetMap + Leaflet** — completely free, no API key required (no Google Maps
  key needed). Search uses the free Nominatim geocoding service.
- **First step after deployment**: go to Admin → Business Location, search for or click your
  shop's location on the map, and click "Save Business Location." Orders cannot be placed
  until this is set — the checkout will show a clear error if it's missing.
- Shipping tiers (distance → charge → delivery estimate) are editable on the same page.
  Defaults: 0–100km ₹50 (3–5 days), 101–300km ₹100 (5–7 days), 301–700km ₹150 (7–10 days),
  700km+ ₹200 (10–14 days).
- **Security**: the shipping charge is always calculated on the backend from the saved
  business location and the customer's submitted coordinates — a modified frontend can never
  change what a customer is charged. `POST /api/orders/calculate-shipping` is just a preview
  for the checkout UI; `POST /api/orders` (the real order) recalculates it independently.
- Checkout now requires: name, phone, full address, a pinned map location, and a preferred
  delivery date before the customer can reach the payment step.

## 10. Product labels, ratings & Bestseller Management

- Every product label (**New Arrival, Handcrafted, Featured, Bestseller, Limited Stock,
  Sale**) is a manual on/off switch in Admin → Products → Edit. Nothing is ever applied
  automatically — the system never decides a product is a bestseller on its own.
- **Ratings work in two layers.** You can set a "showcase" rating (e.g. `4.8` with `24`
  reviews) on a brand-new product before it has real customer reviews — useful for launch.
  The moment a product gets its first *approved* customer review, the real, calculated
  rating takes over automatically and the showcase rating is no longer used.
- **Admin → Bestseller Management** is a dedicated page showing units sold, order count,
  current stock, and rating per product — pulled from real order data — purely so you can
  make an informed call. It surfaces a "🔥 High Performing Product" suggestion for
  products selling well that aren't marked Bestseller yet, with a one-click button, but you
  always make the final decision, and can remove the Bestseller label just as easily.

## 11. Admin navigation, themes, and delivery locations

- **Admin nav**: logged-in admins/owners see an account-focused nav (Home, Profile, My Orders,
  My Payments, Address, Change Password, Custom Orders, Admin) instead of shopping links.
  The admin dashboard has a permanent "← Back to Home" link at the top of the sidebar (and in
  the mobile drawer), plus a clickable logo — both go to `/`.
- **Payments**: admins can permanently delete a transaction from Admin → Payments & Revenue.
  It's a real MongoDB delete (not a UI hide), and revenue totals recalculate immediately after.
- **Custom order reference images**: customers can attach a JPG/PNG/WEBP reference photo when
  requesting a custom piece, stored on Cloudinary. Admins see it in Admin → Custom Orders with
  a click-to-enlarge viewer and an "Open in New Tab" link.
- **Themes**: 7 additional color palettes (Rose Luxury, Purple Dream, Ocean Mist, Sunset Glow,
  Emerald Garden, Royal Plum, Golden Luxury) plus the original as default, selectable from
  Profile → Theme. Applies instantly site-wide (built on CSS variables, not per-component
  overrides), persists to localStorage immediately and to the account when logged in. The
  separate light/dark brightness toggle stays a per-device setting and currently renders as a
  fixed near-black plum tone in dark mode regardless of which color theme is active — a
  reasonable v1 tradeoff, but let me know if you'd like true theme-tinted dark mode too.
- **Delivery location on profile addresses**: Profile → Addresses now has a "Set Location" /
  "Change Location" map picker per saved address, including a "Use My Current Location" button
  that uses the device's real GPS (never IP-based) via the browser's Geolocation API, with
  accuracy shown in meters. This is separate from Admin → Business Location (the shop's own
  location) - selecting your own delivery location never touches the business location.

## 13. Navbar, theme system & drawer overhaul (latest round)

**Files changed:** `src/components/Navbar.jsx`, `src/components/ThemeToggle.jsx`,
`src/context/ThemeContext.jsx`, `src/pages/admin/AdminLayout.jsx`, `src/pages/Profile.jsx`,
`src/index.css`, `src/theme-vars.css`. Deleted `src/components/ThemeSelector.jsx` (superseded).

- **Crowded nav fixed**: staff (admin/owner) now only see "Home" and "Admin" inline — every
  other account link (Profile, Orders, Payments, Address, Password, Custom Orders) lives in
  the account dropdown/drawer, which already had them. This was the actual cause of the
  90%-zoom overflow: 8 links + search + icons was too much for one row at any width.
- **Themes consolidated into the moon/sun button**: `ThemeToggle` is now a dropdown popover
  with all 9 themes (SubhRa Classic + Rose Bloom, Purple Dream, Sunset Glow, Ocean Breeze,
  Mint Garden, Blueberry, Autumn, Midnight), each with a gradient swatch and a checkmark on
  the active one. The separate Profile → Theme tab was removed to avoid two competing UIs, per
  your instruction to keep it in one place.
- **Architecture change for contrast safety**: the previous independent light/dark toggle
  (`html.dark` class) is gone. Every theme is now a complete, self-contained *light* palette —
  this directly avoids the "dark text on dark background" class of bug, since no theme's
  background tokens go dark while its text tokens stay dark. If you want a literal black/navy
  "night mode" later, that's a bigger follow-up (would need distinct token roles for
  text-on-light vs background-with-light-text, which today share the same "plum" token).
- **Drawer rendering bug fixed**: both the site drawer and the admin drawer now render via a
  React Portal directly under `<body>`, completely outside the header's own stacking context
  (created by `position: sticky`). This was the root cause of the drawer appearing behind/cut
  off in your screenshot — no amount of z-index tuning fixes that class of bug from inside a
  sticky ancestor; only moving the DOM node out does.
- **Search bar fixed**: it was hardcoded `bg-white/70`, which is why it looked like a stray
  selected/highlighted box against colored themes. Inputs now default to a theme-aware
  background site-wide (`src/index.css`), and the navbar search is widened (~256px on large
  screens, responsive below that).
- **Body scroll lock**: opening either drawer adds a `drawer-open` class to `<body>` that sets
  `overflow: hidden`, so the page underneath can't scroll while the drawer is open, while the
  drawer's own menu list stays independently scrollable.

**What I actually tested** (via a real headless Chromium session, not just a build check):
375px/320px/1024px/1138px(≈1024 at 90% zoom)/1280px/1440px, mobile drawer open state,
admin drawer open state, account dropdown contents, theme dropdown + applying Ocean Breeze
site-wide, and horizontal-overflow checks (`scrollWidth > clientWidth`) at every width above —
all passed with zero overflow. Screenshots were inspected directly, not just asserted.

**Not fully re-tested this round** (build passes, but I didn't re-screenshot every single
page): Shop, Product, Custom Order, Checkout, Payments, and every theme × every page
combination. The shared components (Navbar, `.card`, inputs, buttons) all pull from the same
theme tokens, so they should inherit correctly, but a manual pass on your end once deployed
is worth doing given the size of the surface area.

## 14. Admin notifications, delete/cascade, password reset, invoices, home banner

**Backend files:** models (`Order`, `CustomOrder`, `Review`, `User`, `Settings`), controllers
(`authController`, `orderController`, `customOrderController`, `reviewController`,
`paymentController`, `dashboardController`, `settingsController`), new `utils/email.js` and
`utils/invoice.js`, matching routes. **Frontend files:** `Navbar.jsx`, `ThemeToggle.jsx`,
`AdminLayout.jsx`, new `NotificationContext.jsx`, `AdminOrders.jsx`, `AdminCustomOrders.jsx`,
`AdminPayments.jsx`, new `ForgotPassword.jsx` / `ResetPassword.jsx`, `Profile.jsx`, `Home.jsx`,
new `AdminHomeBanner.jsx`.

- **Admin nav restructured**: Home | Products | Custom Orders | Reviews | Admin, each with an
  independent unread-count badge (hidden at zero). Customer-account links (Orders, Payments,
  Address, Password) stay in the account dropdown/drawer, not duplicated inline.
- **Found and fixed the actual theme-dropdown bug**: it wasn't really a z-index issue - the
  admin sidebar is a flex child that stretches to match the page's full scroll height, so the
  dropdown (positioned `absolute` inside it) rendered at the bottom of the *whole page*, not
  near the button. Fixed two ways: (1) `ThemeToggle` now renders via a portal with
  `position: fixed`, computed from the button's real screen coordinates every time it opens,
  including flipping upward and clamping height when there's no room below; (2) the sidebar
  itself is now `sticky top-0 h-screen`, the correct root-cause fix.
- **Notification system**: `isAdminSeen` boolean added to Order/CustomOrder/Review, defaults
  `false`. Counts come from `GET /api/dashboard/notifications`, polled every 30s via
  `NotificationContext`. Each section's **Reset** button (top-right of Admin → Orders / Custom
  Orders) calls a dedicated `mark-seen` endpoint that flips the flag - it never touches order
  data, revenue, or the records themselves.
- **Cascade delete**: deleting an order also deletes its linked payment (`DELETE
  /api/orders/:id`); deleting a payment that has a linked order now asks **"Delete Payment +
  Order" vs "Delete Payment Only"** before doing anything, matching the two-relationship
  requirement. Both are real MongoDB deletes, matched by the actual `order`/`payment` ObjectId
  reference already in the schema - never by email or amount guessing.
- **Forgot/Reset Password**: `/forgot-password` and `/reset-password/:token` pages, backed by
  `POST /api/auth/forgot-password` and `POST /api/auth/reset-password/:token`. Tokens are
  random 32-byte values, only their **SHA-256 hash** is stored (same principle as never
  storing plain-text passwords), expire in 1 hour, and are cleared after use. A successful
  reset auto-logs the user in (the emailed token already proved identity). **Needs SMTP
  credentials in `backend/.env`** to actually send email — until then it logs the reset link
  to the server console instead of failing, same graceful pattern as Cloudinary/Razorpay.
- **Per-order PDF invoices** (`utils/invoice.js`, via `pdfkit`): available from Profile → My
  Orders once `paymentStatus === "paid"`, with **View Invoice** (opens in a new tab) and
  **Download PDF**. Contains only that one order's data - no other customers, no site-wide
  revenue - and is rejected with a 403 for anyone who isn't the order's owner or staff.
- **Home page banner CMS**: Admin → Home Page Banner shows the current hero image with a
  hover-to-reveal "Change Banner Image" overlay, file-type/size validation, a preview step
  before saving, and a "Reset to Default" option. Stored via the existing Cloudinary
  `/api/upload` flow plus a new `Settings.homeBanner` field; the Home page falls back to the
  bundled default image (`onError` + empty-string check) so it can never break from a missing
  or deleted custom image.

**What I actually tested** (real headless Chromium, not just a build check): the theme
dropdown fix specifically (confirmed `fits: true` — its bounding box is fully inside the
viewport, both before and after scrolling the admin page), the restructured admin navbar,
the Forgot Password page, Admin → Orders with the Reset button, and the Home Banner admin
page rendering with its default-fallback image. `npm run build` and the backend syntax check
both pass clean.

**Not re-verified this round**: actually sending a password-reset email (no SMTP configured
in this environment), the delete-cascade flows end-to-end (needs real order/payment data in
MongoDB, which isn't running here), and the invoice PDF's visual layout (code reviewed and
`pdfkit` module loads cleanly, but I didn't generate and open an actual PDF to eyeball it).

## 16. Critical fixes: order numbers, payment flow, admin sidebar, Reset semantics

**Files changed:** `models/Counter.js` (new), `utils/generateOrderNumber.js`,
`utils/ensureCounters.js` (new), `server.js`, `middleware/errorHandler.js`,
`controllers/orderController.js` (major rewrite), `controllers/paymentController.js`,
`routes/orderRoutes.js`, `routes/paymentRoutes.js`, `controllers/customOrderController.js`,
`controllers/reviewController.js` + their routes, `pages/admin/AdminLayout.jsx`,
`pages/admin/AdminOrders.jsx`, `pages/admin/AdminCustomOrders.jsx`,
`pages/admin/AdminReviews.jsx`, `pages/Checkout.jsx` (rewrite).

- **Fixed the actual cause of "Duplicate value for field: orderNumber"**: order numbers were
  generated by counting existing documents (`Order.countDocuments()`), which is a classic race
  condition — two requests arriving close together can both read the same count before either
  saves, and both try to use the same number. Replaced with a proper atomic MongoDB counter
  (`models/Counter.js`, using `findOneAndUpdate` with `$inc`), which is guaranteed collision-free
  under concurrency. A one-time startup migration (`ensureCounters.js`) seeds the counter from
  your highest existing order number so it can never collide with orders already in the database.
- **Fixed the deeper architectural cause**: for Razorpay, the order (and a stock decrement) was
  being created the moment "Place Order" was clicked, *before* payment succeeded — so a
  cancelled or failed payment left a dangling pending order, and retrying created a second one.
  Razorpay is now a proper two-step flow: `POST /api/orders/razorpay/initiate` only computes the
  amount and opens a gateway payment (no order, no stock touched); `POST
  /api/orders/razorpay/verify-and-create` verifies the signature and *only then* creates the
  order. A cancelled/failed attempt leaves nothing behind, so retrying — including switching
  payment methods — is always safe. UPI and WhatsApp orders are unchanged (still created
  immediately in "pending" status, since there's no gateway to verify against, matching what
  you asked for those two methods).
- **Admin sidebar actually stays fixed now**: root cause was `overflow-x: hidden` on `html`/
  `body` (added earlier for horizontal-scroll safety), which per the CSS spec implicitly turns
  `overflow-y` into `auto` too — creating a scroll container that broke `position: sticky`
  silently. Fixed structurally instead of with another CSS property: `<main>` is now the *only*
  scrolling element in the admin layout (`h-screen overflow-y-auto`), with the sidebar and body
  both fixed at `h-screen`. Verified in a real browser: forcibly scrolled `main` by 1500px and
  confirmed the sidebar's position didn't move by even one pixel.
- **Reset vs. Mark-as-Seen were reversed** — fixed to match your spec exactly: opening
  Admin → Orders / Custom Orders / Reviews automatically marks new items as seen (toast only
  shown if something was actually new), while **Reset now permanently deletes** everything in
  that section, with a proper confirmation dialog and a real `DELETE .../admin/delete-all`
  request — verified in a real browser that it shows "Delete all orders?" with Cancel/Delete
  All, not the old "marked as seen" message.
- **Saved-address selection at checkout**: Delivery Location now shows saved addresses from
  Profile → Addresses first (with their pinned map location reused automatically), with
  "+ Add New Address" falling back to the existing form + map picker.
- **Checkout persistence**: customer info, address, map location, delivery date, and payment
  method are saved to `sessionStorage` as you go, so navigating to Shop/Cart/Home and back
  doesn't lose your progress. Cleared automatically on a completed order. The total on the
  summary step always reads live from `CartContext`, so a quantity change in Cart is reflected
  automatically without stale numbers.

**What I actually tested** (real headless Chromium): the sidebar fix, with a forced 1500px
scroll and a before/after position comparison (identical, `0` both times); the Reset button
showing the correct delete confirmation with the correct wording; `npm run build` and the
backend syntax check both pass clean.

**Not re-verified this round**: the full Razorpay payment flow end-to-end (needs a real
Razorpay test account + a live backend), the duplicate-order-number fix under actual concurrent
load, and the saved-address checkout flow with a real logged-in account that has saved
addresses. The code paths are consistent and the pieces fit together correctly on inspection,
but that's not the same as watching a real payment go through.

## 18. Profile navigation bug, 5 new gradient themes, search, and WhatsApp/Instagram fixes

**Files changed:** `pages/Profile.jsx` (rewrite), `components/Navbar.jsx`, `context/ThemeContext.jsx`,
`theme-vars.css`, `index.css`, `controllers/productController.js`, new `frontend/src/config.js`,
`components/WhatsAppButton.jsx`, `components/Footer.jsx`, `pages/Contact.jsx`,
`pages/ProductDetails.jsx`, `pages/Checkout.jsx`.

- **Found the actual cause of the Profile dropdown bug**: `const [tab, setTab] =
  useState(TAB_PARAM_MAP[searchParams.get("tab")] || "Profile")` — that lazy initializer only
  ever runs once, on the component's first mount. Since `/profile?tab=orders` →
  `/profile?tab=addresses` is the same route (React Router doesn't remount it, just re-renders
  with new search params), `tab` state silently never updated on subsequent dropdown clicks —
  exactly the "sometimes doesn't update" behavior you saw. Fixed by removing that local state
  entirely: the active tab is now derived fresh from `searchParams` on every render, so the URL
  is the single source of truth and it's structurally impossible for the two to disagree.
  Verified in a real browser: loaded `/profile?tab=orders` directly, then clicked "Addresses"
  *without navigating away first* — URL, active button, and rendered content all updated
  correctly on the first click.
- **Wishlist and Custom Orders are now real tabs on the Profile page** (`?tab=wishlist`,
  `?tab=custom-orders`), matching your reference image — previously the dropdown sent them to
  separate `/wishlist` and `/custom-orders/mine` routes, which is what made them feel
  disconnected from the rest of the profile navigation. The standalone routes still exist and
  still work, so nothing that already linked there breaks.
- **Layout reordered** to match your reference exactly: Navbar → profile nav pills (always
  visible, horizontally scrollable on narrow screens) → "Your Account / Hello, [name] / Profile
  Completion" → the selected tab's content.
- **5 new blended gradient themes** added without touching the 9 existing ones: Lavender
  Bloom, Rose Sunset, Ocean Dream, Meadow Glow, Berry Dream (14 total now). The background
  gradient system itself was centralized per your request — every theme (old or new) now gets
  a genuine soft 5-stop diagonal blend (`linear-gradient(135deg, blush, lavender, rose, gold,
  cream)`) computed from that theme's own CSS variables in one shared rule in `index.css`, so
  adding a future theme only means adding palette values, not new gradient code.
- **Found the actual cause of the search bug**: the backend used MongoDB's `$text` search,
  which only matches whole word stems (not partial/substring text), has zero typo tolerance,
  and — critically — can't search the `Category` collection at all since it's joined via a
  separate `.populate()` after the query runs. Your screenshot's category was literally named
  "Resgin Earings" (not a typo in your data, an intentional-if-unusual name), but `$text`
  search on the product's own name/description never had a chance to see it. Replaced with:
  word-by-word regex matching across product name, description, colors, AND the joined
  category's name (every query word must match somewhere, in any order), with a typo-tolerant
  Levenshtein-distance fallback pass if that finds nothing. No new npm package — implemented
  in ~30 lines of plain JS. Verified all 9 of your example queries (`Resin`, `Earrings`,
  `Purple`, `Resgin Earings`, `gold`, `hoop`, etc.) against your exact product/category names
  from the screenshot — all match correctly now.
- **WhatsApp/Instagram centralized**: new `frontend/src/config.js` is now the single place
  `VITE_WHATSAPP_NUMBER` and the Instagram handle (`subhasini.arts_design`, configurable via
  `VITE_INSTAGRAM_HANDLE`) are read — previously scattered across 6 files with a repeated
  fallback literal. Instagram links were hardcoded to the generic `instagram.com` (not a real
  profile) in the Footer and Contact page — fixed to the actual handle. Checkout's "Contact
  Admin before ordering" link previously had **no context at all** (just opened WhatsApp blank)
  — it now includes the cart items, total, and payment method, matching your example format.
  The product-details WhatsApp button was already correctly deriving its message from the
  live `product` state per-render (verified by inspection — no stale-closure bug there), so the
  mismatch you saw was most likely a leftover WhatsApp desktop window from an earlier click
  rather than a live bug in that specific button, but centralizing the config removes any risk
  of a hardcoded wrong default lurking anywhere else.

**What I actually tested** (real headless Chromium): the Profile tab-sync fix exactly as
described above (direct URL load → click a different pill without navigating away → verified
URL + active button + rendered content all agree), all 5 new theme names present in the
dropdown alongside the original 9, and the search-matching logic run standalone against your
exact product/category names with all 9 example queries passing. `npm run build` and the
backend syntax check both pass clean.

**Not re-verified this round**: the search fix against a live MongoDB (the matching logic
itself was tested directly, but not through the actual `/api/products` endpoint with real
data), and the WhatsApp message content on an actual phone/WhatsApp Web session.

## 19. Notes & next steps

- Demo product images use Picsum (a free placeholder photo service) so they always load —
  replace them via Admin → Products once you have real photos.
- **If uploaded images don't appear on products/categories**: this almost always means
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` aren't set (or are
  wrong) in `backend/.env`. Without them, the upload silently fails and the product saves with
  no image. As of this version, the server now refuses the upload with a clear error message
  instead of failing silently — check your backend terminal/toast message for details. Sign up
  free at cloudinary.com, copy the three values from your dashboard, restart the backend, and
  try uploading again. Any image that's still missing shows a soft on-brand placeholder instead
  of a broken icon.
- Razorpay is wired but needs your real keys to accept live payments; until then, customers
  can still check out via UPI-mention or "Order through WhatsApp".
- This is a strong, working foundation — as your catalog grows (photo frames, trays, etc.)
  just add categories and products from the dashboard. No code changes needed.

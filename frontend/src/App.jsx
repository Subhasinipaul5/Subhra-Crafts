import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import ScrollRestoration from "./components/ScrollRestoration";
import { RequireAuth, RequireStaff, RequireOwner } from "./components/ProtectedRoute";
import { initAnalytics, trackPageView, setAnalyticsStaffMode } from "./lib/analytics";
import { useAuth } from "./context/AuthContext";

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import SalesOffers from "./pages/SalesOffers";
import AllCategories from "./pages/AllCategories";
import CollectionDetail from "./pages/CollectionDetail";
import ProductDetails from "./pages/ProductDetails";
import ProductReviews from "./pages/ProductReviews";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import OrderTracking from "./pages/OrderTracking";
import CustomOrder from "./pages/CustomOrder";
import MyCustomOrders from "./pages/MyCustomOrders";
import Wishlist from "./pages/Wishlist";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminBestsellers from "./pages/admin/AdminBestsellers";
import AdminHomepage from "./pages/admin/AdminHomepage";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminSections from "./pages/admin/AdminSections";
import AdminSales from "./pages/admin/AdminSales";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomOrders from "./pages/admin/AdminCustomOrders";
import AdminVirtualTryOn from "./pages/admin/AdminVirtualTryOn";
import AdminLocation from "./pages/admin/AdminLocation";
import AdminHomeBanner from "./pages/admin/AdminHomeBanner";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAdvertisements from "./pages/admin/AdminAdvertisements";
import AdminAnalytics from "./pages/admin/AdminAnalytics";

// FEATURE 2 (analytics) - fires a page_view event on every route change. Lives inside <Routes>'s
// tree so it has access to useLocation, and is intentionally tiny/side-effect-only (renders nothing).
function RouteChangeTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { isStaff } = useAuth();

  // FEATURE (this round) - frontend-side skip for admin/owner activity. This is a bandwidth/UX
  // optimization ONLY, not the actual security boundary - the backend independently refuses to
  // record anything for an admin/owner token even if this flag were somehow wrong (see
  // analyticsController.js isStaff(req.user) checks).
  useEffect(() => {
    setAnalyticsStaffMode(isStaff);
  }, [isStaff]);

  useEffect(() => {
    initAnalytics();
  }, [isStaff]);

  return (
    <>
      <RouteChangeTracker />
      <ScrollRestoration />
      <Routes>
      {/* Admin area has its own layout (sidebar), no public navbar/footer */}
      <Route path="/admin" element={<RequireStaff> <AdminLayout /></RequireStaff>}>
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="bestsellers" element={<AdminBestsellers />} />
        <Route path="homepage" element={<AdminHomepage />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="sections" element={<AdminSections />} />
        <Route path="sales" element={<AdminSales />} />
        <Route path="virtual-try-on" element={<AdminVirtualTryOn />}/>
        <Route path="orders" element={<AdminOrders />} />
        <Route path="custom-orders" element={<AdminCustomOrders />} />
        <Route path="location" element={<AdminLocation />} />
        <Route path="home-banner" element={<AdminHomeBanner />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="advertisements" element={<AdminAdvertisements />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route
          path="settings"
          element={
            <RequireOwner>
              <AdminSettings />
            </RequireOwner>
          }
        />
      </Route>

      {/* Public / customer site */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/sales" element={<SalesOffers />} />
                <Route path="/categories" element={<AllCategories />} />
                <Route path="/collections/:id" element={<CollectionDetail />} />
                <Route path="/product/:slug" element={<ProductDetails />} />
                <Route path="/product/:slug/reviews" element={<ProductReviews />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/register" element={<Register />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/custom-order" element={<CustomOrder />} />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/wishlist"
                  element={
                    <RequireAuth>
                      <Wishlist />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/custom-orders/mine"
                  element={
                    <RequireAuth>
                      <MyCustomOrders />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <RequireAuth>
                      <OrderTracking />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/track-order"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <WhatsAppButton />
          </div>
        }
      />
      </Routes>
    </>
  );
}

import { useEffect, useState, useRef } from "react";
import { useCurrency } from "../context/CurrencyContext";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import LocationPicker from "../components/LocationPicker";
import ProductCard from "../components/ProductCard";
import LeafDoodles from "../components/LeafDoodles";

// Single source of truth for which tab is active: the URL's ?tab= param. Both the navbar
// dropdown AND the pill buttons on this page write to the SAME param via setSearchParams, and
// the active tab is derived fresh on every render (never cached in local state) - that's what
// makes them impossible to get out of sync, even while already on this page.
const TAB_SLUGS = {
  profile: "Profile",
  orders: "My Orders",
  payments: "My Payments",
  addresses: "Addresses",
  password: "Password",
  wishlist: "Wishlist",
  "custom-orders": "Custom Orders",
};
const SLUG_FOR_TAB = Object.fromEntries(Object.entries(TAB_SLUGS).map(([slug, label]) => [label, slug]));
const TABS = Object.values(TAB_SLUGS);

export default function Profile() {
  const { formatPrice } = useCurrency();
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TAB_SLUGS[searchParams.get("tab")] || "Profile";
  const navigate = useNavigate();
  // Present only when this page was reached via the Checkout "Delivery Location" auto-redirect
  // (see Checkout.jsx) - e.g. "/profile?tab=addresses&returnTo=/checkout". A normal visit to
  // Profile > Addresses (from the navbar, etc.) has no returnTo, so saving an address there
  // behaves exactly as before and simply stays on this page.
  const returnTo = searchParams.get("returnTo");

  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [firstName, setFirstName] = useState(user?.firstName || user?.name?.split(" ")[0] || "");
  const [lastName, setLastName] = useState(user?.lastName || user?.name?.split(" ").slice(1).join(" ") || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [newAddress, setNewAddress] = useState({ label: "Home", house: "", street: "", city: "", state: "", pincode: "", landmark: "", lat: null, lng: null, locationAddress: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [locationModalFor, setLocationModalFor] = useState(null);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [orderDeleteTarget, setOrderDeleteTarget] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [paymentDeleteTarget, setPaymentDeleteTarget] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // Preserves other query params (like returnTo, set by the Checkout redirect) instead of
  // replacing the whole query string - so switching tabs while mid-way through that flow doesn't
  // silently lose where to send the customer back to once they save their address.
  const goToTab = (label) =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", SLUG_FOR_TAB[label]);
      return params;
    });

  const completionFields = [
    !!user?.name, !!user?.email, !!user?.phone,
    !!(user?.addresses && user.addresses.length > 0), !!user?.profileImage?.url, !!user?.bio,
  ];
  const completionPercent = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  useEffect(() => {
    if (tab === "My Orders") api.get("/orders/mine").then((res) => setOrders(res.data));
    if (tab === "My Payments") api.get("/payments/mine").then((res) => setPayments(res.data));
    if (tab === "Wishlist") api.get("/wishlist").then((res) => setWishlist(res.data));
    if (tab === "Custom Orders") api.get("/custom-orders/mine").then((res) => setCustomOrders(res.data));
  }, [tab]);

  const fetchInvoiceBlob = async (order) => {
    const res = await api.get(`/orders/${order._id}/invoice`, { responseType: "blob" });
    return URL.createObjectURL(res.data);
  };

  const viewInvoice = async (order) => {
    try {
      const url = await fetchInvoiceBlob(order);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("Could not open invoice");
    }
  };

  const downloadInvoice = async (order) => {
    try {
      const url = await fetchInvoiceBlob(order);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SubhRa-Crafts-Invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error("Could not download invoice");
    }
  };

  // Removes this order from the customer's OWN "My Orders" view only - the admin's copy of the
  // order, and its contribution to business revenue, are completely untouched (see
  // deleteOrderForCustomer in orderController.js).
  const confirmDeleteOrder = async () => {
    if (!orderDeleteTarget) return;
    setDeletingOrder(true);
    try {
      await api.delete(`/orders/${orderDeleteTarget._id}/mine`);
      toast.success("Order removed from your order history.");
      setOrders((prev) => prev.filter((o) => o._id !== orderDeleteTarget._id));
      setOrderDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove this order");
    } finally {
      setDeletingOrder(false);
    }
  };

  // Same idea, for a payment/transaction row - removes it from the customer's OWN "My Payments"
  // view only. The admin's copy and total revenue are completely untouched (see
  // deletePaymentForCustomer in paymentController.js).
  const confirmDeletePayment = async () => {
    if (!paymentDeleteTarget) return;
    setDeletingPayment(true);
    try {
      await api.delete(`/payments/${paymentDeleteTarget._id}/mine`);
      toast.success("Transaction removed from your payment history.");
      setPayments((prev) => prev.filter((p) => p._id !== paymentDeleteTarget._id));
      setPaymentDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not remove this transaction");
    } finally {
      setDeletingPayment(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    await api.put("/auth/me", { firstName, lastName, phone, bio });
    await refreshUser();
    toast.success("Profile updated");
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload/personal", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const image = res.data.images[0];
      await api.put("/auth/me", { profileImage: image });
      await refreshUser();
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

  const addAddress = async (e) => {
    e.preventDefault();
    // Same required/optional split as Checkout's Delivery Location step: House / Flat No. can
    // stay empty, everything else here can't.
    if (!newAddress.street?.trim()) return toast.error("Please enter your Street.");
    if (!newAddress.city?.trim()) return toast.error("Please enter your City.");
    if (!newAddress.state?.trim()) return toast.error("Please enter your State.");
    if (!newAddress.pincode?.trim()) return toast.error("Please enter your Pincode.");
    if (!PINCODE_REGEX.test(newAddress.pincode.trim())) return toast.error("Please enter a valid 6-digit Pincode.");
    await api.post("/auth/addresses", newAddress);
    await refreshUser();
    toast.success("Address saved");
    setNewAddress({ label: "Home", house: "", street: "", city: "", state: "", pincode: "", landmark: "", lat: null, lng: null, locationAddress: "" });
    // Only when we were sent here from Checkout's Delivery Location step (see the returnTo
    // param) - send the customer straight back to that exact page with the address they just
    // saved now available. A normal Profile > Addresses visit has no returnTo and stays here,
    // unchanged from before.
    if (returnTo && returnTo.startsWith("/")) {
      navigate(returnTo);
    }
  };

  const deleteAddress = async (id) => {
    await api.delete(`/auth/addresses/${id}`);
    await refreshUser();
  };

  const confirmLocation = async () => {
    if (!pendingLocation) return;
    if (locationModalFor === "new") {
      // Only City/State/Pincode/Landmark are ever filled in from the detected location, and only
      // when something was actually detected - House / Flat No. and Street always stay exactly
      // what the customer typed (or didn't).
      setNewAddress((prev) => ({
        ...prev,
        lat: pendingLocation.lat, lng: pendingLocation.lng, locationAddress: pendingLocation.locationAddress,
        city: pendingLocation.components?.city || prev.city,
        state: pendingLocation.components?.state || prev.state,
        pincode: pendingLocation.components?.pincode || prev.pincode,
        landmark: pendingLocation.components?.landmark || prev.landmark,
      }));
    } else {
      // Repositioning an address that was already fully filled in and saved before - only the
      // pin itself is updated here, never its city/state/pincode/landmark text.
      await api.put(`/auth/addresses/${locationModalFor._id}`, {
        lat: pendingLocation.lat, lng: pendingLocation.lng, locationAddress: pendingLocation.locationAddress,
      });
      await refreshUser();
      toast.success("Location saved");
    }
    setLocationModalFor(null);
    setPendingLocation(null);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put("/auth/change-password", pw);
      toast.success("Password changed successfully");
      setPw({ currentPassword: "", newPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change password");
    }
  };

  const STATUS_LABELS = {
    requested: "Requested", under_discussion: "Under Discussion", price_proposed: "Price Proposed",
    accepted: "Accepted", rejected: "Rejected", in_production: "In Production", shipped: "Shipped", delivered: "Delivered",
  };

  return (
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <LeafDoodles />
      {/* Profile navigation - always visible while on this page, never disappears when
          switching sections. Horizontally scrollable on narrow screens instead of wrapping/breaking. */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-10">
        <div className="flex gap-3 justify-start sm:justify-center w-max sm:w-auto mx-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => goToTab(t)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                tab === t ? "bg-plum text-cream" : "border border-blush text-plum-dark hover:border-rose"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <SectionHeading eyebrow="Your Account" title={`Hello, ${user?.name?.split(" ")[0]}`} />

      <div className="max-w-xs mx-auto mb-10 text-center">
        <div className="flex justify-between text-xs text-plum-light/70 mb-1">
          <span>Profile Completion</span><span>{completionPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-blush/40 overflow-hidden">
          <div className="h-full bg-gold transition-all duration-500" style={{ width: `${completionPercent}%` }} />
        </div>
      </div>

      {tab === "Profile" && (
        <form onSubmit={saveProfile} className="card p-8 max-w-md mx-auto space-y-4">
          <div className="flex flex-col items-center gap-3 mb-2">
            <div className="w-24 h-24 rounded-full overflow-hidden border border-blush bg-ivory flex items-center justify-center">
              {user?.profileImage?.url ? (
                <img src={user.profileImage.url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-3xl text-plum">{user?.name?.[0]}</span>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="text-xs text-rose underline underline-offset-4">
              {uploadingPhoto ? "Uploading..." : "Change Photo"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="border border-blush rounded-lg px-4 py-3 bg-white/70" placeholder="First Name" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="border border-blush rounded-lg px-4 py-3 bg-white/70" placeholder="Last Name" />
          </div>
          <input value={user?.email} disabled className="w-full border border-blush rounded-lg px-4 py-3 bg-blush/20 text-plum-light/60" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" placeholder="Phone" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" placeholder="A short bio about you..." />
          <div className="text-xs text-plum-light/60 -mt-2">{bio.length}/500</div>
          <div className="text-xs text-plum-light/60 -mt-2 capitalize">Account type: {user?.role}</div>
          <button className="btn-primary w-full">Save Changes</button>
        </form>
      )}

      {tab === "My Orders" && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {orders.length === 0 && <p className="text-center text-plum-light/60">No orders yet.</p>}
          {orders.map((o) => (
            <div key={o._id} className="card p-4">
              <Link to={`/orders/${o._id}`} className="flex justify-between items-center block">
                <div>
                  <div className="font-medium text-plum-dark">#{o.orderNumber}</div>
                  <div className="text-xs text-plum-light/70">{new Date(o.createdAt).toLocaleDateString()} • {o.items.length} item(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-plum">{formatPrice(o.totalAmount)}</div>
                  <div className="text-xs capitalize text-rose">{o.orderStatus.replace("_", " ")}</div>
                </div>
              </Link>
              {o.paymentStatus === "paid" && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-blush/50 text-xs">
                  <button onClick={() => viewInvoice(o)} className="text-plum underline">View Invoice</button>
                  <button onClick={() => downloadInvoice(o)} className="text-rose underline">Download PDF</button>
                </div>
              )}
              <div className="flex gap-4 mt-3 pt-3 border-t border-blush/50 text-xs">
                <button onClick={() => setOrderDeleteTarget(o)} className="text-rose underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "My Payments" && (
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-plum-light/70 border-b border-blush">
                <th className="py-2">Order</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b border-blush/50">
                  <td className="py-2">{p.order?.orderNumber}</td>
                  <td>{formatPrice(p.amount)}</td>
                  <td className="capitalize">{p.paymentMethod}</td>
                  <td className="capitalize">{p.status}</td>
                  <td>{new Date(p.date).toLocaleDateString()}</td>
                  <td><button onClick={() => setPaymentDeleteTarget(p)} className="text-rose text-xs underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && <p className="text-center text-plum-light/60 py-6">No payments yet.</p>}
        </div>
      )}

      {tab === "Addresses" && (
        <div className="max-w-md mx-auto space-y-6">
          {returnTo && (
            <div className="card p-4 bg-blush/20 flex items-center justify-between gap-3 text-sm">
              <span className="text-plum-dark">Add and save a delivery address to continue your order.</span>
              <Link to={returnTo} className="text-rose underline shrink-0 text-xs">Cancel</Link>
            </div>
          )}
          {user?.addresses?.map((a) => (
            <div key={a._id} className="card p-4">
              <div className="flex justify-between items-start">
                <div className="text-sm text-plum-dark">
                  <div className="font-medium">🏠 {a.label}</div>
                  {/* House / Flat No. is optional, so it's skipped cleanly here (no stray leading
                      comma) whenever an address doesn't have one. */}
                  <div>{[a.house, a.street, a.city, a.state].filter(Boolean).join(", ")} - {a.pincode}</div>
                  {a.landmark && <div className="text-xs text-plum-light/70">Landmark: {a.landmark}</div>}
                  {a.lat != null ? (
                    <div className="text-xs text-plum-light/70 mt-1">📍 Location saved</div>
                  ) : (
                    <div className="text-xs text-rose mt-1">📍 No location set</div>
                  )}
                </div>
                <button onClick={() => deleteAddress(a._id)} className="text-rose text-xs shrink-0">Remove</button>
              </div>
              <button onClick={() => setLocationModalFor(a)} className="text-xs text-plum underline mt-2">
                {a.lat != null ? "Change Location" : "Set Location"}
              </button>
            </div>
          ))}

          <form onSubmit={addAddress} className="card p-6 space-y-3">
            <h4 className="font-display text-lg text-plum">Add New Address</h4>
            <input placeholder="Label (e.g. Home)" value={newAddress.label} onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
            <div>
              <label className="text-xs font-medium text-plum-dark block mb-1">House / Flat No.</label>
              <input placeholder="House / Flat No." value={newAddress.house} onChange={(e) => setNewAddress({ ...newAddress, house: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-plum-dark block mb-1">Street <span className="text-rose">*</span></label>
              <input placeholder="Street" value={newAddress.street} onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-plum-dark block mb-1">City <span className="text-rose">*</span></label>
                <input placeholder="City" value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-plum-dark block mb-1">State <span className="text-rose">*</span></label>
                <input placeholder="State" value={newAddress.state} onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-plum-dark block mb-1">Pincode <span className="text-rose">*</span></label>
              <input placeholder="Pincode" value={newAddress.pincode} onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-plum-dark block mb-1">Landmark (optional)</label>
              <input placeholder="Landmark (optional)" value={newAddress.landmark} onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2 bg-white/70 text-sm" />
            </div>

            <button type="button" onClick={() => setLocationModalFor("new")} className="w-full border border-plum text-plum rounded-lg py-2 text-sm">
              📍 {newAddress.lat != null ? "Location Set — Change" : "Set Location"}
            </button>
            {newAddress.lat != null && <p className="text-xs text-plum-light/70">{newAddress.locationAddress}</p>}

            <button className="btn-primary w-full">Add Address</button>
          </form>
        </div>
      )}

      {tab === "Password" && (
        <form onSubmit={changePassword} className="card p-8 max-w-md mx-auto space-y-4">
          <input type="password" required placeholder="Current Password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input type="password" required placeholder="New Password (min. 6 characters)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <button className="btn-primary w-full">Update Password</button>
        </form>
      )}

      {tab === "Wishlist" && (
        <div className="max-w-4xl mx-auto">
          {wishlist.length === 0 ? (
            <p className="text-center text-plum-light/60">Your wishlist is empty. Tap the heart on any product to save it here.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {wishlist.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      )}

      {tab === "Custom Orders" && (
        <div className="max-w-2xl mx-auto space-y-4">
          {customOrders.length === 0 && <p className="text-center text-plum-light/60">No custom order requests yet.</p>}
          {customOrders.map((o) => (
            <div key={o._id} className="card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-plum-dark">#{o.customOrderNumber} — {o.productType}</div>
                  <div className="text-xs text-plum-light/70">{new Date(o.createdAt).toLocaleDateString()}</div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-blush/50 text-plum">{STATUS_LABELS[o.status]}</span>
              </div>
              {(o.proposedPrice || o.shippingCharge) && (
                <div className="text-sm text-plum-dark mt-2 space-y-0.5">
                  {o.proposedPrice && <p>Proposed Price: {formatPrice(o.proposedPrice)}</p>}
                  {o.shippingCharge > 0 && <p>Shipping Charge: {formatPrice(o.shippingCharge)}</p>}
                  {o.proposedPrice && <p className="font-medium">Total: {formatPrice(o.proposedPrice + (o.shippingCharge || 0))}</p>}
                </div>
              )}
              {o.estimatedDelivery && <p className="text-sm text-plum-dark">Expected Completion: {new Date(o.estimatedDelivery).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
      )}

      {locationModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setLocationModalFor(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-plum mb-1">Set Your Location</h3>
            <p className="text-sm text-plum-light/70 mb-4">Choose your delivery location on the map.</p>
            <LocationPicker
              initialPosition={
                locationModalFor === "new"
                  ? newAddress.lat != null ? [newAddress.lat, newAddress.lng] : null
                  : locationModalFor.lat != null ? [locationModalFor.lat, locationModalFor.lng] : null
              }
              currentLocationSuccessMessage={
                locationModalFor === "new"
                  ? "Location detected. Please enter your Street and verify the detected address details. House / Flat No. is optional."
                  : undefined
              }
              onChange={(lat, lng, addr, components) => setPendingLocation({ lat, lng, locationAddress: addr, components })}
            />
            <div className="flex gap-3 pt-4">
              <button onClick={() => { setLocationModalFor(null); setPendingLocation(null); }} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmLocation} disabled={!pendingLocation} className="btn-primary text-sm w-full disabled:opacity-50">
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
      {orderDeleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOrderDeleteTarget(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete this order from your order history?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              Order #{orderDeleteTarget.orderNumber} will be removed from your own My Orders only. It does not delete SubhRa Crafts' record of the
              order.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setOrderDeleteTarget(null)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmDeleteOrder} disabled={deletingOrder} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {deletingOrder ? "Removing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {paymentDeleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPaymentDeleteTarget(null)}>
          <div className="bg-white rounded-xl2 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-plum-dark mb-1 font-medium">Delete this transaction from your payment history?</p>
            <p className="text-sm text-plum-light/70 mb-5">
              This will be removed from your own My Payments only. It does not delete SubhRa Crafts' record of the transaction or affect their
              revenue.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPaymentDeleteTarget(null)} className="btn-outline text-sm w-full">Cancel</button>
              <button onClick={confirmDeletePayment} disabled={deletingPayment} className="bg-rose text-white px-4 py-2 rounded-full text-sm w-full disabled:opacity-60">
                {deletingPayment ? "Removing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import LocationPicker from "../components/LocationPicker";
import { buildWhatsAppUrl } from "../config";
import { track } from "../lib/analytics";
import LeafDoodles from "../components/LeafDoodles";

const STORAGE_KEY = "sr_checkout_state";
// Guards the auto-redirect-to-Add-Address flow (see the two effects near the top of Checkout())
// so it only fires once per checkout session instead of looping if the customer comes back
// without having saved an address.
const ADDRESS_REDIRECT_FLAG_KEY = "sr_checkout_address_redirect_pending";

const todayPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Loads any in-progress checkout the customer left behind - so navigating to Shop/Cart/Home
// and coming back doesn't lose everything they already entered. Never persists anything
// payment-related (no card/UPI details ever touch this).
const loadPersisted = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  // Every cart line already knows its own variantId (null for classic products) - this is
  // sent straight to the backend, which resolves price/stock/name against that exact variant.
  const cartItemsPayload = () => items.map((i) => ({ productId: i.productId, variantId: i.variantId || undefined, quantity: i.quantity }));
  const persisted = loadPersisted();

  const [step, setStep] = useState(persisted?.step || 1);
  const [placing, setPlacing] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [customer, setCustomer] = useState(persisted?.customer || { name: user?.name || "", email: user?.email || "", phone: user?.phone || "" });
  const [address, setAddress] = useState(persisted?.address || { house: "", street: "", city: "", state: "", pincode: "", landmark: "" });
  const [location, setLocation] = useState(persisted?.location || null); // { lat, lng, address }
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState(persisted?.preferredDeliveryDate || "");
  const [shippingInfo, setShippingInfo] = useState(persisted?.shippingInfo || null);
  // SubhRa Crafts takes orders through WhatsApp only - see handleOpenWhatsApp/handleConfirmOrder
  // below. No other payment method is offered, so this is no longer a per-customer choice.

  // Saved-address selection: customers shouldn't have to retype an address they already saved
  // in Profile > Addresses. Defaults to picking from that list when they have one.
  const [addressMode, setAddressMode] = useState(persisted?.addressMode || (user?.addresses?.length ? "saved" : "new"));
  const [selectedAddressId, setSelectedAddressId] = useState(persisted?.selectedAddressId || null);

  // Persist every change to sessionStorage - cleared only on successful order, or explicit cart-empty.
  useEffect(() => {
    track("checkout_start", { meta: { itemCount: items.length } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step, customer, address, location, preferredDeliveryDate, shippingInfo, addressMode, selectedAddressId })
    );
  }, [step, customer, address, location, preferredDeliveryDate, shippingInfo, addressMode, selectedAddressId]);

  const clearCheckoutState = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ADDRESS_REDIRECT_FLAG_KEY);
  };

  // If the customer reaches Delivery Location with NO saved address at all, send them straight
  // to the existing "Add Delivery Address" page (Profile > Addresses) instead of showing an
  // error - they fill it in and save there, then land back on this exact step (see returnTo
  // handling in Profile.jsx's addAddress). ADDRESS_REDIRECT_FLAG_KEY does double duty and is
  // what makes this safe across the full unmount/remount that happens when navigating to
  // /profile and back:
  //   - Not yet set + no saved address  -> set it, redirect to Add Address (first visit here).
  //   - Already set + still no address  -> customer came back without saving one (e.g. browser
  //     Back); do NOT redirect again (that would loop) - fall through to the normal inline
  //     "new address" form further down instead.
  //   - Already set + an address now exists -> they just came back from saving it; select that
  //     newest address automatically, then clear the flag so this only ever fires once.
  //   - Not set + address(es) already exist -> ordinary returning customer; nothing to do.
  useEffect(() => {
    if (step !== 2 || !user) return;
    const hasAddresses = user?.addresses?.length > 0;
    const pending = sessionStorage.getItem(ADDRESS_REDIRECT_FLAG_KEY);

    if (!hasAddresses) {
      if (!pending) {
        sessionStorage.setItem(ADDRESS_REDIRECT_FLAG_KEY, "1");
        navigate(`/profile?tab=addresses&returnTo=${encodeURIComponent("/checkout")}`);
      }
      return;
    }

    if (pending) {
      sessionStorage.removeItem(ADDRESS_REDIRECT_FLAG_KEY);
      const latest = user.addresses[user.addresses.length - 1];
      setAddressMode("saved");
      setSelectedAddressId(latest._id);
      setAddress({
        house: latest.house || "", street: latest.street || "", city: latest.city || "",
        state: latest.state || "", pincode: latest.pincode || "", landmark: latest.landmark || "",
      });
      if (latest.lat != null && latest.lng != null) {
        setLocation({ lat: latest.lat, lng: latest.lng, address: latest.locationAddress || "" });
      } else {
        setLocation(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user?.addresses]);

  // Total always derives from the LIVE cart subtotal (from CartContext), never a cached
  // number - so if the customer changes quantity in Cart and comes back, this updates itself
  // automatically without any extra plumbing.
  const total = shippingInfo ? subtotal + shippingInfo.shippingFee : null;

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <SectionHeading eyebrow="Checkout" title="Please Log In" subtitle="Log in or create an account to complete your order." />
        <a href="/login" className="btn-primary">Log In</a>
      </div>
    );
  }

  if (items.length === 0 && step < 4) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <SectionHeading eyebrow="Checkout" title="Your Cart is Empty" />
        <a href="/shop" className="btn-primary">Continue Shopping</a>
      </div>
    );
  }

  const selectSavedAddress = (a) => {
    setSelectedAddressId(a._id);
    setAddress({ house: a.house || "", street: a.street || "", city: a.city || "", state: a.state || "", pincode: a.pincode || "", landmark: a.landmark || "" });
    if (a.lat != null && a.lng != null) {
      setLocation({ lat: a.lat, lng: a.lng, address: a.locationAddress || "" });
    } else {
      setLocation(null);
    }
  };

  // House / Flat No. is intentionally NOT in this list - it's the one optional address field
  // (see the address form below and PINCODE_REGEX/goToSummary, which check everything else).
  const step2Complete =
    customer.name && customer.phone && address.street?.trim() && address.city?.trim() &&
    address.state?.trim() && address.pincode?.trim() && location && preferredDeliveryDate;

  const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

  const goToSummary = async () => {
    // Checked in this order so the customer always sees the single most relevant message first,
    // rather than one generic "complete your delivery information" catch-all. House / Flat No.
    // is deliberately never checked here - it's allowed to stay empty.
    if (!address.street?.trim()) return toast.error("Please enter your Street.");
    if (!address.city?.trim()) return toast.error("Please enter your City.");
    if (!address.state?.trim()) return toast.error("Please enter your State.");
    if (!address.pincode?.trim()) return toast.error("Please enter your Pincode.");
    if (!PINCODE_REGEX.test(address.pincode.trim())) return toast.error("Please enter a valid 6-digit Pincode.");
    if (!location) return toast.error("Please pin your delivery location on the map.");
    if (!preferredDeliveryDate) return toast.error("Please select a preferred delivery date.");
    setCalculating(true);
    try {
      const res = await api.post("/orders/calculate-shipping", { lat: location.lat, lng: location.lng });
      setShippingInfo(res.data);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not calculate shipping for this location");
    } finally {
      setCalculating(false);
    }
  };

  const buildShippingAddress = () => ({ name: customer.name, phone: customer.phone, ...address, lat: location.lat, lng: location.lng });

  const buildOrderMessage = () => {
    const addressLine = [address.house, address.street, address.landmark, address.city, address.state, address.pincode]
      .filter(Boolean)
      .join(", ");
    const lines = items
      .map((i) => `- ${i.name}${i.colorName ? ` (${i.colorName})` : ""} x${i.quantity} - ${formatPrice(i.price * i.quantity)}`)
      .join("\n");
    return (
      `Hello SubhRa Crafts! I'd like to place an order.\n\n` +
      `Order details:\n${lines}\n\n` +
      `Shipping: ${formatPrice(shippingInfo.shippingFee)}\nTotal: ${formatPrice(total)}\n\n` +
      `Customer name: ${customer.name}\nContact: ${customer.phone}\nDelivery address: ${addressLine}`
    );
  };

  // STEP A - only opens WhatsApp with the prepared message. Deliberately creates nothing:
  // opening a link/new tab is not proof the customer went on to actually press send inside
  // WhatsApp, so the cart, stock, and the admin's order list stay completely untouched here.
  // No "Order #" in the message either, since no order exists yet at this point.
  const handleOpenWhatsApp = () => {
    window.open(buildWhatsAppUrl(buildOrderMessage()), "_blank");
    setWhatsappOpened(true);
  };

  // STEP B - the one and only place the order is actually created, and only reachable after the
  // customer has explicitly told us they sent the message (the button below stays disabled until
  // handleOpenWhatsApp has run). This is still ultimately the customer's own word, not a verified
  // delivery receipt - SubhRa Crafts has no WhatsApp Business API/webhook integration to
  // genuinely confirm that, and this deliberately never pretends otherwise. The order is created
  // as "pending" regardless (see Order.js's default), so the admin still manually confirms it
  // against the WhatsApp message they actually receive before treating it as accepted.
  const handleConfirmOrder = async () => {
    setPlacing(true);
    try {
      const payload = {
        items: cartItemsPayload(),
        shippingAddress: buildShippingAddress(),
        preferredDeliveryDate,
        paymentMethod: "whatsapp",
      };
      const res = await api.post("/orders", payload);
      const order = res.data;
      track("purchase", { meta: { orderId: order._id, amount: order.totalAmount, paymentMethod: "whatsapp" } });
      clearCart();
      clearCheckoutState();
      toast("Your order request has been submitted. It will be confirmed once we verify your WhatsApp message.", { icon: "💬", duration: 7000 });
      navigate(`/orders/${order._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not submit order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto px-6 py-14">
      <LeafDoodles mobile />
      <SectionHeading eyebrow="Checkout" title="Complete Your Order" />

      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-10 text-xs sm:text-sm">
        {["Customer Info", "Delivery Location", "Order Summary", "WhatsApp Order"].map((label, i) => (
          <button
            key={label}
            onClick={() => (i + 1 < step ? setStep(i + 1) : null)}
            className={`flex items-center gap-2 ${step === i + 1 ? "text-plum font-medium" : i + 1 < step ? "text-rose cursor-pointer" : "text-plum-light/50"}`}
          >
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs shrink-0">
              {i + 1 < step ? "✓" : i + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      <div className="card p-6 sm:p-8">
        {step === 1 && (
          <div className="space-y-4">
            <input placeholder="Full Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
            <input placeholder="Email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
            <input placeholder="Phone Number" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
            <button
              onClick={() => {
                if (!customer.name || !customer.phone) return toast.error("Name and phone number are required");
                setStep(2);
              }}
              className="btn-primary w-full"
            >
              Continue to Delivery Location
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {addressMode === "saved" && user.addresses?.length > 0 ? (
              <>
                <h4 className="font-display text-lg text-plum mb-1">Choose a saved address</h4>
                <div className="space-y-3">
                  {user.addresses.map((a) => (
                    <div key={a._id} className={`border rounded-xl p-4 flex justify-between items-center gap-3 ${selectedAddressId === a._id ? "border-plum bg-blush/20" : "border-blush"}`}>
                      <div className="text-sm">
                        <div className="font-medium text-plum-dark">{a.label}</div>
                        <div className="text-plum-light/70">{[a.house, a.street, a.city, a.state].filter(Boolean).join(", ")} - {a.pincode}</div>
                        {a.landmark && <div className="text-xs text-plum-light/60">Landmark: {a.landmark}</div>}
                        {a.lat == null && <div className="text-[11px] text-rose mt-0.5">No pinned location - you'll need to set one</div>}
                      </div>
                      <button onClick={() => selectSavedAddress(a)} className={`text-xs px-4 py-2 rounded-full shrink-0 ${selectedAddressId === a._id ? "bg-plum text-cream" : "border border-plum text-plum"}`}>
                        {selectedAddressId === a._id ? "Selected" : "Select"}
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setAddressMode("new")} className="w-full border border-dashed border-blush rounded-xl p-4 text-sm text-plum hover:bg-blush/10">
                  + Add New Address
                </button>
                {selectedAddressId && !location && (
                  <div className="pt-2">
                    <p className="text-xs text-rose mb-2">This saved address has no pinned map location yet - please set one to calculate shipping.</p>
                    {/* This only pins a location for an address that was already fully filled in and
                        saved before - it deliberately does NOT re-derive city/state/pincode/landmark
                        from the pin, so it never overwrites what the customer already entered. */}
                    <LocationPicker onChange={(lat, lng, addr) => setLocation({ lat, lng, address: addr })} />
                  </div>
                )}
              </>
            ) : (
              <>
                {user.addresses?.length > 0 && (
                  <button onClick={() => setAddressMode("saved")} className="text-xs text-rose underline mb-2">← Use a saved address</button>
                )}
                {/* House / Flat No. and Street are never auto-filled from the map/GPS/search below
                    (see LocationPicker's onChange handler a few lines down) - only City, State,
                    Pincode and Landmark are, and only when detected. House / Flat No. has no "*"
                    because it's the one optional field here; everything else does. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">House / Flat No.</label>
                    <input placeholder="House / Flat No." value={address.house} onChange={(e) => setAddress({ ...address, house: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">Street <span className="text-rose">*</span></label>
                    <input placeholder="Street" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">City <span className="text-rose">*</span></label>
                    <input placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">State <span className="text-rose">*</span></label>
                    <input placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">Pincode <span className="text-rose">*</span></label>
                    <input placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-plum-dark block mb-1">Landmark (optional)</label>
                    <input placeholder="Landmark (optional)" value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="font-display text-lg text-plum mb-2">Pin Your Delivery Location</h4>
                  <p className="text-xs text-plum-light/70 mb-3">
                    This lets us calculate the exact shipping distance and delivery estimate for you.
                  </p>
                  <LocationPicker
                    initialPosition={location ? [location.lat, location.lng] : null}
                    currentLocationSuccessMessage="Location detected. Please enter your Street and verify the detected address details. House / Flat No. is optional."
                    onChange={(lat, lng, addr, components) => {
                      setLocation({ lat, lng, address: addr });
                      // Only City/State/Pincode/Landmark are ever touched here, and only when a
                      // value was actually detected (falls back to whatever's already there
                      // otherwise) - House / Flat No. and Street are never written by this.
                      setAddress((prev) => ({
                        ...prev,
                        city: components?.city || prev.city,
                        state: components?.state || prev.state,
                        pincode: components?.pincode || prev.pincode,
                        landmark: components?.landmark || prev.landmark,
                      }));
                    }}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium text-plum-dark block mb-1">Preferred Delivery Date</label>
              <input
                type="date"
                min={todayPlus(1)}
                value={preferredDeliveryDate}
                onChange={(e) => setPreferredDeliveryDate(e.target.value)}
                className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-outline w-full">Back</button>
              <button onClick={goToSummary} disabled={calculating} className="btn-primary w-full disabled:opacity-60">
                {calculating ? "Calculating..." : "Continue to Order Summary"}
              </button>
            </div>
            {!step2Complete && (
              <p className="text-xs text-rose text-center">
                Please complete your delivery information before proceeding to payment.
              </p>
            )}
          </div>
        )}

        {step === 3 && shippingInfo && (
          <div className="space-y-5">
            <div>
              <h4 className="font-display text-lg text-plum mb-1">📍 Delivery Location</h4>
              <p className="text-sm text-plum-dark">{location.address}</p>
              <button onClick={() => setStep(2)} className="text-xs text-rose underline mt-1">Change Location</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-plum-light/70">📏 Delivery Distance</div>
                <div className="text-plum-dark font-medium">{shippingInfo.distanceKm} km</div>
              </div>
              <div>
                <div className="text-plum-light/70">🚚 Shipping Charge</div>
                <div className="text-plum-dark font-medium">{formatPrice(shippingInfo.shippingFee)}</div>
              </div>
            </div>
            <div>
              <div className="text-plum-light/70 text-sm">📅 Estimated Delivery</div>
              <div className="text-plum-dark font-medium text-sm">
                {shippingInfo.estimateDaysMin}–{shippingInfo.estimateDaysMax} business days
                {preferredDeliveryDate && ` (you requested ${new Date(preferredDeliveryDate).toLocaleDateString()})`}
              </div>
            </div>

            <div className="border-t border-blush pt-4 space-y-1 text-sm text-plum-dark">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{formatPrice(shippingInfo.shippingFee)}</span></div>
              <div className="flex justify-between font-display text-lg text-plum pt-2 border-t border-blush mt-2">
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-outline w-full">Back</button>
              <button onClick={() => setStep(4)} className="btn-primary w-full">Proceed to Order</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {/* SubhRa Crafts takes orders through WhatsApp only - no online payment gateway. */}
            <div className="flex items-start gap-3 border rounded-xl p-4 border-plum bg-blush/30">
              <input type="radio" name="pm" checked readOnly className="mt-1" />
              <div>
                <div className="font-medium text-plum-dark text-sm">Order through WhatsApp</div>
                <div className="text-xs text-plum-light/70">We'll confirm your order over WhatsApp</div>
              </div>
            </div>

            <div className="border-t border-blush pt-4 flex justify-between font-display text-lg text-plum">
              <span>Total</span><span>{formatPrice(total)}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-outline w-full">Back</button>
              <button onClick={handleOpenWhatsApp} className="btn-primary w-full">
                {whatsappOpened ? "Reopen WhatsApp" : "Send Order via WhatsApp"}
              </button>
            </div>
            <p className="text-xs text-center text-plum-light/70">
              Please send the prepared WhatsApp message. Your order will be confirmed after we receive and verify your message.
            </p>

            {/* Only appears once WhatsApp has actually been opened - this is the one and only
                action that creates the order (see handleConfirmOrder). Clicking "Send Order via
                WhatsApp" above never creates it on its own. */}
            {whatsappOpened && (
              <div className="border border-blush rounded-xl p-4 bg-blush/20 space-y-3">
                <p className="text-sm text-plum-dark text-center">Have you sent the message in WhatsApp?</p>
                <button onClick={handleConfirmOrder} disabled={placing} className="btn-primary w-full disabled:opacity-60">
                  {placing ? "Submitting..." : "Yes, I've Sent It — Complete My Order"}
                </button>
              </div>
            )}

            <a
              href={buildWhatsAppUrl(
                `Hello SubhRa Crafts! 👋 I need help regarding my order.\n\n` +
                  items.map((i) => `Product: ${i.name}${i.colorName ? ` (${i.colorName})` : ""} x${i.quantity}`).join("\n") +
                  `\nOrder Total: ${formatPrice(total)}\n\nPlease help me with my query.`
              )}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-rose underline underline-offset-4"
            >
              Contact Admin before ordering
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

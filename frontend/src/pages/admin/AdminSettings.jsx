import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import NumberInput from "../../components/NumberInput";

const CURRENCIES = [
  { code: "INR", label: "INR — ₹ Indian Rupee" },
  { code: "USD", label: "USD — $ US Dollar" },
  { code: "EUR", label: "EUR — € Euro" },
];

export default function AdminSettings() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // FEATURE 1 (currency) - live INR->USD/EUR rates are fetched server-side (see
  // backend/utils/exchangeRates.js). This section shows the current live rate + when it was
  // last refreshed, lets the admin set the DEFAULT currency new visitors see, and lets them set
  // a manual FALLBACK rate used only on the rare occasion the live API can't be reached.
  const [currency, setCurrency] = useState({
    displayCurrency: "INR",
    exchangeRates: { INR: 1, USD: 0.012, EUR: 0.011 },
    ratesSource: "fallback",
    ratesUpdatedAt: null,
  });
  const [fallbackRates, setFallbackRates] = useState({ USD: 0.012, EUR: 0.011 });
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [refreshingRates, setRefreshingRates] = useState(false);

  // Contact section 3D model display size (see TwoSistersModel3D.jsx) - a single 0.5x-2.0x
  // factor the storefront reads to zoom the model's framing in/out.
  const [modelScale, setModelScale] = useState(1.4);
  const [savingModelScale, setSavingModelScale] = useState(false);
  const [modelHRotation, setModelHRotation] = useState(0);
  const [savingModelHRotation, setSavingModelHRotation] = useState(false);
  const [modelVRotation, setModelVRotation] = useState(0);
  const [savingModelVRotation, setSavingModelVRotation] = useState(false);

  const load = () => api.get("/admin/users").then((res) => setUsers(res.data));
  const loadCurrency = () =>
    api.get("/settings").then((res) => {
      if (res.data?.currency) {
        setCurrency(res.data.currency);
        setFallbackRates({ USD: res.data.currency.exchangeRates.USD, EUR: res.data.currency.exchangeRates.EUR });
      }
      if (res.data?.modelDisplayScale) setModelScale(res.data.modelDisplayScale);
      if (res.data?.modelHorizontalRotation !== undefined) setModelHRotation(res.data.modelHorizontalRotation);
      if (res.data?.modelVerticalRotation !== undefined) setModelVRotation(res.data.modelVerticalRotation);
    });
  useEffect(() => {
    load();
    loadCurrency();
  }, []);

  const saveCurrency = async (e) => {
    e.preventDefault();
    setSavingCurrency(true);
    try {
      const res = await api.put("/settings/currency", { displayCurrency: currency.displayCurrency, fallbackRates });
      setCurrency(res.data);
      toast.success("Currency settings saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save currency settings");
    } finally {
      setSavingCurrency(false);
    }
  };

  const refreshRatesNow = async () => {
    setRefreshingRates(true);
    try {
      const res = await api.post("/settings/currency/refresh");
      setCurrency((c) => ({ ...c, ...res.data }));
      toast.success(res.data.ratesSource === "live" ? "Live rates refreshed successfully." : "Live API unreachable right now — using the last known-good rate.");
    } catch {
      toast.error("Could not refresh exchange rates.");
    } finally {
      setRefreshingRates(false);
    }
  };

  const grant = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/admin/users/grant-admin", { email });
      toast.success(res.data.message);
      setEmail("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not grant admin access");
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (id) => {
    if (!confirm("Revoke admin access for this person?")) return;
    const res = await api.post(`/admin/users/${id}/revoke-admin`);
    toast.success(res.data.message);
    load();
  };

  const toggleActive = async (id) => {
    const res = await api.put(`/admin/users/${id}/toggle-active`);
    toast.success(res.data.message);
    load();
  };

  const staff = users.filter((u) => u.role === "admin" || u.role === "owner");

  const saveModelScale = async (value) => {
    setModelScale(value);
    setSavingModelScale(true);
    try {
      await api.put("/settings/contact-model", { scale: value });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save model size");
    } finally {
      setSavingModelScale(false);
    }
  };

  const saveModelHRotation = async (value) => {
    setModelHRotation(value);
    setSavingModelHRotation(true);
    try {
      await api.put("/settings/contact-model", { horizontalRotation: value });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save horizontal rotation");
    } finally {
      setSavingModelHRotation(false);
    }
  };

  const saveModelVRotation = async (value) => {
    setModelVRotation(value);
    setSavingModelVRotation(true);
    try {
      await api.put("/settings/contact-model", { verticalRotation: value });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save vertical rotation");
    } finally {
      setSavingModelVRotation(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-6">Settings & Admin Access</h1>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 max-w-lg">
        <h3 className="font-display text-xl text-plum dark:text-cream mb-1">Currency & Pricing</h3>
        <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-1">
          Product prices are always entered and stored in INR. USD/EUR prices are converted automatically using a
          live exchange rate — you never need to update this manually.
        </p>
        <div className="text-xs mb-4 flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              currency.ratesSource === "live" || currency.ratesSource === "cache" ? "bg-green-500" : currency.ratesSource === "stale" ? "bg-amber-500" : "bg-red-400"
            }`}
          />
          <span className="text-plum-light/70 dark:text-cream/70">
            {currency.ratesSource === "live" && "Live rate just now"}
            {currency.ratesSource === "cache" && "Live rate (cached, refreshes every 6h)"}
            {currency.ratesSource === "stale" && "Live API unreachable — using last known-good rate"}
            {currency.ratesSource === "fallback" && "Live API unreachable — using safe fallback rate"}
            {currency.ratesUpdatedAt && ` · updated ${new Date(currency.ratesUpdatedAt).toLocaleString()}`}
          </span>
          <button type="button" onClick={refreshRatesNow} disabled={refreshingRates} className="text-plum dark:text-cream underline ml-auto">
            {refreshingRates ? "Refreshing..." : "Refresh Rates Now"}
          </button>
        </div>
        <form onSubmit={saveCurrency} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-plum-dark mb-1">Default Store Currency (for new visitors)</label>
            <select
              value={currency.displayCurrency}
              onChange={(e) => setCurrency((c) => ({ ...c, displayCurrency: e.target.value }))}
              className="w-full border border-blush rounded-lg px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <p className="text-xs text-plum-light/60 dark:text-cream/60 mt-1">
              Returning visitors keep whichever currency they picked from the navbar selector, on their own device.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-plum-dark mb-2">Current live rates (1 INR = ...)</label>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {CURRENCIES.map((c) => (
                <div key={c.code} className="border border-blush rounded-lg px-3 py-2 bg-cream/30">
                  <div className="text-xs text-plum-light/70">{c.code}</div>
                  <div className="font-medium text-plum-dark">{currency.exchangeRates[c.code]}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-plum-dark mb-2">Fallback Rates (used only if the live rate can't be fetched)</label>
            <div className="grid grid-cols-2 gap-3">
              {["USD", "EUR"].map((code) => (
                <div key={code}>
                  <label className="block text-xs text-plum-light/70 mb-1">{code}</label>
                  <NumberInput
                    step="0.0001"
                    min="0.0001"
                    value={fallbackRates[code]}
                    onChange={(e) => setFallbackRates((f) => ({ ...f, [code]: e.target.value }))}
                    className="w-full border border-blush rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-plum-light/60 dark:text-cream/60 mt-2">
              Example: if 1 INR ≈ $0.012, a ₹1299 product shows as about $15.59 when USD is selected.
            </p>
          </div>

          <button disabled={savingCurrency} className="btn-primary text-sm disabled:opacity-60">
            {savingCurrency ? "Saving..." : "Save Currency Settings"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 max-w-lg">
        <h3 className="font-display text-xl text-plum dark:text-cream mb-1">Contact Section 3D Model Size</h3>
        <p className="text-xs text-plum-light/60 mb-4">
          Controls how large the interactive 3D model appears in the "We'd Love to Hear from You" section, without ever cropping it - the camera framing adjusts to always keep the full model in view.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={modelScale}
            onChange={(e) => setModelScale(Number(e.target.value))}
            onMouseUp={(e) => saveModelScale(Number(e.target.value))}
            onTouchEnd={(e) => saveModelScale(Number(e.target.value))}
            className="flex-1 accent-rose"
          />
          <span className="text-sm font-medium text-plum dark:text-cream w-12 text-right">{modelScale.toFixed(1)}x</span>
        </div>
        {savingModelScale && <p className="text-xs text-plum-light/50 mt-2">Saving...</p>}

        <div className="mt-6 pt-6 border-t border-blush">
          <h4 className="font-display text-lg text-plum dark:text-cream mb-1">3D Model Horizontal Rotation</h4>
          <p className="text-xs text-plum-light/60 mb-3">
            Sets the maximum angle the model turns toward the mouse, like a person's attention following the cursor - not a fixed rotation. At 0°
            the model always faces straight forward; at 20° it smoothly turns up to 20° either side as the mouse moves, always returning to
            front-facing when centered. Both sisters always turn together as one combined model.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={modelHRotation}
              onChange={(e) => setModelHRotation(Number(e.target.value))}
              onMouseUp={(e) => saveModelHRotation(Number(e.target.value))}
              onTouchEnd={(e) => saveModelHRotation(Number(e.target.value))}
              className="flex-1 accent-rose"
            />
            <span className="text-sm font-medium text-plum dark:text-cream w-12 text-right">{modelHRotation}°</span>
          </div>
          {savingModelHRotation && <p className="text-xs text-plum-light/50 mt-2">Saving...</p>}
        </div>

        <div className="mt-6 pt-6 border-t border-blush">
          <h4 className="font-display text-lg text-plum dark:text-cream mb-1">3D Model Vertical Rotation</h4>
          <p className="text-xs text-plum-light/60 mb-3">Tilts the model up/down slightly, without moving or resizing it.</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={modelVRotation}
              onChange={(e) => setModelVRotation(Number(e.target.value))}
              onMouseUp={(e) => saveModelVRotation(Number(e.target.value))}
              onTouchEnd={(e) => saveModelVRotation(Number(e.target.value))}
              className="flex-1 accent-rose"
            />
            <span className="text-sm font-medium text-plum dark:text-cream w-12 text-right">{modelVRotation}°</span>
          </div>
          {savingModelVRotation && <p className="text-xs text-plum-light/50 mt-2">Saving...</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 max-w-lg">
        <h3 className="font-display text-xl text-plum dark:text-cream mb-3">Grant Admin Access</h3>
        <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-4">
          Give someone (like your sister) admin access to this dashboard. They must already have a customer account —
          ask them to register on the website first with their email, then add that email here.
        </p>
        <form onSubmit={grant} className="flex gap-3">
          <input
            required
            type="email"
            placeholder="their-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-blush rounded-lg px-3 py-2 text-sm"
          />
          <button disabled={loading} className="btn-primary text-sm whitespace-nowrap disabled:opacity-60">
            {loading ? "Adding..." : "Grant Access"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 max-w-2xl">
        <h3 className="font-display text-xl text-plum dark:text-cream mb-4">Current Admins & Owner</h3>
        <div className="space-y-3">
          {staff.map((u) => (
            <div key={u._id} className="flex items-center justify-between border-b border-blush/50 pb-3">
              <div>
                <div className="font-medium text-plum-dark">{u.name} {u.role === "owner" && <span className="text-xs text-gold ml-1">(Owner)</span>}</div>
                <div className="text-xs text-plum-light/70 dark:text-cream/70">{u.email}</div>
              </div>
              {u.role !== "owner" && (
                <div className="flex gap-3 text-xs">
                  <button onClick={() => toggleActive(u._id)} className="text-plum dark:text-cream underline">
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => revoke(u._id)} className="text-rose underline">Revoke Admin</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";
import LocationPicker from "../../components/LocationPicker";
import NumberInput from "../../components/NumberInput";

const emptyTier = { maxDistanceKm: "", charge: "", estimateDaysMin: "", estimateDaysMax: "" };

export default function AdminLocation() {
  const [loading, setLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [pending, setPending] = useState(null); // { lat, lng, address }
  const [savedLocation, setSavedLocation] = useState(null);
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    api.get("/settings").then((res) => {
      setSavedLocation(res.data.businessLocation?.lat != null ? res.data.businessLocation : null);
      setTiers(
        (res.data.shippingTiers || []).map((t) => ({
          maxDistanceKm: t.maxDistanceKm ?? "",
          charge: t.charge,
          estimateDaysMin: t.estimateDaysMin,
          estimateDaysMax: t.estimateDaysMax,
        }))
      );
      setLoading(false);
    });
  }, []);

  const saveLocation = async () => {
    if (!pending) return toast.error("Select a location on the map first");
    setSavingLocation(true);
    try {
      await api.put("/settings/location", pending);
      setSavedLocation(pending);
      toast.success("Business location saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save location");
    } finally {
      setSavingLocation(false);
    }
  };

  const updateTier = (i, field, value) => {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  };

  const addTier = () => setTiers((prev) => [...prev, { ...emptyTier }]);
  const removeTier = (i) => setTiers((prev) => prev.filter((_, idx) => idx !== i));

  const saveTiers = async () => {
    setSavingShipping(true);
    try {
      const payload = tiers.map((t, i) => ({
        maxDistanceKm: i === tiers.length - 1 && t.maxDistanceKm === "" ? null : Number(t.maxDistanceKm),
        charge: Number(t.charge),
        estimateDaysMin: Number(t.estimateDaysMin),
        estimateDaysMax: Number(t.estimateDaysMax),
      }));
      await api.put("/settings/shipping", { shippingTiers: payload });
      toast.success("Shipping tiers saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save shipping tiers");
    } finally {
      setSavingShipping(false);
    }
  };

  if (loading) return <p className="text-plum-light/60 dark:text-cream/60">Loading...</p>;

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-2">Business Location & Shipping</h1>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-8 max-w-2xl">
        Your saved location is the starting point for every delivery distance calculation. Shipping charges are
        always calculated on the server from this location — customers can never change what they're charged.
      </p>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-10">
        <h2 className="font-display text-xl text-plum dark:text-cream mb-4">Admin Location Setup</h2>

        {savedLocation && (
          <div className="text-sm text-plum-dark bg-blush/20 rounded-lg px-3 py-2.5 mb-4">
            <span className="font-medium">Currently saved:</span> {savedLocation.address}
            <div className="text-xs text-plum-light/60 dark:text-cream/60 mt-1">
              Latitude: {savedLocation.lat?.toFixed(6)}, Longitude: {savedLocation.lng?.toFixed(6)}
            </div>
          </div>
        )}

        <LocationPicker
          initialPosition={savedLocation ? [savedLocation.lat, savedLocation.lng] : null}
          onChange={(lat, lng, address) => setPending({ lat, lng, address })}
        />

        <button onClick={saveLocation} disabled={savingLocation} className="btn-primary text-sm mt-4 disabled:opacity-60">
          {savingLocation ? "Saving..." : "Save Business Location"}
        </button>
      </div>

      <div className="bg-white rounded-xl2 shadow-card border border-blush p-6">
        <h2 className="font-display text-xl text-plum dark:text-cream mb-1">Distance-Based Shipping Tiers</h2>
        <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-4">
          Set the "Up to (km)" field for each tier. Leave it blank on the last row to mean "above the previous tier".
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2 text-xs text-plum-light/70 dark:text-cream/70 font-medium px-1">
            <span>Up to (km)</span><span>Charge (₹)</span><span>Min days</span><span>Max days</span><span></span>
          </div>
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <NumberInput
                placeholder={i === tiers.length - 1 ? "∞ (blank)" : "e.g. 100"}
                value={t.maxDistanceKm}
                onChange={(e) => updateTier(i, "maxDistanceKm", e.target.value)}
                className="border border-blush rounded-lg px-2 py-1.5 text-sm"
              />
              <NumberInput
                placeholder="₹"
                value={t.charge}
                onChange={(e) => updateTier(i, "charge", e.target.value)}
                className="border border-blush rounded-lg px-2 py-1.5 text-sm"
              />
              <NumberInput
                placeholder="days"
                value={t.estimateDaysMin}
                onChange={(e) => updateTier(i, "estimateDaysMin", e.target.value)}
                className="border border-blush rounded-lg px-2 py-1.5 text-sm"
              />
              <NumberInput
                placeholder="days"
                value={t.estimateDaysMax}
                onChange={(e) => updateTier(i, "estimateDaysMax", e.target.value)}
                className="border border-blush rounded-lg px-2 py-1.5 text-sm"
              />
              <button onClick={() => removeTier(i)} className="text-rose text-xs underline">Remove</button>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={addTier} className="btn-outline text-xs">+ Add Tier</button>
          <button onClick={saveTiers} disabled={savingShipping} className="btn-primary text-xs disabled:opacity-60">
            {savingShipping ? "Saving..." : "Save Shipping Tiers"}
          </button>
        </div>
      </div>
    </div>
  );
}

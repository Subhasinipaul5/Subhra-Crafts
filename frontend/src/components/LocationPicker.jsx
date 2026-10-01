import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import toast from "react-hot-toast";
import "leaflet/dist/leaflet.css";

// Pulls out ONLY the address parts that are safe to guess automatically from a map
// pin/GPS fix/search result - city, state, postcode and a neighbourhood-level landmark.
// House number and road/street are deliberately never read here, even though Nominatim
// usually returns them (as `house_number` and `road`) - those have to come from the
// customer themselves (see the callers of onChange in Checkout.jsx/Profile.jsx, which
// never touch the house/street fields with this).
function extractComponents(addr) {
  if (!addr) return {};
  return {
    city: addr.city || addr.town || addr.village || addr.municipality || addr.county || "",
    state: addr.state || "",
    pincode: addr.postcode || "",
    landmark: addr.suburb || addr.neighbourhood || addr.locality || "",
  };
}

// Leaflet's default marker icons reference image files that don't resolve correctly
// through bundlers - rebuild the icon manually from CDN-hosted assets.
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [22.5726, 88.3639]; // Kolkata, India - a reasonable fallback

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom() < 13 ? 14 : map.getZoom());
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Map-based location picker. Uses OpenStreetMap tiles (free, no API key) and the
 * Nominatim geocoding API (also free) for search and reverse-geocoding.
 *
 * Props:
 *  - initialPosition: [lat, lng] | null
 *  - onChange: (lat, lng, address, components) => void - called whenever the selection changes.
 *    `components` is { city, state, pincode, landmark } best-effort parsed from reverse
 *    geocoding - never includes house number or street/road (see extractComponents above).
 *  - currentLocationSuccessMessage: optional string toasted after "Use My Current Location"
 *    succeeds AND reverse geocoding resolves. Omit to show no toast (e.g. when this picker is
 *    just repositioning an already-complete saved address, where the extra reminder doesn't apply).
 */
export default function LocationPicker({ initialPosition, onChange, showCurrentLocationButton = true, currentLocationSuccessMessage }) {
  const [position, setPosition] = useState(initialPosition || null);
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const searchTimeout = useRef(null);

  // Returns true if reverse geocoding actually resolved an address (vs. falling back to raw
  // coordinates) - useMyCurrentLocation uses this to decide whether to show the "Location
  // detected" success toast, so it's never shown in the same breath as the error toast below.
  const reverseGeocode = async (lat, lng) => {
    setReverseLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}&zoom=16`
      );
      const data = await res.json();
      const resolved = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(resolved);
      onChange?.(lat, lng, resolved, extractComponents(data.address));
      return true;
    } catch {
      const resolved = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddress(resolved);
      onChange?.(lat, lng, resolved, {});
      toast.error("Location detected, but address details could not be retrieved. Please verify your address manually.");
      return false;
    } finally {
      setReverseLoading(false);
    }
  };

  const handleSelect = (lat, lng) => {
    setPosition([lat, lng]);
    setAccuracy(null);
    reverseGeocode(lat, lng);
    setResults([]);
  };

  // Only refreshes the human-readable "Selected Location: ..." text for an incoming
  // initialPosition (e.g. restoring a saved address, or a checkout session restored after a
  // page refresh) - deliberately does NOT call onChange. That's what stops a mount/remount from
  // ever re-triggering the city/state/pincode auto-fill and silently overwriting values the
  // customer may have since edited by hand; only an explicit new selection below (map click/drag,
  // search result, current location) goes through reverseGeocode and calls onChange.
  const refreshDisplayOnly = async (lat, lng) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
      const data = await res.json();
      setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  useEffect(() => {
    if (initialPosition && !address) {
      refreshDisplayOnly(initialPosition[0], initialPosition[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(searchTimeout.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(value)}&limit=5`
        );
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const pickResult = (r) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setPosition([lat, lng]);
    setAddress(r.display_name);
    setQuery(r.display_name);
    setResults([]);
    setAccuracy(null);
    onChange?.(lat, lng, r.display_name, extractComponents(r.address));
  };

  const useMyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("Your browser doesn't support location detection. Please search or tap the map instead.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setPosition([latitude, longitude]);
        setAccuracy(Math.round(acc));
        setLocating(false);
        reverseGeocode(latitude, longitude).then((resolved) => {
          if (resolved && currentLocationSuccessMessage) {
            toast.success(currentLocationSuccessMessage, { duration: 6000 });
          }
        });
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocateError("Location permission was denied. You can enter your address manually or search for a location.");
        } else {
          setLocateError("Unable to detect your current location. Please search for a location or enter your address manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div>
      <div className="relative mb-3">
        <input
          value={query}
          onChange={handleSearchChange}
          placeholder="🔍 Search for a location..."
          className="w-full border border-blush rounded-lg px-4 py-2.5 text-sm bg-white/80"
        />
        {searching && <span className="absolute right-3 top-2.5 text-xs text-plum-light/60 dark:text-cream/60">Searching...</span>}
        {results.length > 0 && (
          <ul className="absolute z-[1000] top-full left-0 right-0 bg-white border border-blush rounded-lg mt-1 shadow-card max-h-52 overflow-y-auto">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blush/30 border-b border-blush/40 last:border-0"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl2 overflow-hidden border border-blush" style={{ height: 320 }}>
        <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 14 : 5} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onSelect={handleSelect} />
          {position && (
            <Marker
              position={position}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  handleSelect(lat, lng);
                },
              }}
            />
          )}
          <RecenterMap position={position} />
        </MapContainer>
      </div>

      {showCurrentLocationButton && (
        <div className="mt-3">
          <button
            type="button"
            onClick={useMyCurrentLocation}
            disabled={locating}
            className="w-full sm:w-auto border border-plum dark:border-gold text-plum dark:text-gold px-4 py-2 rounded-full text-sm hover:bg-plum hover:text-cream dark:hover:bg-gold dark:hover:text-plum-dark transition-colors disabled:opacity-60"
          >
            {locating ? "Detecting your location..." : "📍 Use My Current Location"}
          </button>
          {locateError && <p className="text-xs text-rose mt-2">{locateError}</p>}
        </div>
      )}

      <p className="text-xs text-plum-light/60 dark:text-cream/60 mt-2">Click anywhere on the map, search above, or drag the pin to fine-tune.</p>

      {position && (
        <div className="mt-3 text-sm text-plum-dark dark:text-cream bg-blush/20 dark:bg-plum-light/10 rounded-lg px-3 py-2.5">
          <span className="font-medium">📍 Selected Location:</span>{" "}
          {reverseLoading ? "Looking up address..." : address}
          <div className="text-xs text-plum-light/60 dark:text-cream/60 mt-1">
            Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
            {accuracy != null && <> • Accuracy: ~{accuracy} metres</>}
          </div>
        </div>
      )}
    </div>
  );
}

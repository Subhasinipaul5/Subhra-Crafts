import { useEffect, useState } from "react";

// Ticks once a minute (not every second) - fine enough for a countdown, and avoids re-rendering
// an entire grid of sale cards 60x more often than needed. Renders nothing once the time is up -
// by the time that actually happens, the backend has already stopped returning this product as
// on-sale on its next fetch (see backend/utils/salePricing.js), so this is just a safety net for
// whatever's already on screen.
export default function SaleCountdown({ endAt, className = "" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!endAt) return null;
  const diffMs = new Date(endAt).getTime() - now;
  if (diffMs <= 0) return null;

  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / (60 * 24));
  const hours = Math.floor((diffMinutes % (60 * 24)) / 60);
  const minutes = diffMinutes % 60;

  let label;
  if (days > 0) label = `Ends in ${days}d ${hours}h`;
  else if (hours > 0) label = `Ends in ${hours}h ${minutes}m`;
  else if (minutes > 0) label = `Ends in ${minutes}m`;
  else label = "Ending soon";

  return <span className={className}>{label}</span>;
}

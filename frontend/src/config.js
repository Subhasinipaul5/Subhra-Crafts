// Single source of truth for contact destinations, per the requirement to keep these
// configurable in one place instead of hardcoded across multiple components.
export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "910000000000";

// Preferred handle first, per the business's request; change here if it ever needs to move.
export const INSTAGRAM_HANDLE = import.meta.env.VITE_INSTAGRAM_HANDLE || "subhra.crafts_designs";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export function buildWhatsAppUrl(message) {
  const text = encodeURIComponent(message || "Hello SubhRa Crafts! I would like to know more about your products/orders.");
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

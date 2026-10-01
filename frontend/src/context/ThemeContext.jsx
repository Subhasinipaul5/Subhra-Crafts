import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const ThemeContext = createContext(null);

// Every theme is a complete, self-contained light palette (background tones stay pale,
// "plum" stays a deep saturated tone used for text-on-light and as a solid button/header
// background with light text on top). This single-axis design is deliberate: an earlier
// version layered an independent light/dark brightness toggle on top of these tokens, which
// caused real contrast bugs (dark text landing on a near-black background). Keeping every
// theme "light" avoids that whole class of bug while still giving 9 visually distinct moods.
export const COLOR_THEMES = [
  { id: "default", name: "SubhRa Classic", emoji: "💗", colors: ["#4A2140", "#D98FA3", "#C6A05C", "#FBF6EF"] },
  { id: "rose-bloom", name: "Rose Bloom", emoji: "🌸", colors: ["#6B1F3E", "#E0678F", "#C48A5E", "#FDF2F5"] },
  { id: "purple-dream", name: "Purple Dream", emoji: "💜", colors: ["#452C6B", "#A97BC7", "#A98A5A", "#F8F4FC"] },
  { id: "sunset-glow", name: "Sunset Glow", emoji: "🌅", colors: ["#7A2F17", "#F26B4E", "#E0954A", "#FFF6F0"] },
  { id: "ocean-breeze", name: "Ocean Breeze", emoji: "🌊", colors: ["#0B4759", "#2E9DB3", "#4FA8C9", "#EFFAFC"] },
  { id: "mint-garden", name: "Mint Garden", emoji: "🌿", colors: ["#1B5C3C", "#3FA871", "#7FB878", "#F1FAF4"] },
  { id: "blueberry", name: "Blueberry", emoji: "💙", colors: ["#232F63", "#5468C7", "#6B7FD1", "#F2F4FC"] },
  { id: "autumn", name: "Autumn", emoji: "🍂", colors: ["#4A2C14", "#B36A2E", "#C4842A", "#FBF4EC"] },
  { id: "midnight", name: "Midnight", emoji: "🌌", colors: ["#1B1440", "#4C3F9E", "#6F63C9", "#F2F1FA"] },
  // 5 new blended multi-color gradient themes
  { id: "lavender-bloom", name: "Lavender Bloom", emoji: "💐", colors: ["#4E2E7A", "#C98FD6", "#E8A8C4", "#FAF6FD"] },
  { id: "rose-sunset", name: "Rose Sunset", emoji: "🌇", colors: ["#7A1F42", "#E85D8A", "#F0955A", "#FFF5F3"] },
  { id: "ocean-dream", name: "Ocean Dream", emoji: "🌌", colors: ["#0E3D6B", "#3A8FC7", "#6FC6C0", "#EEFAFB"] },
  { id: "meadow-glow", name: "Meadow Glow", emoji: "🌼", colors: ["#2C4A1E", "#5FA85A", "#D4C25A", "#F7FBEF"] },
  { id: "berry-dream", name: "Berry Dream", emoji: "🫐", colors: ["#3A1B5E", "#9B4FC7", "#7B6FE0", "#F8F4FD"] },
];

// Theme choice is now restricted to Rose Sunset everywhere - customer site and admin panel
// alike (see Navbar.jsx, where the customer-facing picker was removed); the multi-theme system
// underneath is intentionally kept intact rather than deleted, since the admin panel's own
// ThemeToggle (see AdminLayout.jsx) still renders it. CUSTOMER_THEME_ID is the one theme every
// visitor - customer, admin, or owner - now always sees, regardless of any theme picked or
// stored on the account before this change.
export const CUSTOMER_THEME_ID = "rose-sunset";

export function ThemeProvider({ children }) {
  const [colorTheme, setColorThemeState] = useState(() => {
    const stored = localStorage.getItem("sr_color_theme");
    if (!stored || stored === CUSTOMER_THEME_ID) return stored || CUSTOMER_THEME_ID;
    // A non-Rose-Sunset value already saved in this browser from before the customer-facing
    // picker was removed. Normalized back to Rose Sunset right here at load for everyone -
    // admin/owner accounts included - so the admin panel always opens with the same rose pink
    // background as the customer site instead of whatever theme (e.g. a blue one) was last
    // picked/stored, instead of flashing the old theme and only correcting on next login.
    return CUSTOMER_THEME_ID;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", colorTheme);
    localStorage.setItem("sr_color_theme", colorTheme);
  }, [colorTheme]);

  // persistToAccount=false is used when we're just applying the user's already-saved
  // preference on login, so we don't immediately re-save it back to itself.
  const setColorTheme = (id, { persistToAccount = true } = {}) => {
    setColorThemeState(id);
    if (persistToAccount) {
      api.put("/auth/me", { themePreference: id }).catch(() => {
        // not logged in, or request failed - localStorage still keeps it for this device
      });
    }
  };

  // Called on login/session-restore with whatever theme is saved on the account (see
  // AuthContext.jsx). Every account - customer, admin, and owner alike - now stays on the one
  // Rose Sunset background, so a stored themePreference (e.g. a staff account left on a blue
  // theme) is never re-applied here; this is what keeps the admin panel's background matching
  // the customer site's rose pink instead of reverting on every login/refresh.
  const applyUserThemePreference = () => {};

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme, applyUserThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

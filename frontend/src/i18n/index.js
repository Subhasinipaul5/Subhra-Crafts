import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US.json";

// Language switching has been removed site-wide (customer + admin) - the store is English-only
// now. react-i18next / the t() calls sprinkled through the storefront components are kept as-is
// (removing every t() call would mean touching many unrelated components for no visible
// benefit), but only the English resource is loaded and there is no way to change it anymore.
const DEFAULT_LANGUAGE = "en-US";

i18n.use(initReactI18next).init({
  resources: {
    "en-US": { translation: enUS },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export const ADMIN_LANGUAGE = DEFAULT_LANGUAGE;

export default i18n;

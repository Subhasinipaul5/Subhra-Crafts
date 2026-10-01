import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api from "../api/client";

// FEATURE 1 (currency) - every price everywhere (products, cart, checkout, WhatsApp messages,
// order history) is stored in the database in INR. This context is the ONE place that knows:
//   - the live INR->USD/EUR rate (fetched server-side, see backend/utils/exchangeRates.js,
//     which itself falls back safely if the live API is briefly unreachable)
//   - which currency THIS visitor picked (persisted in localStorage so it survives navigating
//     around the site and reloading the page, without needing an account)
// Nothing else in the app should hardcode a currency symbol.
const SYMBOLS = { INR: "₹", USD: "$", EUR: "€" };
const LOCALES = { INR: "en-IN", USD: "en-US", EUR: "de-DE" };
const STORAGE_KEY = "sr_currency";

const defaultCurrency = {
  baseCurrency: "INR",
  displayCurrency: "INR",
  exchangeRates: { INR: 1, USD: 0.012, EUR: 0.011 },
  ratesSource: "fallback",
  ratesUpdatedAt: null,
};

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [loaded, setLoaded] = useState(false);
  // The visitor's own choice, once made, always wins over the admin's site-wide default.
  const [userChoice, setUserChoice] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  const refresh = useCallback(() => {
    api
      .get("/settings")
      .then((res) => {
        if (res.data?.currency) setCurrency(res.data.currency);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    // Live rates move slowly - a periodic background refresh keeps a long-open tab accurate
    // without the visitor having to reload.
    const interval = setInterval(refresh, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const setDisplayCurrency = (code) => {
    if (!SYMBOLS[code]) return;
    localStorage.setItem(STORAGE_KEY, code);
    setUserChoice(code);
  };

  const displayCurrency = userChoice || currency.displayCurrency || "INR";
  const rate = currency.exchangeRates?.[displayCurrency] || 1;
  const symbol = SYMBOLS[displayCurrency] || "₹";

  // Converts an amount stored in INR into the visitor's selected display currency.
  const convert = (inrAmount) => (Number(inrAmount) || 0) * rate;

  // Converts AND formats for display, e.g. formatPrice(1299) -> "₹1,299" or "$15.59".
  const formatPrice = (inrAmount) => {
    const converted = convert(inrAmount);
    const decimals = displayCurrency === "INR" ? 0 : 2;
    const formatted = converted.toLocaleString(LOCALES[displayCurrency] || "en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol}${formatted}`;
  };

  const value = useMemo(
    () => ({
      currency,
      displayCurrency,
      symbol,
      rate,
      convert,
      formatPrice,
      setDisplayCurrency,
      supportedCurrencies: ["INR", "USD", "EUR"],
      loaded,
      refreshCurrency: refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency, displayCurrency, loaded]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

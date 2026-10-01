import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { CurrencyProvider } from "./context/CurrencyContext.jsx";
import "./i18n"; // must run before anything renders, so i18next is initialized synchronously
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CurrencyProvider>
            <NotificationProvider>
              <CartProvider>
                <ErrorBoundary>
                  <App />
                </ErrorBoundary>
                <Toaster position="top-center" toastOptions={{ style: { fontFamily: "Poppins, sans-serif" } }} />
              </CartProvider>
            </NotificationProvider>
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

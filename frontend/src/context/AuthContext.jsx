import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";
import { useTheme } from "./ThemeContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("sr_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const { applyUserThemePreference } = useTheme();

  useEffect(() => {
    // Customer-facing theme choice was removed (see ThemeContext.jsx / Navbar.jsx) - only a
    // staff/owner account's saved themePreference is still honored here, so this restore never
    // re-introduces a non-Rose-Sunset theme for an ordinary customer's account that may still
    // carry one from before that change.
    const isStaffAccount = user?.role === "admin" || user?.role === "owner";
    if (user?.themePreference) applyUserThemePreference(user.themePreference, { allowNonCustomerTheme: isStaffAccount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.themePreference, user?.role]);

  useEffect(() => {
    const token = localStorage.getItem("sr_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("sr_user", JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem("sr_token");
        localStorage.removeItem("sr_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("sr_token", res.data.token);
    localStorage.setItem("sr_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("sr_token", res.data.token);
    localStorage.setItem("sr_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("sr_token");
    localStorage.removeItem("sr_user");
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    localStorage.setItem("sr_user", JSON.stringify(res.data));
  };

  // Used after a successful password reset, which already returns a fresh token+user -
  // avoids a redundant second login call.
  const setSession = (token, sessionUser) => {
    localStorage.setItem("sr_token", token);
    localStorage.setItem("sr_user", JSON.stringify(sessionUser));
    setUser(sessionUser);
  };

  const isStaff = user && (user.role === "admin" || user.role === "owner");
  const isOwner = user && user.role === "owner";

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setSession, isStaff, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

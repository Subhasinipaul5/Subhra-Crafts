import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isStaff } = useAuth();
  const [counts, setCounts] = useState({ orders: 0, customOrders: 0, reviews: 0 });

  const refresh = useCallback(() => {
    if (!isStaff) return;
    api
      .get("/dashboard/notifications")
      .then((res) => setCounts(res.data))
      .catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    refresh();
    const interval = setInterval(refresh, 30000); // keep badges reasonably fresh
    return () => clearInterval(interval);
  }, [isStaff, refresh]);

  return <NotificationContext.Provider value={{ counts, refresh }}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);

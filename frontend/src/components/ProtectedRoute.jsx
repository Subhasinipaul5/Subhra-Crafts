import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function RequireStaff({ children }) {
  const { user, loading, isStaff } = useAuth();
  if (loading) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading...</div>;
  if (!user || !isStaff) return <Navigate to="/login" replace />;
  return children;
}

export function RequireOwner({ children }) {
  const { user, loading, isOwner } = useAuth();
  if (loading) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading...</div>;
  if (!user || !isOwner) return <Navigate to="/admin" replace />;
  return children;
}

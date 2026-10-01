import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import SectionHeading from "../components/SectionHeading";
import LoginBubbles from "../components/LoginBubbles";
import AnimatedDoodles from "../components/AnimatedDoodles";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(t("auth.loginSuccess"));
      const dest = location.state?.from || (user.role === "owner" || user.role === "admin" ? "/admin" : "/");
      navigate(dest);
    } catch (err) {
      toast.error(err.response?.data?.message || t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden py-20">
      <LoginBubbles />
      <AnimatedDoodles variant="loginSides" />
      <div className="relative max-w-md mx-auto px-6">
        <SectionHeading eyebrow={t("auth.welcomeBack")} title={t("auth.login")} />
        <form onSubmit={handleSubmit} className="card p-8 space-y-4">
          <input
            type="email"
            required
            placeholder={t("auth.email")}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
          />
          <input
            type="password"
            required
            placeholder={t("auth.password")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
          />
          <div className="text-right -mt-2">
            <Link to="/forgot-password" className="text-xs text-rose hover:underline">{t("auth.forgotPassword")}</Link>
          </div>
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? t("common.loading") : t("auth.login")}
          </button>
        </form>
        <p className="text-center text-sm text-plum-light/70 dark:text-cream/70 mt-4">
          {t("auth.dontHaveAccount")} <Link to="/register" className="text-rose">{t("auth.register")}</Link>
        </p>
      </div>
    </div>
  );
}

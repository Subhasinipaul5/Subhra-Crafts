import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import SectionHeading from "../components/SectionHeading";
import LoginBubbles from "../components/LoginBubbles";
import AnimatedDoodles from "../components/AnimatedDoodles";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created! Welcome to SubhRa Crafts.");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden py-20">
      {/* Same decorative treatment as Login (LoginBubbles + AnimatedDoodles "loginSides") -
          this page has the identical narrow centered-form shape, so the exact same safe
          margins apply without any adjustment. */}
      <LoginBubbles />
      <AnimatedDoodles variant="loginSides" />
      <div className="relative max-w-md mx-auto px-6">
        <SectionHeading eyebrow="Join Us" title="Create Account" />
        <form onSubmit={handleSubmit} className="card p-8 space-y-4">
          <input required placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input placeholder="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input required type="password" placeholder="Password (min. 6 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
        <p className="text-center text-sm text-plum-light/70 dark:text-cream/70 mt-4">
          Already have an account? <Link to="/login" className="text-rose">Log In</Link>
        </p>
      </div>
    </div>
  );
}

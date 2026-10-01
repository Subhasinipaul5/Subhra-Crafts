import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import SectionHeading from "../components/SectionHeading";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/auth/reset-password/${token}`, { password });
      setSession(res.data.token, res.data.user);
      setDone(true);
      toast.success("Password reset successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "This password reset link is invalid or has expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <SectionHeading eyebrow="All Set" title="Password Reset Successfully" />
        <p className="text-plum-light/80 mb-6">You're logged in with your new password.</p>
        <button onClick={() => navigate("/")} className="btn-primary">Continue to SubhRa Crafts</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <SectionHeading eyebrow="Almost There" title="Reset Password" />
      <form onSubmit={handleSubmit} className="card p-8 space-y-4">
        <input
          type="password"
          required
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
        />
        <input
          type="password"
          required
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
        />
        {error && (
          <p className="text-sm text-rose">
            {error} {error.includes("expired") && <Link to="/forgot-password" className="underline">Request a new one</Link>}
          </p>
        )}
        <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <SectionHeading eyebrow="Check Your Inbox" title="Reset Link Sent" />
        <p className="text-plum-light/80">
          If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          It expires in 1 hour.
        </p>
        <Link to="/login" className="btn-primary inline-block mt-6">Back to Login</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <SectionHeading eyebrow="Reset Access" title="Forgot Password?" subtitle="Enter your registered email address and we'll send you a password reset link." />
      <form onSubmit={handleSubmit} className="card p-8 space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70"
        />
        <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
      <p className="text-center text-sm text-plum-light/70 mt-4">
        <Link to="/login" className="text-rose">Back to Login</Link>
      </p>
    </div>
  );
}

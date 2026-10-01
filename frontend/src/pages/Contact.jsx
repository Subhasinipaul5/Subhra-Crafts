import { useState } from "react";
import toast from "react-hot-toast";
import SectionHeading from "../components/SectionHeading";
import { INSTAGRAM_URL, buildWhatsAppUrl } from "../config";
import LeafDoodles from "../components/LeafDoodles";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    const msg = `Hello SubhRa Crafts! ${form.message}\n- ${form.name} (${form.email})`;
    window.open(buildWhatsAppUrl(msg), "_blank");
    toast.success("Opening WhatsApp...");
  };

  return (
    <div className="relative max-w-2xl mx-auto px-6 py-20">
      <LeafDoodles />
      <SectionHeading eyebrow="Get in Touch" title="Have an idea in mind? Let's create it together." />
      <div className="grid sm:grid-cols-3 gap-4 text-center text-sm mb-12">
        <a href={buildWhatsAppUrl()} target="_blank" rel="noreferrer" className="card p-5">
          <div className="text-2xl mb-2">💬</div>WhatsApp
        </a>
        <a href="mailto:paulsubhasini31@gmail.com" className="card p-5">
          <div className="text-2xl mb-2">✉️</div>Email
        </a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="card p-5">
          <div className="text-2xl mb-2">📸</div>Instagram
        </a>
      </div>
      <form onSubmit={handleSubmit} className="card p-8 space-y-4">
        <input required placeholder="Your Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <input required type="email" placeholder="Your Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <textarea required rows={4} placeholder="Your Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <button className="btn-primary w-full">Send via WhatsApp</button>
      </form>
    </div>
  );
}

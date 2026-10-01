import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import LeafDoodles from "../components/LeafDoodles";
import NumberInput from "../components/NumberInput";

export default function CustomOrder() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    productType: "",
    preferredColor: "",
    preferredDesign: "",
    size: "",
    quantity: 1,
    budget: "",
    additionalRequirements: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(false);
  const [referenceImage, setReferenceImage] = useState(null); // { url, publicId }
  const [uploading, setUploading] = useState(false);

  const handleChange = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("images", file);
      const res = await api.post("/upload/personal", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setReferenceImage(res.data.images[0]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, referenceImages: referenceImage ? [referenceImage.url] : [] };
      const res = await api.post("/custom-orders", payload);
      setSubmitted(res.data);
      toast.success("Custom order request sent!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <SectionHeading eyebrow="Thank You" title="Request Received" />
        <p className="text-plum-light/80 dark:text-cream/80 mb-2">Your custom order request has been submitted.</p>
        <p className="font-display text-2xl text-plum dark:text-cream">#{submitted.customOrderNumber}</p>
        <p className="text-sm text-plum-light/70 dark:text-cream/70 mt-4">We'll reach out to you soon to discuss the details.</p>
      </div>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto px-6 py-14">
      <LeafDoodles />
      <SectionHeading eyebrow="Made For You" title="Request a Custom Order" subtitle="Have an idea in mind? Let's create it together." />
      <form onSubmit={handleSubmit} className="card p-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input required placeholder="Your Name" value={form.name} onChange={handleChange("name")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input required placeholder="Phone" value={form.phone} onChange={handleChange("phone")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
        </div>
        <input required type="email" placeholder="Email" value={form.email} onChange={handleChange("email")} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <input required placeholder="Product Type (e.g. earrings, keychain)" value={form.productType} onChange={handleChange("productType")} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input placeholder="Preferred Color" value={form.preferredColor} onChange={handleChange("preferredColor")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input placeholder="Preferred Design" value={form.preferredDesign} onChange={handleChange("preferredDesign")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input placeholder="Size" value={form.size} onChange={handleChange("size")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <NumberInput min="1" placeholder="Quantity" value={form.quantity} onChange={handleChange("quantity")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
          <input placeholder="Budget" value={form.budget} onChange={handleChange("budget")} className="border border-blush rounded-lg px-4 py-3 bg-white/70" />
        </div>
        <textarea placeholder="Additional Requirements" value={form.additionalRequirements} onChange={handleChange("additionalRequirements")} rows={3} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />
        <textarea placeholder="Message" value={form.message} onChange={handleChange("message")} rows={3} className="w-full border border-blush rounded-lg px-4 py-3 bg-white/70" />

        <div>
          <label className="text-sm font-medium text-plum-dark block mb-2">Reference Image</label>
          <p className="text-xs text-plum-light/70 dark:text-cream/70 mb-3">
            Have a photo of something similar in mind? Upload it and we'll use it as inspiration.
          </p>
          {!referenceImage ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blush rounded-xl2 py-10 cursor-pointer hover:bg-blush/10 transition-colors">
              <span className="text-3xl">📷</span>
              <span className="text-sm text-plum-dark">{uploading ? "Uploading..." : "Choose Reference Image"}</span>
              <span className="text-xs text-plum-light/60 dark:text-cream/60">JPG, PNG, or WEBP</span>
              <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageSelect} className="hidden" disabled={uploading} />
            </label>
          ) : (
            <div className="relative rounded-xl2 overflow-hidden border border-blush bg-ivory">
              <img src={referenceImage.url} alt="Reference" className="w-full max-h-80 object-contain" />
              <div className="flex gap-3 p-3 border-t border-blush bg-white/70">
                <label className="text-xs text-plum dark:text-cream underline cursor-pointer">
                  Change Image
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageSelect} className="hidden" disabled={uploading} />
                </label>
                <button type="button" onClick={() => setReferenceImage(null)} className="text-xs text-rose underline">Remove</button>
              </div>
            </div>
          )}
        </div>

        <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
          {loading ? "Sending..." : "Request Custom Order"}
        </button>
      </form>
    </div>
  );
}

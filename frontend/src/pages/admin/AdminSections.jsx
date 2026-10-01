import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/client";

const emptyForm = { title: "", description: "", products: [], displayLocation: ["homepage"], active: true, order: 0 };

export default function AdminSections() {
  const [sections, setSections] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = () => api.get("/sections?all=true").then((res) => setSections(res.data));
  useEffect(() => {
    load();
    api.get("/products/admin/all").then((res) => setAllProducts(res.data));
  }, []);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ ...s, products: s.products.map((p) => p._id) }); setEditingId(s._id); setShowForm(true); };

  const toggleProduct = (id) => {
    setForm((f) => ({
      ...f,
      products: f.products.includes(id) ? f.products.filter((p) => p !== id) : [...f.products, id],
    }));
  };

  // Section product display order is simply this array's order (Home.jsx and the collection
  // page render `section.products` in the order the backend returns them, which is the order
  // stored here) - so reordering the list IS reordering the storefront section.
  const moveProduct = (id, direction) => {
    setForm((f) => {
      const idx = f.products.indexOf(id);
      const swapWith = idx + direction;
      if (idx === -1 || swapWith < 0 || swapWith >= f.products.length) return f;
      const next = [...f.products];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...f, products: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/sections/${editingId}`, form);
        toast.success("Section updated");
      } else {
        await api.post("/sections", form);
        toast.success("Section created");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save section");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this section?")) return;
    await api.delete(`/sections/${id}`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-plum dark:text-cream">Website Sections</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ New Section</button>
      </div>
      <p className="text-sm text-plum-light/70 dark:text-cream/70 mb-6">Build custom homepage collections like "Festive Collection" or "Under ₹499" without touching any code.</p>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl2 shadow-card border border-blush p-6 mb-8 space-y-3">
          <h3 className="font-display text-xl text-plum dark:text-cream mb-2">{editingId ? "Edit Section" : "New Section"}</h3>
          <input required placeholder="Section Title (e.g. Festive Resin Collection)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-blush rounded-lg px-3 py-2" />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-blush rounded-lg px-3 py-2" />
          <div>
            <div className="text-sm font-medium text-plum-dark mb-2">Select Products</div>
            <div className="max-h-48 overflow-y-auto border border-blush rounded-lg p-3 grid sm:grid-cols-2 gap-2">
              {allProducts.map((p) => (
                <label key={p._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.products.includes(p._id)} onChange={() => toggleProduct(p._id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          {form.products.length > 0 && (
            <div>
              <div className="text-sm font-medium text-plum-dark mb-2">Product Order (shown left-to-right on the storefront)</div>
              <div className="border border-blush rounded-lg divide-y divide-blush/60">
                {form.products.map((id, i) => {
                  const p = allProducts.find((ap) => ap._id === id);
                  return (
                    <div key={id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span>{i + 1}. {p?.name || "(product)"}</span>
                      <span className="flex gap-2">
                        <button type="button" disabled={i === 0} onClick={() => moveProduct(id, -1)} className="disabled:opacity-30 text-plum dark:text-cream">↑</button>
                        <button type="button" disabled={i === form.products.length - 1} onClick={() => moveProduct(id, 1)} className="disabled:opacity-30 text-plum dark:text-cream">↓</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline text-sm">Cancel</button>
            <button className="btn-primary text-sm">{editingId ? "Save Changes" : "Create Section"}</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s._id} className="bg-white rounded-xl2 shadow-card border border-blush p-4 flex justify-between items-center">
            <div>
              <div className="font-medium text-plum-dark">{s.title} {!s.active && <span className="text-xs text-plum-light/50 dark:text-cream/50">(inactive)</span>}</div>
              <div className="text-xs text-plum-light/70 dark:text-cream/70">{s.products.length} product(s)</div>
            </div>
            <div className="space-x-3 text-sm">
              <button onClick={() => openEdit(s)} className="text-plum dark:text-cream underline">Edit</button>
              <button onClick={() => remove(s._id)} className="text-rose underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

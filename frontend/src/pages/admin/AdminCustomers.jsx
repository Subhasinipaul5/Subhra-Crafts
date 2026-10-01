import { useEffect, useState } from "react";
import api from "../../api/client";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api.get("/admin/users?role=customer").then((res) => setCustomers(res.data));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl text-plum dark:text-cream mb-6">Customers</h1>
      <div className="bg-white rounded-xl2 shadow-card border border-blush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-plum-light/70 dark:text-cream/70 border-b border-blush">
              <th className="p-3">Name</th><th>Email</th><th>Phone</th><th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id} className="border-b border-blush/50">
                <td className="p-3 flex items-center gap-2">
                  <img src={c.profileImage?.url || "https://api.dicebear.com/7.x/initials/svg?seed=" + c.name} alt="" className="w-8 h-8 rounded-full object-cover" />
                  {c.name}
                </td>
                <td>{c.email}</td>
                <td>{c.phone || "-"}</td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

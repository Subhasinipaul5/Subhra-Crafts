import { useEffect, useState } from "react";
import { useCurrency } from "../context/CurrencyContext";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import LeafDoodles from "../components/LeafDoodles";

const STATUS_LABELS = {
  requested: "Requested",
  under_discussion: "Under Discussion",
  price_proposed: "Price Proposed",
  accepted: "Accepted",
  rejected: "Rejected",
  in_production: "In Production",
  shipped: "Shipped",
  delivered: "Delivered",
};

export default function MyCustomOrders() {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api.get("/custom-orders/mine").then((res) => setOrders(res.data));
  }, []);

  return (
    <div className="relative max-w-3xl mx-auto px-6 py-14">
      <LeafDoodles />
      <SectionHeading eyebrow="Your Requests" title="My Custom Orders" />
      {orders.length === 0 && <p className="text-center text-plum-light/60 dark:text-cream/60">No custom order requests yet.</p>}
      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o._id} className="card p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-plum-dark">#{o.customOrderNumber} — {o.productType}</div>
                <div className="text-xs text-plum-light/70 dark:text-cream/70">{new Date(o.createdAt).toLocaleDateString()}</div>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-blush/50 text-plum dark:text-cream">{STATUS_LABELS[o.status]}</span>
            </div>
            {(o.proposedPrice || o.shippingCharge) && (
              <div className="text-sm text-plum-dark mt-2 space-y-0.5">
                {o.proposedPrice && <p>Proposed Price: {formatPrice(o.proposedPrice)}</p>}
                {o.shippingCharge > 0 && <p>Shipping Charge: {formatPrice(o.shippingCharge)}</p>}
                {o.proposedPrice && (
                  <p className="font-medium">Total: {formatPrice(o.proposedPrice + (o.shippingCharge || 0))}</p>
                )}
              </div>
            )}
            {o.estimatedDelivery && <p className="text-sm text-plum-dark">Expected Completion: {new Date(o.estimatedDelivery).toLocaleDateString()}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

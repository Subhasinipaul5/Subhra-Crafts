import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import WriteReviewForm from "../components/WriteReviewForm";
import placeholder from "../assets/placeholder.svg";
import { useCurrency } from "../context/CurrencyContext";
import LeafDoodles from "../components/LeafDoodles";

const STEPS = ["pending", "confirmed", "preparing", "shipped", "out_for_delivery", "delivered"];
const LABELS = {
  pending: "Order Placed",
  confirmed: "Payment Confirmed",
  preparing: "Handmade / Preparing",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

export default function OrderTracking() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    api.get(`/orders/${id}`).then((res) => setOrder(res.data));
  }, [id]);

  if (!order) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading order...</div>;

  const currentIndex = order.orderStatus === "cancelled" ? -1 : STEPS.indexOf(order.orderStatus);

  return (
    <div className="relative max-w-3xl mx-auto px-6 py-14">
      <LeafDoodles />
      <SectionHeading eyebrow={`Order #${order.orderNumber}`} title="Order Tracking" />

      {order.orderStatus === "cancelled" ? (
        <p className="text-center text-rose">This order has been cancelled.</p>
      ) : (
        <div className="card p-8 mb-10">
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    i <= currentIndex ? "bg-plum text-cream" : "border border-blush text-plum-light/50 dark:text-cream/50"
                  }`}
                >
                  {i <= currentIndex ? "✓" : "○"}
                </span>
                <span className={i <= currentIndex ? "text-plum-dark font-medium" : "text-plum-light/50 dark:text-cream/50"}>{LABELS[s]}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card p-6 space-y-2 text-sm text-plum-dark mb-6">
        <div className="flex justify-between"><span>Order Date</span><span>{new Date(order.createdAt).toLocaleDateString()}</span></div>
        {order.deliveryDistanceKm != null && <div className="flex justify-between"><span>Delivery Distance</span><span>{order.deliveryDistanceKm} km</span></div>}
        {order.preferredDeliveryDate && <div className="flex justify-between"><span>Preferred Delivery Date</span><span>{new Date(order.preferredDeliveryDate).toLocaleDateString()}</span></div>}
        {order.estimatedDeliveryMin && order.estimatedDeliveryMax && (
          <div className="flex justify-between"><span>Estimated Delivery Window</span><span>{new Date(order.estimatedDeliveryMin).toLocaleDateString()} – {new Date(order.estimatedDeliveryMax).toLocaleDateString()}</span></div>
        )}
        {order.expectedDelivery && <div className="flex justify-between"><span>Expected Delivery</span><span>{new Date(order.expectedDelivery).toLocaleDateString()}</span></div>}
        {order.courier && <div className="flex justify-between"><span>Courier</span><span>{order.courier}</span></div>}
        {order.trackingNumber && <div className="flex justify-between"><span>Tracking Number</span><span>{order.trackingNumber}</span></div>}
        <div className="flex justify-between"><span>Payment</span><span className="capitalize">{order.paymentMethod} • {order.paymentStatus}</span></div>
        {order.shippingAddress && (
          // House / Flat No. is optional, so it's skipped cleanly (no stray leading comma) for
          // orders placed without one.
          <div className="flex justify-between">
            <span>Shipping To</span>
            <span className="text-right">
              {[order.shippingAddress.house, order.shippingAddress.street, order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(", ")} - {order.shippingAddress.pincode}
            </span>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h4 className="font-display text-lg text-plum dark:text-cream mb-4">Items</h4>
        <div className="space-y-3">
          {order.items.map((it, i) => (
            <div key={i} className="flex items-center gap-3">
              <img src={it.image || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt={it.name} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 text-sm text-plum-dark">{it.name} × {it.quantity}</div>
              <div className="text-sm text-plum-dark">{formatPrice(it.price * it.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-display text-lg text-plum dark:text-cream pt-4 mt-4 border-t border-blush">
          <span>Total</span><span>{formatPrice(order.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-xs text-plum-light/60 dark:text-cream/60 mt-1">
          <span>Items: {formatPrice(order.itemsTotal)}</span><span>Shipping: {formatPrice(order.shippingFee)}</span>
        </div>
      </div>

      {order.orderStatus === "delivered" && (
        <div className="mt-10">
          <h4 className="font-display text-lg text-plum dark:text-cream mb-4">Rate & Review Your Order</h4>
          <div className="space-y-4">
            {order.items.map((it, i) => (
              <WriteReviewForm key={i} orderId={order._id} item={it} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

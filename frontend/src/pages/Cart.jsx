import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import SectionHeading from "../components/SectionHeading";
import placeholder from "../assets/placeholder.svg";
import LeafDoodles from "../components/LeafDoodles";
import LoginBubbles from "../components/LoginBubbles";
import AnimatedDoodles from "../components/AnimatedDoodles";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, subtotal } = useCart();
  const { formatPrice } = useCurrency();

  if (items.length === 0) {
    return (
      <div className="relative overflow-hidden max-w-3xl mx-auto px-6 py-24 text-center">
        <LoginBubbles />
        <AnimatedDoodles variant="loginSides" />
        <div className="relative">
          <SectionHeading eyebrow="Your Bag" title="Your Cart is Empty" />
          <Link to="/shop" className="btn-primary">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto px-6 py-14">
      <LoginBubbles variant="compact" />
      <LeafDoodles />
      <SectionHeading eyebrow="Your Bag" title="Shopping Cart" />
      <div className="grid lg:grid-cols-[1fr_320px] gap-10">
        <div className="space-y-4">
          {items.map((i) => (
            <div key={i.cartKey} className="card flex flex-wrap sm:flex-nowrap items-center gap-4 p-4">
              <img src={i.image || placeholder} onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }} alt={i.name} className="w-20 h-20 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <Link to={`/product/${i.slug}`} className="font-body text-sm text-plum-dark">{i.name}</Link>
                {i.colorName && (
                  <div className="text-xs text-plum-light/70 dark:text-cream/60 mt-0.5">Color: {i.colorName}</div>
                )}
                <div className="text-plum dark:text-cream font-display text-lg">{formatPrice(i.price)}</div>
              </div>
              {/* On mobile this group wraps onto its own full-width row below the image/name
                  instead of squeezing into the same row (which is what was clipping/overlapping
                  the price and stepper on narrow screens) - sm: and up restores the original
                  single-row layout unchanged. */}
              <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                <div className="flex items-center border border-blush rounded-full shrink-0">
                  <button onClick={() => updateQuantity(i.cartKey, i.quantity - 1)} className="px-3 py-1 text-plum dark:text-cream">-</button>
                  <span className="px-3">{i.quantity}</span>
                  <button onClick={() => updateQuantity(i.cartKey, Math.min(i.maxStock, i.quantity + 1))} className="px-3 py-1 text-plum dark:text-cream">+</button>
                </div>
                <div className="text-right font-body text-sm text-plum-dark shrink-0">{formatPrice(i.price * i.quantity)}</div>
                <button onClick={() => removeFromCart(i.cartKey)} className="text-rose text-sm shrink-0">Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-6 h-fit">
          <h3 className="font-display text-xl text-plum dark:text-cream mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm text-plum-dark">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between text-plum-light/60 dark:text-cream/60"><span>Shipping</span><span>Calculated at checkout</span></div>
            <p className="text-xs text-plum-light/60 dark:text-cream/60 pt-1">
              Shipping is calculated based on your delivery distance in the next step.
            </p>
          </div>
          <Link to="/checkout" className="btn-primary w-full text-center block mt-6">Proceed to Checkout</Link>
          <Link to="/shop" className="btn-outline w-full text-center block mt-3">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}

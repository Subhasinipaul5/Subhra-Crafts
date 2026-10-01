import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import api from "../api/client";
import toast from "react-hot-toast";
import ImageCarousel from "./ImageCarousel";
import SaleCountdown from "./SaleCountdown";
import { getCardPricing, getDefaultVariant, getDisplayProduct, hasVariants } from "../utils/variants";
import { track } from "../lib/analytics";

export default function ProductCard({ product, onNavigate }) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const [wished, setWished] = useState(false);
  // CRITICAL: starts at null on purpose. The card's own default showcase image
  // (product.images) is what shows on first load - NOT any variant's image, even though a
  // "first/default variant" technically exists. A variant's image only ever appears after the
  // customer explicitly clicks its swatch.
  const [clickedVariant, setClickedVariant] = useState(null);

  const { price, discountPrice, fromMultiple } = getCardPricing(product);
  const variantDisplay = clickedVariant ? getDisplayProduct(product, clickedVariant) : null;
  const cardImages = variantDisplay?.images?.length ? variantDisplay.images : product.images;
  const displayPrice = clickedVariant ? variantDisplay.price : price;
  const displayDiscountPrice = clickedVariant ? variantDisplay.discountPrice : discountPrice;
  const hasDiscount = displayDiscountPrice && displayDiscountPrice < displayPrice;
  const outOfStock = hasVariants(product) ? product.variants.every((v) => v.stock <= 0) : product.stock <= 0;
  const rating = product.effectiveRating ?? product.ratingAverage ?? 0;
  const reviewCount = product.effectiveReviewCount ?? product.ratingCount ?? 0;
  const showSaleRibbon = product.saleLabel || hasDiscount;

  // Priority order so the card doesn't get crowded - top 2 badges shown
  const badges = [
    product.bestseller && { label: "Bestseller", cls: "bg-gold/90 text-plum-dark" },
    product.featured && { label: "Featured", cls: "bg-plum text-cream" },
    product.newArrival && { label: "New Arrival", cls: "bg-rose text-white" },
    product.limitedStockLabel && { label: "Limited Stock", cls: "bg-red-500 text-white" },
    product.handcrafted && { label: "Handcrafted", cls: "bg-lavender text-plum-dark" },
  ].filter(Boolean).slice(0, 2);

  const toggleWishlist = async (e) => {
    e.preventDefault();
    if (!user) return toast.error("Please log in to save favorites");
    try {
      const res = await api.post(`/wishlist/${product._id}`);
      setWished(res.data.added);
      toast.success(res.data.added ? "Added to wishlist" : "Removed from wishlist");
      if (res.data.added) track("wishlist_add", { productId: product._id });
    } catch {
      toast.error("Something went wrong");
    }
  };

  const selectVariant = (e, variant) => {
    // Cards are wrapped in a <Link> (navigates to the product page) - swatches must never
    // trigger that navigation, they only swap the image/price shown on the card itself.
    e.preventDefault();
    e.stopPropagation();
    setClickedVariant(variant);
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (outOfStock) return;
    // Add-to-cart still needs a concrete variant for products that have them (the backend
    // expects one) - falls back to the first active variant ONLY for this action, never for
    // what image/price the card displays, which must stay on the default showcase image until
    // the customer actually clicks a swatch.
    const variantForCart = clickedVariant || (hasVariants(product) ? getDefaultVariant(product) : null);
    const display = variantForCart ? getDisplayProduct(product, variantForCart) : { price, discountPrice, variantId: null };
    addToCart(product, 1, display);
    track("add_to_cart", { productId: product._id, variantId: display.variantId, meta: { quantity: 1, price: display.price } });
    toast.success(`${product.name} added to cart`);
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      onClick={() => {
        track("product_click", { productId: product._id });
        // Optional: lets a listing page (currently just Home's per-category rows) mark which
        // category this click came from, so a later Back returns to that exact section - see
        // utils/homeScrollMemory.js. No-op for every other caller of ProductCard.
        onNavigate?.();
      }}
      className="group card overflow-hidden flex flex-col"
    >
      <div className="relative bg-ivory aspect-square overflow-hidden">
        {/* key forces the carousel to remount (and reset to its first image) whenever the
            selected variant changes - satisfies "always reset image index to 0 on variant
            switch" without needing to lift/control the carousel's index state here. */}
        <ImageCarousel
          key={clickedVariant?._id || clickedVariant?.colorName || "default"}
          images={cardImages}
          alt={variantDisplay?.name || product.name}
          className="w-full h-full"
          imageClassName="object-cover group-hover:scale-105 transition-transform duration-300"
          showDots
        />
        <button
          onClick={toggleWishlist}
          className="absolute top-3 right-3 bg-white/80 backdrop-blur w-8 h-8 rounded-full flex items-center justify-center text-rose hover:bg-white"
          aria-label="Add to wishlist"
        >
          {wished ? "♥" : "♡"}
        </button>
        {showSaleRibbon && (
          <span className="absolute top-3 left-3 bg-plum text-cream text-[10px] px-2 py-1 rounded-full">SALE</span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-plum dark:text-cream font-body text-xs tracking-widest uppercase">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-0.5">
            {badges.map((b) => (
              <span key={b.label} className={`text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full ${b.cls}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}
        <h3 className="product-title text-sm text-plum-dark leading-snug">{product.name}</h3>
        {hasVariants(product) && (
          <div className="flex items-center gap-1.5">
            {product.variants.slice(0, 5).map((v) => {
              const isActive = clickedVariant && (clickedVariant?._id || clickedVariant?.colorName) === (v._id || v.colorName);
              return (
                <button
                  key={v._id || v.colorName}
                  type="button"
                  title={v.colorName}
                  aria-label={`View ${v.colorName} variant`}
                  aria-pressed={isActive}
                  onClick={(e) => selectVariant(e, v)}
                  className={`w-4 h-4 rounded-full border shrink-0 transition-transform ${
                    isActive ? "ring-2 ring-rose ring-offset-1 scale-110 border-white" : "border-white ring-1 ring-blush hover:scale-110"
                  }`}
                  style={{ backgroundColor: v.colorHex || "#8B5CF6" }}
                />
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-gold">
          {rating > 0 ? (
            <>
              {"★".repeat(Math.round(rating))}
              {"☆".repeat(5 - Math.round(rating))}
              <span className="text-plum-light/70 dark:text-cream/70 ml-1">
                {reviewCount > 0 ? `(${reviewCount})` : ""}
              </span>
            </>
          ) : (
            <span className="text-plum-light/40 dark:text-cream/40 normal-case">No ratings yet</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {fromMultiple && !clickedVariant && <span className="text-[10px] uppercase tracking-wide text-plum-light/60 dark:text-cream/60">From</span>}
          {hasDiscount ? (
            <>
              <span className="font-display font-semibold text-lg text-plum dark:text-cream">{formatPrice(displayDiscountPrice)}</span>
              <span className="text-xs text-plum-light/60 dark:text-cream/60 line-through">{formatPrice(displayPrice)}</span>
              <span className="text-[10px] font-medium text-rose">
                {Math.round(((displayPrice - displayDiscountPrice) / displayPrice) * 100)}% OFF
              </span>
            </>
          ) : (
            <span className="font-display font-semibold text-lg text-plum dark:text-cream">{formatPrice(displayPrice)}</span>
          )}
        </div>
        {/* Only ever set by an active sale campaign (see backend/utils/salePricing.js) - a
            plain admin-set discountPrice with no campaign behind it has no end date, so no
            countdown shows for it. */}
        {product.activeSale?.endAt && (
          <SaleCountdown endAt={product.activeSale.endAt} className="text-[10px] text-plum-light/70 dark:text-cream/70" />
        )}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock}
          className="mt-2 w-full text-xs py-2 rounded-full border border-plum text-plum dark:text-cream hover:bg-plum hover:text-cream transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {outOfStock ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}

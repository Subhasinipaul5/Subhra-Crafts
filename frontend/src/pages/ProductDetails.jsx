import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import { useCart } from "../context/CartContext";
import { useCurrency } from "../context/CurrencyContext";
import ProductCard from "../components/ProductCard";
import VirtualTryOnModal, { TryOnGapControls } from "../components/VirtualTryOn";
import ImageCarousel from "../components/ImageCarousel";
import BackButton from "../components/BackButton";
import Breadcrumb from "../components/Breadcrumb";
import placeholder from "../assets/placeholder.svg";
import { buildWhatsAppUrl } from "../config";
import { getDefaultVariant, getDisplayProduct, hasVariants } from "../utils/variants";
import { buildReviewGallery, topRatedReviews } from "../utils/reviewGallery";
import { track } from "../lib/analytics";
import LeafDoodles from "../components/LeafDoodles";
import ReviewCard from "../components/ReviewCard";
import ReviewGalleryLightbox from "../components/ReviewGalleryLightbox";

export default function ProductDetails() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  // ROOT-CAUSE FIX: previously a failed /products/:slug request (network error, backend briefly
  // unavailable, a stale/deleted product slug) had no .catch() at all - `product` just stayed
  // null forever and the page below sat on "Loading..." indefinitely, with no way to tell a
  // genuine failure apart from a slow request, and no way to recover without navigating away
  // manually. `loadError` distinguishes "still loading" from "failed to load" so the page can
  // show a real message instead of an infinite spinner.
  const [loadError, setLoadError] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [showTryOn, setShowTryOn] = useState(false);
  // FEATURE (this round) - "Try-On Control": the gap/position the customer sets, shared between
  // the standalone popover (button beside "Virtual Try-On", works without opening the camera)
  // and the live camera overlay - one value, editable from either place. Session-only: never
  // sent to the server, and never touches the admin-configured actual size.
  const [showTryOnControls, setShowTryOnControls] = useState(false);
  const [tryOnControls, setTryOnControls] = useState({ earGap: 0, earVOffset: 0, neckOffset: 0 });
  // Product-page reviews: only the top 3 highest-rated are shown here (see the reviews section
  // below); `lightboxIndex` is an index into THIS page's flattened top-3 gallery, null = closed.
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Extracted so the error state's "Retry" button can call the exact same fetch logic again
  // (retrying just by clearing state wouldn't actually re-issue the request, since the effect
  // above only re-runs when `slug` changes).
  function loadProduct() {
    setLoadError(null);
    setProduct(null);
    api
      .get(`/products/${slug}`)
      .then((res) => {
        setProduct(res.data.product);
        setRelated(res.data.related);
        const defaultVariant = getDefaultVariant(res.data.product);
        setSelectedVariant(defaultVariant);
        setActiveImage(0);
        setQty(1);
        track("product_view", { productId: res.data.product._id, variantId: defaultVariant?._id });
      })
      .catch((err) => {
        console.error(`Failed to load product "${slug}":`, err);
        setLoadError(err.response?.status === 404 ? "not_found" : "network");
      });
  }

  useEffect(() => {
    if (product) {
      api
        .get(`/reviews/product/${product._id}`)
        .then((res) => setReviews(res.data))
        .catch((err) => console.error("Failed to load reviews:", err)); // reviews are optional - a failure here must not block the rest of the page
    }
  }, [product]);

  // FEATURE 2 - merges the base product with whichever color the customer picked (or null =
  // the product has no variants at all) into the single flat object the whole page renders from.
  const display = useMemo(() => getDisplayProduct(product, selectedVariant), [product, selectedVariant]);

  // Reviews section data - computed unconditionally (before the loading-state early return
  // below) since hooks can't follow a conditional return; both are cheap no-ops on the initial
  // empty `reviews` array before the API response lands.
  const topReviews = useMemo(() => topRatedReviews(reviews, 3), [reviews]);
  const reviewGallery = useMemo(() => buildReviewGallery(topReviews), [topReviews]);

  if (loadError) {
    return (
      <div className="py-24 text-center px-6">
        <p className="text-plum dark:text-cream text-lg font-medium mb-2">
          {loadError === "not_found" ? "This product could not be found." : "This product is unavailable right now."}
        </p>
        <p className="text-plum-light/70 dark:text-cream/70 text-sm mb-6">
          {loadError === "not_found" ? "It may have been removed or the link may be incorrect." : "There was a problem reaching the server. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-3">
          {loadError !== "not_found" && (
            <button onClick={loadProduct} className="btn-primary text-sm">
              Retry
            </button>
          )}
          <Link to="/shop" className="btn-outline text-sm">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  if (!product || !display) return <div className="py-24 text-center text-plum-light dark:text-cream/90">Loading...</div>;

  const visibleVariants = hasVariants(product) ? product.variants.filter((v) => v.status !== "hidden") : [];
  const hasDiscount = display.discountPrice && display.discountPrice < display.price;
  const outOfStock = display.stock <= 0;
  const effectiveRating = product.effectiveRating ?? product.ratingAverage ?? 0;
  const effectiveReviewCount = product.effectiveReviewCount ?? product.ratingCount ?? 0;

  // FEATURE 7 - only offer Virtual Try-On when BOTH the category has it enabled AND this
  // specific variant/product has a valid, enabled try-on configuration with at least one asset.
  const categoryTryOn = product.category?.virtualTryOn;
  const canTryOn = !!(categoryTryOn?.enabled && display.tryOn?.enabled && display.tryOn?.assets?.length > 0);
  // "Try-On Control" (gap/position) only makes sense for the face-landmark ears/neck adapter -
  // the manual-placement adapter (wrist/table/etc.) already has its own drag/resize controls
  // built into the camera view itself.
  const earAssetAvailable = !!display.tryOn?.assets?.some((a) => a.target === "ears");
  const neckAssetAvailable = !!display.tryOn?.assets?.some((a) => a.target === "neck");
  const canControlGap = canTryOn && (earAssetAvailable || neckAssetAvailable);

  const selectVariant = (variant) => {
    setSelectedVariant(variant);
    setActiveImage(0);
    setQty(1);
    setTryOnControls({ earGap: 0, earVOffset: 0, neckOffset: 0 }); // different color = different physical piece, reset the gap preview
    track("color_variant_selected", { productId: product._id, variantId: variant._id });
  };

  const handleAdd = () => {
    addToCart(product, qty, display);
    track("add_to_cart", { productId: product._id, variantId: display.variantId, meta: { quantity: qty, price: display.price } });
    toast.success(`${display.name} added to cart`);
  };

  const handleBuyNow = () => {
    track("buy_now", { productId: product._id, variantId: display.variantId, meta: { quantity: qty, price: display.price } });
    handleAdd();
  };

  const priceForMsg = hasDiscount ? display.discountPrice : display.price;
  const whatsappMsg = `Hello SubhRa Crafts! 👋 I am interested in the ${display.name}${display.colorName ? ` (${display.colorName})` : ""}. Price: ${formatPrice(priceForMsg)}. I have a question about this product.`;

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-14">
      <LeafDoodles />
      {/* FEATURE (this round) - real "← Back" (browser/router history, not a hardcoded Home
          link) plus a small breadcrumb - both give the customer a way back that isn't "start
          over from Home", per the navigation fixes requested. */}
      <BackButton fallback="/shop" />
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          ...(product.category ? [{ label: product.category.name, to: `/shop?category=${product.category._id}` }] : []),
          { label: display.name },
        ]}
      />
      <div className="grid lg:grid-cols-2 gap-12">
        <div>
          <div className="group rounded-xl2 overflow-hidden bg-ivory border border-blush flex items-center justify-center" style={{ maxHeight: 700, height: 500 }}>
            <ImageCarousel
              images={display.images}
              alt={display.name}
              className="w-full h-full"
              imageClassName="object-contain"
              index={activeImage}
              onIndexChange={setActiveImage}
              showDots
            />
          </div>
          <div className="flex gap-3 mt-4">
            {display.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-16 h-16 rounded-lg overflow-hidden border ${i === activeImage ? "border-plum" : "border-blush"}`}
              >
                <img
                  src={img.url || placeholder}
                  alt=""
                  onError={(e) => { e.target.onerror = null; e.target.src = placeholder; }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-rose mb-2">{product.category?.name}</p>
          <h1 className="font-display text-3xl sm:text-4xl text-plum dark:text-cream mb-3">{display.name}</h1>

          {(product.bestseller || product.featured || product.newArrival || product.limitedStockLabel || product.handcrafted || product.saleLabel) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.bestseller && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-gold/90 text-plum-dark">🏆 Bestseller</span>}
              {product.featured && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-plum text-cream">Featured</span>}
              {product.newArrival && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-rose text-white">New Arrival</span>}
              {product.handcrafted && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-lavender text-plum-dark">🌸 Handcrafted</span>}
              {product.limitedStockLabel && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-red-500 text-white">Limited Stock</span>}
              {product.saleLabel && <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-plum-light text-cream">Sale</span>}
            </div>
          )}

          <div className="flex items-center gap-2 text-gold text-sm mb-4">
            {effectiveRating > 0 ? (
              <>
                {"★".repeat(Math.round(effectiveRating))}
                {"☆".repeat(5 - Math.round(effectiveRating))}
                <span className="text-plum-light/70 dark:text-cream/70">
                  {effectiveRating.toFixed(1)} {effectiveReviewCount > 0 ? `(${effectiveReviewCount} reviews)` : ""}
                </span>
              </>
            ) : (
              <span className="text-plum-light/50 dark:text-cream/50 normal-case">No ratings yet</span>
            )}
          </div>
          <div className="flex items-center gap-3 mb-6">
            {hasDiscount ? (
              <>
                <span className="font-display text-3xl text-plum dark:text-cream">{formatPrice(display.discountPrice)}</span>
                <span className="text-lg text-plum-light/50 dark:text-cream/50 line-through">{formatPrice(display.price)}</span>
              </>
            ) : (
              <span className="font-display text-3xl text-plum dark:text-cream">{formatPrice(display.price)}</span>
            )}
          </div>
          <p className="text-plum-light/90 dark:text-cream/90 leading-relaxed mb-6">{display.description}</p>

          {/* FEATURE 2 - color circle swatches, one per variant */}
          {visibleVariants.length > 0 && (
            <div className="mb-6">
              <span className="font-medium text-sm text-plum-dark">Colors: </span>
              <div className="flex items-center gap-3 mt-2">
                {visibleVariants.map((v) => {
                  const active = selectedVariant?._id === v._id;
                  return (
                    <button
                      key={v._id}
                      onClick={() => selectVariant(v)}
                      title={v.colorName}
                      aria-label={`Select color ${v.colorName}`}
                      className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-transform ${active ? "scale-110" : "hover:scale-105"}`}
                      style={{ boxShadow: active ? "0 0 0 2px white, 0 0 0 4px #4A2140" : "0 0 0 2px white, 0 0 0 3px #E8D9E4" }}
                    >
                      <span className="w-full h-full rounded-full" style={{ backgroundColor: v.colorHex || "#8B5CF6" }} />
                      {active && <span className="absolute inset-0 flex items-center justify-center text-white text-xs drop-shadow">✓</span>}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-plum-light/60 dark:text-cream/60 mt-1.5">
                Selected: <span className="font-medium text-plum-dark dark:text-cream/90">{selectedVariant?.colorName}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm text-plum-dark mb-6">
            {display.materials && <div><span className="font-medium">Materials:</span> {display.materials}</div>}
            {display.dimensions && <div><span className="font-medium">Size:</span> {display.dimensions}</div>}
            {!hasVariants(product) && product.colors?.length > 0 && <div><span className="font-medium">Colors:</span> {product.colors.join(", ")}</div>}
            <div>
              <span className="font-medium">Availability:</span>{" "}
              {outOfStock ? "Out of Stock" : display.stock <= product.lowStockThreshold ? `Only ${display.stock} left` : "In Stock"}
            </div>
          </div>

          {!outOfStock && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex items-center border border-blush rounded-full">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-plum dark:text-cream">-</button>
                <span className="px-3">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(display.stock, q + 1))} className="px-3 py-2 text-plum dark:text-cream">+</button>
              </div>

              {/* FEATURE 7 - Virtual Try-On button, next to the quantity selector */}
              {canTryOn && (
                <button
                  onClick={() => { track("virtual_tryon_open", { productId: product._id, variantId: display.variantId }); setShowTryOn(true); }}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-plum to-rose text-white shadow-sm hover:opacity-90 transition"
                >
                  ✨ Virtual Try-On
                </button>
              )}

              {/* "Try-On Control" - beside Virtual Try-On, lets the customer set the earring
                  gap / necklace position WITHOUT needing the camera open. Whatever they set here
                  carries straight into the camera view (and vice versa - see VirtualTryOn.jsx). */}
              {canControlGap && (
                <div className="relative">
                  <button
                    onClick={() => setShowTryOnControls((v) => !v)}
                    className="px-4 py-2 rounded-full text-sm font-medium border border-plum text-plum dark:text-cream hover:bg-plum hover:text-cream transition-colors flex items-center gap-1.5"
                    aria-expanded={showTryOnControls}
                  >
                    ⚙️ Try-On Control
                  </button>
                  {showTryOnControls && (
                    <div className="absolute z-30 top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-soft border border-blush p-4">
                      <TryOnGapControls
                        earAvailable={earAssetAvailable}
                        neckAvailable={neckAssetAvailable}
                        earGap={tryOnControls.earGap}
                        earVOffset={tryOnControls.earVOffset}
                        neckOffset={tryOnControls.neckOffset}
                        onEarGapChange={(v) => setTryOnControls((c) => ({ ...c, earGap: v }))}
                        onEarVOffsetChange={(v) => setTryOnControls((c) => ({ ...c, earVOffset: v }))}
                        onNeckOffsetChange={(v) => setTryOnControls((c) => ({ ...c, neckOffset: v }))}
                        variant="panel"
                      />
                      {!showTryOn && (
                        <button
                          onClick={() => { setShowTryOnControls(false); track("virtual_tryon_open", { productId: product._id, variantId: display.variantId }); setShowTryOn(true); }}
                          className="mt-3 w-full text-xs py-2 rounded-full bg-plum text-cream hover:opacity-90 transition"
                        >
                          Open camera to preview
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={handleAdd} disabled={outOfStock} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
              {outOfStock ? "Out of Stock" : "Add to Cart"}
            </button>
            <Link to="/cart" onClick={handleBuyNow} className="btn-outline">Buy Now</Link>
            <a
              href={buildWhatsAppUrl(whatsappMsg)}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </div>

      {showTryOn && canTryOn && (
        <VirtualTryOnModal
          itemLabel={display.name}
          targets={categoryTryOn.targets}
          assets={display.tryOn.assets}
          initialControls={tryOnControls}
          onControlsChange={setTryOnControls}
          onClose={() => setShowTryOn(false)}
        />
      )}

      {/* Reviews - only the top 3 highest-rated show here; "Show all -> " links to the dedicated
          All Reviews page (ProductReviews.jsx) for the rest. Images use the SAME flattened
          gallery (utils/reviewGallery.buildReviewGallery) the All Reviews page uses, scoped to
          just these 3 reviews, so swiping moves continuously across all of their images without
          closing/reopening the viewer. */}
      <div className="mt-20">
        <h2 className="section-title text-2xl mb-6">Customer Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-plum-light/60 dark:text-cream/60 text-sm">No reviews yet — be the first to review this piece.</p>
        ) : (
          <>
            <div className="space-y-5">
              {topReviews.map((r) => (
                <ReviewCard key={r._id} review={r} onImageClick={(i) => setLightboxIndex((reviewGallery.offsets[r._id] ?? 0) + i)} />
              ))}
            </div>
            {reviews.length > topReviews.length && (
              <div className="mt-5 text-center">
                <Link to={`/product/${slug}/reviews`} className="text-sm text-rose hover:underline font-medium">
                  Show all {reviews.length} reviews →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <ReviewGalleryLightbox images={reviewGallery.flat} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="section-title text-2xl text-plum dark:text-cream mb-6">You may also like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

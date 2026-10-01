// FEATURE 1/2 helpers - shared everywhere a product with color variants needs to be displayed
// or added to the cart, so ProductCard, ProductDetails, and CartContext all agree on exactly
// how a variant's fields fall back to the parent product's fields.

export function hasVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

// The variant customers/admin should see selected by default: the first ACTIVE variant, or
// null if this product doesn't use variants at all (classic single-SKU product).
export function getDefaultVariant(product) {
  if (!hasVariants(product)) return null;
  return product.variants.find((v) => v.status !== "hidden") || product.variants[0];
}

// Merges a product with a (possibly null) selected variant into one flat object the UI can
// render directly - name/images/price/description/stock/materials/dimensions/tryOn all resolve
// to the variant's own value when set, otherwise fall back to the parent product's value.
export function getDisplayProduct(product, variant) {
  if (!product) return null;
  if (!variant) {
    return {
      variantId: null,
      colorName: null,
      colorHex: null,
      name: product.name,
      images: product.images || [],
      price: product.price,
      discountPrice: product.discountPrice,
      description: product.description,
      stock: product.stock,
      materials: product.materials,
      dimensions: product.dimensions,
      sku: product.sku,
      status: product.status,
      tryOn: product.tryOn,
    };
  }
  return {
    variantId: variant._id,
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    name: variant.name || `${product.name} - ${variant.colorName}`,
    images: variant.images?.length ? variant.images : product.images || [],
    price: variant.price ?? product.price,
    discountPrice: variant.discountPrice ?? product.discountPrice ?? null,
    description: variant.description || product.description,
    stock: variant.stock,
    materials: variant.materials || product.materials,
    dimensions: variant.dimensions || product.dimensions,
    sku: variant.sku || product.sku,
    status: variant.status,
    tryOn: variant.tryOn,
  };
}

// The price to show on a product CARD (list view), before any variant is picked: the cheapest
// active option, so a product with variants priced ₹1299-₹1599 shows the ₹1299 "from" price.
//
// ROOT-CAUSE FIX: a variant's `discountPrice` overrides the parent product's sale price only
// when the variant sets its own - same fallback relationship `price` already had
// (`v.price ?? product.price`). Handles all 5 pricing cases: (A) no variants → reads the
// product directly; (B) has variants, each variant priced independently; (C) a static
// product-level discount with no campaign; (D) an active sale campaign, which - as of the
// backend fix in saleCampaignController.js - now sets discountPrice on both the product AND
// each variant; (E) no discount configured anywhere → discountPrice stays null/undefined and
// nothing is invented.
export function getCardPricing(product) {
  if (!hasVariants(product)) {
    return { price: product.price, discountPrice: product.discountPrice, fromMultiple: false };
  }
  const active = product.variants.filter((v) => v.status !== "hidden");
  const pool = active.length ? active : product.variants;
  let best = null;
  for (const v of pool) {
    const price = v.price ?? product.price;
    const discountPrice = v.discountPrice ?? product.discountPrice;
    const effective = discountPrice && discountPrice < price ? discountPrice : price;
    if (best === null || effective < best.effective) {
      best = { effective, price, discountPrice };
    }
  }
  return { price: best.price, discountPrice: best.discountPrice, fromMultiple: pool.length > 1 };
}

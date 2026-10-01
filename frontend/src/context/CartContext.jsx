import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

// FEATURE 10 - a cart line is keyed by product + variant, so two different colors of the same
// product are always kept as separate lines. `cartKey` is what React keys/updates/removals use;
// `variantId` (may be null) is what checkout sends to the backend so stock/price is validated
// against the exact color purchased.
const makeCartKey = (productId, variantId) => (variantId ? `${productId}::${variantId}` : productId);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem("sr_cart");
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem("sr_cart", JSON.stringify(items));
  }, [items]);

  // `displayProduct` is the result of utils/variants.getDisplayProduct(product, variant) -
  // already resolved name/price/image/stock for whichever variant (or none) is selected.
  const addToCart = (product, quantity = 1, displayProduct = null) => {
    const d = displayProduct || {
      variantId: null,
      colorName: null,
      name: product.name,
      images: product.images,
      price: product.discountPrice && product.discountPrice < product.price ? product.discountPrice : product.price,
      stock: product.stock,
    };
    const price = d.discountPrice && d.discountPrice < d.price ? d.discountPrice : d.price;
    const cartKey = makeCartKey(product._id, d.variantId);

    setItems((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: Math.min(i.quantity + quantity, d.stock) } : i
        );
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product._id,
          variantId: d.variantId || null,
          colorName: d.colorName || null,
          name: d.name,
          image: d.images?.[0]?.url || "",
          price,
          quantity: Math.min(quantity, d.stock || quantity),
          maxStock: d.stock,
          slug: product.slug,
        },
      ];
    });
  };

  const updateQuantity = (cartKey, quantity) => {
    setItems((prev) =>
      prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxStock || quantity)) } : i))
    );
  };

  const removeFromCart = (cartKey) => {
    setItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, updateQuantity, removeFromCart, clearCart, subtotal, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

import { useEffect, useState } from "react";
import api from "../api/client";
import ProductCard from "../components/ProductCard";
import SectionHeading from "../components/SectionHeading";
import LeafDoodles from "../components/LeafDoodles";
import LoginBubbles from "../components/LoginBubbles";

export default function Wishlist() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/wishlist").then((res) => setProducts(res.data));
  }, []);

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-14">
      <LoginBubbles variant="compact" />
      <LeafDoodles />
      <SectionHeading eyebrow="Saved for Later" title="My Wishlist" />
      {products.length === 0 ? (
        <p className="text-center text-plum-light/60 dark:text-cream/60">Your wishlist is empty. Tap the heart on any product to save it here.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

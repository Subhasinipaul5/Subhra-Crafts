import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import SectionHeading from "../components/SectionHeading";
import ProductCard from "../components/ProductCard";
import LeafDoodles from "../components/LeafDoodles";

// FEATURE (this round) - "View All" destination for a homepage product-collection section
// (WebsiteSection), which only ever shows the first 4 on the homepage itself. Shows every
// product curated into that collection by the admin.
export default function CollectionDetail() {
  const { id } = useParams();
  const [section, setSection] = useState(null); // null = loading, false = not found
  const [error, setError] = useState(false);

  useEffect(() => {
    setSection(null);
    setError(false);
    api
      .get(`/sections/${id}`)
      .then((res) => setSection(res.data))
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-plum-light/70 dark:text-cream/70">This collection is no longer available.</p>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-plum-light/60 dark:text-cream/60 text-sm">
        Loading collection...
      </div>
    );
  }

  return (
    <div className="relative max-w-7xl mx-auto px-6 py-16">
      <LeafDoodles />
      <SectionHeading eyebrow="Collection" title={section.title} subtitle={section.description} />
      {section.products.length === 0 ? (
        <p className="text-center text-plum-light/60 dark:text-cream/60 text-sm">No products in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {section.products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// Run with: npm run seed:demo
// Populates sample categories & products so the site isn't empty on first run.
// Uses free Unsplash placeholder images - replace with real product photos
// anytime from the Admin > Products page.

require("dotenv").config();
const connectDB = require("../config/db");
const Category = require("../models/Category");
const Product = require("../models/Product");

const placeholder = (seed) => `https://picsum.photos/seed/${seed}/800/800`;

const categoriesData = [
  { name: "Top Earrings", description: "Our most-loved handmade resin earrings", order: 1, featured: true },
  { name: "Earrings", description: "Handcrafted resin earrings in every color", order: 2, featured: true },
  { name: "Necklaces", description: "Delicate resin necklaces, made to order", order: 3, featured: true },
  { name: "Earrings & Necklace Sets", description: "Matching sets for a complete look", order: 4, featured: true },
  { name: "Hair Clips", description: "Pretty resin hair clips & back clips", order: 5, featured: true },
  { name: "Keychains", description: "Fun handmade resin keychains", order: 6, featured: false },
];

const productSeeds = [
  { name: "Blush Rose Resin Earrings", price: 399, discountPrice: 349, stock: 14, cat: "Earrings", colors: ["Pink", "Gold"], desc: "Delicate pressed-flower resin earrings in a soft blush tone, finished with gold accents." },
  { name: "Lavender Dream Studs", price: 349, stock: 20, cat: "Earrings", colors: ["Lavender"], desc: "Lightweight lavender resin studs with a dreamy marbled finish." },
  { name: "Plum Petal Drop Earrings", price: 449, stock: 8, cat: "Top Earrings", colors: ["Plum", "Gold"], featured: true, desc: "Statement plum resin drops with delicate gold leafing." },
  { name: "Ivory Bloom Hoop Earrings", price: 499, stock: 3, cat: "Top Earrings", colors: ["Ivory"], bestseller: true, desc: "Hand-poured ivory resin hoops with a soft floral inclusion." },
  { name: "Dusty Rose Pendant Necklace", price: 599, stock: 10, cat: "Necklaces", colors: ["Rose"], desc: "A single dusty-rose resin pendant on a fine gold-tone chain." },
  { name: "Golden Vine Layered Necklace", price: 699, discountPrice: 599, stock: 6, cat: "Necklaces", colors: ["Gold"], newArrival: true, desc: "Layered chain necklace with a hand-cast golden vine resin charm." },
  { name: "Blossom Set — Earrings & Necklace", price: 899, stock: 5, cat: "Earrings & Necklace Sets", colors: ["Pink", "Purple"], bestseller: true, desc: "A matching earring and necklace set featuring pressed blossoms in resin." },
  { name: "Twilight Set — Earrings & Necklace", price: 949, stock: 0, cat: "Earrings & Necklace Sets", colors: ["Plum"], desc: "Deep plum resin set with subtle gold shimmer, for evening wear." },
  { name: "Floral Back Hair Clip", price: 299, stock: 25, cat: "Hair Clips", colors: ["Pink", "Lavender"], newArrival: true, desc: "A dainty floral resin hair clip, perfect for everyday elegance." },
  { name: "Pearl Bloom Hair Clip", price: 329, stock: 12, cat: "Hair Clips", colors: ["Ivory"], desc: "Pearl-accented resin hair clip with a soft bloom motif." },
  { name: "Little Rose Keychain", price: 199, stock: 30, cat: "Keychains", colors: ["Pink"], desc: "A tiny hand-poured rose keychain, a sweet gift for someone you love." },
  { name: "Lucky Clover Keychain", price: 179, stock: 18, cat: "Keychains", colors: ["Green", "Gold"], desc: "A four-leaf clover resin keychain with gold flakes for good luck." },
];

(async () => {
  await connectDB();

  const catMap = {};
  for (const c of categoriesData) {
    let cat = await Category.findOne({ name: c.name });
    if (!cat) {
      cat = await Category.create({ ...c, image: { url: placeholder(c.name.replace(/\s+/g, "-").toLowerCase()) } });
      console.log(`Created category: ${cat.name}`);
    }
    catMap[c.name] = cat._id;
  }

  let created = 0;
  for (const p of productSeeds) {
    const exists = await Product.findOne({ name: p.name });
    if (exists) continue;
    await Product.create({
      name: p.name,
      description: p.desc,
      price: p.price,
      discountPrice: p.discountPrice || null,
      stock: p.stock,
      category: catMap[p.cat],
      colors: p.colors,
      materials: "Epoxy resin, dried flowers, gold leaf",
      dimensions: "Approx. 3-5 cm",
      featured: !!p.featured,
      bestseller: !!p.bestseller,
      newArrival: !!p.newArrival,
      images: [
        { url: placeholder(p.name.replace(/\s+/g, "-").toLowerCase() + "-1") },
        { url: placeholder(p.name.replace(/\s+/g, "-").toLowerCase() + "-2") },
      ],
      status: "active",
    });
    created++;
  }

  console.log(`Demo data seeded. ${created} new products created.`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

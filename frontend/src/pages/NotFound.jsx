import { Link } from "react-router-dom";
import LeafDoodles from "../components/LeafDoodles";

export default function NotFound() {
  return (
    <div className="relative max-w-lg mx-auto px-6 py-32 text-center">
      <LeafDoodles />
      <h1 className="font-display text-5xl text-plum dark:text-cream mb-4">404</h1>
      <p className="text-plum-light/80 dark:text-cream/80 mb-8">This page doesn't exist — but our collection does.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}

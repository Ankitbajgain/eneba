import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { money } from "../lib/marketplace";
import type { Product } from "../lib/marketplace";

export function ProductCard({ product }: { product: Product }) {
  const discount =
    product.min_price && product.reference_price
      ? Math.round(
          (1 -
            product.min_price.amount_minor /
              product.reference_price.amount_minor) *
            100,
        )
      : 0;
  return (
    <Link
      className="product-card"
      to={`/products/${product.slug}`}
      aria-label={`${product.title}, ${money(product.min_price)}`}
    >
      <div className="product-cover">
        <img src={product.cover_url} alt="" loading="lazy" />
        {discount > 0 && <span className="discount-badge">−{discount}%</span>}
        <span className="card-open">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="platform-strip">
        ◉{" "}
        {product.platforms.map((platform) => platform.name).join(" / ") ||
          "Digital game"}
      </div>
      <div className="product-info">
        <h3>
          {product.title} <span>Digital Key</span>
        </h3>
        <p className="region-label">
          {product.regions.map((region) => region.name).join(" / ")}
        </p>
        <div className="card-price">
          <small>From</small>
          {discount > 0 && <del>{money(product.reference_price)}</del>}
          <strong>{money(product.min_price)}</strong>
        </div>
        <p className="offer-note">
          {product.available
            ? "Compare seller offers"
            : "Currently unavailable"}
        </p>
      </div>
    </Link>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Zap, Star, ShoppingCart, Check } from "lucide-react";
import { useCart } from "../../app/providers";
import { read, money } from "../../lib/marketplace";
import type { Product, Offer, Page } from "../../lib/marketplace";
import { Breadcrumbs, Loading, ErrorState } from "../../components/ui";

export function ProductPage() {
  const { slug } = useParams();
  const cart = useCart();
  const [busy, setBusy] = useState<number | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: ({ signal }) =>
      read<{ data: Product }>(
        `/products/${encodeURIComponent(slug ?? "")}`,
        signal,
      ),
    retry: false,
  });
  const offers = useQuery({
    queryKey: ["offers", slug],
    queryFn: ({ signal }) =>
      read<Page<Offer>>(
        `/products/${encodeURIComponent(slug ?? "")}/offers`,
        signal,
      ),
    retry: false,
  });
  async function add(offer: Offer) {
    setBusy(offer.id);
    setError(null);
    try {
      await cart.add(offer.id);
      setAdded(offer.id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }
  if (product.isPending) return <Loading label="Loading game…" />;
  if (product.isError)
    return (
      <div className="container">
        <ErrorState
          error={product.error}
          retry={() => void product.refetch()}
        />
        <Link to="/store">Back to games</Link>
      </div>
    );
  const game = product.data.data;
  return (
    <div className="container product-page">
      <Breadcrumbs>
        <Link to="/store">Games</Link>
        <span>›</span>
        <span>{game.title}</span>
      </Breadcrumbs>
      <div className="product-detail">
        <img
          className="detail-cover"
          src={game.cover_url}
          alt={`${game.title} cover`}
        />
        <div className="detail-summary">
          <span className="eyebrow">DIGITAL GAME KEY</span>
          <h1>{game.title}</h1>
          <div className="detail-tags">
            {game.platforms.map((platform) => (
              <span key={platform.code}>{platform.name}</span>
            ))}
            {game.regions.map((region) => (
              <span key={region.code}>{region.name}</span>
            ))}
          </div>
          <p className="description">{game.description}</p>
          <div className="detail-assurances">
            <span>
              <Zap size={19} /> Instant demo key delivery
            </span>
            <span>
              <ShieldCheck size={19} /> Compare independent sellers
            </span>
          </div>
          {game.release_date && (
            <p className="muted">
              Release date:{" "}
              {new Date(game.release_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <aside className="buy-summary">
          <p>Best available price</p>
          <strong>{money(game.min_price)}</strong>
          {game.reference_price && <del>{money(game.reference_price)}</del>}
          <a className="yellow-button" href="#seller-offers">
            Compare offers <ShoppingCart size={18} />
          </a>
          <small>
            Check platform and activation region before choosing an offer.
          </small>
          <span className="demo-label">
            Simulated purchases · fictional keys
          </span>
        </aside>
      </div>
      <section className="offers-section" id="seller-offers">
        <div className="section-heading">
          <h2>
            Offers from sellers{" "}
            <span className="count-pill">{offers.data?.meta.total ?? 0}</span>
          </h2>
          <span className="muted">Available offers, lowest price first</span>
        </div>
        {!!error && <ErrorState error={error} />}
        {added !== null && (
          <p className="success-note" role="status">
            <Check size={17} /> Added to your cart.{" "}
            <Link to="/cart">View cart →</Link>
          </p>
        )}
        {offers.isPending ? (
          <Loading label="Comparing sellers…" />
        ) : offers.isError ? (
          <ErrorState
            error={offers.error}
            retry={() => void offers.refetch()}
          />
        ) : (
          offers.data.data.map((offer) => (
            <article className="offer-row" key={offer.id}>
              <div className="seller-name">
                <span className="seller-avatar">
                  {offer.seller.name.charAt(0)}
                </span>
                <div>
                  <strong>{offer.seller.name}</strong>
                  <small>
                    <Star size={13} fill="currentColor" />{" "}
                    {offer.seller.rating.toFixed(2)} / 5{" "}
                    <span>demo rating</span>
                  </small>
                </div>
              </div>
              <div className="offer-activation">
                <strong>
                  {offer.platform.name} · {offer.region.name}
                </strong>
                <small>{offer.region.activation_note}</small>
              </div>
              <div className="offer-price">
                <strong>{money(offer.price)}</strong>
                <small>{offer.available ? "Available" : "Sold out"}</small>
              </div>
              <button
                className="yellow-button"
                disabled={!offer.available || busy !== null}
                onClick={() => void add(offer)}
              >
                {busy === offer.id ? "Adding…" : "Add to cart"}
                <ShoppingCart size={17} />
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { useCart, useSession } from "../../app/providers";
import { money } from "../../lib/marketplace";
import { Breadcrumbs, Empty, ErrorState, Loading } from "../../components/ui";

export function CartPage() {
  const state = useCart();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const cart = state.cart?.data;
  return (
    <div className="container cart-page">
      <Breadcrumbs>
        <span>Cart</span>
      </Breadcrumbs>
      <h1>Your cart</h1>
      {state.notice && (
        <div className="info-note" role="status">
          {state.notice}
          <button className="text-button" onClick={state.retry}>
            Retry saved cart
          </button>
        </div>
      )}
      {!!error && <ErrorState error={error} />}
      {state.loading || state.merging ? (
        <Loading label="Updating your cart…" />
      ) : state.error ? (
        <ErrorState error={state.error} retry={state.retry} />
      ) : !cart?.items.length ? (
        <Empty title="Your next adventure is waiting">
          <p>Find a game you love and choose a seller offer to add it here.</p>
          <Link to="/store" className="yellow-button">
            Explore games <ArrowRight size={17} />
          </Link>
        </Empty>
      ) : (
        <div className="checkout-layout">
          <section className="cart-lines" aria-label="Cart items">
            {cart.items.map((line) => (
              <article key={line.id} className="cart-line">
                <Link to={`/products/${line.product.slug}`}>
                  <img src={line.product.cover_url} alt="" />
                </Link>
                <div className="cart-line-detail">
                  <Link to={`/products/${line.product.slug}`}>
                    <h2>{line.product.title}</h2>
                  </Link>
                  <p>
                    {line.offer.platform.name} · {line.offer.region.name}
                  </p>
                  <small>Sold by {line.offer.seller.name}</small>
                  {line.issue && (
                    <p className="line-issue">
                      {line.issue === "price_changed"
                        ? "Price changed. Update the quantity to accept the current price."
                        : "This offer is not currently available in the requested quantity."}
                    </p>
                  )}
                  <div className="line-actions">
                    <label>
                      Quantity{" "}
                      <select
                        disabled={busy}
                        aria-label={`Quantity for ${line.product.title}`}
                        value={line.quantity}
                        onChange={(event) =>
                          void action(() =>
                            state.update(line.id, Number(event.target.value)),
                          )
                        }
                      >
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => void action(() => state.remove(line.id))}
                      className="text-button"
                    >
                      <Trash2 size={15} /> Remove
                    </button>
                    {line.issue === "price_changed" && (
                      <button
                        disabled={busy}
                        className="text-button"
                        onClick={() =>
                          void action(() =>
                            state.update(line.id, line.quantity),
                          )
                        }
                      >
                        Accept new price
                      </button>
                    )}
                  </div>
                </div>
                <strong>
                  {money({
                    amount_minor: line.offer.price.amount_minor * line.quantity,
                    currency: "EUR",
                  })}
                </strong>
              </article>
            ))}
          </section>
          <aside className="order-summary">
            <h2>Order summary</h2>
            <div>
              <span>Items</span>
              <span>{state.count}</span>
            </div>
            <div>
              <span>Payment</span>
              <span>Simulated</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{money(cart.total)}</strong>
            </div>
            {!user && (
              <p className="muted">
                Sign in or create an account to complete your purchase. Your
                cart will be saved.
              </p>
            )}
            {cart.items.some((item) => !item.valid) ? (
              <p className="line-issue">
                Review unavailable or changed offers before continuing.
              </p>
            ) : (
              <Link
                to={user ? "/checkout" : "/account?next=/checkout"}
                className="yellow-button"
              >
                {user ? "Continue to checkout" : "Sign in to checkout"}
                <ArrowRight size={18} />
              </Link>
            )}
            <p className="summary-note">
              <ShieldCheck size={17} /> No real money is charged.
            </p>
            <Link to="/store" className="text-button">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

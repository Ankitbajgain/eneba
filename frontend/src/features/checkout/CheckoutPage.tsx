import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, LockKeyhole } from "lucide-react";
import { useCart, useSession } from "../../app/providers";
import { write, money } from "../../lib/marketplace";
import type { Order } from "../../lib/marketplace";
import { Breadcrumbs, Empty, ErrorState, Loading } from "../../components/ui";

export function CheckoutPage() {
  const { user, loading } = useSession();
  const state = useCart();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [result, setResult] = useState<"success" | "decline">("success");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  if (loading || state.loading || state.merging)
    return <Loading label="Preparing checkout…" />;
  if (!user)
    return (
      <div className="container">
        <Empty title="Sign in to complete your purchase">
          <Link to="/account?next=/checkout" className="yellow-button">
            Sign in or create account
          </Link>
        </Empty>
      </div>
    );
  const cart = state.cart?.data;
  if (state.error)
    return (
      <div className="container">
        <ErrorState error={state.error} retry={state.retry} />
      </div>
    );
  if (!cart?.items.length)
    return (
      <div className="container">
        <Empty title="Your cart is empty">
          <p>
            If you already attempted a payment, check your orders before
            starting a new purchase.
          </p>
          {attempt.current && (
            <button
              className="outline-button"
              disabled={busy}
              onClick={async () => {
                const pending = attempt.current;
                if (!pending) return;
                setBusy(true);
                try {
                  const recovered = await write<{ data: Order }>(
                    "/checkout",
                    JSON.parse(pending.body),
                    "POST",
                    { "Idempotency-Key": pending.key },
                  );
                  attempt.current = null;
                  navigate(`/orders/${recovered.data.id}`);
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Recover previous checkout
            </button>
          )}
          {!!error && <ErrorState error={error} />}
          <Link to="/orders" className="text-button">
            View my orders
          </Link>
          <Link to="/store" className="yellow-button">
            Browse games
          </Link>
        </Empty>
      </div>
    );
  async function pay() {
    if (busy || !cart) return;
    const body = { cart_revision: cart.revision, simulate_result: result };
    const fingerprint = JSON.stringify(body);
    if (attempt.current?.body !== fingerprint)
      attempt.current = { body: fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      const order = await write<{ data: Order }>("/checkout", body, "POST", {
        "Idempotency-Key": attempt.current.key,
      });
      attempt.current = null;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["cart"] }),
        client.invalidateQueries({ queryKey: ["orders"] }),
        client.invalidateQueries({ queryKey: ["home"] }),
      ]);
      navigate(`/orders/${order.data.id}`);
    } catch (e) {
      setError(e);
      void client.invalidateQueries({ queryKey: ["cart"] });
    } finally {
      setBusy(false);
    }
  }
  const valid = cart.items.every((item) => item.valid);
  return (
    <div className="container checkout-page">
      <Breadcrumbs>
        <Link to="/cart">Cart</Link>
        <span>›</span>
        <span>Checkout</span>
      </Breadcrumbs>
      <h1>Checkout</h1>
      <div className="checkout-layout">
        <section className="payment-panel">
          <h2>
            <CreditCard /> Payment
          </h2>
          <div className="demo-payment">
            <span>DEMO PAYMENT</span>
            <h3>Try the complete experience</h3>
            <p>
              This is an internship marketplace. No real money is charged, and
              purchased keys are fictional.
            </p>
          </div>
          <fieldset disabled={busy}>
            <legend>Simulate a payment outcome</legend>
            <label className="payment-option">
              <input
                type="radio"
                name="result"
                value="success"
                checked={result === "success"}
                onChange={() => setResult("success")}
              />
              <span>
                <strong>Successful payment</strong>
                <small>
                  Complete your demo order and receive a fictional key.
                </small>
              </span>
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="result"
                value="decline"
                checked={result === "decline"}
                onChange={() => setResult("decline")}
              />
              <span>
                <strong>Declined payment</strong>
                <small>
                  Try the failure flow. Your cart and keys stay untouched.
                </small>
              </span>
            </label>
          </fieldset>
          <p className="muted">Signed in as {user.email}</p>
          {!!error && <ErrorState error={error} />}
          <Link to="/cart" className="text-button">
            ← Back to cart
          </Link>
        </section>
        <aside className="order-summary">
          <h2>Your order</h2>
          {cart.items.map((item) => (
            <div className="checkout-item" key={item.id}>
              <span>
                {item.product.title} × {item.quantity}
              </span>
              <strong>
                {money({
                  amount_minor: item.offer.price.amount_minor * item.quantity,
                  currency: "EUR",
                })}
              </strong>
            </div>
          ))}
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(cart.total)}</strong>
          </div>
          {!valid && (
            <p className="line-issue">
              A price or availability changed. Return to your cart to review.
            </p>
          )}
          <button
            className="yellow-button"
            disabled={busy || !valid || state.merging}
            onClick={() => void pay()}
          >
            <LockKeyhole size={17} />
            {busy ? "Processing…" : `Pay ${money(cart.total)} · Demo`}
          </button>
          <p className="summary-note">
            Simulated payment only. Never enter card details.
          </p>
        </aside>
      </div>
    </div>
  );
}

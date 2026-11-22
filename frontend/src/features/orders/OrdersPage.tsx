import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, KeyRound, Copy, Check } from "lucide-react";
import { useSession } from "../../app/providers";
import { read, money } from "../../lib/marketplace";
import type { Order, Page } from "../../lib/marketplace";
import { Breadcrumbs, Empty, ErrorState, Loading } from "../../components/ui";

export function OrdersPage() {
  const { user, loading } = useSession();
  const [page, setPage] = useState(1);
  const orders = useQuery({
    queryKey: ["orders", user?.id, page],
    enabled: !!user,
    queryFn: ({ signal }) =>
      read<Page<Order>>(`/orders?page=${page}&per_page=10`, signal),
    retry: false,
  });
  if (loading) return <Loading />;
  if (!user)
    return (
      <div className="container">
        <Empty title="Your games are waiting for you">
          <p>Sign in to see your order history and demo keys.</p>
          <Link to="/account?next=/orders" className="yellow-button">
            Sign in
          </Link>
        </Empty>
      </div>
    );
  return (
    <div className="container orders-page">
      <Breadcrumbs>
        <span>My orders</span>
      </Breadcrumbs>
      <h1>My orders</h1>
      <p className="muted">Your purchases, all in one place.</p>
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorState error={orders.error} retry={() => void orders.refetch()} />
      ) : orders.data.data.length ? (
        <>
          <div className="order-list">
            {orders.data.data.map((order) => (
              <Link
                className="order-list-item"
                key={order.id}
                to={`/orders/${order.id}`}
              >
                <span className={`order-status ${order.status}`}>
                  {order.status === "fulfilled" ? (
                    <CheckCircle2 />
                  ) : (
                    <XCircle />
                  )}
                  {order.status === "fulfilled"
                    ? "Completed"
                    : "Payment declined"}
                </span>
                <div>
                  <strong>
                    {order.items.map((item) => item.product_title).join(", ")}
                  </strong>
                  <small>
                    {new Date(order.created_at).toLocaleString("en-GB")} · #
                    {order.id.slice(0, 8)}
                  </small>
                </div>
                <strong>{money(order.total)}</strong>
                <span className="text-button">View order →</span>
              </Link>
            ))}
          </div>
          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="outline-button"
            >
              Previous
            </button>
            <span>
              Page {page} of {orders.data.meta.last_page}
            </span>
            <button
              disabled={page >= orders.data.meta.last_page}
              onClick={() => setPage(page + 1)}
              className="outline-button"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <Empty title="Your first adventure starts here">
          <p>You haven’t placed an order yet.</p>
          <Link className="yellow-button" to="/store">
            Explore games
          </Link>
        </Empty>
      )}
    </div>
  );
}

export function OrderPage() {
  const { id } = useParams();
  const { user, loading } = useSession();
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [copyError, setCopyError] = useState(false);
  const order = useQuery({
    queryKey: ["order", user?.id, id],
    enabled: !!user,
    queryFn: ({ signal }) => read<{ data: Order }>(`/orders/${id}`, signal),
    retry: false,
  });
  const keys = useQuery({
    queryKey: ["orderKeys", user?.id, id],
    enabled: !!user && reveal && order.data?.data.status === "fulfilled",
    queryFn: ({ signal }) =>
      read<{ data: { order_item_id: number; value: string }[] }>(
        `/orders/${id}/keys`,
        signal,
      ),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (loading) return <Loading />;
  if (!user)
    return (
      <div className="container">
        <Empty title="Sign in to view this order">
          <Link to={`/account?next=/orders/${id}`} className="yellow-button">
            Sign in
          </Link>
        </Empty>
      </div>
    );
  if (order.isPending) return <Loading />;
  if (order.isError)
    return (
      <div className="container">
        <ErrorState error={order.error} />
        <Link to="/orders">Back to orders</Link>
      </div>
    );
  const data = order.data.data;
  const success = data.status === "fulfilled";
  return (
    <div className="container order-page">
      <Breadcrumbs>
        <Link to="/orders">Orders</Link>
        <span>›</span>
        <span>#{data.id.slice(0, 8)}</span>
      </Breadcrumbs>
      <section className={`order-result ${success ? "fulfilled" : "failed"}`}>
        {success ? <CheckCircle2 size={52} /> : <XCircle size={52} />}
        <div>
          <span className="eyebrow">
            {success ? "YOUR NEXT ADVENTURE IS READY" : "LET’S TRY THAT AGAIN"}
          </span>
          <h1>{success ? "Thanks for your order!" : "Payment declined"}</h1>
          <p>
            {success
              ? "Your simulated purchase is complete. Your fictional keys are ready below."
              : "No keys were allocated. Your cart is saved, so you can try another simulated payment."}
          </p>
        </div>
      </section>
      <div className="checkout-layout">
        <section className="order-details">
          <h2>Order details</h2>
          <p className="muted">
            #{data.id} · {new Date(data.created_at).toLocaleString("en-GB")}
          </p>
          {data.items.map((item) => (
            <div className="order-item" key={item.id}>
              <div>
                <h3>
                  {item.product_title} × {item.quantity}
                </h3>
                <p>
                  {item.platform_name} · {item.region_name} · {item.seller_name}
                </p>
              </div>
              <strong>{money(item.line_total)}</strong>
            </div>
          ))}
          {success && (
            <div className="key-delivery">
              <h2>
                <KeyRound size={22} /> Your digital keys
              </h2>
              <p className="muted">
                These are demo keys and cannot activate real games.
              </p>
              <button
                className="yellow-button"
                onClick={() => setReveal(!reveal)}
              >
                {reveal ? "Hide demo keys" : "Reveal demo keys"}
              </button>
              {reveal &&
                (keys.isPending ? (
                  <Loading label="Retrieving your keys…" />
                ) : keys.isError ? (
                  <ErrorState
                    error={keys.error}
                    retry={() => void keys.refetch()}
                  />
                ) : (
                  keys.data.data.map((key, i) => (
                    <div className="key-row" key={`${key.order_item_id}-${i}`}>
                      <code>{key.value}</code>
                      <button
                        className="outline-button"
                        aria-label={`Copy demo key ${i + 1}`}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(key.value);
                            setCopied(i);
                            setCopyError(false);
                          } catch {
                            setCopyError(true);
                          }
                        }}
                      >
                        {copied === i ? (
                          <Check size={17} />
                        ) : (
                          <Copy size={17} />
                        )}
                      </button>
                    </div>
                  ))
                ))}
              {copyError && (
                <p role="alert">
                  Clipboard unavailable. Select the key and copy it manually.
                </p>
              )}
            </div>
          )}
        </section>
        <aside className="order-summary">
          <h2>Payment summary</h2>
          <div>
            <span>Method</span>
            <span>Simulated</span>
          </div>
          <div>
            <span>Status</span>
            <span>{success ? "Paid" : "Declined"}</span>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(data.total)}</strong>
          </div>
          <Link className="yellow-button" to={success ? "/store" : "/checkout"}>
            {success ? "Find your next game" : "Try checkout again"}
          </Link>
          <Link className="text-button" to="/orders">
            View all orders
          </Link>
        </aside>
      </div>
    </div>
  );
}

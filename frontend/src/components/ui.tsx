import { Link } from "react-router-dom";
import { AlertCircle, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "../lib/api/client";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="loading-state">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error?: unknown;
  retry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? ({
          price_changed:
            "An offer price changed. Update the cart line to accept the new price.",
          cart_changed: "Your cart changed. Review it and try again.",
          out_of_stock:
            "An offer is out of stock. Update your cart to continue.",
          unauthenticated: "Please sign in to continue.",
          csrf_cookie_missing: "Allow cookies for this site and try again.",
          too_many_requests: "Too many requests. Please wait a minute.",
          cart_empty: "Your cart is empty.",
        }[error.code] ?? "We couldn’t complete that request. Please try again.")
      : "We couldn’t load this content. Please try again.";
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <p>{message}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <ShoppingBag size={42} strokeWidth={1} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Breadcrumbs({ children }: { children: ReactNode }) {
  return (
    <div className="breadcrumbs">
      <Link to="/">Home</Link>
      <span>›</span>
      {children}
    </div>
  );
}

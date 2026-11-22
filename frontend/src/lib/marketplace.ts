import { getJson, mutateJson } from "./api/client";
export type Money = { amount_minor: number; currency: string };
export type Option = { code: string; name: string };
export type Product = {
  id: number;
  slug: string;
  title: string;
  cover_url: string;
  min_price: Money | null;
  reference_price: Money | null;
  available: boolean;
  platforms: Option[];
  regions: Option[];
  description: string;
  release_date: string | null;
};
export type Offer = {
  id: number;
  price: Money;
  reference_price: Money | null;
  available: boolean;
  seller: { name: string; rating: number };
  platform: Option;
  region: Option & { activation_note: string };
};
export type Page<T> = {
  data: T[];
  meta: { page: number; per_page: number; total: number; last_page: number };
};
export type GuestLine = { offer_id: number; quantity: number };
export type CartItem = {
  id: number;
  offer: Offer;
  product: Product;
  quantity: number;
  observed_price: Money;
  valid: boolean;
  issue: string | null;
};
export type Cart = { revision: number; items: CartItem[]; total: Money };
export type CartEnvelope = { data: Cart; warnings: string[] };
export type OrderItem = {
  id: number;
  product_title: string;
  seller_name: string;
  platform_name: string;
  region_name: string;
  quantity: number;
  unit_price: Money;
  line_total: Money;
};
export type Order = {
  id: string;
  status: "fulfilled" | "failed";
  payment_status: string;
  total: Money;
  items: OrderItem[];
  created_at: string;
  fulfilled_at: string | null;
};
export type Banner = {
  heading: string;
  subheading: string;
  image_url: string;
  target_path: string;
  cta_label: string;
};
export type HomeBlock = {
  key: string;
  type: "banner" | "best_sellers" | "deals";
  title: string;
  status: "ok" | "error";
  items: Banner[] | Product[];
};
export const money = (value: Money | null | undefined) =>
  value
    ? new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: value.currency,
      }).format(value.amount_minor / 100)
    : "Sold out";
export async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await getJson(`/api/v1${path}`, signal)) as T;
}
export async function write<T>(
  path: string,
  body?: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
  headers?: Record<string, string>,
): Promise<T> {
  return (await mutateJson(`/api/v1${path}`, body, method, headers)) as T;
}

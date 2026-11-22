import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currentUser } from "../features/auth/api";
import type { User } from "../features/auth/api";
import { ApiError } from "../lib/api/client";
import { read, write } from "../lib/marketplace";
import type { CartEnvelope, GuestLine } from "../lib/marketplace";

export function useSession() {
  const query = useQuery({
    queryKey: ["session"],
    queryFn: async ({ signal }) => {
      try {
        return await currentUser(signal);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
  const client = useQueryClient();
  return {
    user: query.data,
    loading: query.isPending,
    error: query.error,
    changed: (user: User | null) => {
      client.setQueryData(["session"], user);
      client.removeQueries({ queryKey: ["orderKeys"] });
      void client.invalidateQueries({ queryKey: ["cart"] });
    },
  };
}

function loadGuest(): GuestLine[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("eneba-demo-cart") ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (line): line is GuestLine =>
          typeof line === "object" &&
          line !== null &&
          Number.isInteger(line.offer_id) &&
          line.offer_id > 0 &&
          Number.isInteger(line.quantity) &&
          line.quantity > 0 &&
          line.quantity <= 10,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

type CartContextValue = {
  cart?: CartEnvelope;
  loading: boolean;
  error: unknown;
  notice: string;
  merging: boolean;
  retry: () => void;
  count: number;
  add: (offerId: number, quantity?: number) => Promise<void>;
  update: (itemId: number, quantity: number) => Promise<void>;
  remove: (itemId: number) => Promise<void>;
};
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const client = useQueryClient();
  const [guest, setGuest] = useState<GuestLine[]>(loadGuest);
  const [notice, setNotice] = useState("");
  const [merging, setMerging] = useState(false);
  const merged = useRef<number | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem("eneba-demo-cart", JSON.stringify(guest));
    } catch {
      /* Cart still works in memory when storage is blocked. */
    }
  }, [guest]);
  const query = useQuery({
    queryKey: ["cart", user?.id ?? "guest", guest],
    enabled: !sessionLoading,
    retry: false,
    queryFn: async () =>
      user
        ? read<CartEnvelope>("/cart")
        : guest.length
          ? write<CartEnvelope>("/cart/preview", { items: guest })
          : {
              data: {
                revision: 1,
                items: [],
                total: { amount_minor: 0, currency: "EUR" },
              },
              warnings: [],
            },
  });
  async function merge() {
    if (!user || !guest.length) return;
    setMerging(true);
    try {
      const result = await write<CartEnvelope>("/cart/merge", { items: guest });
      setGuest([]);
      setNotice(result.warnings.join(" "));
      await client.invalidateQueries({ queryKey: ["cart"] });
    } catch {
      setNotice(
        "Your saved cart could not be merged. Retry before continuing to checkout.",
      );
    } finally {
      setMerging(false);
    }
  }
  useEffect(() => {
    if (!user) {
      merged.current = null;
      client.removeQueries({ queryKey: ["orderKeys"] });
      return;
    }
    if (merged.current === user.id) return;
    merged.current = user.id;
    if (guest.length) void merge();
  }, [user?.id]); // A saved guest cart is merged once per signed-in session; retry is explicit.
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["cart"] });
  }
  return (
    <CartContext.Provider
      value={{
        cart: query.data,
        loading: query.isPending || sessionLoading,
        error: query.error,
        notice,
        merging,
        retry: () => {
          if (guest.length && user) void merge();
          else void query.refetch();
        },
        count: user
          ? (query.data?.data.items.reduce(
              (sum, line) => sum + line.quantity,
              0,
            ) ?? 0)
          : guest.reduce((sum, line) => sum + line.quantity, 0),
        add: async (id, quantity = 1) => {
          if (user) {
            await write("/cart/items", { offer_id: id, quantity });
            await refresh();
          } else
            setGuest((lines) => {
              const existing = lines.find((line) => line.offer_id === id);
              return existing
                ? lines.map((line) =>
                    line.offer_id === id
                      ? {
                          ...line,
                          quantity: Math.min(10, line.quantity + quantity),
                        }
                      : line,
                  )
                : lines.length < 50
                  ? [...lines, { offer_id: id, quantity }]
                  : lines;
            });
        },
        update: async (id, quantity) => {
          if (user) {
            await write(`/cart/items/${id}`, { quantity }, "PATCH");
            await refresh();
          } else
            setGuest((lines) =>
              lines.map((line) =>
                line.offer_id === id ? { ...line, quantity } : line,
              ),
            );
        },
        remove: async (id) => {
          if (user) {
            await write(`/cart/items/${id}`, {}, "DELETE");
            await refresh();
          } else
            setGuest((lines) => lines.filter((line) => line.offer_id !== id));
        },
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("CartProvider is required");
  return cart;
}

import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShieldCheck, Gamepad2 } from "lucide-react";
import { CartProvider, useSession } from "./app/providers";
import { Header } from "./components/Header";
import { AuthPanel } from "./features/auth/AuthPanel";
import { HomePage } from "./features/store/HomePage";
import { StorePage } from "./features/store/StorePage";
import { ProductPage } from "./features/store/ProductPage";
import { CartPage } from "./features/checkout/CartPage";
import { CheckoutPage } from "./features/checkout/CheckoutPage";
import { OrdersPage, OrderPage } from "./features/orders/OrdersPage";
import { Empty } from "./components/ui";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false },
  },
});
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
function AccountPage() {
  const { changed } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <div className="container account-page">
      <div className="account-intro">
        <span className="eyebrow">MORE GAMES. MORE POSSIBILITIES.</span>
        <h1>Your next adventure starts here.</h1>
        <p>
          Find games you love, compare offers and keep your digital purchases in
          one place.
        </p>
        <div>
          <ShieldCheck size={22} />
          <span>Your orders and keys, securely in your account.</span>
        </div>
        <Link className="text-button" to="/orders">
          View my orders →
        </Link>
      </div>
      <AuthPanel
        onSessionChange={(user) => {
          changed(user);
          if (user) {
            const next = params.get("next");
            if (next?.startsWith("/") && !next.startsWith("//")) navigate(next);
          }
        }}
      />
    </div>
  );
}
export default function App() {
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <CartProvider>
          <ScrollReset />
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/store" element={<StorePage />} />
              <Route path="/products/:slug" element={<ProductPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderPage />} />
              <Route
                path="*"
                element={
                  <div className="container">
                    <Empty title="This page couldn’t be found">
                      <Link to="/store" className="yellow-button">
                        Explore the store
                      </Link>
                    </Empty>
                  </div>
                }
              />
            </Routes>
          </main>
          <footer className="site-footer">
            <div className="container">
              <div className="footer-main">
                <div>
                  <Link to="/" className="brand">
                    <Gamepad2 size={33} />
                    <span>
                      eneba<span className="brand-dot">.</span>
                    </span>
                  </Link>
                  <p>
                    Great games. Better prices.
                    <br />
                    Your next adventure starts here.
                  </p>
                </div>
                <div>
                  <h3>Discover</h3>
                  <Link to="/store">All games</Link>
                  <Link to="/store?sort=price_asc">Great deals</Link>
                  <Link to="/store?region=global">Global keys</Link>
                </div>
                <div>
                  <h3>Your account</h3>
                  <Link to="/account">Sign in / Register</Link>
                  <Link to="/orders">Order history</Link>
                  <Link to="/cart">Shopping cart</Link>
                </div>
                <div className="footer-demo">
                  <ShieldCheck size={28} />
                  <strong>Built for the assignment</strong>
                  <p>
                    Eneba-style internship demo. Sellers, offers and activation
                    keys are fictional. All payments are simulated.
                  </p>
                </div>
              </div>
              <div className="footer-bottom">
                <span>Internship marketplace · {new Date().getFullYear()}</span>
                <span>English EU · EUR</span>
                <span>Demo purchases only · No real money</span>
              </div>
            </div>
          </footer>
        </CartProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

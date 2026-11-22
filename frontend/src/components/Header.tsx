import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ShoppingCart,
  UserRound,
  Menu,
  Globe2,
  ChevronRight,
} from "lucide-react";
import { useCart, useSession } from "../app/providers";
import { read, money } from "../lib/marketplace";
import type { Product, Option } from "../lib/marketplace";

export function Header() {
  const { user } = useSession();
  const { count } = useCart();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const results = useQuery({
    queryKey: ["search", term],
    enabled: term.length >= 2 && open,
    queryFn: ({ signal }) =>
      read<{ data: Product[] }>(
        `/search?q=${encodeURIComponent(term)}&limit=5`,
        signal,
      ),
    retry: false,
  });
  const filters = useQuery({
    queryKey: ["filters"],
    queryFn: ({ signal }) =>
      read<{ data: { platforms: Option[]; regions: Option[] } }>(
        "/catalog/filters",
        signal,
      ),
    staleTime: 60_000,
  });
  function search() {
    if (input.trim().length < 2) return;
    setOpen(false);
    navigate(`/store?q=${encodeURIComponent(input.trim())}`);
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Eneba-style demo home">
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              eneba<span className="brand-dot">.</span>
            </span>
          </Link>
          <div className="search-wrapper">
            <form
              className="global-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                search();
              }}
            >
              <button aria-label="Search products" type="submit">
                <Search size={25} strokeWidth={1.6} />
              </button>
              <input
                aria-label="Search for games"
                placeholder="Search for games and more"
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                }}
                autoComplete="off"
              />
            </form>
            {open && term.length >= 2 && (
              <div className="search-results">
                {results.isPending ? (
                  <p>Searching…</p>
                ) : results.isError ? (
                  <p>Search is unavailable. Try again.</p>
                ) : results.data?.data.length ? (
                  <>
                    {results.data.data.map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.slug}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setOpen(false);
                          setInput("");
                        }}
                      >
                        <img src={product.cover_url} alt="" />
                        <span>
                          {product.title}
                          <small>
                            {product.platforms.map((p) => p.name).join(" · ")}
                          </small>
                        </span>
                        <strong>{money(product.min_price)}</strong>
                      </Link>
                    ))}
                    <button className="search-all" onClick={search}>
                      See all results <ChevronRight size={16} />
                    </button>
                  </>
                ) : (
                  <p>No games found. Try a different name.</p>
                )}
              </div>
            )}
          </div>
          <span className="locale">
            <Globe2 size={17} /> English EU <b>|</b> EUR
          </span>
          <Link
            className="header-icon cart-link"
            to="/cart"
            aria-label={`Cart, ${count} items`}
          >
            <ShoppingCart size={27} strokeWidth={1.5} />
            {count > 0 && <b>{count}</b>}
          </Link>
          <Link
            className="account-link"
            to="/account"
            aria-label={user ? `Account: ${user.name}` : "Log in or register"}
          >
            <UserRound size={25} strokeWidth={1.5} />
            <span>{user ? user.name : "Log in | Register"}</span>
          </Link>
        </div>
      </header>
      <nav className="site-nav" aria-label="Store navigation">
        <div className="nav-inner">
          <NavLink to="/store">
            <Menu size={20} /> Categories
          </NavLink>
          <NavLink to="/store?sort=price_asc">Cheap games</NavLink>
          {filters.data?.data.platforms.map((platform) => (
            <NavLink
              key={platform.code}
              to={`/store?platform=${platform.code}`}
            >
              {platform.name}
            </NavLink>
          ))}
          <NavLink to="/store?available=1">In stock</NavLink>
          <NavLink to="/orders">My orders</NavLink>
          <span className="demo-pill">DEMO MARKETPLACE</span>
        </div>
      </nav>
    </>
  );
}

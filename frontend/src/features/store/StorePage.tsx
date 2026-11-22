import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X, Search } from "lucide-react";
import { read } from "../../lib/marketplace";
import type { Product, Page, Option } from "../../lib/marketplace";
import { ProductCard } from "../../components/ProductCard";
import { Breadcrumbs, Empty, ErrorState, Loading } from "../../components/ui";

export function StorePage() {
  const [params, setParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  const filters = useQuery({
    queryKey: ["filters"],
    queryFn: ({ signal }) =>
      read<{ data: { platforms: Option[]; regions: Option[] } }>(
        "/catalog/filters",
        signal,
      ),
    staleTime: 60_000,
  });
  const apiParams = new URLSearchParams(params);
  if (!apiParams.has("per_page")) apiParams.set("per_page", "12");
  const queryString = apiParams.toString();
  const products = useQuery({
    queryKey: ["products", queryString],
    queryFn: ({ signal }) =>
      read<Page<Product>>(`/products?${queryString}`, signal),
    retry: false,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  const chips = [
    "q",
    "platform",
    "region",
    "min_price",
    "max_price",
    "available",
  ].filter((key) => params.has(key));
  return (
    <div className="container store-page">
      <Breadcrumbs>
        <span>Games</span>
      </Breadcrumbs>
      <div className="store-title">
        <div>
          <span className="eyebrow">A WORLD OF GAMES</span>
          <h1>
            {params.get("q") ? `Results for “${params.get("q")}”` : "Games"}
          </h1>
          <p className="muted">
            Find your next favourite. Compare offers and play for less.
          </p>
        </div>
        <button
          className="outline-button mobile-filter-button"
          onClick={() => setMobileFilters(!mobileFilters)}
        >
          <SlidersHorizontal size={17} /> Filters
        </button>
      </div>
      <div className="store-layout">
        <aside
          className={`filters ${mobileFilters ? "filters-open" : ""}`}
          aria-label="Product filters"
        >
          <div className="filter-heading">
            <h2>Filters</h2>
            <button
              className="text-button"
              onClick={() => setParams(new URLSearchParams())}
            >
              Reset all
            </button>
          </div>
          <form
            className="filter-search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(
                new FormData(event.currentTarget).get("q") ?? "",
              ).trim();
              if (value.length === 0 || value.length >= 2) change("q", value);
            }}
          >
            <label htmlFor="catalog-search">Search by name</label>
            <div>
              <input
                key={params.get("q")}
                id="catalog-search"
                name="q"
                placeholder="Search games"
                defaultValue={params.get("q") ?? ""}
                minLength={2}
                maxLength={100}
              />
              <button aria-label="Apply name search">
                <Search size={18} />
              </button>
            </div>
          </form>
          <fieldset>
            <legend>Platform</legend>
            {filters.data?.data.platforms.map((option) => (
              <label className="check-option" key={option.code}>
                <input
                  type="radio"
                  name="platform"
                  checked={params.get("platform") === option.code}
                  onChange={() => change("platform", option.code)}
                />
                <span>{option.name}</span>
              </label>
            ))}
            {params.has("platform") && (
              <button
                className="text-button"
                onClick={() => change("platform", "")}
              >
                All platforms
              </button>
            )}
          </fieldset>
          <fieldset>
            <legend>Region</legend>
            {filters.data?.data.regions.map((option) => (
              <label className="check-option" key={option.code}>
                <input
                  type="radio"
                  name="region"
                  checked={params.get("region") === option.code}
                  onChange={() => change("region", option.code)}
                />
                <span>{option.name}</span>
              </label>
            ))}
            {params.has("region") && (
              <button
                className="text-button"
                onClick={() => change("region", "")}
              >
                All regions
              </button>
            )}
          </fieldset>
          <form
            className="price-filter"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const next = new URLSearchParams(params);
              for (const key of ["min_price", "max_price"]) {
                const value = String(data.get(key) ?? "");
                if (value !== "")
                  next.set(key, String(Math.round(Number(value) * 100)));
                else next.delete(key);
              }
              next.delete("page");
              setParams(next);
            }}
          >
            <h3>Price (€)</h3>
            <div>
              <label>
                <span className="sr-only">Minimum price in euros</span>
                <input
                  key={`min-${params.get("min_price")}`}
                  name="min_price"
                  aria-label="Minimum price in euros"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  placeholder="From"
                  defaultValue={
                    params.has("min_price")
                      ? Number(params.get("min_price")) / 100
                      : ""
                  }
                />
              </label>
              <span>–</span>
              <label>
                <span className="sr-only">Maximum price in euros</span>
                <input
                  key={`max-${params.get("max_price")}`}
                  name="max_price"
                  aria-label="Maximum price in euros"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  placeholder="To"
                  defaultValue={
                    params.has("max_price")
                      ? Number(params.get("max_price")) / 100
                      : ""
                  }
                />
              </label>
            </div>
            <button className="outline-button">Apply price</button>
          </form>
          <label className="check-option">
            <input
              type="checkbox"
              checked={params.get("available") === "1"}
              onChange={(event) =>
                change("available", event.target.checked ? "1" : "")
              }
            />
            <span>Available now</span>
          </label>
          {filters.isError && (
            <ErrorState
              error={filters.error}
              retry={() => void filters.refetch()}
            />
          )}
        </aside>
        <section className="catalog-results" aria-label="Catalog results">
          <div className="catalog-toolbar">
            <p>
              {products.data ? (
                <>
                  <strong>{products.data.meta.total}</strong> games found
                </>
              ) : (
                "Finding games…"
              )}
            </p>
            <label>
              Sort by{" "}
              <select
                aria-label="Sort products"
                value={
                  params.get("sort") ??
                  (params.get("q") ? "relevance" : "newest")
                }
                onChange={(event) => change("sort", event.target.value)}
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name_asc">Name: A–Z</option>
              </select>
            </label>
          </div>
          {chips.length > 0 && (
            <div className="filter-chips">
              {chips.map((key) => (
                <button key={key} onClick={() => change(key, "")}>
                  {key === "available"
                    ? "In stock"
                    : `${key.replace("_", " ")}: ${params.get(key)}`}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}
          {products.isPending ? (
            <Loading label="Loading games…" />
          ) : products.isError ? (
            <ErrorState
              error={products.error}
              retry={() => void products.refetch()}
            />
          ) : products.data.data.length ? (
            <>
              <div className="product-grid catalog-grid">
                {products.data.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <nav className="pagination" aria-label="Catalog pagination">
                <button
                  disabled={products.data.meta.page <= 1}
                  className="outline-button"
                  onClick={() =>
                    change("page", String(products.data.meta.page - 1))
                  }
                >
                  Previous
                </button>
                <span>
                  Page {products.data.meta.page} of{" "}
                  {products.data.meta.last_page}
                </span>
                <button
                  disabled={
                    products.data.meta.page >= products.data.meta.last_page
                  }
                  className="outline-button"
                  onClick={() =>
                    change("page", String(products.data.meta.page + 1))
                  }
                >
                  Next
                </button>
              </nav>
            </>
          ) : (
            <Empty title="No games found">
              <p>Try another search or remove a filter.</p>
              <Link className="yellow-button" to="/store">
                Browse all games
              </Link>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}

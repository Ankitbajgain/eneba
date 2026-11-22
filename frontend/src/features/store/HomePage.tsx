import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gamepad2, ShieldCheck, Zap, Globe2 } from "lucide-react";
import { read } from "../../lib/marketplace";
import type { HomeBlock, Banner, Product, Option } from "../../lib/marketplace";
import { ProductCard } from "../../components/ProductCard";
import { ErrorState, Loading } from "../../components/ui";

export function HomePage() {
  const home = useQuery({
    queryKey: ["home"],
    queryFn: ({ signal }) => read<{ data: HomeBlock[] }>("/home", signal),
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
  if (home.isPending) return <Loading label="Finding your next adventure…" />;
  if (home.isError)
    return (
      <div className="container">
        <ErrorState error={home.error} retry={() => void home.refetch()} />
      </div>
    );
  return (
    <>
      {home.data.data.map((block) => (
        <Fragment key={block.key}>
          {block.type === "banner" ? (
            <>
              <section className="campaigns" aria-label={block.title}>
                {block.status === "error" ? (
                  <ErrorState retry={() => void home.refetch()} />
                ) : (
                  (block.items as Banner[]).map((banner, i) => {
                    const Heading = i === 0 ? "h1" : "h2";
                    return (
                      <Link
                        to={
                          banner.target_path.startsWith("/") &&
                          !banner.target_path.startsWith("//")
                            ? banner.target_path
                            : "/store"
                        }
                        className={`campaign campaign-${i}`}
                        key={banner.heading}
                        style={{
                          backgroundImage: `linear-gradient(90deg,rgba(17,5,43,.85),rgba(17,5,43,.1)),url("${banner.image_url}")`,
                        }}
                      >
                        <div>
                          <Heading>{banner.heading}</Heading>
                          <p>{banner.subheading}</p>
                          <span className="campaign-cta">
                            {banner.cta_label} <ArrowRight size={17} />
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </section>
              <div className="container">
                <nav className="category-row" aria-label="Browse categories">
                  <Link to="/store">
                    <Gamepad2 />
                    <span>All games</span>
                  </Link>
                  {filters.data?.data.platforms.map((platform) => (
                    <Link
                      key={platform.code}
                      to={`/store?platform=${platform.code}`}
                    >
                      <Gamepad2 />
                      <span>{platform.name}</span>
                    </Link>
                  ))}
                  <Link to="/store?sort=price_asc">
                    <Zap />
                    <span>Great deals</span>
                  </Link>
                  <Link to="/store?region=global">
                    <Globe2 />
                    <span>Global keys</span>
                  </Link>
                  <Link to="/store?available=1">
                    <ShieldCheck />
                    <span>In stock</span>
                  </Link>
                </nav>
              </div>
            </>
          ) : (
            <div className="container">
              <section className="product-section">
                <div className="section-heading">
                  <h2>{block.title}</h2>
                  <Link
                    to={
                      block.type === "deals"
                        ? "/store?sort=price_asc"
                        : "/store"
                    }
                  >
                    View all <ArrowRight size={16} />
                  </Link>
                </div>
                {block.status === "error" ? (
                  <ErrorState retry={() => void home.refetch()} />
                ) : block.items.length ? (
                  <div className="product-grid home-products">
                    {(block.items as Product[]).map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    This collection is being updated. Browse all games in the
                    store.
                  </p>
                )}
              </section>
            </div>
          )}
        </Fragment>
      ))}
    </>
  );
}

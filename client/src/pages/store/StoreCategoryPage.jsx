import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStoreProducts } from "../../api/store.service.ts";
import { useCartStore } from "../../store/cart.store.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreCategoryPage() {
  const { slug } = useParams();
  let safeSlug = "";
  if (slug) {
    try {
      safeSlug = decodeURIComponent(slug).trim();
    } catch {
      safeSlug = slug.trim();
    }
  }
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const invalidSlug =
    !safeSlug || safeSlug.includes("<") || safeSlug.includes(">");
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!safeSlug || invalidSlug) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError("");

    fetchStoreProducts({ category: safeSlug })
      .then((response) => {
        if (!isActive) return;
        setProducts(response.data ?? response?.data?.data ?? []);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load category products.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [safeSlug, invalidSlug]);

  if (invalidSlug) {
    return (
      <section>
        <h1>Invalid category slug</h1>
        <p>Please choose a category from the storefront home.</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Category: {safeSlug || "Unknown"}</h1>
      {isLoading ? <p>Loading products...</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {!isLoading && !error ? (
        products.length === 0 ? (
          <p>No products found.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                style={{
                  padding: "12px",
                  background: "#fff",
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid #e2e2e2",
                  borderRadius: "8px",
                }}
              >
                <div style={{ fontWeight: 600 }}>{product.name}</div>
                <div style={{ marginBottom: "8px" }}>
                  {currency.format(Number(product.price || 0))}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    addItem({
                      id: product.id,
                      name: product.name,
                      price: Number(product.price || 0),
                      imageUrl: product.imageUrl ?? null,
                    });
                  }}
                >
                  Add to cart
                </button>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}

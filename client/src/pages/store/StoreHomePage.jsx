import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStoreCategories, fetchStoreProducts } from "../../api/store.service.ts";
import { useCartStore } from "../../store/cart.store.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreHomePage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError("");

    Promise.all([fetchStoreCategories(), fetchStoreProducts()])
      .then(([categoriesResponse, productsResponse]) => {
        if (!isActive) return;
        setCategories(categoriesResponse.data || []);
        setProducts(productsResponse.data || []);
      })
      .catch(() => {
        if (!isActive) return;
        setError("Failed to load store data.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading) {
    return (
      <section>
        <h1>Store Home</h1>
        <p>Loading storefront...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Store Home</h1>
        <p style={{ color: "crimson" }}>{error}</p>
      </section>
    );
  }

  return (
    <section>
      <h1>Store Home</h1>
      <div style={{ marginBottom: "24px" }}>
        <h2>Categories</h2>
        {categories.length === 0 ? (
          <p>No categories available.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${encodeURIComponent(category.slug)}`}
                style={{
                  padding: "6px 12px",
                  background: "#ffffff",
                  borderRadius: "999px",
                  border: "1px solid #e2e2e2",
                  textDecoration: "none",
                  color: "inherit",
                  fontSize: "0.9rem",
                }}
              >
                {category.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2>Products</h2>
        {products.length === 0 ? (
          <p>No products available.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
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
                  display: "block",
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
        )}
      </div>
    </section>
  );
}

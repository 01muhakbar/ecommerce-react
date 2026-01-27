import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStoreProductById } from "../../api/store.service.ts";
import { useCartStore } from "../../store/cart.store.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError("");

    fetchStoreProductById(id)
      .then((response) => {
        if (!isActive) return;
        setProduct(response.data || null);
      })
      .catch((err) => {
        if (!isActive) return;
        const status = err?.response?.status;
        setError(status === 404 ? "Product not found." : "Failed to load product.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <section>
        <h1>Store Product Detail</h1>
        <p>Loading product...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Store Product Detail</h1>
        <p style={{ color: "crimson" }}>{error}</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  if (!product) {
    return (
      <section>
        <h1>Store Product Detail</h1>
        <p>Product not found.</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  const hasSale =
    product.salePrice !== null &&
    product.salePrice !== undefined &&
    Number(product.salePrice) > 0;

  return (
    <section>
      <h1>{product.name}</h1>
      <div style={{ marginBottom: "12px" }}>
        {hasSale ? (
          <>
            <span style={{ fontWeight: 600, marginRight: "8px", color: "#c2410c" }}>
              {currency.format(Number(product.salePrice || 0))}
            </span>
            <span style={{ textDecoration: "line-through", opacity: 0.7 }}>
              {currency.format(Number(product.price || 0))}
            </span>
          </>
        ) : (
          <span style={{ fontWeight: 600 }}>{currency.format(Number(product.price || 0))}</span>
        )}
      </div>
      <div style={{ marginBottom: "12px" }}>
        Category:{" "}
        {product.category ? (
          <Link to={`/category/${encodeURIComponent(product.category.slug)}`}>
            {product.category.name}
          </Link>
        ) : (
          "Uncategorized"
        )}
      </div>
      {typeof product.stock === "number" ? (
        <div style={{ marginBottom: "12px" }}>Stock: {product.stock}</div>
      ) : null}
      {product.description ? <p>{product.description}</p> : null}
      <button
        type="button"
        onClick={() =>
          addItem({
            id: product.id,
            name: product.name,
            price: Number(product.price || 0),
            imageUrl: product.imageUrl ?? null,
          })
        }
        style={{ marginTop: "12px" }}
      >
        Add to cart
      </button>
      <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
        <Link to="/">Back to Store Home</Link>
        {product.category ? (
          <Link to={`/category/${encodeURIComponent(product.category.slug)}`}>
            Back to Category
          </Link>
        ) : null}
      </div>
    </section>
  );
}

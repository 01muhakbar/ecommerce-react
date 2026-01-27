import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreCartPage() {
  const navigate = useNavigate();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);

  if (items.length === 0) {
    return (
      <section>
        <h1>Cart</h1>
        <p>Cart is empty.</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Cart</h1>
      <div style={{ display: "grid", gap: "12px", marginBottom: "24px" }}>
        {items.map((item) => (
          <div
            key={item.productId}
            style={{
              padding: "12px",
              border: "1px solid #e2e2e2",
              borderRadius: "8px",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <div>{currency.format(Number(item.price || 0))}</div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => updateQty(item.productId, item.qty - 1)}
              >
                -
              </button>
              <span>{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.productId, item.qty + 1)}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                style={{ marginLeft: "auto" }}
              >
                Remove
              </button>
            </div>
            <div style={{ marginTop: "8px" }}>
              Item total: {currency.format(Number(item.price || 0) * item.qty)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 600, marginBottom: "16px" }}>
        Subtotal: {currency.format(Number(subtotal || 0))}
      </div>
      <button type="button" onClick={() => navigate("/checkout")}>
        Checkout
      </button>
    </section>
  );
}

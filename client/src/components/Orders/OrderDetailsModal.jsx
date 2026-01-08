import { formatCurrency } from "../../utils/format.js";

export default function OrderDetailsModal({ open, order, onClose }) {
  if (!open || !order) {
    return null;
  }

  const customerName =
    order.customer?.name || order.customerName || order.customer || "—";
  const customerEmail = order.customer?.email || order.customerEmail || "—";
  const createdAt = order.createdAt || order.orderTime || "—";
  const totalAmount = typeof order.amount === "number" ? order.amount : order.total;
  const items = order.items || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          width: 420,
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <h3 style={{ margin: "0 0 12px" }}>Order Details</h3>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <div>
            <strong>Order ID:</strong> {order.id || "—"}
          </div>
          <div>
            <strong>Created At:</strong> {createdAt}
          </div>
          <div>
            <strong>Status:</strong> {order.status || "—"}
          </div>
          <div>
            <strong>Total:</strong>{" "}
            {typeof totalAmount === "number" ? formatCurrency(totalAmount) : "—"}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px" }}>Customer</h4>
          <div>
            <strong>Name:</strong> {customerName}
          </div>
          <div>
            <strong>Email:</strong> {customerEmail}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px" }}>Items</h4>
          {items.length === 0 ? (
            <div style={{ color: "#6b7280" }}>No items available.</div>
          ) : (
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {items.map((item, index) => (
                <li key={item.id || index}>
                  {item.name || "Item"} x{item.quantity || 1} —{" "}
                  {typeof item.price === "number"
                    ? formatCurrency(item.price)
                    : "—"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 8px" }}>Payment & Shipping</h4>
          <div>
            <strong>Method:</strong> {order.method || "—"}
          </div>
          <div>
            <strong>Shipping:</strong> {order.shipping || "—"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

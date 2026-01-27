import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { orderService } from "../../api/index.ts";
import { formatCurrency } from "../../utils/format.js";

const STATUS_OPTIONS = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await orderService.getOrder(id);
        if (!active) return;
        setOrder(data);
        setStatus(data?.status || "");
      } catch (err) {
        if (!active) return;
        setError("Failed to load order details.");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!order || !status) {
      return;
    }
    setIsUpdating(true);
    setSuccess("");
    setError("");
    try {
      const response = await orderService.updateOrderStatus(order.id, {
        status,
      });
      const updated = response?.data || response?.order || order;
      setOrder((prev) => ({ ...prev, ...updated, status }));
      setSuccess("Status updated.");
    } catch (err) {
      setError("Failed to update status.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: "24px" }}>Loading order...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <p style={{ color: "crimson" }}>{error}</p>
        <Link to="/admin/orders">Back to Orders</Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ padding: "24px" }}>
        <p>Order not found.</p>
        <Link to="/admin/orders">Back to Orders</Link>
      </div>
    );
  }

  const items = order.items || [];
  const customerName = order.customerName || order.customer?.name || "Guest";
  const customerEmail = order.customer?.email || "";

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <Link to="/admin/orders">Back to Orders</Link>
      </div>

      <h1>Order Detail</h1>

      <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "12px" }}>
          <h3>Summary</h3>
          <div>Invoice: {order.invoiceNo || order.id}</div>
          <div>Status: {order.status}</div>
          <div>Total: {formatCurrency(Number(order.totalAmount || 0))}</div>
          <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
        </div>

        <div style={{ background: "#fff", padding: "16px", borderRadius: "12px" }}>
          <h3>Customer</h3>
          <div>Name: {customerName}</div>
          {customerEmail ? <div>Email: {customerEmail}</div> : null}
          <div>Phone: {order.customerPhone || "—"}</div>
          <div>Address: {order.customerAddress || "—"}</div>
          <div>Notes: {order.customerNotes || "—"}</div>
        </div>

        <div style={{ background: "#fff", padding: "16px", borderRadius: "12px" }}>
          <h3>Items</h3>
          {items.length === 0 ? (
            <p>No items found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 0" }}>Product</th>
                  <th style={{ textAlign: "right", padding: "8px 0" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "8px 0" }}>Price</th>
                  <th style={{ textAlign: "right", padding: "8px 0" }}>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "8px 0" }}>
                      {item.product?.name || `Product #${item.productId}`}
                    </td>
                    <td style={{ textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency(Number(item.price || 0))}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency(Number(item.lineTotal || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ background: "#fff", padding: "16px", borderRadius: "12px" }}>
          <h3>Update Status</h3>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Select status</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleUpdateStatus} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update"}
            </button>
          </div>
          {success ? <p style={{ color: "green" }}>{success}</p> : null}
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

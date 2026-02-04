import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchStoreOrder } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import StatusBadge from "../../components/UI/StatusBadge.jsx";
import {
  COD_INSTRUCTIONS,
  TRANSFER_INSTRUCTIONS,
} from "../../config/paymentInstructions.ts";

export default function StoreOrderTrackingPage() {
  const { ref } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const resetTimerRef = useRef(null);

  const resetCopyStatus = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => setCopyStatus(""), 1500);
  };

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("success");
      resetCopyStatus();
    } catch (err) {
      setCopyStatus("error");
      resetCopyStatus();
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!ref) {
        setError("Invalid order reference.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const response = await fetchStoreOrder(ref);
        if (!active) return;
        setOrder(response.data || null);
      } catch (err) {
        if (!active) return;
        const status = err?.response?.status;
        setError(status === 404 ? "Order not found." : "Failed to load order.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [ref]);

  if (isLoading) {
    return (
      <section>
        <h1>Order Tracking</h1>
        <p>Loading order...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Order Tracking</h1>
        <p style={{ color: "crimson" }}>{error}</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  if (!order) {
    return (
      <section>
        <h1>Order Tracking</h1>
        <p>Order not found.</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  const invoiceRef = order.invoiceNo || order.ref;

  return (
    <section>
      <h1>Order Tracking</h1>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ marginBottom: "6px" }}>Invoice: {invoiceRef}</div>
        {invoiceRef ? (
          <div style={{ marginBottom: "6px" }}>
            <button type="button" onClick={() => copyToClipboard(invoiceRef)}>
              {copyStatus === "success" ? "Copied!" : "Copy Invoice"}
            </button>
            {copyStatus === "error" ? (
              <span style={{ marginLeft: "8px", color: "crimson" }}>
                Failed to copy
              </span>
            ) : null}
          </div>
        ) : null}
        <div>
          Status: <StatusBadge status={order.status} />
        </div>
        <div>Payment Method: {order.paymentMethod || "COD"}</div>
        {order.paymentMethod === "TRANSFER" ? (
          <div style={{ marginTop: "8px", padding: "12px", border: "1px solid #e2e2e2" }}>
            <strong>How to pay (Bank Transfer)</strong>
            <div>Bank: {TRANSFER_INSTRUCTIONS.bank}</div>
            <div>Account No: {TRANSFER_INSTRUCTIONS.accountNo}</div>
            <div>Account Name: {TRANSFER_INSTRUCTIONS.accountName}</div>
            <div style={{ marginTop: "6px" }}>
              After transfer, please upload proof via WhatsApp{" "}
              {TRANSFER_INSTRUCTIONS.whatsapp}.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "8px", padding: "12px", border: "1px solid #e2e2e2" }}>
            <strong>Pay on delivery</strong>
            <div>{COD_INSTRUCTIONS.text}</div>
          </div>
        )}
        <div>
          Created At:{" "}
          {order.createdAt
            ? new Date(order.createdAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <h3>Customer</h3>
        <div>Name: {order.customerName || "—"}</div>
        <div>Phone: {order.customerPhone || "—"}</div>
        <div>Address: {order.customerAddress || "—"}</div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <h3>Items</h3>
        {order.items && order.items.length > 0 ? (
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
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: "8px 0" }}>{item.name}</td>
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
        ) : (
          <p>No items found.</p>
        )}
      </div>

      <div style={{ fontWeight: 600 }}>
        Total: {formatCurrency(Number(order.totalAmount || 0))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <Link to="/">Back to Store Home</Link>
      </div>
    </section>
  );
}

import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function StoreCheckoutSuccessPage() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || params.get("orderId");
  const invoiceNo = params.get("invoiceNo") || ref;
  const total = params.get("total");
  const method = params.get("method");
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

  return (
    <section>
      <h1>Checkout Success</h1>
      <p>Your order has been placed successfully.</p>
      {invoiceNo ? (
        <div style={{ marginBottom: "8px" }}>
          <div>Invoice: {invoiceNo}</div>
          <div style={{ marginTop: "6px" }}>
            <button type="button" onClick={() => copyToClipboard(invoiceNo)}>
              {copyStatus === "success" ? "Copied!" : "Copy Invoice"}
            </button>
            {copyStatus === "error" ? (
              <span style={{ marginLeft: "8px", color: "crimson" }}>
                Failed to copy
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {total ? <p>Total: {total}</p> : null}
      <p>Payment Method: {method || "COD"}</p>
      {ref ? (
        <Link to={`/order/${encodeURIComponent(ref)}`}>View Order</Link>
      ) : null}
      <Link to="/">Back to Store Home</Link>
    </section>
  );
}

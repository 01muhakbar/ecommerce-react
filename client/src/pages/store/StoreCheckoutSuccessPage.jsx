import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  COD_INSTRUCTIONS,
  TRANSFER_INSTRUCTIONS,
} from "../../config/paymentInstructions.ts";

export default function StoreCheckoutSuccessPage() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || params.get("orderId") || params.get("invoiceNo");
  const invoiceNo = params.get("invoiceNo") || ref;
  const total = params.get("total");
  const method = params.get("method") || "COD";
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
      <p>Payment Method: {method}</p>
      {method === "TRANSFER" ? (
        <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #e2e2e2" }}>
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
        <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #e2e2e2" }}>
          <strong>Pay on delivery</strong>
          <div>{COD_INSTRUCTIONS.text}</div>
        </div>
      )}
      <div className="flex gap-3" style={{ marginTop: "12px", flexWrap: "wrap" }}>
        {ref ? (
          <Link to={`/order/${encodeURIComponent(ref)}`}>Track your order</Link>
        ) : (
          <Link to="/account/orders">Track your order</Link>
        )}
        <Link to="/">Back to Store Home</Link>
      </div>
    </section>
  );
}

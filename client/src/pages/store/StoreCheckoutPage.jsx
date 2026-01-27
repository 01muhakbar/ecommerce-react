import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { createStoreOrder } from "../../api/store.service.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreCheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const clearCart = useCartStore((state) => state.clearCart);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (items.length === 0) {
    return (
      <section>
        <h1>Checkout</h1>
        <p>Your cart is empty.</p>
        <Link to="/">Back to Store Home</Link>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError("Please complete your contact details.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createStoreOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim() ? notes.trim() : undefined,
        },
        paymentMethod,
        items: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
        })),
      });

      clearCart();
      const invoiceNo = response?.data?.invoiceNo;
      const ref = invoiceNo || String(response.data.orderId);
      navigate(
        `/checkout/success?ref=${encodeURIComponent(ref)}&method=${encodeURIComponent(
          response.data.paymentMethod || paymentMethod
        )}`
      );
    } catch (err) {
      const message = err?.response?.data?.message;
      setError(message || "Checkout failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Checkout</h1>
      <p>Subtotal: {currency.format(Number(subtotal || 0))}</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-name">Name</label>
          <input
            id="checkout-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-phone">Phone</label>
          <input
            id="checkout-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-address">Address</label>
          <textarea
            id="checkout-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={3}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-method">Payment Method</label>
          <select
            id="checkout-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            style={{ display: "block", width: "100%", padding: "8px" }}
          >
            <option value="COD">COD</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="EWALLET">EWALLET</option>
          </select>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <label htmlFor="checkout-notes">Notes (optional)</label>
          <textarea
            id="checkout-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            style={{ display: "block", width: "100%", padding: "8px" }}
          />
        </div>
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Place Order"}
        </button>
      </form>
    </section>
  );
}

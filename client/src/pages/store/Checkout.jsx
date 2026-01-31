import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { createStoreOrder } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const totalQty = useCartStore((state) => state.totalQty);
  const clearCart = useCartStore((state) => state.clearCart);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isMissingError, setIsMissingError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!mounted) return;
        if (res.status === 401) {
          navigate("/auth/login");
        }
      } catch (_) {
        if (mounted) {
          navigate("/auth/login");
        }
      }
    };
    checkAuth();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
        <h1 className="text-xl font-semibold">Checkout</h1>
        <p className="mt-2 text-sm text-slate-500">Your cart is empty.</p>
        <Link
          to="/search"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Browse products
        </Link>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsMissingError(false);

    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      setError("Please complete your contact details.");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (
      items.some((item) => {
        const productId = Number(item.productId ?? item.id);
        const qty = Number(item.qty ?? 0);
        return !Number.isFinite(productId) || productId <= 0 || qty <= 0;
      })
    ) {
      setError("Invalid cart items.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createStoreOrder({
        customer: {
          name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
        paymentMethod: "COD",
        items: items.map((item) => ({
          productId: Number(item.productId ?? item.id),
          qty: Number(item.qty ?? 0),
        })),
      });
      clearCart();
      const invoiceNo =
        response?.data?.invoiceNo || response?.data?.data?.invoiceNo || "";
      const total = response?.data?.total ?? response?.data?.data?.total ?? "";
      navigate(
        `/checkout/success?invoiceNo=${encodeURIComponent(
          invoiceNo
        )}&total=${encodeURIComponent(total)}`
      );
    } catch (err) {
      if (import.meta.env.DEV) {
        console.log("[checkout] error", {
          status: err?.response?.status,
          data: err?.response?.data,
        });
      }
      const data = err?.response?.data;
      if (Array.isArray(data?.missing) && data.missing.length > 0) {
        setIsMissingError(true);
        setError(
          `Some products in your cart are no longer available (missing: ${data.missing.join(
            ", "
          )}). Please clear your cart and add products again.`
        );
      } else {
        setError(data?.message || "Checkout failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <p className="text-sm text-slate-500">
          {totalQty} items · {formatCurrency(Number(subtotal || 0))}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <label className="text-sm font-medium text-slate-600">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Address</label>
          <textarea
            rows={3}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {isMissingError ? (
          <button
            type="button"
            onClick={clearCart}
            className="text-sm text-slate-600 underline"
          >
            Clear cart
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Place Order"}
        </button>
      </form>
    </section>
  );
}

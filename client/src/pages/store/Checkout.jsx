import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { createStoreOrder, validateStoreCoupon } from "../../api/store.service.ts";
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
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
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

  const discountAmount = Number(appliedCoupon?.discountAmount || 0);
  const total = Math.max(0, Number(subtotal || 0) - discountAmount);

  const applyCoupon = async () => {
    if (items.length === 0) {
      setCouponMessage("Cart kosong.");
      setAppliedCoupon(null);
      return;
    }
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponMessage("Masukkan kode kupon.");
      setAppliedCoupon(null);
      return;
    }
    setIsApplyingCoupon(true);
    setCouponMessage("");
    try {
      const response = await validateStoreCoupon({
        code,
        subtotal: Number(subtotal || 0),
      });
      const result = response?.data?.data ?? response?.data;
      if (import.meta.env.DEV) {
        console.log("[coupon validate]", result);
      }
      if (result?.valid) {
        const resolvedCode = result.code || code;
        const resolvedDiscountAmount = Number(
          result.discountAmount ?? result.discount ?? result.amount ?? result.value ?? 0
        );
        setAppliedCoupon({
          code: resolvedCode,
          discountAmount: resolvedDiscountAmount,
          raw: result,
        });
        setCouponMessage(result.message || "Kupon diterapkan.");
        setCouponCode(resolvedCode);
      } else {
        setAppliedCoupon(null);
        setCouponMessage(result?.message || "Kupon tidak valid.");
      }
    } catch (_) {
      setAppliedCoupon(null);
      setCouponMessage("Gagal menerapkan kupon.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponMessage("");
    setCouponCode("");
  };

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
      if (import.meta.env.DEV) {
        console.log("[checkout] submit payload", {
          items,
          mapped: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
          })),
        });
      }
      const response = await createStoreOrder({
        customer: {
          name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
        paymentMethod,
        couponCode: appliedCoupon?.code || undefined,
        items: items.map((item) => ({
          productId: Number(item.productId ?? item.id),
          qty: Number(item.qty ?? 0),
        })),
      });
      clearCart();
      const result = response?.data?.data ?? response?.data ?? {};
      const invoiceNo = result.invoiceNo || "";
      const totalValue = result.total ?? result.totalAmount ?? result.total_amount ?? total;
      navigate(
        `/checkout/success?invoiceNo=${encodeURIComponent(
          invoiceNo
        )}&total=${encodeURIComponent(totalValue)}&method=${encodeURIComponent(paymentMethod)}`
      );
    } catch (err) {
      if (import.meta.env.DEV) {
        console.log("[checkout] error", {
          status: err?.response?.status,
          data: err?.response?.data,
        });
      }
      const data = err?.response?.data;
      if (err?.response?.status === 400 && Array.isArray(data?.missing)) {
        if (import.meta.env.DEV) {
          console.warn("[checkout] missing items", data.missing);
        }
        clearCart();
        setIsMissingError(true);
        setError("Cart cleared, please add products again");
        setTimeout(() => navigate("/search"), 800);
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
        <div>
          <label className="text-sm font-medium text-slate-600">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="COD">COD</option>
            <option value="TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Coupon Code</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              placeholder="Masukkan kode kupon"
              className="w-full flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={isApplyingCoupon || items.length === 0}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {isApplyingCoupon ? "Applying..." : "Apply"}
            </button>
            {appliedCoupon ? (
              <button
                type="button"
                onClick={removeCoupon}
                disabled={isApplyingCoupon}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Remove
              </button>
            ) : null}
          </div>
          {couponMessage ? (
            <p
              className={`mt-2 text-sm ${
                appliedCoupon ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {couponMessage}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div>
            Discount:{" "}
            {appliedCoupon ? formatCurrency(discountAmount) : "-"}
          </div>
          <div className="mt-1 font-semibold text-slate-900">
            Total: {formatCurrency(total)}
          </div>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
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

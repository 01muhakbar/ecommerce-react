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
  const [orderStatus, setOrderStatus] = useState("idle");
  const [placedOrder, setPlacedOrder] = useState(null);
  const [error, setError] = useState("");
  const [isMissingError, setIsMissingError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    phone: "",
    address: "",
  });

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

  useEffect(() => {
    if (placedOrder) {
      return;
    }
    try {
      const raw = localStorage.getItem("kb_orders");
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const latest = list[0];
      if (!latest || !Array.isArray(latest.items)) {
        return;
      }
      setPlacedOrder({
        itemsSnapshot: latest.items,
        totalQtySnapshot: Number(latest.totalQty || 0),
        subtotalSnapshot: Number(latest.subtotal || 0),
        discountSnapshot: Number(latest.discount || 0),
        totalSnapshot: Number(latest.total || 0),
        invoiceNo: latest.invoiceNo || "",
        paymentMethod: latest.paymentMethod || "COD",
      });
      setOrderStatus("success");
    } catch (_) {
      // ignore storage errors
    }
  }, [placedOrder]);

  const hasItems = items.length > 0;
  const shouldShowSuccess = orderStatus === "success" && placedOrder;
  const discountAmount = Number(appliedCoupon?.discountAmount || 0);
  const total = Math.max(0, Number(subtotal || 0) - discountAmount);
  const summaryItems = items.slice(0, 3);
  const extraCount = Math.max(0, items.length - summaryItems.length);
  const headerQty = shouldShowSuccess
    ? placedOrder.totalQtySnapshot
    : totalQty;
  const headerTotal = shouldShowSuccess
    ? placedOrder.totalSnapshot
    : total;

  const resetSuccessState = () => {
    setPlacedOrder(null);
    setOrderStatus("idle");
  };

  if (!hasItems && !shouldShowSuccess) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Cart is empty</h1>
          <p className="mt-2 text-sm text-slate-500">Your cart is empty.</p>
          <Link
            to="/search"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold !text-white visited:!text-white active:!text-white hover:bg-slate-800 no-underline hover:no-underline"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

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
    setFieldErrors({ fullName: "", phone: "", address: "" });
    setOrderStatus("idle");

    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      setFieldErrors({
        fullName: fullName.trim() ? "" : "Full name is required.",
        phone: phone.trim() ? "" : "Phone is required.",
        address: address.trim() ? "" : "Address is required.",
      });
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
    setOrderStatus("submitting");
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
      const result = response?.data?.data ?? response?.data ?? {};
      const invoiceNo =
        result.invoiceNo ||
        result.invoice ||
        result.ref ||
        (result.orderId ? `ORDER-${result.orderId}` : "");
      const totalValue = Number(
        result.total ?? result.totalAmount ?? result.total_amount ?? total
      );
      const snapshot = {
        itemsSnapshot: items,
        totalQtySnapshot: totalQty,
        subtotalSnapshot: Number(subtotal || 0),
        discountSnapshot: Number(discountAmount || 0),
        totalSnapshot: Number.isFinite(totalValue) ? totalValue : total,
        invoiceNo,
        paymentMethod,
      };
      setPlacedOrder(snapshot);
      setOrderStatus("success");
      try {
        const raw = localStorage.getItem("kb_orders");
        const parsed = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(parsed) ? parsed : [];
        const orderEntry = {
          invoiceNo: snapshot.invoiceNo,
          createdAt: new Date().toISOString(),
          totalQty: snapshot.totalQtySnapshot,
          subtotal: snapshot.subtotalSnapshot,
          discount: snapshot.discountSnapshot,
          total: snapshot.totalSnapshot,
          paymentMethod: snapshot.paymentMethod,
          items: snapshot.itemsSnapshot.map((item) => ({
            productId: item.productId,
            name: item.name,
            price: Number(item.price || 0),
            qty: Number(item.qty || 0),
          })),
        };
        const next = [orderEntry, ...list].slice(0, 20);
        localStorage.setItem("kb_orders", JSON.stringify(next));
      } catch (_) {
        // ignore storage errors
      }
      clearCart();
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
      setOrderStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Checkout</h1>
        <p className="text-sm text-slate-500">
          {headerQty} items · {formatCurrency(headerTotal)}
        </p>
      </div>

      {orderStatus === "success" && placedOrder ? (
        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Order placed 🎉</h2>
          <p className="mt-2 text-sm text-slate-500">
            Thanks, we received your order.
          </p>
          <div className="mt-4 text-sm text-slate-600">
            {placedOrder.totalQtySnapshot} items ·{" "}
            <span className="font-semibold text-slate-900">
              {formatCurrency(Number(placedOrder.totalSnapshot || 0))}
            </span>
          </div>
          <div className="mt-6 space-y-2 text-sm text-slate-600">
            {placedOrder.itemsSnapshot.slice(0, 3).map((item) => (
              <div key={item.productId} className="flex items-center justify-between">
                <span className="truncate">
                  {item.name} × {item.qty}
                </span>
                <span className="text-slate-900">
                  {formatCurrency(Number(item.price || 0) * item.qty)}
                </span>
              </div>
            ))}
            {placedOrder.itemsSnapshot.length > 3 ? (
              <div className="text-xs text-slate-500">
                +{placedOrder.itemsSnapshot.length - 3} more items
              </div>
            ) : null}
          </div>
          <div className="mt-8 space-y-3">
            <Link
              to="/search"
              onClick={resetSuccessState}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold !text-white visited:!text-white active:!text-white hover:bg-slate-800 no-underline hover:no-underline"
            >
              Continue shopping
            </Link>
            <Link
              to="/cart"
              onClick={resetSuccessState}
              className="block w-full rounded-full border border-slate-200 px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Back to cart
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  if (fieldErrors.fullName) {
                    setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
              {fieldErrors.fullName ? (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.fullName}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
              {fieldErrors.phone ? (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Address</label>
              <textarea
                rows={4}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  if (fieldErrors.address) {
                    setFieldErrors((prev) => ({ ...prev, address: "" }));
                  }
                }}
                className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              />
              {fieldErrors.address ? (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.address}</p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
              >
                <option value="COD">COD</option>
                <option value="TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Coupon Code</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="Masukkan kode kupon"
                  className="w-full flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    disabled={isApplyingCoupon}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={isApplyingCoupon || items.length === 0}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {isApplyingCoupon ? "Applying..." : "Apply"}
                  </button>
                )}
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
                Discount: {appliedCoupon ? formatCurrency(discountAmount) : "-"}
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                Total: {formatCurrency(total)}
              </div>
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {isMissingError ? (
              <p className="text-sm text-rose-600">
                Cart cleared, please add products again
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {summaryItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-2">
                    <span className="flex-1 truncate text-slate-600">
                      {item.name} × {item.qty}
                    </span>
                    <span className="text-slate-900">
                      {formatCurrency(Number(item.price || 0) * item.qty)}
                    </span>
                  </div>
                ))}
                {extraCount > 0 ? (
                  <div className="text-xs text-slate-500">+{extraCount} more items</div>
                ) : null}
                <div className="flex items-center justify-between pt-2">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(Number(subtotal || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span className="text-slate-500">Calculated at checkout</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting || orderStatus === "submitting"}
                  className="w-full rounded-full bg-slate-900 px-6 py-3 text-center text-sm font-semibold !text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting..." : "Place Order"}
                </button>
                <Link
                  to="/cart"
                  className="block w-full rounded-full border border-slate-200 px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Back to cart
                </Link>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

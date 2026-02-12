import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createOrderSchema } from "@ecommerce/schemas";
import { useCartStore } from "../../store/cart.store.ts";
import { createStoreOrder } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";

const LABEL_CLASS = "text-xs font-semibold uppercase text-slate-600";
const INPUT_CLASS =
  "mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const subtotal = useCartStore((state) => state.subtotal);
  const totalQty = useCartStore((state) => state.totalQty);
  const clearCart = useCartStore((state) => state.clearCart);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    fullName: "",
    phone: "",
    address: "",
  });
  const fullNameRef = useRef(null);
  const phoneRef = useRef(null);
  const addressRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const hasAuthHint = (() => {
      try {
        return (
          Boolean(localStorage.getItem("authToken")) ||
          localStorage.getItem("authSessionHint") === "true"
        );
      } catch {
        return false;
      }
    })();
    if (!hasAuthHint) {
      return () => {
        mounted = false;
      };
    }
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

  const paymentMethod = "COD";
  const hasItems = items.length > 0;
  const trimmedFullName = fullName.trim();
  const trimmedPhone = phone.trim();
  const trimmedAddress = address.trim();
  const phoneDigits = trimmedPhone.replace(/[^\d]/g, "");
  const isPhoneCharsValid = trimmedPhone
    ? /^[\d+\s-]+$/.test(trimmedPhone)
    : true;
  const isPhoneTooShort = trimmedPhone ? phoneDigits.length < 8 : false;
  const isFormInvalid =
    !trimmedFullName ||
    !trimmedPhone ||
    !trimmedAddress ||
    !isPhoneCharsValid ||
    isPhoneTooShort;

  const summaryItems = useMemo(
    () =>
      items.map((item) => ({
        productId: Number(item.productId ?? item.id),
        name: item.name || "Product",
        qty: Number(item.qty ?? 0),
        price: Number(item.price ?? 0),
      })),
    [items]
  );

  const payloadDraft = useMemo(
    () => ({
      customer: {
        name: trimmedFullName,
        phone: trimmedPhone,
        address: trimmedAddress,
      },
      paymentMethod,
      items: summaryItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
      })),
    }),
    [trimmedFullName, trimmedPhone, trimmedAddress, paymentMethod, summaryItems]
  );

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Loading checkout...
          </h1>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    );
  }

  if (!hasItems) {
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

  const focusField = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const hasAuthHint = (() => {
      try {
        return (
          Boolean(localStorage.getItem("authToken")) ||
          localStorage.getItem("authSessionHint") === "true"
        );
      } catch {
        return false;
      }
    })();
    if (!hasAuthHint) {
      navigate("/auth/login", { replace: true, state: { from: "/checkout" } });
      return;
    }
    setError("");
    setFieldErrors({ fullName: "", phone: "", address: "" });
    const parsed = createOrderSchema.safeParse(payloadDraft);
    if (!parsed.success) {
      const nextErrors = { fullName: "", phone: "", address: "" };
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        if (path === "customer.name") {
          nextErrors.fullName = issue.message;
        }
        if (path === "customer.phone") {
          nextErrors.phone = issue.message;
        }
        if (path === "customer.address") {
          nextErrors.address = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setError("Please check the highlighted fields.");
      if (nextErrors.fullName) {
        focusField(fullNameRef);
      } else if (nextErrors.phone) {
        focusField(phoneRef);
      } else if (nextErrors.address) {
        focusField(addressRef);
      }
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createStoreOrder(parsed.data);
      const result = response?.data?.data ?? response?.data ?? {};
      const invoiceNo =
        result.invoiceNo ||
        result.invoice ||
        result.ref ||
        (result.id ? `ORDER-${result.id}` : "");
      clearCart();
      await queryClient.invalidateQueries({
        queryKey: ["account", "orders", "my"],
      });
      const successParams = new URLSearchParams();
      if (invoiceNo) {
        successParams.set("ref", invoiceNo);
      }
      navigate(`/checkout/success?${successParams.toString()}`, {
        state: { ref: invoiceNo },
      });
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 401) {
        navigate("/auth/login", { replace: true, state: { from: "/checkout" } });
        return;
      }
      if (err?.response?.status === 400 && Array.isArray(data?.missing)) {
        clearCart();
        setError("Cart items are no longer available. Please add them again.");
        setTimeout(() => navigate("/search"), 800);
      } else if (err?.response?.status === 409) {
        setError(data?.message || "Some items are out of stock.");
      } else {
        setError(data?.message || "Checkout failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtotalValue = Number(subtotal || 0);
  const shippingCost = 0;
  const discountAmount = 0;
  const total = Math.max(0, subtotalValue + shippingCost - discountAmount);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-6">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
            <p className="mt-2 text-sm text-slate-500">
              Fill in your details to place the order.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <label className={LABEL_CLASS}>Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  ref={fullNameRef}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.fullName ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.fullName}</p>
                ) : null}
              </div>
              <div>
                <label className={LABEL_CLASS}>Phone *</label>
                <input
                  type="tel"
                  value={phone}
                  ref={phoneRef}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setPhone(nextValue);
                    if (fieldErrors.phone) {
                      const nextTrimmed = nextValue.trim();
                      const nextDigits = nextTrimmed.replace(/[^\d]/g, "");
                      const nextCharsValid = nextTrimmed
                        ? /^[\d+\s-]+$/.test(nextTrimmed)
                        : true;
                      if (nextTrimmed && nextCharsValid && nextDigits.length >= 8) {
                        setFieldErrors((prev) => ({ ...prev, phone: "" }));
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  className={INPUT_CLASS}
                />
                {fieldErrors.phone ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
                ) : null}
              </div>
              <div>
                <label className={LABEL_CLASS}>Address *</label>
                <textarea
                  rows={4}
                  value={address}
                  ref={addressRef}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    if (fieldErrors.address) {
                      setFieldErrors((prev) => ({ ...prev, address: "" }));
                    }
                  }}
                  disabled={isSubmitting}
                  className={`${INPUT_CLASS} min-h-[120px] resize-none`}
                />
                {fieldErrors.address ? (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.address}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <p className={LABEL_CLASS}>Payment Method</p>
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={paymentMethod}
                  checked
                  readOnly
                  className="mt-1 h-4 w-4 text-emerald-600"
                />
                <span>
                  <span className="block font-semibold text-slate-900">Cash on Delivery</span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Pay when your order arrives.
                  </span>
                </span>
              </label>
            </div>

            {error ? (
              <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting || isFormInvalid}
                className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Placing order..." : "Place Order"}
              </button>
              <Link
                to="/cart"
                className="w-full rounded-lg border border-slate-200 px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Back to cart
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Your Order</h2>
              <span className="text-sm text-slate-500">{totalQty} items</span>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {summaryItems.map((item) => (
                <div key={item.productId} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-slate-700">{item.name}</p>
                    <p className="text-xs text-slate-500">Qty {item.qty}</p>
                  </div>
                  <span className="text-slate-900">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">
                  {formatCurrency(subtotalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Shipping</span>
                <span>{formatCurrency(shippingCost)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Discount</span>
                <span>{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

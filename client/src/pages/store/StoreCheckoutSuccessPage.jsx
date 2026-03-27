import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import QueryState from "../../components/primitives/ui/QueryState.jsx";

const LAST_ORDER_REF_STORAGE_KEY = "store_last_order_ref";

const readStoredOrderRef = () => {
  try {
    return String(localStorage.getItem(LAST_ORDER_REF_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
};

export default function StoreCheckoutSuccessPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const refFromParams = params.get("ref") || params.get("invoiceNo");
  const refFromState = location.state?.ref || location.state?.orderRef;
  const refFromStorage = readStoredOrderRef();
  const orderRef = String(refFromParams || refFromState || refFromStorage || "").trim();
  const hasOrderRef = orderRef.length > 0;

  useEffect(() => {
    if (!hasOrderRef) return;
    try {
      localStorage.setItem(LAST_ORDER_REF_STORAGE_KEY, orderRef);
    } catch {
      // ignore storage errors
    }
  }, [hasOrderRef, orderRef]);

  return (
    <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {!hasOrderRef ? (
        <div className="mx-auto max-w-2xl space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Order Confirmation</h1>
            <p className="mt-1 text-sm text-slate-500">
              We could not detect your order reference from this session.
            </p>
          </div>
          <QueryState
            isLoading={false}
            isError
            error={{ message: "Order reference is missing. We cannot open tracking yet." }}
            isEmpty={false}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/cart"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Cart
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:h-20 sm:w-20">
              <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-600">
              Payment Confirmed
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Order Success
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
              Thank you, your order has been received and is now being processed.
              You can track progress in real-time from your account.
            </p>

            <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Order Reference
              </p>
              <p className="mt-2 break-all rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-mono text-lg font-bold text-slate-900 sm:text-2xl">
                {orderRef}
              </p>
            </div>

            <div className="mt-7 space-y-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Next Actions
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  to={`/order/${encodeURIComponent(orderRef)}`}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Track Order
                </Link>
                <Link
                  to="/account/orders"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  My Orders
                </Link>
                <Link
                  to="/"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

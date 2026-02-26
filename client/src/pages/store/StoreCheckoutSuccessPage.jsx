import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import QueryState from "../../components/UI/QueryState.jsx";

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
    <section className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {!hasOrderRef ? (
        <div className="space-y-4">
          <QueryState
            isLoading={false}
            isError
            error={{ message: "Order reference is missing. We cannot open tracking yet." }}
            isEmpty={false}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/cart"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Back to Cart
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-900 sm:px-6 sm:py-4 sm:text-base">
            <span className="font-semibold text-emerald-700">Thank You!</span> Your
            order has been received!
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:mt-8 sm:p-6">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Order Success</h1>
            <p className="mt-2 text-sm text-slate-500">
              We are preparing your order. You can track it anytime from your
              account.
            </p>

            <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Order Reference
              </p>
              <p className="mt-2 break-all font-mono text-xl font-bold text-slate-900 sm:text-2xl">
                {orderRef}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to={`/order/${encodeURIComponent(orderRef)}`}
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
              >
                Track Order
              </Link>
              <Link
                to="/account/orders"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto"
              >
                My Orders
              </Link>
              <Link
                to="/"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

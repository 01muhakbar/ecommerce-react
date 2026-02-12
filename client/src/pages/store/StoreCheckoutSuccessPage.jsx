import { Link, useLocation, useSearchParams } from "react-router-dom";

export default function StoreCheckoutSuccessPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const refFromParams = params.get("ref") || params.get("invoiceNo");
  const refFromState = location.state?.ref;
  const orderRef = refFromParams || refFromState || "";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="rounded-lg bg-emerald-100 px-6 py-4 text-emerald-900">
        <span className="font-semibold text-emerald-700">Thank You!</span> Your
        order has been received!
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">Order Success</h1>
        <p className="mt-2 text-sm text-slate-500">
          We are preparing your order. You can track it anytime from your
          account.
        </p>

        <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Order Reference
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {orderRef || "Reference unavailable"}
          </p>
          {!orderRef ? (
            <p className="mt-2 text-sm text-slate-600">
              If you cannot find the reference, please check your order history.
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {orderRef ? (
            <Link
              to={`/order/${encodeURIComponent(orderRef)}`}
              className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              View Invoice
            </Link>
          ) : null}
          <Link
            to="/account/orders"
            className="rounded-lg border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            My Orders
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </section>
  );
}

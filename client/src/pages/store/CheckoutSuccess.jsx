import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, QrCode, ReceiptText } from "lucide-react";
import { formatCurrency } from "../../utils/format.js";
import { resolvePublicOrderReference } from "../../utils/publicOrderReference.js";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const location = useLocation();
  const invoiceNo = resolvePublicOrderReference(
    params.get("invoiceNo"),
    params.get("ref"),
    location.state?.invoiceNo,
    location.state?.ref
  );
  const orderId = params.get("orderId") || location.state?.orderId || "";
  const total = params.get("total");
  const method = (params.get("method") || location.state?.method || "QRIS").toUpperCase();
  const totalDisplay =
    total != null && total !== "" ? formatCurrency(Number(total || 0)) : null;
  const isQris = method === "QRIS";

  return (
    <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white px-5 py-7 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:px-7">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Checkout Created
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {isQris ? "Continue to QRIS payment" : "Order placed"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isQris
              ? "Scan QR code to pay from the payment page. Marketplace payment stays split by store, so each store keeps its own QRIS panel and proof lane."
              : "Your order was created successfully."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Invoice
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{invoiceNo || "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Payment Method
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{method}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Total
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{totalDisplay || "-"}</p>
        </div>
      </div>

      {isQris ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
              <QrCode className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Scan QR code to pay</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Open the payment page to see QRIS per store, copy the exact amount to pay, and
                submit payment proof for each store after transfer.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {orderId ? (
          <Link
            to={`/user/my-orders/${orderId}/payment`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {isQris ? "Open QRIS Payment Page" : "Open Payment Page"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        {orderId ? (
          <Link
            to={`/user/my-orders/${orderId}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View Order Detail
            <ReceiptText className="h-4 w-4" />
          </Link>
        ) : null}
        <Link
          to="/user/my-orders"
          className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>
    </section>
  );
}

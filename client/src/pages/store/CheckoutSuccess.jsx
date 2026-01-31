import { Link, useSearchParams } from "react-router-dom";
import { formatCurrency } from "../../utils/format.js";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const invoiceNo = params.get("invoiceNo") || params.get("orderId") || "";
  const total = params.get("total");
  const totalDisplay =
    total != null && total !== "" ? formatCurrency(Number(total || 0)) : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
      <h1 className="text-2xl font-semibold">Order placed!</h1>
      {invoiceNo ? (
        <p className="mt-2 text-sm text-slate-600">Invoice: {invoiceNo}</p>
      ) : null}
      {totalDisplay ? (
        <p className="mt-1 text-sm text-slate-600">Total: {totalDisplay}</p>
      ) : null}
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
      >
        Back to Home
      </Link>
    </section>
  );
}

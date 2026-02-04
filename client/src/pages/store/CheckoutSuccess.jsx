import { Link, useSearchParams } from "react-router-dom";
import { formatCurrency } from "../../utils/format.js";
import {
  COD_INSTRUCTIONS,
  TRANSFER_INSTRUCTIONS,
} from "../../config/paymentInstructions.ts";

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const invoiceNo = params.get("invoiceNo") || params.get("orderId") || "";
  const total = params.get("total");
  const method = params.get("method") || "COD";
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
      <p className="mt-2 text-sm text-slate-600">Payment Method: {method}</p>
      {method === "TRANSFER" ? (
        <div className="mx-auto mt-3 max-w-md rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-600">
          <strong className="text-slate-900">How to pay (Bank Transfer)</strong>
          <div>Bank: {TRANSFER_INSTRUCTIONS.bank}</div>
          <div>Account No: {TRANSFER_INSTRUCTIONS.accountNo}</div>
          <div>Account Name: {TRANSFER_INSTRUCTIONS.accountName}</div>
          <div className="mt-2">
            After transfer, please upload proof via WhatsApp{" "}
            {TRANSFER_INSTRUCTIONS.whatsapp}.
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-3 max-w-md rounded-xl border border-slate-200 p-3 text-left text-sm text-slate-600">
          <strong className="text-slate-900">Pay on delivery</strong>
          <div>{COD_INSTRUCTIONS.text}</div>
        </div>
      )}
      {invoiceNo ? (
        <Link
          to={`/order/${encodeURIComponent(invoiceNo)}`}
          className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Track your order
        </Link>
      ) : (
        <Link
          to="/account/orders"
          className="mt-4 inline-flex text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Track your order
        </Link>
      )}
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
      >
        Back to Home
      </Link>
    </section>
  );
}

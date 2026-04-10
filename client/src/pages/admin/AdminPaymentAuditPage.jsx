import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPaymentAudit } from "../../api/adminPaymentAudit.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";

const PAYMENT_STATUS_OPTIONS = ["", "UNPAID", "PARTIALLY_PAID", "PAID"];
const REVIEW_STATUS_OPTIONS = ["", "PENDING", "REJECTED", "APPROVED"];
const CHECKOUT_MODE_OPTIONS = ["", "MULTI_STORE", "SINGLE_STORE", "LEGACY"];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getToneBadgeClass = (tone) => {
  const value = String(tone || "").trim().toLowerCase();
  if (value === "amber") return "bg-amber-100 text-amber-700";
  if (value === "sky") return "bg-sky-100 text-sky-700";
  if (value === "indigo") return "bg-indigo-100 text-indigo-700";
  if (value === "emerald") return "bg-emerald-100 text-emerald-700";
  if (value === "rose") return "bg-rose-100 text-rose-700";
  if (value === "orange") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-700";
};

function StatusMetaBadge({ label, tone, prefix = "" }) {
  const text = String(label || "-").trim() || "-";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getToneBadgeClass(tone)}`}
    >
      {prefix ? `${prefix} ${text}` : text}
    </span>
  );
}

const NOT_CONFIRMED_HELPER =
  "Not confirmed includes unpaid, expired, failed, and cancelled store splits.";

const getOperationalCounts = (entry) => entry?.operationalCounts || entry?.counts || null;

const getStoreSplitHelperLines = (counts) => {
  const lines = [];
  if (Number(counts?.shipmentLaneSuborders || 0) > 0) {
    lines.push(`Shipment lane: ${counts.shipmentLaneSuborders}`);
  }
  if (Number(counts?.finalNegativeSuborders || 0) > 0) {
    lines.push(`Final-negative: ${counts.finalNegativeSuborders}`);
  }
  return lines;
};

export default function AdminPaymentAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const params = useMemo(() => {
    const page = Number(searchParams.get("page") || 1);
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      search: searchParams.get("search") || "",
      paymentStatus: searchParams.get("paymentStatus") || "",
      reviewStatus: searchParams.get("reviewStatus") || "",
      checkoutMode: searchParams.get("checkoutMode") || "",
      storeId: searchParams.get("storeId") || "",
    };
  }, [searchParams]);

  const auditQuery = useQuery({
    queryKey: ["admin", "payment-audit", params],
    queryFn: () => fetchAdminPaymentAudit(params),
  });

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const text = String(value ?? "").trim();
      if (!text) next.delete(key);
      else next.set(key, text);
    });
    if (!Object.prototype.hasOwnProperty.call(patch, "page")) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const items = Array.isArray(auditQuery.data?.items) ? auditQuery.data.items : [];
  const meta = auditQuery.data || { total: 0, page: 1, pageSize: 10, totalPages: 1 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">Payment Audit</h1>
          <p className="mt-1 text-sm text-slate-500">
            Parent order stays aggregate. Store split counters below prefer operational split
            payment and shipment truth.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {meta.total || 0} order{meta.total === 1 ? "" : "s"}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[2fr_repeat(4,minmax(0,1fr))]">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search Order / Buyer
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Order number or buyer"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => updateParams({ search: searchInput })}
                className="rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Search
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parent Payment
            </label>
            <select
              value={params.paymentStatus}
              onChange={(event) => updateParams({ paymentStatus: event.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Proof Review
            </label>
            <select
              value={params.reviewStatus}
              onChange={(event) => updateParams({ reviewStatus: event.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {REVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Checkout Mode
            </label>
            <select
              value={params.checkoutMode}
              onChange={(event) => updateParams({ checkoutMode: event.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {CHECKOUT_MODE_OPTIONS.map((option) => (
                <option key={option || "all"} value={option}>
                  {option || "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Store ID
            </label>
            <input
              type="number"
              min="1"
              value={params.storeId}
              onChange={(event) => updateParams({ storeId: event.target.value })}
              placeholder="Any"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {NOT_CONFIRMED_HELPER}
      </div>

      {auditQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading payment audit...
        </div>
      ) : null}

      {auditQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {auditQuery.error?.response?.data?.message ||
            auditQuery.error?.message ||
            "Failed to load payment audit."}
        </div>
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No audit rows found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Stores</th>
                    <th className="px-4 py-3">Grand Total</th>
                    <th className="px-4 py-3">Parent State</th>
                    <th className="px-4 py-3">Store Split Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((entry) => {
                    const counts = getOperationalCounts(entry);
                    const helperLines = getStoreSplitHelperLines(counts);

                    return (
                      <tr key={entry.orderId} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{entry.orderNumber}</div>
                          <div className="text-xs text-slate-500">ID {entry.orderId}</div>
                          <div className="mt-2">
                            <CheckoutModeBadge mode={entry.checkoutMode} />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{entry.buyerName}</div>
                          <div className="text-xs text-slate-500">{entry.buyerEmail || "-"}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{entry.checkoutMode}</td>
                        <td className="px-4 py-4 text-slate-700">{entry.totalStores}</td>
                        <td className="px-4 py-4 font-medium text-slate-900">
                          {formatCurrency(entry.grandTotal)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <StatusMetaBadge
                              label={entry.orderStatusMeta?.label || entry.orderStatus}
                              tone={entry.orderStatusMeta?.tone}
                              prefix="Order"
                            />
                            <PaymentStatusBadge
                              status={entry.paymentStatus}
                              label={entry.paymentStatusMeta?.label}
                              tone={entry.paymentStatusMeta?.tone}
                              prefix="Parent"
                            />
                            <div className="text-xs text-slate-500">
                              {entry.checkoutMode === "MULTI_STORE"
                                ? "Parent badges stay aggregate. Split payment and shipment truth is audited separately."
                                : entry.orderStatusMeta?.description ||
                                  entry.paymentStatusMeta?.description ||
                                  "-"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          <div>Paid: {counts?.paidSuborders || 0}</div>
                          <div>Under Review: {counts?.pendingSuborders || 0}</div>
                          <div>Not Confirmed: {counts?.unpaidSuborders || 0}</div>
                          <div>Rejected Proofs: {counts?.rejectedPayments || 0}</div>
                          {helperLines.length > 0 ? (
                            <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                              {helperLines.map((line) => (
                                <div key={`${entry.orderId}-${line}`}>{line}</div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            to={`/admin/online-store/payment-audit/${entry.orderId}`}
                            className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            View Detail
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <p>
          Page {meta.page || 1} of {meta.totalPages || 1}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => updateParams({ page: Math.max(1, (meta.page || 1) - 1) })}
            disabled={(meta.page || 1) <= 1}
            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              updateParams({ page: Math.min(meta.totalPages || 1, (meta.page || 1) + 1) })
            }
            disabled={(meta.page || 1) >= (meta.totalPages || 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

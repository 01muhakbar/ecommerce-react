import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPaymentAudit } from "../../api/adminPaymentAudit.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsMetricCard,
  AdminOpsPageHeader,
  AdminOpsStatusBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const PAYMENT_STATUS_OPTIONS = ["", "UNPAID", "PARTIALLY_PAID", "PAID"];
const REVIEW_STATUS_OPTIONS = ["", "PENDING", "REJECTED", "APPROVED"];
const CHECKOUT_MODE_OPTIONS = ["", "MULTI_STORE", "SINGLE_STORE", "LEGACY"];
const RISK_FILTERS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "review", label: "Proof review" },
  { value: "mismatch", label: "Mismatch" },
  { value: "blocked", label: "Blocked" },
  { value: "clear", label: "Clear" },
];

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

const getAuditRisk = (entry) => {
  const counts = getOperationalCounts(entry) || {};
  const paid = Number(counts?.paidSuborders || 0);
  const review = Number(counts?.pendingSuborders || 0);
  const blocked = Number(counts?.unpaidSuborders || 0);
  const rejected = Number(counts?.rejectedPayments || 0);
  const finalNegative = Number(counts?.finalNegativeSuborders || 0);
  const paymentStatus = String(entry?.paymentStatus || "").trim().toUpperCase();
  const parentPaidButSplitOpen = paymentStatus === "PAID" && (review > 0 || blocked > 0);
  const splitPaidButParentOpen = paid > 0 && paymentStatus !== "PAID";

  if (rejected > 0 || finalNegative > 0) {
    return {
      key: "urgent",
      label: "Urgent",
      tone: "rose",
      helper: "Rejected or final-negative split found.",
      rank: 4,
    };
  }
  if (parentPaidButSplitOpen || splitPaidButParentOpen) {
    return {
      key: "mismatch",
      label: "Mismatch",
      tone: "attention",
      helper: "Parent and store split states differ.",
      rank: 3,
    };
  }
  if (review > 0) {
    return {
      key: "review",
      label: "Proof review",
      tone: "attention",
      helper: "At least one proof still needs review.",
      rank: 2,
    };
  }
  if (blocked > 0) {
    return {
      key: "blocked",
      label: "Not confirmed",
      tone: "stone",
      helper: NOT_CONFIRMED_HELPER,
      rank: 1,
    };
  }
  return {
    key: "clear",
    label: "Clear",
    tone: "ready",
    helper: "No visible payment risk in this row.",
    rank: 0,
  };
};

function SplitStatusBlock({ counts, helperLines }) {
  const entries = [
    ["Paid", counts?.paidSuborders || 0, "emerald"],
    ["Review", counts?.pendingSuborders || 0, "amber"],
    ["Not confirmed", counts?.unpaidSuborders || 0, "slate"],
    ["Rejected", counts?.rejectedPayments || 0, "rose"],
  ];

  return (
    <div className="min-w-[210px] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([label, value, tone]) => (
          <div key={label} className={`rounded-lg px-2.5 py-2 ${getToneBadgeClass(tone)}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide">{label}</p>
            <p className="mt-0.5 text-base font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      {helperLines.length > 0 ? (
        <div className="space-y-1 text-[11px] text-slate-500">
          {helperLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
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
  const [riskFilter, setRiskFilter] = useState("all");

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
  const visibleCounts = useMemo(
    () =>
      items.reduce(
        (acc, entry) => {
          const counts = getOperationalCounts(entry);
          const risk = getAuditRisk(entry);
          acc.paid += Number(counts?.paidSuborders || 0);
          acc.review += Number(counts?.pendingSuborders || 0);
          acc.blocked += Number(counts?.unpaidSuborders || 0);
          acc.rejected += Number(counts?.rejectedPayments || 0);
          acc.finalNegative += Number(counts?.finalNegativeSuborders || 0);
          if (risk.key === "urgent") acc.urgent += 1;
          if (risk.key === "mismatch") acc.mismatch += 1;
          return acc;
        },
        { paid: 0, review: 0, blocked: 0, rejected: 0, finalNegative: 0, urgent: 0, mismatch: 0 }
      ),
    [items]
  );
  const filteredItems = useMemo(() => {
    if (riskFilter === "all") return items;
    return items.filter((entry) => getAuditRisk(entry).key === riskFilter);
  }, [items, riskFilter]);
  const mostUrgent = useMemo(
    () =>
      [...items]
        .map((entry) => ({ entry, risk: getAuditRisk(entry) }))
        .sort((left, right) => right.risk.rank - left.risk.rank)[0] || null,
    [items]
  );

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Payment Audit"
        description="Parent order state and store split payment truth."
        meta={`${meta.total || 0} order${meta.total === 1 ? "" : "s"}`}
        badges={
          <>
            <AdminOpsStatusBadge
              label={visibleCounts.review ? "Action needed" : "Ready"}
              tone={visibleCounts.review ? "attention" : "ready"}
            />
            <AdminOpsStatusBadge
              label={visibleCounts.blocked ? "Needs attention" : "Verified"}
              tone={visibleCounts.blocked ? "rose" : "verified"}
            />
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => auditQuery.refetch()}
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <AdminOpsMetricCard
          label="Urgent Rows"
          badgeLabel={visibleCounts.urgent ? "Immediate" : "Ready"}
          value={visibleCounts.urgent}
          helper="Rejected or final-negative rows."
          tone={visibleCounts.urgent ? "rose" : "ready"}
        />
        <AdminOpsMetricCard
          label="Paid Splits"
          badgeLabel="Verified"
          value={visibleCounts.paid}
          helper="Visible rows confirmed as paid."
          tone="verified"
        />
        <AdminOpsMetricCard
          label="Under Review"
          badgeLabel={visibleCounts.review ? "Action needed" : "Ready"}
          value={visibleCounts.review}
          helper="Proof review still pending."
          tone={visibleCounts.review ? "attention" : "ready"}
        />
        <AdminOpsMetricCard
          label="Mismatch Rows"
          badgeLabel={visibleCounts.mismatch ? "Needs attention" : "Ready"}
          value={visibleCounts.mismatch}
          helper="Parent state differs from split state."
          tone={visibleCounts.mismatch ? "attention" : "ready"}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Risk Queue
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {RISK_FILTERS.find((filter) => filter.value === riskFilter)?.label || "All"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_FILTERS.map((filter) => {
              const isActive = filter.value === riskFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRiskFilter(filter.value)}
                  className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${
                    isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {mostUrgent?.risk?.rank > 0
                ? `${mostUrgent.risk.label}: ${mostUrgent.entry.orderNumber}`
                : "No visible risk in this view"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {mostUrgent?.risk?.helper || "Use filters to inspect payment lanes."}
            </p>
          </div>
          {mostUrgent?.risk?.rank > 0 ? (
            <Link
              to={`/admin/online-store/payment-audit/${mostUrgent.entry.orderId}`}
              className="inline-flex h-9 items-center rounded-full bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Urgent
            </Link>
          ) : (
            <AdminOpsStatusBadge label="Audit clear" tone="ready" />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,2fr)_repeat(4,minmax(140px,1fr))]">
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

      {auditQuery.isLoading ? (
        <AdminOpsLoadingState title="Loading payment audit..." />
      ) : null}

      {auditQuery.isError ? (
        <AdminOpsErrorState
          message={
            auditQuery.error?.response?.data?.message ||
            auditQuery.error?.message ||
            "Failed to load payment audit."
          }
          onRetry={() => auditQuery.refetch()}
        />
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <AdminOpsEmptyState
              title="No payment audit rows"
              description="Try clearing filters or searching a different order or buyer."
            />
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
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Store Split Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6">
                        <AdminOpsEmptyState
                          title="No audit rows match this risk filter"
                          description="Switch filters or clear search criteria."
                        />
                      </td>
                    </tr>
                  ) : null}
                  {filteredItems.map((entry) => {
                    const counts = getOperationalCounts(entry);
                    const helperLines = getStoreSplitHelperLines(counts);
                    const risk = getAuditRisk(entry);

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
                                ? "Aggregate parent state."
                                : entry.orderStatusMeta?.description ||
                                  entry.paymentStatusMeta?.description ||
                                  "-"}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-2">
                            <AdminOpsStatusBadge label={risk.label} tone={risk.tone} />
                            <p className="max-w-[180px] text-xs leading-5 text-slate-500">
                              {risk.helper}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <SplitStatusBlock counts={counts} helperLines={helperLines} />
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

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminShippingReconciliationReport } from "../../lib/adminApi.js";

const CATEGORY_OPTIONS = [
  ["", "All"],
  ["activeShippingException", "Active exception"],
  ["finalShippingException", "Final exception"],
  ["compatibilityMismatch", "Compatibility mismatch"],
  ["mixedShipmentOutcome", "Mixed outcome"],
  ["trackingDataIncomplete", "Tracking incomplete"],
  ["adminCorrectedRecent", "Admin corrected"],
];

const SHIPMENT_STATUS_OPTIONS = [
  "",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
  "DELIVERED",
  "SHIPPED",
  "PACKED",
  "READY_TO_FULFILL",
];

const toneClass = (tone) => {
  const value = String(tone || "").toLowerCase();
  if (value === "rose") return "bg-rose-100 text-rose-700";
  if (value === "amber") return "bg-amber-100 text-amber-700";
  if (value === "emerald") return "bg-emerald-100 text-emerald-700";
  if (value === "sky") return "bg-sky-100 text-sky-700";
  if (value === "stone") return "bg-stone-100 text-stone-700";
  return "bg-slate-100 text-slate-700";
};

const formatStatus = (value) =>
  String(value || "-")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

function StatusPill({ label, tone }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(tone)}`}>
      {label || "-"}
    </span>
  );
}

export default function AdminShippingReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const params = useMemo(() => {
    const page = Number(searchParams.get("page") || 1);
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      category: searchParams.get("category") || "",
      shipmentStatus: searchParams.get("shipmentStatus") || "",
      search: searchParams.get("search") || "",
      storeId: searchParams.get("storeId") || "",
    };
  }, [searchParams]);

  const reportQuery = useQuery({
    queryKey: ["admin", "shipping-reconciliation", params],
    queryFn: () => fetchAdminShippingReconciliationReport(params),
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

  const items = Array.isArray(reportQuery.data?.items) ? reportQuery.data.items : [];
  const meta = reportQuery.data?.meta || {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    scannedOrders: 0,
    categoryCounts: {},
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">
            Shipping Reconciliation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only report for shipment exceptions, compatibility drift, mixed outcomes, and tracking anomalies.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {meta.total || 0} item{meta.total === 1 ? "" : "s"}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[2fr_repeat(3,minmax(0,1fr))]">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search Invoice
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Invoice no"
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
              Category
            </label>
            <select
              value={params.category}
              onChange={(event) => updateParams({ category: event.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {CATEGORY_OPTIONS.map(([value, label]) => (
                <option key={value || "all"} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Shipment Status
            </label>
            <select
              value={params.shipmentStatus}
              onChange={(event) => updateParams({ shipmentStatus: event.target.value })}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {SHIPMENT_STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? formatStatus(value) : "All"}
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
        Scanned {meta.scannedOrders || 0} recent order{meta.scannedOrders === 1 ? "" : "s"}. This report is read-only; use Order Detail for investigation and existing correction lane.
      </div>

      {reportQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading shipping reconciliation...
        </div>
      ) : null}

      {reportQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {reportQuery.error?.response?.data?.message ||
            reportQuery.error?.message ||
            "Failed to load shipping reconciliation report."}
        </div>
      ) : null}

      {!reportQuery.isLoading && !reportQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No reconciliation items found for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Store Split</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Canonical</th>
                    <th className="px-4 py-3">Compatibility</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Mixed Outcome</th>
                    <th className="px-4 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={`${item.orderId}-${item.suborderId}-${item.primaryCategory?.code || "reconcile"}`}>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900">{item.invoiceNo || "-"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.checkoutMode || "LEGACY"} | {formatDateTime(item.orderUpdatedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-slate-900">
                          {item.suborderNumber || `Suborder #${item.suborderId || "-"}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.store?.name || "Store"} | ID {item.store?.id || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex max-w-[220px] flex-wrap gap-1.5">
                          {item.categories.map((category) => (
                            <span
                              key={category.code}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                              title={category.detail || category.label}
                            >
                              {category.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <StatusPill
                          label={
                            item.canonicalShipmentStatusMeta?.label ||
                            formatStatus(item.canonicalShipmentStatus)
                          }
                          tone={item.canonicalShipmentStatusMeta?.tone}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          {item.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="text-xs text-slate-500">Stored</p>
                        <p className="font-semibold text-slate-800">
                          {item.storedFulfillmentStatusMeta?.label ||
                            formatStatus(item.storedFulfillmentStatus)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Canonical maps to</p>
                        <p className="font-semibold text-slate-800">
                          {item.compatibilityFulfillmentStatusMeta?.label ||
                            formatStatus(item.compatibilityFulfillmentStatus)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        <p>{item.tracking?.eventCount || 0} event{item.tracking?.eventCount === 1 ? "" : "s"}</p>
                        <p className="mt-1">Last: {formatDateTime(item.tracking?.lastTransitionAt)}</p>
                        {item.tracking?.hasAdminCorrection ? (
                          <p className="mt-1 font-semibold text-emerald-700">Admin correction logged</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600">
                        {item.mixedOutcome?.isMixed ? (
                          <p className="font-semibold text-amber-700">
                            {item.mixedOutcome.summary || "Mixed"}
                          </p>
                        ) : (
                          <p>-</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        {item.orderDetailHref ? (
                          <Link
                            to={item.orderDetailHref}
                            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            Open order
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {Number(meta.totalPages || 1) > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>
            Page {meta.page || 1} of {meta.totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={Number(meta.page || 1) <= 1}
              onClick={() => updateParams({ page: Math.max(1, Number(meta.page || 1) - 1) })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={Number(meta.page || 1) >= Number(meta.totalPages || 1)}
              onClick={() => updateParams({ page: Number(meta.page || 1) + 1 })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

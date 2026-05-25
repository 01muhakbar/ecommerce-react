import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminShippingReconciliationReport } from "../../lib/adminApi.js";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsMetricCard,
  AdminOpsPageHeader,
  AdminOpsStatusBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const CATEGORY_OPTIONS = [
  ["", "All"],
  ["activeShippingException", "Active exception"],
  ["finalShippingException", "Final exception"],
  ["compatibilityMismatch", "Compatibility mismatch"],
  ["mixedShipmentOutcome", "Mixed outcome"],
  ["trackingDataIncomplete", "Tracking incomplete"],
  ["adminCorrectedRecent", "Admin corrected"],
];
const CATEGORY_LABEL_BY_CODE = Object.fromEntries(CATEGORY_OPTIONS);

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
  return <AdminOpsStatusBadge label={label || "-"} tone={tone} />;
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
  const categoryCounts = meta.categoryCounts || {};
  const topCategories = Object.entries(categoryCounts)
    .filter(([, count]) => Number(count || 0) > 0)
    .slice(0, 4);

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Shipping Reconciliation"
        description="Read-only shipment exceptions and tracking audit."
        meta={`${meta.total || 0} item${meta.total === 1 ? "" : "s"}`}
        badges={
          <>
            <AdminOpsStatusBadge
              label={meta.total ? "Needs attention" : "Ready"}
              tone={meta.total ? "attention" : "ready"}
            />
            <AdminOpsStatusBadge
              label={topCategories.length ? "Action needed" : "Verified"}
              tone={topCategories.length ? "amber" : "verified"}
            />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <AdminOpsMetricCard
          label="Scanned Orders"
          badgeLabel="Ready"
          value={meta.scannedOrders || 0}
          helper={`Last ${meta.maxScanLimit || 500} order scan limit.`}
          tone="info"
        />
        <AdminOpsMetricCard
          label="Exception Items"
          badgeLabel={meta.total ? "Needs attention" : "Ready"}
          value={meta.total || 0}
          helper="Rows matching current filters."
          tone={meta.total ? "attention" : "ready"}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topCategories.length > 0 ? (
              topCategories.map(([code, count]) => (
                <StatusPill
                  key={code}
                  label={`${CATEGORY_LABEL_BY_CODE[code] || formatStatus(code)} ${count}`}
                  tone={code.includes("Exception") ? "rose" : "slate"}
                />
              ))
            ) : (
              <span className="text-sm font-medium text-slate-600">No exception category detected.</span>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,2fr)_repeat(3,minmax(150px,1fr))]">
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

      {reportQuery.isLoading ? (
        <AdminOpsLoadingState title="Loading shipping reconciliation..." />
      ) : null}

      {reportQuery.isError ? (
        <AdminOpsErrorState
          message={
            reportQuery.error?.response?.data?.message ||
            reportQuery.error?.message ||
            "Failed to load shipping reconciliation report."
          }
          onRetry={() => reportQuery.refetch()}
        />
      ) : null}

      {!reportQuery.isLoading && !reportQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <AdminOpsEmptyState
              title="No shipping exceptions found"
              description={`${meta.scannedOrders || 0} order${
                meta.scannedOrders === 1 ? "" : "s"
              } scanned. Current filters look clean.`}
            />
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

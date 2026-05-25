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

const RISK_FILTERS = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "mismatch", label: "Mismatch" },
  { value: "active", label: "Active exception" },
  { value: "final", label: "Final exception" },
  { value: "tracking", label: "Tracking gap" },
  { value: "corrected", label: "Corrected" },
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

const hasCategory = (item, code) =>
  Array.isArray(item?.categories) && item.categories.some((category) => category.code === code);

const getShippingRisk = (item) => {
  const activeException = hasCategory(item, "activeShippingException");
  const finalException = hasCategory(item, "finalShippingException");
  const compatibilityMismatch = hasCategory(item, "compatibilityMismatch");
  const mixedOutcome = hasCategory(item, "mixedShipmentOutcome");
  const trackingGap = hasCategory(item, "trackingDataIncomplete");
  const adminCorrected = hasCategory(item, "adminCorrectedRecent");

  if (activeException) {
    return {
      key: "urgent",
      label: "Urgent",
      tone: "rose",
      helper: "Failed delivery still needs operational follow-up.",
      rank: 5,
    };
  }
  if (finalException) {
    return {
      key: "final",
      label: "Final exception",
      tone: "stone",
      helper: "Returned or cancelled shipment is closed in an exception lane.",
      rank: 4,
    };
  }
  if (compatibilityMismatch || mixedOutcome) {
    return {
      key: "mismatch",
      label: compatibilityMismatch ? "Mismatch" : "Mixed split",
      tone: "attention",
      helper: compatibilityMismatch
        ? "Canonical shipment truth differs from stored compatibility status."
        : "Store splits on the same order have conflicting shipment outcomes.",
      rank: 3,
    };
  }
  if (trackingGap) {
    return {
      key: "tracking",
      label: "Tracking gap",
      tone: "amber",
      helper: "Courier, tracking number, or shipment timeline is incomplete.",
      rank: 2,
    };
  }
  if (adminCorrected) {
    return {
      key: "corrected",
      label: "Corrected",
      tone: "info",
      helper: "Admin correction is already present in the shipment timeline.",
      rank: 1,
    };
  }
  return {
    key: "all",
    label: "Review",
    tone: "neutral",
    helper: "Review the reported shipment exception.",
    rank: 0,
  };
};

export default function AdminShippingReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [riskFilter, setRiskFilter] = useState("all");

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
  const visibleCounts = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          const risk = getShippingRisk(item);
          if (risk.key === "urgent") acc.urgent += 1;
          if (risk.key === "mismatch") acc.mismatch += 1;
          if (risk.key === "final") acc.final += 1;
          if (risk.key === "tracking") acc.tracking += 1;
          if (risk.key === "corrected") acc.corrected += 1;
          if (hasCategory(item, "activeShippingException")) acc.active += 1;
          return acc;
        },
        { urgent: 0, mismatch: 0, active: 0, final: 0, tracking: 0, corrected: 0 }
      ),
    [items]
  );
  const filteredItems = useMemo(() => {
    if (riskFilter === "all") return items;
    if (riskFilter === "active") {
      return items.filter((item) => hasCategory(item, "activeShippingException"));
    }
    return items.filter((item) => getShippingRisk(item).key === riskFilter);
  }, [items, riskFilter]);
  const urgentQueue = useMemo(
    () =>
      [...items]
        .map((item) => ({ item, risk: getShippingRisk(item) }))
        .sort((a, b) => b.risk.rank - a.risk.rank || String(a.item.invoiceNo || "").localeCompare(b.item.invoiceNo || ""))
        .slice(0, 3),
    [items]
  );

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Shipping Reconciliation"
        description="Read-only queue for shipment exceptions, tracking gaps, and split mismatches."
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
        actions={
          <button
            type="button"
            onClick={() => reportQuery.refetch()}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Refresh
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AdminOpsMetricCard
          label="Scanned Orders"
          badgeLabel="Ready"
          value={meta.scannedOrders || 0}
          helper={`Last ${meta.maxScanLimit || 500} order scan limit.`}
          tone="info"
        />
        <AdminOpsMetricCard
          label="Urgent Follow-up"
          badgeLabel={visibleCounts.urgent ? "Action needed" : "No urgent"}
          value={visibleCounts.urgent}
          helper="Failed delivery rows on this loaded page."
          tone={visibleCounts.urgent ? "rose" : "ready"}
        />
        <AdminOpsMetricCard
          label="Mismatch"
          badgeLabel={visibleCounts.mismatch ? "Review sync" : "Aligned"}
          value={visibleCounts.mismatch}
          helper="Compatibility or mixed split rows on this page."
          tone={visibleCounts.mismatch ? "attention" : "ready"}
        />
        <AdminOpsMetricCard
          label="Tracking Gaps"
          badgeLabel={visibleCounts.tracking ? "Incomplete" : "Complete"}
          value={visibleCounts.tracking}
          helper="Courier, tracking, or timeline gaps on this page."
          tone={visibleCounts.tracking ? "amber" : "ready"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk Queue</p>
              <p className="mt-1 text-sm text-slate-500">Client-side priority for the current loaded page.</p>
            </div>
            <AdminOpsStatusBadge
              label={visibleCounts.urgent || visibleCounts.mismatch ? "Review first" : "Stable view"}
              tone={visibleCounts.urgent ? "rose" : visibleCounts.mismatch ? "attention" : "ready"}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {urgentQueue.length > 0 ? (
              urgentQueue.map(({ item, risk }) => (
                <div
                  key={`queue-${item.orderId}-${item.suborderId}-${risk.key}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <AdminOpsStatusBadge label={risk.label} tone={risk.tone} />
                    {item.orderDetailHref ? (
                      <Link
                        to={item.orderDetailHref}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">{item.invoiceNo || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.store?.name || "Store"} | {item.suborderNumber || `Suborder #${item.suborderId || "-"}`}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{risk.helper}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700 md:col-span-3">
                No shipping risk in the current view.
              </div>
            )}
          </div>
        </section>

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
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-lg bg-white px-3 py-2">Final {visibleCounts.final}</span>
            <span className="rounded-lg bg-white px-3 py-2">Corrected {visibleCounts.corrected}</span>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Filter</p>
            <p className="mt-1 text-sm text-slate-500">Applies to the rows loaded on this page.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RISK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRiskFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  riskFilter === filter.value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <AdminOpsMetricCard
          label="Exception Items"
          badgeLabel={meta.total ? "Needs attention" : "Ready"}
          value={meta.total || 0}
          helper="Rows matching current filters."
          tone={meta.total ? "attention" : "ready"}
        />
        <AdminOpsMetricCard
          label="Active Exceptions"
          badgeLabel={visibleCounts.active ? "Manual follow-up" : "None visible"}
          value={visibleCounts.active}
          helper="Failed delivery rows currently visible."
          tone={visibleCounts.active ? "rose" : "ready"}
        />
        <AdminOpsMetricCard
          label="Loaded Rows"
          badgeLabel={riskFilter === "all" ? "All visible" : "Filtered"}
          value={`${filteredItems.length}/${items.length}`}
          helper="Quick filter is local to current page data."
          tone={filteredItems.length === items.length ? "info" : "attention"}
        />
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
              title="No shipping issues in this view"
              description={`${meta.scannedOrders || 0} order${
                meta.scannedOrders === 1 ? "" : "s"
              } scanned. Current filters look clean.`}
            />
          ) : filteredItems.length === 0 ? (
            <AdminOpsEmptyState
              title="No rows match this quick filter"
              description="Try All, or adjust the API filters above to load a different page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Store Split</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Canonical</th>
                    <th className="px-4 py-3">Compatibility</th>
                    <th className="px-4 py-3">Tracking</th>
                    <th className="px-4 py-3">Mixed Outcome</th>
                    <th className="px-4 py-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const risk = getShippingRisk(item);
                    return (
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
                          <StatusPill label={risk.label} tone={risk.tone} />
                          <p className="mt-2 max-w-[200px] text-xs leading-5 text-slate-500">
                            {risk.helper}
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
                    );
                  })}
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

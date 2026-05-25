import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStoreApplications } from "../../api/adminStoreApplications.ts";
import { STORE_APPLICATION_FILTER_OPTIONS } from "../../utils/storeOnboardingPresentation.ts";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsMetricCard,
  AdminOpsPageHeader,
  AdminOpsStatusBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const STATUS_OPTIONS = STORE_APPLICATION_FILTER_OPTIONS;

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StatusPill({ label, tone = "stone" }) {
  return <AdminOpsStatusBadge label={label} tone={tone} />;
}

function ProgressBar({ completed, total }) {
  const percent = total > 0 ? Math.round((Number(completed || 0) / Number(total)) * 100) : 0;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{percent}% complete</p>
    </div>
  );
}

export default function AdminStoreApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusInput, setStatusInput] = useState(searchParams.get("status") || "");

  const params = useMemo(() => {
    const page = Number(searchParams.get("page") || 1);
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: 10,
      status: searchParams.get("status") || "",
    };
  }, [searchParams]);

  const applicationsQuery = useQuery({
    queryKey: ["admin", "store-applications", params],
    queryFn: () => fetchAdminStoreApplications(params),
  });

  const updateParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      const normalized = String(value ?? "").trim();
      if (!normalized) next.delete(key);
      else next.set(key, normalized);
    });
    if (!Object.prototype.hasOwnProperty.call(patch, "page")) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const items = Array.isArray(applicationsQuery.data?.items) ? applicationsQuery.data.items : [];
  const meta = applicationsQuery.data?.meta || {
    page: 1,
    totalPages: 1,
    total: 0,
  };
  const visibleSummary = useMemo(
    () =>
      items.reduce(
        (acc, entry) => {
          const status = String(entry.status || "").toLowerCase();
          if (["submitted", "under_review"].includes(status)) acc.reviewable += 1;
          if (entry.completeness?.isComplete) acc.complete += 1;
          if (status === "revision_requested") acc.revision += 1;
          return acc;
        },
        { reviewable: 0, complete: 0, revision: 0 }
      ),
    [items]
  );

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Store Applications"
        description="Onboarding queue, readiness, and review actions."
        meta={`${meta.total || 0} application${meta.total === 1 ? "" : "s"}`}
        badges={
          <>
            <AdminOpsStatusBadge
              label={visibleSummary.reviewable ? "Action needed" : "Ready"}
              tone={visibleSummary.reviewable ? "attention" : "ready"}
            />
            <AdminOpsStatusBadge
              label={visibleSummary.revision ? "Needs attention" : "Verified"}
              tone={visibleSummary.revision ? "rose" : "verified"}
            />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <AdminOpsMetricCard
          label="Review Queue"
          badgeLabel={visibleSummary.reviewable ? "Action needed" : "Ready"}
          value={visibleSummary.reviewable}
          helper="Submitted or under review in this page."
          tone={visibleSummary.reviewable ? "attention" : "ready"}
        />
        <AdminOpsMetricCard
          label="Complete Forms"
          badgeLabel="Verified"
          value={visibleSummary.complete}
          helper="All required application fields present."
          tone="verified"
        />
        <AdminOpsMetricCard
          label="Revision Queue"
          badgeLabel={visibleSummary.revision ? "Needs attention" : "Ready"}
          value={visibleSummary.revision}
          helper="Waiting for applicant updates."
          tone={visibleSummary.revision ? "rose" : "ready"}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto]">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status Filter
            </label>
            <select
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => updateParams({ status: statusInput })}
            className="self-end rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusInput("");
              updateParams({ status: "", page: "1" });
            }}
            className="self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </section>

      {applicationsQuery.isLoading ? (
        <AdminOpsLoadingState title="Loading store applications..." />
      ) : null}

      {applicationsQuery.isError ? (
        <AdminOpsErrorState
          message={
            applicationsQuery.error?.response?.data?.message ||
            applicationsQuery.error?.message ||
            "Failed to load store applications."
          }
          onRetry={() => applicationsQuery.refetch()}
        />
      ) : null}

      {!applicationsQuery.isLoading && !applicationsQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <AdminOpsEmptyState
              title="No applications match this view"
              description="Clear the filter to see all onboarding applications."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Completeness</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Reviewed</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">
                          {entry.applicant.accountName || "Unknown applicant"}
                        </div>
                        <div className="text-xs text-slate-500">{entry.applicant.accountEmail || "-"}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          Identity: {entry.applicant.identityMatch.summaryLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {entry.storeInformation.storeName || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.storeInformation.storeSlug
                            ? `@${entry.storeInformation.storeSlug}`
                            : "No slug"}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {entry.storeInformation.storeCategory || "-"} |{" "}
                          {entry.storeInformation.sellerType || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <StatusPill
                            label={entry.statusMeta.label}
                            tone={entry.statusMeta.tone}
                          />
                          <StatusPill label={entry.currentStepMeta.label} tone="stone" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {entry.completeness.completedFields}/{entry.completeness.totalFields}
                        </div>
                        <div className="mt-2">
                          <ProgressBar
                            completed={entry.completeness.completedFields}
                            total={entry.completeness.totalFields}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {entry.completeness.label}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {formatDateTime(entry.submittedAt)}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>{formatDateTime(entry.reviewedAt)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {entry.reviewedBy?.name || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          to={`/admin/store/applications/${entry.id}`}
                          className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
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

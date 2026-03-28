import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStoreApplications } from "../../api/adminStoreApplications.ts";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "revision_requested", label: "Revision requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
];

const STATUS_CLASS = {
  stone: "border-slate-200 bg-slate-100 text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StatusPill({ label, tone = "stone" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        STATUS_CLASS[tone] || STATUS_CLASS.stone
      }`}
    >
      {label}
    </span>
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">Store Applications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review incoming store onboarding applications, verify applicant data, and decide approve,
            revision request, or reject.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {meta.total || 0} application{meta.total === 1 ? "" : "s"}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading store applications...
        </div>
      ) : null}

      {applicationsQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {applicationsQuery.error?.response?.data?.message ||
            applicationsQuery.error?.message ||
            "Failed to load store applications."}
        </div>
      ) : null}

      {!applicationsQuery.isLoading && !applicationsQuery.isError ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No store applications found for the selected filter.
            </div>
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
                          Match: {entry.applicant.identityMatch.summaryLabel}
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
                          {entry.storeInformation.storeCategory || "-"} •{" "}
                          {entry.storeInformation.sellerType || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <StatusPill
                            label={entry.statusMeta.label}
                            tone={entry.statusMeta.tone}
                          />
                          <div className="text-xs text-slate-500">
                            Step: {entry.currentStepMeta.label}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {entry.completeness.completedFields}/{entry.completeness.totalFields}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
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
                          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View Detail
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

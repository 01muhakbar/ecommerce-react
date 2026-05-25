import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStorePaymentProfiles,
  reviewAdminStorePaymentProfile,
} from "../../api/storePaymentProfiles.ts";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsMetricCard,
  AdminOpsPageHeader,
  AdminOpsStatusBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StatusPill({ label, status }) {
  return <AdminOpsStatusBadge label={label} tone={status} />;
}

function ProgressBar({ value }) {
  const normalized = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${normalized}%` }} />
    </div>
  );
}

function ImagePanel({ title, hint, imageUrl, alt, statusLabel }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <StatusPill
          label={imageUrl ? statusLabel || "Available" : "Missing"}
          status={imageUrl ? "SUCCESS" : "NEUTRAL"}
        />
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="h-40 w-full rounded-md bg-white object-contain"
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white text-sm font-medium text-slate-400">
            No QRIS uploaded
          </div>
        )}
      </div>
    </div>
  );
}

function ReadinessPanel({ workspaceReadiness, readinessChecklist }) {
  if (!workspaceReadiness) return null;

  const visibleChecks = readinessChecklist.filter((item) => item.visible !== false);
  const importantChecks = visibleChecks.slice(0, 4);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Seller Readiness
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {workspaceReadiness.completionPercent || 0}% complete
          </p>
        </div>
        <StatusPill
          label={workspaceReadiness.summary?.label || "In progress"}
          status={workspaceReadiness.summary?.tone || "NEUTRAL"}
        />
      </div>
      <div className="mt-3">
        <ProgressBar value={workspaceReadiness.completionPercent || 0} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {importantChecks.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <span className="min-w-0 truncate text-sm font-medium text-slate-700">
              {item.label}
            </span>
            <StatusPill
              label={item.status?.label || "Unknown"}
              status={item.status?.tone || "NEUTRAL"}
            />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Complete required items before checkout can go live.
      </p>
    </div>
  );
}

function SnapshotField({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function getShortWorkflowLabel(status, fallback = "Not ready") {
  const label = String(status?.label || fallback).trim();
  return label
    .replace(/^Waiting for seller setup$/i, "Seller setup")
    .replace(/^No open request$/i, "No request")
    .replace(/^Not reviewed yet$/i, "Not reviewed")
    .replace(/^Action required$/i, "Action needed");
}

export default function AdminStorePaymentProfilesPage() {
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ["admin-store-payment-profiles"],
    queryFn: fetchAdminStorePaymentProfiles,
  });

  const mutation = useMutation({
    mutationFn: ({ storeId, payload }) => reviewAdminStorePaymentProfile(storeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-payment-profiles"] });
    },
  });

  const items = useMemo(
    () => (Array.isArray(profilesQuery.data) ? profilesQuery.data : []),
    [profilesQuery.data]
  );
  const summary = useMemo(() => {
    const pending = items.filter((entry) => entry.pendingRequest).length;
    const active = items.filter((entry) => entry.paymentProfile?.readiness?.isReady).length;
    const needsAction = items.filter(
      (entry) => entry.workflow?.governance?.canApprovePromotion || entry.workflow?.governance?.canRequestRevision
    ).length;
    return { pending, active, needsAction };
  }, [items]);

  if (profilesQuery.isLoading) {
    return <AdminOpsLoadingState title="Loading store payment profiles..." />;
  }

  if (profilesQuery.isError) {
    return (
      <AdminOpsErrorState
        message={
          profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store payment."
        }
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Store Payment"
        description="QRIS approval, active snapshots, and checkout readiness."
        meta={`${items.length} store${items.length === 1 ? "" : "s"}`}
        badges={
          <>
            <AdminOpsStatusBadge
              label={summary.needsAction ? "Action needed" : "Ready"}
              tone={summary.needsAction ? "attention" : "ready"}
            />
            <AdminOpsStatusBadge
              label={summary.active ? "Verified" : "Missing"}
              tone={summary.active ? "verified" : "missing"}
            />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <AdminOpsMetricCard
          label="Active Ready"
          badgeLabel={summary.active ? "Ready" : "Missing"}
          value={summary.active}
          helper="Can accept checkout."
          tone={summary.active ? "ready" : "missing"}
        />
        <AdminOpsMetricCard
          label="Pending Review"
          badgeLabel={summary.pending ? "Action needed" : "Ready"}
          value={summary.pending}
          helper="Seller requests awaiting admin review."
          tone={summary.pending ? "attention" : "ready"}
        />
        <AdminOpsMetricCard
          label="Admin Decisions"
          badgeLabel={summary.needsAction ? "Action needed" : "Verified"}
          value={summary.needsAction}
          helper="Approval, revision, or activation available."
          tone={summary.needsAction ? "rose" : "verified"}
        />
      </div>

      {items.length === 0 ? (
        <AdminOpsEmptyState
          title="No store payment data found"
          description="Seller submissions and active snapshots will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((entry) => {
            const profile = entry.paymentProfile;
            const pendingRequest = entry.pendingRequest;
            const workflow = entry.workflow || {};
            const currentStatus = String(
              profile?.activityMeta?.code || profile?.verificationStatus || "NOT_CONFIGURED"
            ).toUpperCase();
            const pendingStoreId = mutation.variables?.storeId;
            const isBusy =
              mutation.isPending && Number(pendingStoreId) === Number(entry.store.id);
            const canApprovePromotion = Boolean(workflow?.governance?.canApprovePromotion);
            const canRequestRevision = Boolean(workflow?.governance?.canRequestRevision);
            const canToggleActiveSnapshot = Boolean(workflow?.governance?.canToggleActiveSnapshot);
            const completeness = workflow?.completeness || {};
            const missingFields = Array.isArray(completeness?.missingFields)
              ? completeness.missingFields
              : [];
            const workspaceReadiness = entry.workspaceReadiness || null;
            const readinessChecklist = Array.isArray(workspaceReadiness?.checklist)
              ? workspaceReadiness.checklist
              : [];
            const activeStatusLabel = profile
              ? profile.isActive
                ? "Active snapshot"
                : "Inactive snapshot"
              : "No snapshot";
            const reviewStatusLabel = workflow?.reviewStatus?.label
              ? `Review ${getShortWorkflowLabel(workflow.reviewStatus)}`
              : "Review not reviewed";
            const readinessStatusLabel = workspaceReadiness?.summary?.label
              ? getShortWorkflowLabel(workspaceReadiness.summary, "In progress")
              : "Readiness unknown";
            const hasAdminAction =
              canApprovePromotion || canRequestRevision || canToggleActiveSnapshot;
            const actionHelper = pendingRequest
              ? canApprovePromotion
                ? "Only approved requests can be promoted."
                : "Request is not eligible for promotion yet."
              : profile
                ? canToggleActiveSnapshot
                  ? "Manual activation follows backend governance."
                  : "Backend governance keeps this action locked."
                : "No snapshot is available to activate.";

            return (
              <section
                key={entry.store.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{entry.store.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {entry.owner?.name || "-"} ({entry.owner?.email || "-"})
                    </p>
                  </div>
                  <div className="flex max-w-full flex-wrap justify-start gap-2 sm:justify-end">
                    <StatusPill
                      label={activeStatusLabel}
                      status={profile?.activityMeta?.tone || currentStatus}
                    />
                    <StatusPill
                      label={reviewStatusLabel}
                      status={workflow?.reviewStatus?.tone || "NEUTRAL"}
                    />
                    {workspaceReadiness ? (
                      <StatusPill
                        label={readinessStatusLabel}
                        status={workspaceReadiness.summary?.tone || "NEUTRAL"}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Active Snapshot</p>
                          <p className="mt-1 text-xs text-slate-500">Used by checkout</p>
                        </div>
                        <StatusPill
                          label={profile?.activityMeta?.label || activeStatusLabel}
                          status={profile?.activityMeta?.tone || currentStatus}
                        />
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <SnapshotField label="Account" value={profile?.accountName} />
                        <SnapshotField label="Merchant" value={profile?.merchantName} />
                        <SnapshotField label="Merchant ID" value={profile?.merchantId} />
                        <SnapshotField
                          label="Version"
                          value={profile?.version ? `v${profile.version}` : "-"}
                        />
                      </div>
                    </div>

                    {pendingRequest ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-amber-900">Pending admin review</p>
                          <StatusPill
                            label={getShortWorkflowLabel(workflow?.requestState, "Submitted")}
                            status={workflow?.requestState?.tone || "WARNING"}
                          />
                        </div>
                        <p className="mt-1 text-xs font-medium text-amber-800">Awaiting admin review</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <StatusPill label="No pending request" status="NEUTRAL" />
                        <span>Admin approval required for activation</span>
                      </div>
                    )}

                    {pendingRequest ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Pending Account
                          </p>
                          <p className="mt-2 text-sm text-slate-900">{pendingRequest.accountName || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Pending Merchant
                          </p>
                          <p className="mt-2 text-sm text-slate-900">{pendingRequest.merchantName || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Submitted At
                          </p>
                          <p className="mt-2 text-sm text-slate-900">{formatDate(pendingRequest.submittedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Based On Snapshot
                          </p>
                          <p className="mt-2 text-sm text-slate-900">
                            {pendingRequest.basedOnProfileId ? `#${pendingRequest.basedOnProfileId}` : "-"}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Instruction
                          </p>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-700">
                            {pendingRequest.instructionText || "-"}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Seller Note
                          </p>
                          <p className="mt-2 text-sm text-slate-700">{pendingRequest.sellerNote || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Review Status
                          </p>
                          <p className="mt-2 text-sm text-slate-900">
                            {workflow?.reviewStatus?.label || "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Required Fields
                          </p>
                          <p className="mt-2 text-sm text-slate-900">
                            {`${completeness?.completedFields || 0}/${completeness?.totalFields || 0}`}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {missingFields.length ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Missing required fields: {missingFields.map((field) => field.label).join(", ")}
                      </div>
                    ) : null}
                    {workflow?.reviewStatus?.adminReviewNote ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        Admin review note: {workflow.reviewStatus.adminReviewNote}
                      </div>
                    ) : null}
                    {workflow?.governance?.note ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <StatusPill label="Admin authority" status="NEUTRAL" />
                        <span>Approval required</span>
                      </div>
                    ) : null}
                    <ReadinessPanel
                      workspaceReadiness={workspaceReadiness}
                      readinessChecklist={readinessChecklist}
                    />
                  </div>

                  <div className="grid gap-4">
                    <ImagePanel
                      title="Active QRIS"
                      hint="Used by checkout"
                      imageUrl={profile?.qrisImageUrl || null}
                      alt={`Active QRIS ${entry.store.name}`}
                      statusLabel="Available"
                    />
                    <ImagePanel
                      title="Pending Request"
                      hint="Awaiting admin review"
                      imageUrl={pendingRequest?.qrisImageUrl || null}
                      alt={`Pending QRIS ${entry.store.name}`}
                      statusLabel="Submitted"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Admin action</p>
                    <p className="mt-1 text-xs text-slate-500">{actionHelper}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingRequest ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            mutation.mutate({
                              storeId: entry.store.id,
                              payload: { verificationStatus: "ACTIVE" },
                            })
                          }
                          disabled={isBusy || !canApprovePromotion}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Updating..." : "Approve & Promote"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            mutation.mutate({
                              storeId: entry.store.id,
                              payload: { verificationStatus: "REJECTED" },
                            })
                          }
                          disabled={isBusy || !canRequestRevision}
                          className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Request Revision
                        </button>
                      </>
                    ) : null}

                    {profile ? (
                      <button
                        type="button"
                        onClick={() =>
                          mutation.mutate({
                            storeId: entry.store.id,
                            payload: {
                              verificationStatus: profile.isActive ? "INACTIVE" : "ACTIVE",
                            },
                          })
                        }
                        disabled={isBusy || !canToggleActiveSnapshot}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          !profile.isActive && canToggleActiveSnapshot
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {profile.isActive ? "Deactivate Snapshot" : "Activate Snapshot"}
                      </button>
                    ) : null}
                    {!hasAdminAction ? (
                      <StatusPill label="No action available" status="NEUTRAL" />
                    ) : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

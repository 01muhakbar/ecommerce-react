import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStorePaymentProfiles,
  reviewAdminStorePaymentProfile,
} from "../../api/storePaymentProfiles.ts";

const STATUS_STYLES = {
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-700",
  NEEDS_REVISION: "border-rose-200 bg-rose-50 text-rose-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-700",
  EMERALD: "border-emerald-200 bg-emerald-50 text-emerald-700",
  AMBER: "border-amber-200 bg-amber-50 text-amber-700",
  ROSE: "border-rose-200 bg-rose-50 text-rose-700",
  SKY: "border-sky-200 bg-sky-50 text-sky-700",
  STONE: "border-slate-200 bg-slate-100 text-slate-700",
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  DANGER: "border-rose-200 bg-rose-50 text-rose-700",
  NEUTRAL: "border-slate-200 bg-slate-100 text-slate-700",
};

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
  const className =
    STATUS_STYLES[String(status || "").toUpperCase()] ||
    "border-slate-200 bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function ImagePanel({ title, hint, imageUrl, alt }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt}
            className="h-48 w-full rounded-lg bg-white object-contain"
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-400">
            No QRIS image
          </div>
        )}
      </div>
    </div>
  );
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

  if (profilesQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading store payment profiles...
      </div>
    );
  }

  if (profilesQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store payment profiles."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">Store Payment Profiles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review seller payment setup requests and promote approved QRIS revisions into a new active snapshot.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length} store{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No store payment profiles found yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((entry) => {
            const profile = entry.paymentProfile;
            const pendingRequest = entry.pendingRequest;
            const workflow = entry.workflow || {};
            const currentStatus = String(
              profile?.activityMeta?.code || profile?.verificationStatus || "NOT_CONFIGURED"
            ).toUpperCase();
            const requestStatus = String(
              workflow?.requestState?.code || pendingRequest?.requestStatus || ""
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

            return (
              <section
                key={entry.store.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{entry.store.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {entry.owner?.name || "-"} ({entry.owner?.email || "-"})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={
                        workflow?.primaryStatus?.label ||
                        (currentStatus === "NOT_CONFIGURED"
                          ? "No Active Snapshot"
                          : `Active ${currentStatus}`)
                      }
                      status={workflow?.primaryStatus?.tone || currentStatus}
                    />
                    {pendingRequest ? (
                      <StatusPill
                        label={`Request ${workflow?.requestState?.label || requestStatus}`}
                        status={workflow?.requestState?.tone || requestStatus}
                      />
                    ) : null}
                    <StatusPill
                      label={`Review ${workflow?.reviewStatus?.label || "Not reviewed yet"}`}
                      status={workflow?.reviewStatus?.tone || "NEUTRAL"}
                    />
                    {workspaceReadiness ? (
                      <StatusPill
                        label={`Readiness ${workspaceReadiness.summary?.label || "In progress"}`}
                        status={workspaceReadiness.summary?.tone || "NEUTRAL"}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active Account Name
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile?.accountName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active Merchant Name
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile?.merchantName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active Merchant ID
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile?.merchantId || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active Snapshot Version
                        </p>
                        <p className="mt-2 text-sm text-slate-900">
                          {profile?.version ? `v${profile.version}` : "-"}
                        </p>
                      </div>
                    </div>

                    {pendingRequest ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {workflow?.primaryStatus?.description ||
                          "A seller payment setup request is waiting for admin action. Promoting it will create a new immutable active snapshot and switch the store pointer."}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {workflow?.nextStep?.description ||
                          "No submitted payment setup request is waiting for review right now."}
                      </div>
                    )}

                    {pendingRequest ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Pending Account Name
                          </p>
                          <p className="mt-2 text-sm text-slate-900">{pendingRequest.accountName || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Pending Merchant Name
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
                            Pending Instruction Text
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
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
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {workflow.governance.note}
                      </div>
                    ) : null}
                    {workspaceReadiness ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Seller Readiness
                          </p>
                          <span className="text-sm font-semibold text-slate-900">
                            {workspaceReadiness.completionPercent || 0}% ({workspaceReadiness.completedItems || 0}/
                            {workspaceReadiness.totalItems || 0})
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {workspaceReadiness.summary?.description ||
                            "Seller readiness follows the current store, payment, and catalog state."}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {readinessChecklist
                            .filter((item) => item.visible !== false)
                            .map((item) => (
                              <div
                                key={item.key}
                                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.status?.description || "-"}
                                  </p>
                                </div>
                                <StatusPill
                                  label={item.status?.label || "Unknown"}
                                  status={item.status?.tone || "NEUTRAL"}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4">
                    <ImagePanel
                      title="Current Active QRIS"
                      hint="Checkout keeps using this image until admin promotes a new snapshot."
                      imageUrl={profile?.qrisImageUrl || null}
                      alt={`Active QRIS ${entry.store.name}`}
                    />
                    <ImagePanel
                      title="Pending Request QRIS"
                      hint="This image stays in the request lane until admin approve/promote."
                      imageUrl={pendingRequest?.qrisImageUrl || null}
                      alt={`Pending QRIS ${entry.store.name}`}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
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
                        className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {profile.isActive ? "Deactivate Active Snapshot" : "Activate Current Snapshot"}
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

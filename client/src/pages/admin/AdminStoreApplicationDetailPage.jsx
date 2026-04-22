import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAdminStoreApplication,
  fetchAdminStoreApplicationDetail,
  rejectAdminStoreApplication,
  requestAdminStoreApplicationRevision,
} from "../../api/adminStoreApplications.ts";
import {
  presentStoreApplicationStatus,
  presentStoreReadiness,
} from "../../utils/storeOnboardingPresentation.ts";

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
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const yesNo = (value) => (value ? "Yes" : "No");

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

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailGrid({ items }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-900">{item.value || "-"}</p>
          {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

function Notice({ tone = "info", children }) {
  const className =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${className}`}>{children}</div>;
}

export default function AdminStoreApplicationDetailPage() {
  const { applicationId } = useParams();
  const queryClient = useQueryClient();
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [revisionInternalNote, setRevisionInternalNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectInternalNote, setRejectInternalNote] = useState("");
  const [approveInternalNote, setApproveInternalNote] = useState("");
  const [flash, setFlash] = useState(null);

  const detailQuery = useQuery({
    queryKey: ["admin", "store-application", applicationId],
    queryFn: () => fetchAdminStoreApplicationDetail(applicationId),
    enabled: Boolean(applicationId),
  });

  const syncDetail = (data, message) => {
    queryClient.setQueryData(["admin", "store-application", applicationId], data);
    queryClient.invalidateQueries({ queryKey: ["admin", "store-applications"] });
    setFlash(message ? { type: "success", message } : null);
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      approveAdminStoreApplication(applicationId, {
        internalAdminNote: approveInternalNote || null,
      }),
    onSuccess: (data) => syncDetail(data, "Application approved successfully."),
    onError: (error) =>
      setFlash({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to approve application.",
      }),
  });

  const revisionMutation = useMutation({
    mutationFn: () =>
      requestAdminStoreApplicationRevision(applicationId, {
        revisionNote,
        revisionSummary: revisionSummary || null,
        internalAdminNote: revisionInternalNote || null,
      }),
    onSuccess: (data) => syncDetail(data, "Revision request submitted successfully."),
    onError: (error) =>
      setFlash({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to request revision.",
      }),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectAdminStoreApplication(applicationId, {
        rejectReason,
        internalAdminNote: rejectInternalNote || null,
      }),
    onSuccess: (data) => syncDetail(data, "Application rejected successfully."),
    onError: (error) =>
      setFlash({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to reject application.",
      }),
  });

  const detail = detailQuery.data;
  const workflow = detail?.workflowSummary;
  const actionGovernance = workflow?.actionGovernance || {};
  const applicationStatus = detail
    ? presentStoreApplicationStatus(detail.statusMeta, detail.status)
    : presentStoreApplicationStatus("draft");
  const readinessStatus = presentStoreReadiness({
    storeStatus: workflow?.activation?.storeStatus || null,
    hasStore: Boolean(workflow?.activation?.storeId),
    sellerAccessReady: Boolean(workflow?.activation?.sellerAccessReady),
  });
  const isBusy =
    approveMutation.isPending || revisionMutation.isPending || rejectMutation.isPending;

  if (detailQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Loading store application detail...
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/store/applications"
          className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Queue
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {detailQuery.error?.response?.data?.message ||
            detailQuery.error?.message ||
            "Failed to load store application detail."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <Link
            to="/admin/store/applications"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Back to Queue
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold text-slate-800">
            Store Application #{detail.id}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review the application details and decide the next step.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={applicationStatus.label} tone={applicationStatus.tone} />
          <StatusPill label={readinessStatus.label} tone={readinessStatus.tone} />
          <StatusPill label={detail.currentStepMeta.label} tone="stone" />
        </div>
      </div>

      {flash ? <Notice tone={flash.type === "error" ? "error" : "info"}>{flash.message}</Notice> : null}

      <SectionCard
        title="Application Summary"
        description="Status, progress, and review timestamps."
      >
        <DetailGrid
          items={[
            { label: "Application Status", value: applicationStatus.label },
            { label: "Current Step", value: detail.currentStepMeta.label },
            {
              label: "Completeness",
              value: `${workflow.completeness.completedFields}/${workflow.completeness.totalFields}`,
              hint: workflow.completeness.label,
            },
            { label: "Submitted At", value: formatDateTime(workflow.submittedAt) },
            { label: "Reviewed At", value: formatDateTime(workflow.reviewedAt) },
            {
              label: "Reviewed By",
              value: workflow.reviewedBy?.name || "-",
              hint: workflow.reviewedBy?.email || null,
            },
            { label: "Revision Note", value: workflow.revisionNote },
            { label: "Revision Summary", value: workflow.revisionSummary },
            { label: "Reject Reason", value: workflow.rejectReason },
            { label: "Internal Admin Note", value: workflow.internalAdminNote },
          ]}
        />
        {actionGovernance.boundaryNote ? (
          <Notice tone="warning">{actionGovernance.boundaryNote}</Notice>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Store Readiness"
        description="Seller access and store activation stay separate from application review."
      >
        <DetailGrid
          items={[
            { label: "Readiness", value: readinessStatus.label, hint: readinessStatus.description },
            {
              label: "Provisioned Store",
              value: workflow.activation?.storeSlug
                ? `@${workflow.activation.storeSlug}`
                : "-",
              hint:
                workflow.activation?.storeStatus && workflow.activation?.storeId
                  ? `Store #${workflow.activation.storeId} • ${workflow.activation.storeStatus}`
                  : null,
            },
            {
              label: "Owner Membership",
              value:
                workflow.activation?.ownerMembershipId
                  ? `#${workflow.activation.ownerMembershipId}`
                  : "-",
              hint: workflow.activation?.ownerMembershipStatus || null,
            },
            {
              label: "Seller Access",
              value: workflow.activation?.sellerAccessReady ? "Ready" : "Not Ready",
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Applicant Identity"
        description="Account data and identity comparison."
      >
        <DetailGrid
          items={[
            { label: "User ID", value: String(detail.applicant.userId || "-") },
            { label: "Account Name", value: detail.applicant.accountName },
            { label: "Account Email", value: detail.applicant.accountEmail },
            { label: "Account Phone", value: detail.applicant.accountPhone },
            { label: "Account Role", value: detail.applicant.accountRole },
            { label: "Account Status", value: detail.applicant.accountStatus },
            { label: "Identity Name", value: detail.ownerIdentity.fullName },
            { label: "Identity Type", value: detail.ownerIdentity.identityType },
            { label: "Identity Number", value: detail.ownerIdentity.identityNumber },
            { label: "Birth Date", value: detail.ownerIdentity.birthDate },
            { label: "Operational PIC", value: detail.ownerIdentity.operationalContactName },
            { label: "Legal Name", value: detail.ownerIdentity.identityLegalName },
          ]}
        />
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            Identity match summary: {detail.applicant.identityMatch.summaryLabel}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {detail.applicant.identityMatch.fields.map((field) => (
              <div key={field.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {field.matched ? "Match" : "Mismatch"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Account: {field.accountValue || "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Application: {field.applicationValue || "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Store Information"
        description="Submitted store profile details."
      >
        <DetailGrid
          items={[
            { label: "Store Name", value: detail.storeInformation.storeName },
            { label: "Store Slug", value: detail.storeInformation.storeSlug },
            { label: "Business Category", value: detail.storeInformation.storeCategory },
            { label: "Seller Type", value: detail.storeInformation.sellerType },
            {
              label: "Self Produced",
              value: yesNo(detail.storeInformation.isSelfProduced),
            },
            {
              label: "Initial Product Estimate",
              value:
                detail.storeInformation.initialProductCount === null
                  ? "-"
                  : String(detail.storeInformation.initialProductCount),
            },
            { label: "Store Description", value: detail.storeInformation.description },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Operational Verification"
        description="Business contact and address details."
      >
        <DetailGrid
          items={[
            { label: "Operational Contact", value: detail.operationalVerification.contactName },
            { label: "Operational Phone", value: detail.operationalVerification.phoneNumber },
            { label: "Full Address", value: detail.operationalVerification.fullAddress },
            { label: "Province", value: detail.operationalVerification.province },
            { label: "City / Regency", value: detail.operationalVerification.city },
            { label: "District", value: detail.operationalVerification.district },
            { label: "Postal Code", value: detail.operationalVerification.postalCode },
            { label: "Country", value: detail.operationalVerification.country },
            { label: "Address Note", value: detail.operationalVerification.addressNotes },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Financial Verification"
        description="Masked payout details for review."
      >
        <DetailGrid
          items={[
            { label: "Payout Method", value: detail.financialVerification.payoutMethod },
            { label: "Account Holder", value: detail.financialVerification.accountHolderName },
            { label: "Bank / Channel", value: detail.financialVerification.bankChannel },
            {
              label: "Account Number",
              value: detail.financialVerification.accountNumberMasked,
            },
            {
              label: "Account Name Matches Identity",
              value: yesNo(detail.financialVerification.accountHolderMatchesIdentity),
            },
            { label: "Tax ID", value: detail.financialVerification.taxId },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Compliance and Risk"
        description="Declarations, support details, and risk-related notes."
      >
        <DetailGrid
          items={[
            { label: "Product Types", value: detail.complianceRisk.productTypes },
            { label: "Brand Ownership", value: detail.complianceRisk.brandOwnershipType },
            {
              label: "Authenticity Statement",
              value: yesNo(detail.complianceRisk.authenticityConfirmed),
            },
            {
              label: "No Prohibited Goods Statement",
              value: yesNo(detail.complianceRisk.prohibitedGoodsConfirmed),
            },
            { label: "Website", value: detail.complianceRisk.websiteUrl },
            { label: "Social Media", value: detail.complianceRisk.socialMediaUrl },
            { label: "Support Email", value: detail.complianceRisk.supportEmail },
            { label: "Support Phone", value: detail.complianceRisk.supportPhone },
            { label: "Additional Notes", value: detail.complianceRisk.additionalNotes },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Admin Actions"
        description="Approve, request revision, or reject the current application. Actions follow backend transition validation."
      >
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Approve</h3>
            <p className="mt-1 text-xs text-slate-500">
              Approve seller access. Public activity still depends on store readiness.
            </p>
            <textarea
              value={approveInternalNote}
              onChange={(event) => setApproveInternalNote(event.target.value)}
              className="mt-3 h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Optional internal admin note"
            />
            <button
              type="button"
              onClick={() => {
                setFlash(null);
                approveMutation.mutate();
              }}
              disabled={isBusy || !actionGovernance.canApprove}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approveMutation.isPending ? "Approving..." : "Approve Application"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Request Revision</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add a clear revision note for the applicant.
            </p>
            <textarea
              value={revisionNote}
              onChange={(event) => setRevisionNote(event.target.value)}
              className="mt-3 h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Revision note"
            />
            <textarea
              value={revisionSummary}
              onChange={(event) => setRevisionSummary(event.target.value)}
              className="mt-3 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Short revision summary"
            />
            <textarea
              value={revisionInternalNote}
              onChange={(event) => setRevisionInternalNote(event.target.value)}
              className="mt-3 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Optional internal admin note"
            />
            <button
              type="button"
              onClick={() => {
                setFlash(null);
                revisionMutation.mutate();
              }}
              disabled={isBusy || !actionGovernance.canRequestRevision || !revisionNote.trim()}
              className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {revisionMutation.isPending ? "Submitting..." : "Request Revision"}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Reject</h3>
            <p className="mt-1 text-xs text-slate-500">
              Add a rejection reason. Internal notes stay private.
            </p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="mt-3 h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Reject reason"
            />
            <textarea
              value={rejectInternalNote}
              onChange={(event) => setRejectInternalNote(event.target.value)}
              className="mt-3 h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none"
              placeholder="Optional internal admin note"
            />
            <button
              type="button"
              onClick={() => {
                setFlash(null);
                rejectMutation.mutate();
              }}
              disabled={isBusy || !actionGovernance.canReject || !rejectReason.trim()}
              className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

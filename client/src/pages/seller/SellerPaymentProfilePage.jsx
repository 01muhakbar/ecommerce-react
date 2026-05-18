import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CreditCard,
  ImageIcon,
  RotateCcw,
  Save,
  SendHorizonal,
  ShieldAlert,
  Upload,
} from "lucide-react";
import {
  getSellerPaymentProfile,
  saveSellerPaymentProfileDraft,
  submitSellerPaymentProfileRequest,
  uploadSellerPaymentProfileImage,
} from "../../api/sellerPaymentProfile.ts";
import {
  sellerDisabledFieldClass,
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerTextareaClass,
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";

const requiredFields = [
  { key: "accountName", label: "Account name" },
  { key: "merchantName", label: "Merchant name" },
  { key: "qrisImageUrl", label: "QRIS image" },
];

const editableFieldLabels = {
  accountName: "Account name",
  merchantName: "Merchant name",
  merchantId: "Merchant ID",
  qrisImageUrl: "QRIS image",
  qrisPayload: "QRIS text",
  instructionText: "Buyer instruction",
  sellerNote: "Seller note",
};

const formatEditableFields = (fields = []) => {
  if (!Array.isArray(fields) || fields.length === 0) return "-";
  return fields.map((field) => editableFieldLabels[field] || field).join(", ");
};

const formatPaymentType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "QRIS_STATIC") return "Static QRIS";
  return normalized
    ? normalized.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "QRIS";
};

const formatProvider = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "MANUAL_QRIS") return "Manual QRIS";
  return normalized
    ? normalized.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "Manual QRIS";
};

const createFormState = (profile) => ({
  accountName:
    profile?.pendingRequest?.accountName ||
    profile?.requestDraft?.accountName ||
    profile?.activeSnapshot?.accountName ||
    "",
  merchantName:
    profile?.pendingRequest?.merchantName ||
    profile?.requestDraft?.merchantName ||
    profile?.activeSnapshot?.merchantName ||
    "",
  merchantId:
    profile?.pendingRequest?.merchantId ||
    profile?.requestDraft?.merchantId ||
    profile?.activeSnapshot?.merchantId ||
    "",
  qrisImageUrl:
    profile?.pendingRequest?.qrisImageUrl ||
    profile?.requestDraft?.qrisImageUrl ||
    profile?.activeSnapshot?.qrisImageUrl ||
    "",
  qrisPayload:
    profile?.pendingRequest?.qrisPayload ||
    profile?.requestDraft?.qrisPayload ||
    profile?.activeSnapshot?.qrisPayload ||
    "",
  instructionText:
    profile?.pendingRequest?.instructionText ||
    profile?.requestDraft?.instructionText ||
    profile?.activeSnapshot?.instructionText ||
    "",
  sellerNote:
    profile?.pendingRequest?.sellerNote ||
    profile?.requestDraft?.sellerNote ||
    "",
});

const createFallbackProfile = (store, storeId, canEdit) => ({
  id: 0,
  storeId: Number(storeId || 0),
  activeSnapshot: null,
  pendingRequest: null,
  requestStatus: {
    code: canEdit ? "DRAFT" : "INACTIVE",
    label: canEdit ? "Draft request" : "Inactive",
    tone: canEdit ? "stone" : "neutral",
    description: canEdit
      ? "No open seller request exists yet. Saving a draft will create one without affecting checkout."
      : "This seller access can only monitor payment readiness.",
    isSubmitted: false,
    isDraft: canEdit,
  },
  reviewFeedback: {
    code: "NOT_REVIEWED",
    label: "Not reviewed yet",
    tone: "stone",
    description: "No seller request has been submitted for admin review yet.",
    reviewedAt: null,
    reviewedBy: null,
    adminReviewNote: null,
    source: "PENDING_REQUEST",
  },
  readModel: {
    primaryStatus: {
      code: "NEEDS_ACTION",
      label: "Needs action",
      tone: "warning",
      description:
        "Seller can prepare a separate payment setup request here, but checkout still uses only the current active approved setup.",
    },
    requestState: {
      code: canEdit ? "DRAFT" : "INACTIVE",
      label: canEdit ? "Draft request" : "Inactive",
      tone: canEdit ? "stone" : "neutral",
      description: canEdit
        ? "No seller request has been created yet."
        : "This seller access is read-only for payment setup.",
      isSubmitted: false,
      isDraft: canEdit,
    },
    reviewStatus: {
      code: "NOT_REVIEWED",
      label: "Not reviewed yet",
      tone: "stone",
      description: "No seller request has been submitted for admin review yet.",
      authority: "ADMIN",
      reviewedAt: null,
      reviewedBy: null,
      adminReviewNote: null,
      source: "PENDING_REQUEST",
    },
    completeness: {
      completedFields: 0,
      totalFields: requiredFields.length,
      allRequiredPresent: false,
      missingFields: [...requiredFields],
      requiredFields: [...requiredFields],
    },
    nextStep: {
      code: canEdit ? "COMPLETE_PROFILE" : "WAIT_OWNER",
      label: canEdit ? "Start payment request" : "Wait for owner or admin action",
      lane: "SELLER_PAYMENT_SETUP",
      actor: canEdit ? "SELLER_EDITOR" : "STORE_OWNER_OR_ADMIN",
      description: canEdit
        ? "Save draft or submit after the required request fields are complete."
        : "Your current seller access is view-only for payment setup in the seller workspace.",
    },
    boundaries: {
      sellerWorkspaceMode:
        "Seller can edit only a separate request draft here. Admin remains the final reviewer and activation authority.",
      readinessVsPaymentHistory:
        "Payment readiness is separate from buyer payment proof review, settlement, and payout.",
      paymentHistoryLane:
        "Buyer payment proofs are reviewed from Payment Review and Orders, not here.",
    },
  },
  requestDraft: createFormState(null),
  governance: {
    canView: true,
    canEdit,
    editableFields: [
      "accountName",
      "merchantName",
      "merchantId",
      "qrisImageUrl",
      "qrisPayload",
      "instructionText",
      "sellerNote",
    ],
    readOnlyFields: [
      "providerCode",
      "paymentType",
      "verificationStatus",
      "isActive",
      "verifiedByAdminId",
      "verifiedAt",
    ],
    note: canEdit
      ? "Seller can edit only separate store-scoped request fields. Admin keeps final approval and activation authority."
      : "This seller role can view payment setup, but cannot edit it.",
  },
  store: store
    ? {
        id: Number(store.id || storeId || 0),
        name: store.name || "",
        slug: store.slug || "",
        status: store.status || "ACTIVE",
      }
    : null,
  createdAt: null,
  updatedAt: null,
  verifiedAt: null,
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const hasText = (value) => String(value || "").trim().length > 0;
const toRequiredText = (value) => String(value || "").trim();
const toNullableText = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const getErrorMessage = (error) => {
  const payload = error?.response?.data || {};
  if (String(payload?.code || "").toUpperCase() === "PAYMENT_PROFILE_REVIEW_LOCKED") {
    return "This payment setup request is already under admin review and is temporarily locked for editing.";
  }
  if (String(payload?.code || "").toUpperCase() === "PAYMENT_PROFILE_INCOMPLETE") {
    const labels = Array.isArray(payload?.fields)
      ? payload.fields.map((field) => field?.label).filter(Boolean)
      : [];
    if (labels.length) return `Complete the required fields before submit: ${labels.join(", ")}.`;
  }
  return payload?.message || error?.message || "Failed to update seller payment setup.";
};

function Field({ label, hint, multiline = false, disabled = false, ...props }) {
  const baseClass = multiline ? sellerTextareaClass : sellerFieldClass;
  const className = `${baseClass} mt-2 ${disabled ? sellerDisabledFieldClass : ""}`;
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea className={className} disabled={disabled} {...props} />
      ) : (
        <input className={className} disabled={disabled} {...props} />
      )}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function SellerPaymentProfilePage() {
  const queryClient = useQueryClient();
  const { sellerContext, workspaceStoreId: storeId } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canView = permissionKeys.includes("PAYMENT_PROFILE_VIEW");
  const fallbackCanEdit = permissionKeys.includes("PAYMENT_PROFILE_EDIT");
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(createFormState(null));
  const [status, setStatus] = useState(null);

  const profileQuery = useQuery({
    queryKey: ["seller", "payment-profile", storeId],
    queryFn: () => getSellerPaymentProfile(storeId),
    enabled: Boolean(storeId) && canView,
    retry: false,
  });

  const effectiveProfile = useMemo(
    () => profileQuery.data || createFallbackProfile(sellerContext?.store || null, storeId, fallbackCanEdit),
    [profileQuery.data, sellerContext?.store, storeId, fallbackCanEdit]
  );

  useEffect(() => {
    setForm(createFormState(effectiveProfile));
  }, [effectiveProfile]);

  const activeSnapshot = effectiveProfile.activeSnapshot || null;
  const pendingRequest = effectiveProfile.pendingRequest || null;
  const readModel = effectiveProfile.readModel || {};
  const requestStatus = effectiveProfile.requestStatus || readModel.requestState || {};
  const reviewStatus = effectiveProfile.reviewFeedback || readModel.reviewStatus || {};
  const completeness = readModel.completeness || activeSnapshot?.readiness || {};
  const missingFields = completeness.missingFields || [];
  const governance = effectiveProfile.governance || {};
  const canEdit = Boolean(governance.canEdit ?? fallbackCanEdit);
  const permissionCanEdit = Boolean(governance.permissionCanEdit ?? fallbackCanEdit);
  const isReviewLocked = Boolean(governance.isReviewLocked);
  const governanceReviewStatus = governance.reviewStatus || reviewStatus;
  const governanceNextStep = governance.nextStep || readModel.nextStep || {};
  const busy = profileQuery.isLoading;
  const activeVerificationCode = String(
    activeSnapshot?.verificationStatus || activeSnapshot?.verificationMeta?.code || ""
  )
    .trim()
    .toUpperCase();
  const paymentSetupReady = Boolean(
    activeSnapshot?.readiness?.isReady ||
      (activeSnapshot?.isActive && activeVerificationCode === "ACTIVE")
  );
  const paymentSetupChecklist = [
    {
      label: "Active payment setup",
      ready: Boolean(activeSnapshot?.isActive),
      hint: activeSnapshot?.isActive
        ? "Checkout has an active payment destination."
        : "Checkout cannot accept payments until a setup is activated.",
    },
    {
      label: "Admin verified",
      ready: activeVerificationCode === "ACTIVE",
      hint:
        activeVerificationCode === "ACTIVE"
          ? "The active setup has passed admin review."
          : "Admin review is still required before this setup can be used.",
    },
    {
      label: "QRIS image available",
      ready: Boolean(activeSnapshot?.qrisImageUrl),
      hint: activeSnapshot?.qrisImageUrl
        ? "Buyers can see the QRIS image during payment."
        : "Add a QRIS image in the request before submitting for review.",
    },
    {
      label: "Required request fields",
      ready: missingFields.length === 0,
      hint:
        missingFields.length === 0
          ? "The current request has the required destination fields."
          : `Complete ${missingFields.map((field) => field.label).join(", ")}.`,
    },
  ];

  const buildPayload = () => ({
    accountName: toRequiredText(form.accountName),
    merchantName: toRequiredText(form.merchantName),
    merchantId: toNullableText(form.merchantId),
    qrisImageUrl: toRequiredText(form.qrisImageUrl),
    qrisPayload: toNullableText(form.qrisPayload),
    instructionText: toNullableText(form.instructionText),
    sellerNote: toNullableText(form.sellerNote),
  });

  const saveDraftMutation = useMutation({
    mutationFn: (payload) => saveSellerPaymentProfileDraft(storeId, payload),
    onSuccess: (data) => {
      setStatus({
        type: "success",
        message: "Payment setup draft saved. It will not affect checkout until admin approval.",
      });
      queryClient.setQueryData(["seller", "payment-profile", storeId], data);
    },
    onError: (error) => setStatus({ type: "error", message: getErrorMessage(error) }),
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => submitSellerPaymentProfileRequest(storeId, payload),
    onSuccess: (data) => {
      setStatus({
        type: "success",
        message:
          "Payment setup request submitted. The current active setup stays unchanged until admin approval.",
      });
      queryClient.setQueryData(["seller", "payment-profile", storeId], data);
    },
    onError: (error) => setStatus({ type: "error", message: getErrorMessage(error) }),
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file) => uploadSellerPaymentProfileImage(file),
    onSuccess: (url) => {
      setStatus({
        type: "success",
        message:
          "Pending QRIS image uploaded. Save draft or submit to keep it in this request.",
      });
      setForm((current) => ({ ...current, qrisImageUrl: url }));
    },
    onError: (error) =>
      setStatus({
        type: "error",
        message: error?.response?.data?.message || error?.message || "Failed to upload QRIS image.",
      }),
  });

  const submitReady = requiredFields.every((field) => hasText(form[field.key]));
  const disabled =
    saveDraftMutation.isPending || submitMutation.isPending || uploadImageMutation.isPending;

  const handleQrisFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus(null);
    await uploadImageMutation.mutateAsync(file);
  };

  if (!canView) {
    return (
      <SellerWorkspaceSectionCard
        title="Payment setup access is unavailable"
        hint="Your current seller access does not include seller finance setup visibility."
        Icon={ShieldAlert}
      />
    );
  }

  if (profileQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading payment setup"
        hint="Fetching the current payment setup and open seller request."
        Icon={CreditCard}
      />
    );
  }

  if (profileQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load payment setup"
        hint={getSellerRequestErrorMessage(profileQuery.error, {
          permissionMessage: "Your current seller access does not include seller finance setup visibility.",
          fallbackMessage: "Failed to load seller payment setup.",
        })}
        Icon={ShieldAlert}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Finance Setup"
        title="Payment setup"
        description="Set the payment destination buyers will use at checkout. Only the active, admin-verified setup is used publicly; drafts and submitted requests stay separate until approved."
        actions={[
          <SellerWorkspaceBadge
            key="request"
            label={requestStatus.label || "Draft request"}
            tone={requestStatus.tone || "stone"}
          />,
          <SellerWorkspaceBadge
            key="review"
            label={`Review ${reviewStatus.label || "Pending review"}`}
            tone={reviewStatus.tone || "stone"}
          />,
          <SellerWorkspaceBadge
            key="activity"
            label={activeSnapshot?.activityMeta?.label || "No active setup"}
            tone={activeSnapshot?.activityMeta?.tone || "stone"}
          />,
        ]}
      />

      {status ? (
        <SellerWorkspaceNotice type={status.type === "error" ? "error" : "success"}>
          {status.message}
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceNotice type={paymentSetupReady ? "success" : "warning"}>
        {paymentSetupReady
          ? "Payment setup is active and verified. This store has the payment readiness needed for public checkout."
          : "Payment setup is not ready for public checkout yet. Complete the setup request and wait for admin verification before treating the store as ready to receive orders."}
      </SellerWorkspaceNotice>

      <SellerWorkspaceSectionCard
        title="Payment readiness checklist"
        hint="This checklist explains why checkout can or cannot use this store's payment setup."
        Icon={BadgeCheck}
      >
        <div className="grid gap-2 md:grid-cols-2">
          {paymentSetupChecklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border px-3.5 py-3 ${
                item.ready
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <SellerWorkspaceBadge
                  label={item.ready ? "Ready" : "Needs action"}
                  tone={item.ready ? "emerald" : "amber"}
                  className="bg-white"
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.hint}</p>
            </div>
          ))}
        </div>
      </SellerWorkspaceSectionCard>

      <section className="grid gap-3.5 lg:grid-cols-3">
        <SellerWorkspaceSectionCard
          title="Active payment setup"
          hint="This is the payment setup buyers currently see at checkout."
          Icon={CreditCard}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem
              label="Snapshot Status"
              value={activeSnapshot?.activityMeta?.label || "No active setup"}
              hint={
                activeSnapshot?.activityMeta?.description ||
                "No active approved payment setup is available for this store yet."
              }
            />
            <SellerWorkspaceDetailItem
              label="Admin Review"
              value={activeSnapshot?.verificationMeta?.label || "Not approved yet"}
              hint={
                activeSnapshot?.verificationMeta?.description ||
                "Admin remains the final review authority for active payment setup."
              }
            />
            <SellerWorkspaceDetailItem
              label="Payment Type"
              value={formatPaymentType(activeSnapshot?.paymentType)}
              hint={`Provider ${formatProvider(activeSnapshot?.providerCode)}`}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Payment destination"
          hint="These destination details come from the active approved setup."
          Icon={BadgeCheck}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem label="Merchant Name" value={activeSnapshot?.merchantName || "-"} />
            <SellerWorkspaceDetailItem label="Account Name" value={activeSnapshot?.accountName || "-"} />
            <SellerWorkspaceDetailItem label="Merchant ID" value={activeSnapshot?.merchantId || "-"} />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Store"
          hint="Payment setup always belongs to this active seller store."
          Icon={ShieldAlert}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem
              label="Store"
              value={effectiveProfile.store?.name || sellerContext?.store?.name || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Store Slug"
              value={effectiveProfile.store?.slug || sellerContext?.store?.slug || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Store Status"
              value={effectiveProfile.store?.status || sellerContext?.store?.status || "-"}
            />
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <SellerWorkspaceSectionCard
          title="QRIS used at checkout"
          hint="This preview shows only the active approved QRIS. Draft requests do not affect checkout."
          Icon={ImageIcon}
        >
          {activeSnapshot?.qrisImageUrl ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <img
                src={activeSnapshot.qrisImageUrl}
                alt={`${activeSnapshot.merchantName || activeSnapshot.accountName || "Store"} QRIS`}
                className="mx-auto max-h-[420px] w-full rounded-xl object-contain"
              />
            </div>
          ) : (
            <SellerWorkspaceEmptyState
              title="No active QRIS yet"
              description="Checkout remains blocked until admin approves and activates a valid payment setup."
              icon={<ImageIcon className="h-5 w-5" />}
            />
          )}
          <div className="mt-5 grid gap-3">
            <SellerWorkspaceDetailItem
              label="Instruction Text"
              value={activeSnapshot?.instructionText || "-"}
            />
            <SellerWorkspaceDetailItem
              label="QR Payload"
              value={activeSnapshot?.qrisPayload || "-"}
              hint="Optional QR payload or QR identifier on the active setup."
            />
            <SellerWorkspaceDetailItem
              label="Reviewed"
              value={formatDate(activeSnapshot?.verifiedAt)}
            />
          </div>
          <SellerWorkspaceNotice type="info" className="mt-4">
            {activeSnapshot?.isActive
              ? "Checkout currently uses this active payment setup."
              : "No active setup is available for checkout yet. Requests remain separate until admin approval."}
          </SellerWorkspaceNotice>
        </SellerWorkspaceSectionCard>

        <div className="space-y-5">
          <SellerWorkspaceSectionCard
            title="Setup request"
            hint="Edit the request here. Saving or submitting it will not overwrite the active setup."
            Icon={CreditCard}
          >
            {!permissionCanEdit ? (
              <SellerWorkspaceNotice type="warning">
                This seller access can view payment readiness, but only roles with payment setup edit permission can prepare or submit a request.
              </SellerWorkspaceNotice>
            ) : (
              <form className="space-y-5">
                <SellerWorkspaceNotice type="info">
                  {readModel.boundaries?.sellerWorkspaceMode || governance.note}
                </SellerWorkspaceNotice>
                {isReviewLocked ? (
                  <SellerWorkspaceNotice type="warning">
                    {governance.lockReason ||
                      "This request is locked while admin review is in progress."}{" "}
                    {governanceReviewStatus?.label
                      ? `Current review status: ${governanceReviewStatus.label}.`
                      : ""}
                  </SellerWorkspaceNotice>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleQrisFileChange}
                />
                <div className="grid gap-3 md:grid-cols-2">
                      <SellerWorkspaceDetailItem
                        label="Open Request"
                        value={pendingRequest ? requestStatus.label || pendingRequest.requestStatus : "No open request"}
                        hint={
                          pendingRequest
                        ? `Editing request #${pendingRequest.id}. Saving keeps it separate from the active setup.`
                        : "Saving draft will create the first open seller request for this store."
                    }
                  />
                  <SellerWorkspaceDetailItem
                    label="Based on active setup"
                    value={pendingRequest?.basedOnProfileId ? `#${pendingRequest.basedOnProfileId}` : activeSnapshot?.id ? `#${activeSnapshot.id}` : "-"}
                    hint="The request starts from the current active setup when one exists."
                  />
                </div>
                <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Pending QRIS Preview
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          This image belongs to the request only. Checkout still uses the active setup until admin approval.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStatus(null);
                          fileInputRef.current?.click();
                        }}
                        disabled={disabled || busy || !canEdit}
                        className={sellerSecondaryButtonClass}
                      >
                        <Upload className="h-4 w-4" />
                        {uploadImageMutation.isPending ? "Uploading..." : "Upload QRIS"}
                      </button>
                    </div>
                    {form.qrisImageUrl ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                        <img
                          src={form.qrisImageUrl}
                          alt="Pending QRIS request"
                          className="mx-auto max-h-[320px] w-full rounded-lg object-contain"
                        />
                      </div>
                    ) : (
                      <SellerWorkspaceEmptyState
                        title="No pending QRIS image yet"
                        description="Upload a PNG or JPEG QRIS image to attach it to the pending seller request."
                        icon={<ImageIcon className="h-5 w-5" />}
                      />
                    )}
                  </div>

                  <div className="grid gap-3 content-start">
                    <SellerWorkspaceDetailItem
                      label="Active QRIS"
                      value={activeSnapshot?.qrisImageUrl ? "Available" : "Not available"}
                      hint={
                        activeSnapshot?.qrisImageUrl
                          ? "This is still the QRIS image used by checkout."
                          : "No active QRIS image is available yet."
                      }
                    />
                    <SellerWorkspaceDetailItem
                      label="Pending QRIS"
                      value={form.qrisImageUrl ? "Ready in request" : "Missing"}
                      hint="Uploading or replacing this image only changes the pending request."
                    />
                    <SellerWorkspaceDetailItem
                      label="Allowed File Types"
                      value="PNG, JPEG"
                      hint="Upload follows the existing image pipeline with a 2MB server-side limit."
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field
                    label="Account Name"
                    hint="Required store-scoped destination account name."
                    disabled={disabled || busy || !canEdit}
                    value={form.accountName}
                    onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
                  />
                  <Field
                    label="Merchant Name"
                    hint="Required store-scoped merchant label."
                    disabled={disabled || busy || !canEdit}
                    value={form.merchantName}
                    onChange={(event) => setForm((current) => ({ ...current, merchantName: event.target.value }))}
                  />
                  <Field
                    label="Merchant ID"
                    hint="Optional store-scoped identifier."
                    disabled={disabled || busy || !canEdit}
                    value={form.merchantId}
                    onChange={(event) => setForm((current) => ({ ...current, merchantId: event.target.value }))}
                  />
                  <Field
                    label="QRIS Image URL"
                    hint="Required. Buyer checkout will still use the active setup until admin approves a change."
                    disabled={disabled || busy || !canEdit}
                    value={form.qrisImageUrl}
                    onChange={(event) => setForm((current) => ({ ...current, qrisImageUrl: event.target.value }))}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="QRIS Payload"
                      hint="Optional QR code text or payment identifier."
                      multiline
                      rows={4}
                      disabled={disabled || busy || !canEdit}
                      value={form.qrisPayload}
                      onChange={(event) => setForm((current) => ({ ...current, qrisPayload: event.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="Instruction Text"
                      hint="Optional buyer instruction text to include after approval."
                      multiline
                      rows={4}
                      disabled={disabled || busy || !canEdit}
                      value={form.instructionText}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, instructionText: event.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="Seller Note"
                      hint="Optional note for the current seller request."
                      multiline
                      rows={3}
                      disabled={disabled || busy || !canEdit}
                      value={form.sellerNote}
                      onChange={(event) => setForm((current) => ({ ...current, sellerNote: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <SellerWorkspaceDetailItem
                    label="Editable Fields"
                    value={formatEditableFields(effectiveProfile.governance?.editableFields)}
                    hint="Admin-governed fields stay locked."
                  />
                  <SellerWorkspaceDetailItem
                    label="Admin-Governed"
                    value="Approval, activation, provider rules"
                    hint="Seller cannot approve or activate from this page."
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      setForm(createFormState(effectiveProfile));
                    }}
                    disabled={disabled || busy || !canEdit}
                    className={sellerSecondaryButtonClass}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      saveDraftMutation.mutate(buildPayload());
                    }}
                    disabled={disabled || busy || !canEdit}
                    className={sellerSecondaryButtonClass}
                  >
                    <Save className="h-4 w-4" />
                    {saveDraftMutation.isPending ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      submitMutation.mutate(buildPayload());
                    }}
                    disabled={disabled || busy || !canEdit || !submitReady}
                    className={sellerPrimaryButtonClass}
                  >
                    <SendHorizonal className="h-4 w-4" />
                    {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </button>
                </div>
                {!submitReady && canEdit ? (
                  <p className="text-xs text-slate-500">
                    Complete `Account Name`, `Merchant Name`, and `QRIS Image URL` before submit.
                  </p>
                ) : null}
                {!canEdit ? (
                  <p className="text-xs text-slate-500">
                    {governanceNextStep?.description ||
                      "This request is not editable right now. Wait for admin review or follow the next review step."}
                  </p>
                ) : null}
              </form>
            )}
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Request Status and Review"
            hint="Track the request review status here while checkout keeps using the active setup."
            Icon={ShieldAlert}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Primary Status"
                value={readModel.primaryStatus?.label || "-"}
                hint={readModel.primaryStatus?.description || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Next Step"
                value={readModel.nextStep?.label || "Wait for admin review"}
                hint={readModel.nextStep?.description || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Request State"
                value={requestStatus.label || "-"}
                hint={requestStatus.description || "The request is separate from the active setup."}
              />
              <SellerWorkspaceDetailItem
                label="Required Fields"
                value={`${completeness.completedFields || 0}/${completeness.totalFields || 0}`}
                hint="Incomplete drafts can be saved, but submit requires all required fields."
              />
              <SellerWorkspaceDetailItem
                label="Submitted"
                value={formatDate(pendingRequest?.submittedAt)}
                hint={pendingRequest?.submittedBy?.name || "No submitter recorded yet."}
              />
              <SellerWorkspaceDetailItem
                label="Reviewed"
                value={formatDate(reviewStatus.reviewedAt)}
                hint={reviewStatus.reviewedBy?.name || "Admin is the final review authority."}
              />
            </div>
            {reviewStatus.adminReviewNote ? (
              <SellerWorkspaceNotice type="warning" className="mt-4">
                Admin feedback: {reviewStatus.adminReviewNote}
              </SellerWorkspaceNotice>
            ) : null}
            {pendingRequest?.sellerNote ? (
              <SellerWorkspaceNotice type="info" className="mt-4">
                Seller note: {pendingRequest.sellerNote}
              </SellerWorkspaceNotice>
            ) : null}
            {missingFields.length ? (
              <SellerWorkspaceNotice type="warning" className="mt-4">
                Missing required fields: {missingFields.map((field) => field.label).join(", ")}
              </SellerWorkspaceNotice>
            ) : null}
            <SellerWorkspaceNotice type="info" className="mt-4">
              Checkout and storefront use only the current active approved setup. Saving or submitting this request does not switch the public payment setup.
            </SellerWorkspaceNotice>
            <SellerWorkspaceNotice type="warning" className="mt-4">
              {readModel.boundaries?.readinessVsPaymentHistory ||
                "Payment setup readiness is separate from buyer payment proof review, settlement, and payout."}
            </SellerWorkspaceNotice>
            <SellerWorkspaceNotice type="info" className="mt-4">
              {readModel.boundaries?.paymentHistoryLane ||
                "Buyer payment proofs are reviewed from Payment Review and Orders, not here."}
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}

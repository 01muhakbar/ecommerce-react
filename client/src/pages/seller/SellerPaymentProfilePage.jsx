import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CreditCard,
  ImageIcon,
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
import {
  getSellerStatusBadge,
  sellerStatusBadge,
} from "./sellerStatusPresentation.js";

const requiredFields = [
  { key: "accountName", label: "Account name" },
  { key: "merchantName", label: "Merchant name" },
  { key: "qrisImageUrl", label: "QRIS image" },
];

const EMPTY_VALUE = "Not set";

const displayValue = (value, fallback = EMPTY_VALUE) => {
  const text = String(value || "").trim();
  return text || fallback;
};

const formatPaymentType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "QRIS_STATIC") return "Static QRIS";
  return normalized
    ? normalized.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "QRIS";
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
  const requestCode = String(requestStatus?.code || "").trim().toUpperCase();
  const reviewCode = String(reviewStatus?.code || "").trim().toUpperCase();
  const isPendingReview =
    requestCode === "SUBMITTED" ||
    requestCode.includes("UNDER_REVIEW") ||
    requestCode.includes("PENDING_REVIEW") ||
    reviewCode.includes("PENDING");
  const isNeedsRevision =
    requestCode === "NEEDS_REVISION" ||
    reviewCode === "NEEDS_REVISION" ||
    requestCode.includes("REVISION") ||
    reviewCode.includes("REVISION");
  const requiredCompleted = Number(completeness.completedFields || 0);
  const requiredTotal = Number(completeness.totalFields || requiredFields.length);
  const missingFieldLabels = missingFields.map((field) => field.label).filter(Boolean);
  const paymentSetupChecklist = [
    {
      label: "Account name",
      state: hasText(form.accountName) ? "Complete" : "Missing",
      tone: hasText(form.accountName) ? "emerald" : "amber",
      hint: hasText(form.accountName) ? "Ready" : "Required",
    },
    {
      label: "Merchant name",
      state: hasText(form.merchantName) ? "Complete" : "Missing",
      tone: hasText(form.merchantName) ? "emerald" : "amber",
      hint: hasText(form.merchantName) ? "Ready" : "Required",
    },
    {
      label: "QRIS image",
      state: hasText(form.qrisImageUrl) ? "Complete" : "Missing",
      tone: hasText(form.qrisImageUrl) ? "emerald" : "amber",
      hint: hasText(form.qrisImageUrl) ? "Ready" : "Upload or paste URL",
    },
    {
      label: "Admin approval",
      state: paymentSetupReady ? "Approved" : isPendingReview ? "Pending" : "Missing",
      tone: paymentSetupReady ? "emerald" : isPendingReview ? "amber" : "amber",
      hint: paymentSetupReady
        ? "Checkout ready"
        : isPendingReview
          ? "In review"
          : "Submit for review",
    },
  ];
  const setupStatusHeader = paymentSetupReady
    ? {
        type: "success",
        title: "Ready for checkout",
        message: "Checkout uses the approved setup.",
        actionLabel: "View approved setup",
        targetId: "approved-payment-setup",
      }
    : isPendingReview
      ? {
          type: "warning",
          title: "Waiting for admin review",
          message: "Changes need admin approval.",
          actionLabel: "View request",
          targetId: "payment-setup-request",
        }
      : isNeedsRevision
        ? {
            type: "error",
            title: "Fix requested changes",
            message: "Update the request and submit again.",
            actionLabel: "Fix request",
            targetId: "payment-setup-request",
          }
        : pendingRequest || requestCode === "DRAFT"
          ? {
              type: "warning",
              title: "Complete required info",
              message: "Save draft or submit when ready.",
              actionLabel: "Complete setup",
              targetId: "payment-setup-request",
            }
          : {
              type: "warning",
              title: "Set up payment method",
              message: "Add account, merchant, and QRIS.",
              actionLabel: "Start setup",
              targetId: "payment-setup-request",
            };
  const requestBadge = getSellerStatusBadge(requestStatus, sellerStatusBadge.needsSetup);
  const activeBadge = paymentSetupReady
    ? sellerStatusBadge.ready
    : activeSnapshot
      ? getSellerStatusBadge(activeSnapshot?.activityMeta, sellerStatusBadge.needsSetup)
      : { label: "No active setup", tone: "stone" };
  const primaryHeaderBadge = paymentSetupReady
    ? sellerStatusBadge.ready
    : isPendingReview
      ? sellerStatusBadge.pendingReview
      : sellerStatusBadge.needsSetup;
  const headerBadges = [primaryHeaderBadge, activeBadge, requestBadge]
    .filter((badge) => badge?.label)
    .filter(
      (badge, index, items) =>
        items.findIndex((item) => item.label === badge.label) === index
    )
    .slice(0, 2);
  const checkoutAvailability = paymentSetupReady
    ? {
        label: "Checkout available",
        tone: "emerald",
        message: "Buyer checkout can use this active approved setup.",
      }
    : isPendingReview
      ? {
          label: "Waiting admin",
          tone: "amber",
          message: "Submitted requests do not affect checkout until admin approval.",
        }
      : isNeedsRevision
        ? {
            label: "Revision needed",
            tone: "rose",
            message: "Update the request. Checkout keeps using only an active approved setup.",
          }
        : {
            label: "Checkout blocked",
            tone: "amber",
            message: "Complete setup and wait for admin approval before buyers can pay.",
          };
  const adminAuthorityText =
    readModel.boundaries?.sellerWorkspaceMode ||
    governance.note ||
    "Seller can submit payment setup requests. Admin remains the final reviewer and activation authority.";

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
  const submitDisabledReason = !submitReady
    ? "Missing required info."
    : isReviewLocked
      ? "Waiting for admin review."
      : !canEdit
        ? "Read-only access."
        : "Ready to submit.";

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
        description="Prepare QRIS checkout destination."
        actions={headerBadges.map((badge) => (
          <SellerWorkspaceBadge key={badge.label} label={badge.label} tone={badge.tone} />
        ))}
      />

      {status ? (
        <SellerWorkspaceNotice type={status.type === "error" ? "error" : "success"}>
          {status.message}
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceNotice type={setupStatusHeader.type}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-900">{setupStatusHeader.title}</p>
            <p className="mt-1 leading-5">{setupStatusHeader.message}</p>
          </div>
          {canEdit && permissionCanEdit ? (
            <div className="flex flex-wrap gap-2">
              {!form.qrisImageUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    fileInputRef.current?.click();
                  }}
                  disabled={disabled || busy || !canEdit}
                  className={sellerSecondaryButtonClass}
                >
                  Upload QRIS
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(setupStatusHeader.targetId)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={
                  !paymentSetupReady && !isPendingReview
                    ? sellerPrimaryButtonClass
                    : sellerSecondaryButtonClass
                }
              >
                {setupStatusHeader.actionLabel}
              </button>
              {submitReady && !paymentSetupReady && !isPendingReview ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    submitMutation.mutate(buildPayload());
                  }}
                  disabled={disabled || busy || !canEdit || !submitReady}
                  className={sellerPrimaryButtonClass}
                >
                  Submit for review
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SellerWorkspaceNotice>

      <SellerWorkspaceSectionCard
        title="Checkout authority"
        hint="Client checkout reads the active approved setup only."
        Icon={ShieldAlert}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Buyer checkout</p>
              <SellerWorkspaceBadge
                label={checkoutAvailability.label}
                tone={checkoutAvailability.tone}
                className="bg-white"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {checkoutAvailability.message}
            </p>
          </div>
          <SellerWorkspaceDetailItem
            label="Active setup"
            value={activeSnapshot?.activityMeta?.label || "No active setup"}
            hint={paymentSetupReady ? "Approved by admin." : "Not available for checkout."}
          />
          <SellerWorkspaceDetailItem
            label="Open request"
            value={requestStatus?.label || "No request"}
            hint={reviewStatus?.label || "Admin review status."}
          />
        </div>
        <SellerWorkspaceNotice type="info" className="mt-3">
          {adminAuthorityText}
        </SellerWorkspaceNotice>
      </SellerWorkspaceSectionCard>

      <SellerWorkspaceSectionCard
        title="Required setup"
        hint={`${requiredCompleted}/${requiredTotal} required fields complete.`}
        Icon={BadgeCheck}
      >
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {paymentSetupChecklist.map((item) => (
            <div
              key={item.label}
              className={`rounded-lg border px-3 py-2.5 ${
                item.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <SellerWorkspaceBadge
                  label={item.state}
                  tone={item.tone}
                  className="bg-white"
                />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.hint}</p>
            </div>
          ))}
        </div>
      </SellerWorkspaceSectionCard>

      <div id="approved-payment-setup" className="scroll-mt-24">
        <SellerWorkspaceSectionCard
          title="Checkout setup"
          hint="Checkout uses the approved setup."
          Icon={CreditCard}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SellerWorkspaceDetailItem
              label="Status"
              value={activeSnapshot?.activityMeta?.label || "No active setup"}
            />
            <SellerWorkspaceDetailItem
              label="Payment type"
              value={formatPaymentType(activeSnapshot?.paymentType)}
            />
            <SellerWorkspaceDetailItem
              label="Merchant"
              value={displayValue(activeSnapshot?.merchantName)}
            />
            <SellerWorkspaceDetailItem
              label="Account"
              value={displayValue(activeSnapshot?.accountName)}
            />
            <SellerWorkspaceDetailItem
              label="Store"
              value={displayValue(effectiveProfile.store?.name || sellerContext?.store?.name)}
            />
          </div>
        </SellerWorkspaceSectionCard>
      </div>

      <section className="grid gap-5">
        <SellerWorkspaceSectionCard
          title="Checkout QRIS"
          hint="Approved QRIS used at checkout."
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
              title="No approved QRIS yet"
              description="Checkout waits for an approved setup."
              icon={<ImageIcon className="h-5 w-5" />}
              action={
                permissionCanEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus(null);
                      fileInputRef.current?.click();
                    }}
                    disabled={disabled || busy || !canEdit}
                    className={sellerSecondaryButtonClass}
                  >
                    Upload QRIS
                  </button>
                ) : null
              }
            />
          )}
        </SellerWorkspaceSectionCard>

        <div className="space-y-5">
          <div id="payment-setup-request" className="scroll-mt-24">
            <SellerWorkspaceSectionCard
              title="Payment method editor"
              hint="Required first, optional after."
              Icon={CreditCard}
            >
              {!permissionCanEdit ? (
                <SellerWorkspaceNotice type="warning">
                  This role can view payment setup, but cannot edit it.
                </SellerWorkspaceNotice>
              ) : (
                <form className="space-y-5">
                  <SellerWorkspaceNotice type="info">
                    Changes need admin approval. Payment proofs are reviewed in Payment Review.
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
                  <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            QRIS image
                          </p>
                          <p className="mt-1 text-xs text-slate-500">PNG or JPEG recommended.</p>
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
                          title="No QRIS image yet"
                          description="Upload QRIS before submit."
                          icon={<ImageIcon className="h-5 w-5" />}
                          action={
                            <button
                              type="button"
                              onClick={() => {
                                setStatus(null);
                                fileInputRef.current?.click();
                              }}
                              disabled={disabled || busy || !canEdit}
                              className={sellerSecondaryButtonClass}
                            >
                              Upload QRIS
                            </button>
                          }
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Required info</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Needed before admin review.
                            </p>
                          </div>
                          <SellerWorkspaceBadge
                            label={submitReady ? "Complete" : "Missing"}
                            tone={submitReady ? "emerald" : "amber"}
                          />
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field
                            label="Account name"
                            disabled={disabled || busy || !canEdit}
                            value={form.accountName}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, accountName: event.target.value }))
                            }
                          />
                          <Field
                            label="Merchant name"
                            disabled={disabled || busy || !canEdit}
                            value={form.merchantName}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, merchantName: event.target.value }))
                            }
                          />
                          <div className="md:col-span-2">
                            <Field
                              label="QRIS image URL"
                              disabled={disabled || busy || !canEdit}
                              value={form.qrisImageUrl}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, qrisImageUrl: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                        <p className="text-sm font-semibold text-slate-900">Optional details</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Useful for audit and buyer instructions.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field
                            label="Merchant ID"
                            disabled={disabled || busy || !canEdit}
                            value={form.merchantId}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, merchantId: event.target.value }))
                            }
                          />
                          <div className="md:col-span-2">
                            <Field
                              label="QRIS payload"
                              multiline
                              rows={2}
                              disabled={disabled || busy || !canEdit}
                              value={form.qrisPayload}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, qrisPayload: event.target.value }))
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Field
                              label="Instruction text"
                              multiline
                              rows={2}
                              disabled={disabled || busy || !canEdit}
                              value={form.instructionText}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  instructionText: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Field
                              label="Seller note"
                              multiline
                              rows={2}
                              disabled={disabled || busy || !canEdit}
                              value={form.sellerNote}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, sellerNote: event.target.value }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
                <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur">
                  <p className="text-xs text-slate-500">
                    {submitDisabledReason}
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                      {saveDraftMutation.isPending ? "Saving..." : "Save draft"}
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
                      {submitMutation.isPending ? "Submitting..." : "Submit for review"}
                    </button>
                  </div>
                </div>
                {!submitReady && canEdit ? (
                  <p className="text-xs text-slate-500">
                    Complete account name, merchant name, and QRIS image URL before submit.
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
          </div>

          <SellerWorkspaceSectionCard
            title="Review status"
            hint="Request history."
            Icon={ShieldAlert}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Status"
                value={displayValue(requestStatus.label, "Draft request")}
              />
              <SellerWorkspaceDetailItem
                label="Required Fields"
                value={`${requiredCompleted}/${requiredTotal} required fields complete`}
              />
              <SellerWorkspaceDetailItem
                label="Submitted"
                value={pendingRequest?.submittedAt ? formatDate(pendingRequest.submittedAt) : "Not submitted"}
              />
              <SellerWorkspaceDetailItem
                label="Reviewed"
                value={reviewStatus.reviewedAt ? formatDate(reviewStatus.reviewedAt) : "Not reviewed"}
              />
              <SellerWorkspaceDetailItem
                label="Missing"
                value={missingFieldLabels.length ? missingFieldLabels.join(", ") : "None"}
                className="md:col-span-2"
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
            <SellerWorkspaceNotice type="info" className="mt-4">
              Payment proofs are reviewed in Payment Review, not here.
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}

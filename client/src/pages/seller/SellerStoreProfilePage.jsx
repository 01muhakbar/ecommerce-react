import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Globe, MapPin, Save, ShieldCheck, Store } from "lucide-react";
import {
  getSellerStoreProfile,
  uploadSellerStoreProfileImage,
  updateSellerStoreProfile,
} from "../../api/sellerStoreProfile.ts";
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
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { getSellerStatusBadge, sellerStatusBadge } from "./sellerStatusPresentation.js";

const emptyToNull = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const createFormState = (profile) => ({
  name: profile?.name || "",
  description: profile?.description || "",
  email: profile?.email || "",
  phone: profile?.phone || "",
  whatsapp: profile?.whatsapp || "",
  websiteUrl: profile?.websiteUrl || "",
  instagramUrl: profile?.instagramUrl || "",
  tiktokUrl: profile?.tiktokUrl || "",
  logoUrl: profile?.logoUrl || "",
  bannerUrl: profile?.bannerUrl || "",
  addressLine1: profile?.addressLine1 || "",
  addressLine2: profile?.addressLine2 || "",
  city: profile?.city || "",
  province: profile?.province || "",
  postalCode: profile?.postalCode || "",
  country: profile?.country || "",
  shippingEnabled: profile?.shippingSetup?.shippingEnabled !== false,
  originContactName: profile?.shippingSetup?.originContactName || "",
  originPhone: profile?.shippingSetup?.originPhone || "",
  originAddressLine1: profile?.shippingSetup?.originAddressLine1 || "",
  originAddressLine2: profile?.shippingSetup?.originAddressLine2 || "",
  originDistrict: profile?.shippingSetup?.originDistrict || "",
  originCity: profile?.shippingSetup?.originCity || "",
  originProvince: profile?.shippingSetup?.originProvince || "",
  originPostalCode: profile?.shippingSetup?.originPostalCode || "",
  originCountry: profile?.shippingSetup?.originCountry || "",
  pickupNotes: profile?.shippingSetup?.pickupNotes || "",
});

const formatFieldName = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const sellerFriendlyText = (value, fallback = "") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/\bmetadata\b/gi, "details")
    .replace(/\bbackend\b/gi, "system")
    .replace(/\bsource of truth\b/gi, "saved record")
    .replace(/\bserializer\b/gi, "display rules")
    .replace(/\bclient\/storefront\b/gi, "storefront")
    .replace(/\boperational client\b/gi, "checkout")
    .replace(/\bnot surfaced\b/gi, "hidden");
};

const getProfileValidationMessage = (error) => {
  const code = String(error?.response?.data?.code || "").toUpperCase();
  const responseMessage = error?.response?.data?.message;
  const forbiddenFields = Array.isArray(error?.response?.data?.fields)
    ? error.response.data.fields
    : [];
  const fieldErrors = error?.response?.data?.errors?.fieldErrors || {};
  const firstFieldError = Object.entries(fieldErrors).find(
    ([, messages]) => Array.isArray(messages) && messages.length > 0
  );

  if (code === "READ_ONLY_STORE_PROFILE_FIELDS" && forbiddenFields.length > 0) {
    return `These read-only fields cannot be updated here: ${forbiddenFields
      .map((field) => formatFieldName(field))
      .join(", ")}.`;
  }

  if (firstFieldError) {
    const [field, messages] = firstFieldError;
    return `${formatFieldName(field)}: ${messages[0]}`;
  }

  return responseMessage || error?.message || "Failed to update seller store profile.";
};

const buildLocationLabel = (profile) =>
  [
    profile?.addressLine1,
    profile?.addressLine2,
    [profile?.city, profile?.province, profile?.postalCode].filter(Boolean).join(", "),
    profile?.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

const EMPTY_FIELD_LABEL = "Not set";
const compactSecondaryActionClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const displayFieldValue = (value) => {
  const text = String(value || "").trim();
  return text || EMPTY_FIELD_LABEL;
};

function InputField({ label, hint, multiline = false, disabled = false, ...props }) {
  const inputClasses = multiline ? sellerTextareaClass : sellerFieldClass;
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          className={`${inputClasses} mt-2 ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      ) : (
        <input
          className={`${inputClasses} mt-2 ${disabled ? sellerDisabledFieldClass : ""}`}
          disabled={disabled}
          {...props}
        />
      )}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function SellerStoreProfilePage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const logoInputRef = useRef(null);
  const {
    sellerContext,
    workspaceStoreId: storeId,
    workspaceRoutes,
    refetchSellerContext,
  } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canView = permissionKeys.includes("STORE_VIEW");
  const fallbackCanEdit = permissionKeys.includes("STORE_EDIT");
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(createFormState(null));
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["seller", "store-profile", storeId],
    queryFn: () => getSellerStoreProfile(storeId),
    enabled: Boolean(storeId) && canView,
    retry: false,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setForm(createFormState(profileQuery.data));
    }
  }, [profileQuery.data]);

  const effectiveCanEdit = Boolean(profileQuery.data?.governance?.canEdit ?? fallbackCanEdit);

  useEffect(() => {
    if (location.hash !== "#shipping-setup") return undefined;
    if (effectiveCanEdit && !isEditing) {
      setIsEditing(true);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const section = document.getElementById("shipping-setup");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [effectiveCanEdit, isEditing, location.hash, profileQuery.data]);

  useEffect(() => {
    if (!effectiveCanEdit && isEditing) {
      setIsEditing(false);
    }
  }, [effectiveCanEdit, isEditing]);

  const mutation = useMutation({
    mutationFn: (payload) => updateSellerStoreProfile(storeId, payload),
    onSuccess: async (data) => {
      setStatus({
        type: "success",
        message: "Store profile updated successfully.",
      });
      setIsEditing(false);
      setForm(createFormState(data));
      queryClient.setQueryData(["seller", "store-profile", storeId], data);
      await refetchSellerContext?.();
    },
    onError: (error) => {
      setStatus({
        type: "error",
        message: getProfileValidationMessage(error),
      });
    },
  });

  const formSections = useMemo(
    () => [
      {
        title: "Public details",
        fields: [
          {
            key: "name",
            label: "Store Name",
            type: "text",
            hint: "Managed by admin.",
          },
          {
            key: "description",
            label: "Description",
            type: "textarea",
            hint: "Short public store bio.",
          },
          {
            key: "logoUrl",
            label: "Logo URL",
            type: "text",
            hint: "Upload a logo or paste an image URL.",
          },
          {
            key: "bannerUrl",
            label: "Banner URL",
            type: "text",
            hint: "Optional cover image.",
          },
        ],
      },
      {
        title: "Contact",
        fields: [
          { key: "email", label: "Store Email", type: "email" },
          { key: "phone", label: "Phone", type: "text" },
          { key: "whatsapp", label: "WhatsApp", type: "text" },
          { key: "websiteUrl", label: "Website URL", type: "url" },
          { key: "instagramUrl", label: "Instagram URL", type: "url" },
          { key: "tiktokUrl", label: "TikTok URL", type: "url" },
        ],
      },
      {
        title: "Address",
        fields: [
          { key: "addressLine1", label: "Address Line 1", type: "text" },
          { key: "addressLine2", label: "Address Line 2", type: "text" },
          { key: "city", label: "City", type: "text" },
          { key: "province", label: "Province", type: "text" },
          { key: "postalCode", label: "Postal Code", type: "text" },
          { key: "country", label: "Country", type: "text" },
        ],
      },
    ],
    []
  );

  const handleChange = (key) => (event) => {
    const nextValue = event?.target?.value ?? "";
    setForm((current) => ({ ...current, [key]: nextValue }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setStatus(null);
    setForm(createFormState(profileQuery.data));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const nextPayload = {
      description: emptyToNull(form.description),
      email: emptyToNull(form.email),
      phone: emptyToNull(form.phone),
      whatsapp: emptyToNull(form.whatsapp),
      websiteUrl: emptyToNull(form.websiteUrl),
      instagramUrl: emptyToNull(form.instagramUrl),
      tiktokUrl: emptyToNull(form.tiktokUrl),
      logoUrl: emptyToNull(form.logoUrl),
      bannerUrl: emptyToNull(form.bannerUrl),
      addressLine1: emptyToNull(form.addressLine1),
      addressLine2: emptyToNull(form.addressLine2),
      city: emptyToNull(form.city),
      province: emptyToNull(form.province),
      postalCode: emptyToNull(form.postalCode),
      country: emptyToNull(form.country),
      shippingSetup: {
        shippingEnabled: Boolean(form.shippingEnabled),
        originContactName: emptyToNull(form.originContactName),
        originPhone: emptyToNull(form.originPhone),
        originAddressLine1: emptyToNull(form.originAddressLine1),
        originAddressLine2: emptyToNull(form.originAddressLine2),
        originDistrict: emptyToNull(form.originDistrict),
        originCity: emptyToNull(form.originCity),
        originProvince: emptyToNull(form.originProvince),
        originPostalCode: emptyToNull(form.originPostalCode),
        originCountry: emptyToNull(form.originCountry),
        pickupNotes: emptyToNull(form.pickupNotes),
      },
    };
    const filteredPayload = Object.fromEntries(
      Object.entries(nextPayload).filter(
        ([key]) => key === "shippingSetup" || editableFieldSet.has(key)
      )
    );
    await mutation.mutateAsync(filteredPayload);
  };

  const profile = profileQuery.data;
  const shippingSetupStatus = profile?.shippingSetupStatus || {
    code: "UNKNOWN",
    label: "Unavailable",
    tone: "stone",
    description:
      "Shipping setup readiness is unavailable right now. Refresh the page or try again later.",
  };
  const shippingSetupMeta = profile?.shippingSetupMeta || {
    severity: "info",
    message: "Shipping setup hints are unavailable right now.",
    hints: [],
    usesStoreProfileFallback: false,
    fallbackFields: [],
  };
  const shippingMissingFields = Array.isArray(profile?.missingShippingFields)
    ? profile.missingShippingFields
    : [];
  const shippingSetupSummary = profile?.shippingSetupSummary || {
    shippingEnabled: true,
    originContactName: null,
    originPhone: null,
    originAddressLine: null,
    pickupNotes: null,
    usesStoreProfileFallback: false,
    fallbackFields: [],
  };
  const operationalReadiness = useMemo(
    () =>
      profile?.operationalReadiness || {
        code: "UNKNOWN",
        label: "Unavailable",
        tone: "stone",
        isReady: false,
        description:
          "Operational readiness is unavailable right now. Refresh the page or try again later.",
      },
    [profile?.operationalReadiness]
  );
  const completeness = profile?.completeness || {
    label: "Profile needs attention",
    tone: "warning",
    completedFields: 0,
    totalFields: 0,
    missingFields: [],
  };
  const editableFields = profile?.governance?.editableFields || [];
  const missingFields = completeness.missingFields || [];
  const editableFieldSet = useMemo(() => new Set(editableFields), [editableFields]);
  const storefrontPreviewHref = profile?.slug
    ? `/store/${encodeURIComponent(profile.slug)}`
    : null;
  const storefrontLocationLabel = buildLocationLabel(profile);
  const logoPreviewUrl = resolveAssetUrl(form.logoUrl || "");
  const publicContactLabel =
    [profile?.phone, profile?.email, profile?.websiteUrl]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join(" | ") || EMPTY_FIELD_LABEL;
  const mediaLabel =
    [profile?.logoUrl ? "Logo" : "", profile?.bannerUrl ? "Cover" : ""]
      .filter(Boolean)
      .join(" + ") || EMPTY_FIELD_LABEL;
  const shippingPickupAddress =
    shippingSetupSummary.originAddressLine ||
    [
      form.originAddressLine1,
      form.originAddressLine2,
      form.originDistrict,
      form.originCity,
      form.originProvince,
      form.originPostalCode,
      form.originCountry,
    ]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join(", ") ||
    EMPTY_FIELD_LABEL;
  const storeStatusBadge = getSellerStatusBadge(
    profile?.statusMeta || profile?.status,
    sellerStatusBadge.active
  );
  const profileCompletenessBadge = completeness.isComplete
    ? sellerStatusBadge.ready
    : sellerStatusBadge.incomplete;
  const operationalBadge = operationalReadiness.isReady
    ? sellerStatusBadge.ready
    : getSellerStatusBadge(operationalReadiness, sellerStatusBadge.blocked);
  const shippingBadge =
    shippingSetupStatus.code === "READY"
      ? sellerStatusBadge.ready
      : shippingSetupStatus.code === "DISABLED"
        ? sellerStatusBadge.blocked
        : sellerStatusBadge.needsSetup;
  const storeReadyReasons = [
    operationalReadiness.isReady
      ? null
      : sellerFriendlyText(operationalReadiness.description || operationalReadiness.blockedBy),
    shippingSetupStatus.code === "READY"
      ? null
      : sellerFriendlyText(shippingSetupMeta.message || shippingSetupStatus.description),
  ].filter(Boolean);
  const storefrontReady = operationalReadiness.isReady && shippingSetupStatus.code === "READY";
  const mainReadinessBadge = storefrontReady
    ? sellerStatusBadge.ready
    : operationalBadge.label === sellerStatusBadge.blocked.label ||
        shippingBadge.label === sellerStatusBadge.blocked.label
      ? sellerStatusBadge.blocked
      : sellerStatusBadge.incomplete;

  if (!canView) {
    return (
      <SellerWorkspaceSectionCard
        title="Store profile access is unavailable"
        hint="Your current seller access does not include store profile visibility."
        Icon={ShieldCheck}
      />
    );
  }

  if (profileQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading seller store profile"
        hint="Fetching the latest saved store profile for this workspace."
        Icon={Store}
      />
    );
  }

  if (profileQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load seller store profile"
        hint={getSellerRequestErrorMessage(profileQuery.error, {
          permissionMessage:
            "Your current seller access does not include store profile visibility.",
          fallbackMessage: "Failed to load seller store profile.",
        })}
        Icon={ShieldCheck}
      />
      );
  }

  if (!profile) {
    return (
      <SellerWorkspaceSectionCard
        title="No store profile data is available"
        hint="This workspace does not expose a store profile yet."
        Icon={Store}
      >
          <SellerWorkspaceEmptyState
            title="No store profile data is available for this workspace yet"
          description="The store profile will appear after store details exist for the active workspace."
          icon={<Store className="h-5 w-5" />}
        />
      </SellerWorkspaceSectionCard>
    );
  }

  return (
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Store Profile"
        title="Store profile"
        description="Manage what buyers see and where orders ship from."
        actions={[
          <SellerWorkspaceBadge
            key="status"
            label={storeStatusBadge.label}
            tone={storeStatusBadge.tone}
          />,
          <SellerWorkspaceBadge
            key="readiness"
            label={mainReadinessBadge.label}
            tone={mainReadinessBadge.tone}
          />,
          <SellerWorkspaceBadge
            key="mode"
            label={effectiveCanEdit ? (isEditing ? "Editing" : "Editable") : "Read-only"}
            tone={effectiveCanEdit ? "sky" : "stone"}
          />,
        ]}
      />

      {!operationalReadiness.isReady || shippingSetupStatus.code !== "READY" ? (
        <SellerWorkspaceNotice type="warning">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">Store not ready yet</p>
              <p className="mt-1 leading-5">
                Complete payment and shipping setup before going public.
              </p>
              {storeReadyReasons[0] ? (
                <p className="mt-1 text-xs leading-5 text-amber-800">{storeReadyReasons[0]}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={workspaceRoutes.paymentProfile()} className={sellerSecondaryButtonClass}>
                Payment setup
              </Link>
              <Link to={workspaceRoutes.shippingSetup()} className={sellerPrimaryButtonClass}>
                Fix shipping
              </Link>
            </div>
          </div>
        </SellerWorkspaceNotice>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SellerWorkspaceSectionCard
          title="Completeness"
          hint="Public profile."
          Icon={MapPin}
          className="p-3"
          actions={
            <SellerWorkspaceBadge
              label={profileCompletenessBadge.label}
              tone={profileCompletenessBadge.tone}
            />
          }
        >
          <p className="text-[1.5rem] font-semibold leading-none text-slate-900">
            {completeness.score || 0}%
          </p>
          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            {completeness.completedFields || 0} of {completeness.totalFields || 0} fields complete.
          </p>
          {missingFields.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missingFields.slice(0, 2).map((field) => (
                <SellerWorkspaceBadge
                  key={field.key}
                  label={field.label}
                  tone="amber"
                  className="bg-white"
                />
              ))}
              {missingFields.length > 2 ? (
                <SellerWorkspaceBadge label={`+${missingFields.length - 2}`} tone="amber" />
              ) : null}
            </div>
          ) : null}
          {effectiveCanEdit && missingFields.length ? (
            <button
              type="button"
              onClick={() => {
                setStatus(null);
                setIsEditing(true);
              }}
              className={`${compactSecondaryActionClass} mt-2.5`}
            >
              Fix missing fields
            </button>
          ) : null}
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Payment"
          hint="Checkout."
          Icon={ShieldCheck}
          className="p-3"
          actions={<SellerWorkspaceBadge label={operationalBadge.label} tone={operationalBadge.tone} />}
        >
          <p className="text-sm font-semibold leading-5 text-slate-900">
            {
              operationalReadiness.paymentProfileCode
                ? formatFieldName(operationalReadiness.paymentProfileCode)
                : operationalBadge.label
            }
          </p>
          {!operationalReadiness.isReady ? (
            <p className="mt-1.5 text-sm leading-5 text-slate-600">Required before checkout.</p>
          ) : null}
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Shipping"
          hint="Pickup origin."
          Icon={MapPin}
          className="p-3"
          actions={<SellerWorkspaceBadge label={shippingBadge.label} tone={shippingBadge.tone} />}
        >
          <p className="text-sm font-semibold leading-5 text-slate-900">
            {
              shippingSetupSummary.shippingEnabled
                ? shippingSetupStatus.label || "Enabled"
                : "Disabled"
            }
          </p>
          {shippingMissingFields.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {shippingMissingFields.slice(0, 2).map((field) => (
                <SellerWorkspaceBadge
                  key={field.key}
                  label={field.label}
                  tone="amber"
                  className="bg-white"
                />
              ))}
              {shippingMissingFields.length > 2 ? (
                <SellerWorkspaceBadge label={`+${shippingMissingFields.length - 2}`} tone="amber" />
              ) : null}
            </div>
          ) : null}
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Storefront"
          hint="Visibility."
          Icon={Store}
          className="p-3"
          actions={
            <SellerWorkspaceBadge
              label={storefrontReady ? "Ready" : "Blocked"}
              tone={storefrontReady ? "emerald" : "rose"}
            />
          }
        >
          <p className="text-sm leading-5 text-slate-600">
            {storefrontReady ? "Buyers can open this store." : "Complete setup before going public."}
          </p>
          {storefrontReady && storefrontPreviewHref ? (
            <Link to={storefrontPreviewHref} className={`${compactSecondaryActionClass} mt-2.5`}>
              View storefront
            </Link>
          ) : null}
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <SellerWorkspaceSectionCard
            title="Public profile"
            hint="What buyers see."
            Icon={Globe}
            actions={
              effectiveCanEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    setIsEditing(true);
                  }}
                  className={sellerSecondaryButtonClass}
                >
                  Edit profile
                </button>
              ) : null
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem label="Store name" value={displayFieldValue(profile.name)} />
              <SellerWorkspaceDetailItem
                label="Store URL"
                value={
                  <span className="break-words">
                    {displayFieldValue(storefrontPreviewHref || profile.slug)}
                  </span>
                }
              />
              <SellerWorkspaceDetailItem label="Description" value={displayFieldValue(profile.description)} />
              <SellerWorkspaceDetailItem label="Logo / Cover" value={mediaLabel} />
              <SellerWorkspaceDetailItem label="Contact" value={publicContactLabel} />
              <SellerWorkspaceDetailItem label="Location" value={displayFieldValue(storefrontLocationLabel)} />
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Shipping setup"
            hint="Pickup origin for seller orders."
            Icon={MapPin}
          >
            <p className="text-sm text-slate-600">Used as the pickup origin for seller orders.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Status"
                value={shippingSetupSummary.shippingEnabled ? shippingSetupStatus.label : "Disabled"}
              />
              <SellerWorkspaceDetailItem
                label="Pickup contact"
                value={displayFieldValue(shippingSetupSummary.originContactName)}
              />
              <SellerWorkspaceDetailItem
                label="Pickup phone"
                value={displayFieldValue(shippingSetupSummary.originPhone)}
              />
              <SellerWorkspaceDetailItem
                label="Pickup address"
                value={shippingPickupAddress}
                className="md:col-span-2"
              />
            </div>

            {shippingMissingFields.length ? (
              <SellerWorkspaceNotice type="warning" className="mt-4">
                <div className="flex flex-col gap-3">
                  <p className="font-semibold text-slate-900">Missing fields</p>
                  <div className="flex flex-wrap gap-2">
                    {shippingMissingFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field.key}
                        label={field.label}
                        tone="amber"
                        className="bg-white"
                      />
                    ))}
                  </div>
                  <Link
                    to={workspaceRoutes.shippingSetup()}
                    className={`${compactSecondaryActionClass} self-start`}
                  >
                    Fix shipping
                  </Link>
                </div>
              </SellerWorkspaceNotice>
            ) : null}

            {shippingSetupMeta.usesStoreProfileFallback ? (
              <SellerWorkspaceNotice type="info" className="mt-4">
                Using store profile contact as fallback.
              </SellerWorkspaceNotice>
            ) : null}
          </SellerWorkspaceSectionCard>
        </div>

        <div className="space-y-5">
          <SellerWorkspaceSectionCard
            title="What you can edit"
            hint="Seller-owned fields only."
            Icon={ShieldCheck}
          >
            <div className="space-y-1 text-sm text-slate-600">
              <p>You can edit public details, contact, media, and address.</p>
              <p>Store name, slug, and status are managed by admin.</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">Editable</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Public details", "Contact", "Media", "Address"].map((label) => (
                    <SellerWorkspaceBadge key={label} label={label} tone="emerald" className="bg-white" />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Admin managed</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Name", "Slug", "Status"].map((label) => (
                    <SellerWorkspaceBadge key={label} label={label} tone="stone" />
                  ))}
                </div>
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Store readiness notes"
            hint="Quick actions."
            Icon={Store}
          >
            <SellerWorkspaceNotice type={storefrontReady ? "success" : "warning"}>
            {storefrontReady
              ? "Store setup looks ready."
              : "Complete payment and shipping setup before going public."}
            </SellerWorkspaceNotice>
            {!operationalReadiness.isReady ||
            shippingSetupStatus.code !== "READY" ||
            (storefrontReady && storefrontPreviewHref) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {!operationalReadiness.isReady ? (
                  <Link to={workspaceRoutes.paymentProfile()} className={compactSecondaryActionClass}>
                    Payment setup
                  </Link>
                ) : null}
                {shippingSetupStatus.code !== "READY" ? (
                  <Link to={workspaceRoutes.shippingSetup()} className={compactSecondaryActionClass}>
                    Fix shipping
                  </Link>
                ) : null}
                {storefrontReady && storefrontPreviewHref ? (
                  <Link to={storefrontPreviewHref} className={compactSecondaryActionClass}>
                    View storefront
                  </Link>
                ) : null}
              </div>
            ) : null}
          </SellerWorkspaceSectionCard>
        </div>
      </section>

      <div>
        <SellerWorkspaceSectionCard
          title="Edit store details"
          hint="Public details, contact, and shipping origin."
          Icon={ShieldCheck}
          actions={
            effectiveCanEdit ? (
              isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className={sellerSecondaryButtonClass}
                    disabled={mutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="seller-store-profile-form"
                    className={sellerPrimaryButtonClass}
                    disabled={mutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    {mutation.isPending ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setStatus(null);
                    setIsEditing(true);
                  }}
                  className={sellerPrimaryButtonClass}
                >
                  Edit profile
                </button>
              )
            ) : (
              <SellerWorkspaceBadge label="Read-only access" tone="stone" />
            )
          }
        >
          {status ? (
            <SellerWorkspaceNotice
              type={status.type === "success" ? "success" : "error"}
              className="mb-5"
            >
              {status.message}
            </SellerWorkspaceNotice>
          ) : null}

          <SellerWorkspaceNotice
            type={effectiveCanEdit ? "info" : "warning"}
            className="mb-5"
          >
            {effectiveCanEdit
              ? "Store name, slug, and status are managed by admin."
              : "Your role can view this page only."}
          </SellerWorkspaceNotice>

          {!isEditing ? (
            <div id="shipping-setup" className="space-y-4 scroll-mt-24">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SellerWorkspaceDetailItem label="Public details" value={profile.description ? "Ready" : "Needs setup"} />
                <SellerWorkspaceDetailItem label="Contact" value={publicContactLabel} />
                <SellerWorkspaceDetailItem label="Address" value={displayFieldValue(storefrontLocationLabel)} />
                <SellerWorkspaceDetailItem
                  label="Shipping origin"
                  value={shippingSetupSummary.shippingEnabled ? shippingSetupStatus.label : "Disabled"}
                />
              </div>
            </div>
          ) : (
            <form id="seller-store-profile-form" onSubmit={handleSubmit} className="space-y-4">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setStatus(null);
                  setIsUploadingLogo(true);
                  try {
                    const url = await uploadSellerStoreProfileImage(file);
                    setForm((current) => ({ ...current, logoUrl: url }));
                    setStatus({
                      type: "success",
                      message: "Store logo uploaded. Save changes to persist it to the store profile.",
                    });
                  } catch (error) {
                    setStatus({
                      type: "error",
                      message:
                        error?.response?.data?.message ||
                        error?.message ||
                        "Failed to upload seller store logo.",
                    });
                  } finally {
                    setIsUploadingLogo(false);
                    event.target.value = "";
                  }
                }}
              />
              <section className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Media</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Shown on seller and storefront surfaces.
                    </p>
                  </div>
                  <SellerWorkspaceBadge
                    label={logoPreviewUrl ? "Logo ready" : "Default initials"}
                    tone={logoPreviewUrl ? "emerald" : "stone"}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-400">
                    {logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt={form.name || profile.name || "Store logo"} className="h-full w-full object-cover" />
                    ) : (
                      "ST"
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={mutation.isPending || isUploadingLogo || !editableFieldSet.has("logoUrl")}
                      className={sellerSecondaryButtonClass}
                    >
                      {isUploadingLogo ? "Uploading..." : logoPreviewUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, logoUrl: "" }));
                        setStatus({
                          type: "success",
                          message: "Store logo removed from the draft. Save changes to keep the default initials.",
                        });
                      }}
                      disabled={mutation.isPending || isUploadingLogo || !form.logoUrl || !editableFieldSet.has("logoUrl")}
                      className={sellerSecondaryButtonClass}
                    >
                      Remove logo
                    </button>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-3">
                {formSections.map((section) => (
                  <section
                    key={section.title}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {section.fields.map((field) => (
                        (() => {
                          const fieldEditable = editableFieldSet.has(field.key);
                          const fieldHint = fieldEditable
                            ? field.hint
                            : "Managed by admin.";
                          return (
                            <div key={field.key}>
                              <InputField
                                label={field.label}
                                hint={fieldHint}
                                multiline={field.type === "textarea"}
                                type={field.type === "textarea" ? undefined : field.type}
                                value={form[field.key]}
                                onChange={handleChange(field.key)}
                                readOnly={mutation.isPending || !fieldEditable}
                                disabled={mutation.isPending || !fieldEditable}
                                rows={field.type === "textarea" ? 2 : undefined}
                              />
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <section
                id="shipping-setup"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">Shipping origin</h4>
                  <SellerWorkspaceBadge
                    label={form.shippingEnabled ? "Enabled" : "Disabled"}
                    tone={form.shippingEnabled ? "sky" : "stone"}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Shipping mode
                    </span>
                    <select
                      className={`${sellerFieldClass} mt-2 ${mutation.isPending ? sellerDisabledFieldClass : ""}`}
                      value={form.shippingEnabled ? "enabled" : "disabled"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          shippingEnabled: event.target.value === "enabled",
                        }))
                      }
                      disabled={mutation.isPending}
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Used for pickup.</p>
                  </label>
                  <InputField
                    label="Origin Contact Name"
                    hint="Fallback: store name."
                    value={form.originContactName}
                    onChange={handleChange("originContactName")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Phone"
                    hint="Fallback: store contact."
                    value={form.originPhone}
                    onChange={handleChange("originPhone")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Address Line 1"
                    hint="Used for pickup."
                    value={form.originAddressLine1}
                    onChange={handleChange("originAddressLine1")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Address Line 2"
                    hint="Optional."
                    value={form.originAddressLine2}
                    onChange={handleChange("originAddressLine2")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin District"
                    value={form.originDistrict}
                    onChange={handleChange("originDistrict")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin City"
                    value={form.originCity}
                    onChange={handleChange("originCity")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Province"
                    value={form.originProvince}
                    onChange={handleChange("originProvince")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Postal Code"
                    value={form.originPostalCode}
                    onChange={handleChange("originPostalCode")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <InputField
                    label="Origin Country"
                    value={form.originCountry}
                    onChange={handleChange("originCountry")}
                    readOnly={mutation.isPending}
                    disabled={mutation.isPending}
                  />
                  <div className="md:col-span-2">
                    <InputField
                      label="Pickup Notes"
                      hint="Optional."
                      multiline
                      rows={2}
                      value={form.pickupNotes}
                      onChange={handleChange("pickupNotes")}
                      readOnly={mutation.isPending}
                      disabled={mutation.isPending}
                    />
                  </div>
                </div>
              </section>
            </form>
          )}
        </SellerWorkspaceSectionCard>
      </div>
    </div>
  );
}

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
  getCityOptions,
  getDistrictOptions,
  getProvinceOptions,
} from "../../utils/idRegions.ts";
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
  originCountry: profile?.shippingSetup?.originCountry || "Indonesia",
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

const getCompactFieldLabel = (field) => {
  const label = String(field?.label || field?.key || "").trim();
  if (!label) return "Missing info";
  return label
    .replace(/^Store\s+/i, "")
    .replace(/\s+URL$/i, "")
    .replace(/\s+Line\s+\d+$/i, "")
    .replace(/\bOrigin\s+/i, "")
    .trim();
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

function SelectField({ label, hint, disabled = false, children, ...props }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      <select
        className={`${sellerFieldClass} mt-2 ${disabled ? sellerDisabledFieldClass : ""}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </select>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function SellerStoreProfilePage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
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
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

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

  const handleOriginProvinceChange = (event) => {
    const originProvince = event?.target?.value ?? "";
    setForm((current) => ({
      ...current,
      originProvince,
      originCity: "",
      originDistrict: "",
      originCountry: current.originCountry || "Indonesia",
    }));
  };

  const handleOriginCityChange = (event) => {
    const originCity = event?.target?.value ?? "";
    setForm((current) => ({
      ...current,
      originCity,
      originDistrict: "",
      originCountry: current.originCountry || "Indonesia",
    }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setStatus(null);
    setForm(createFormState(profileQuery.data));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const isShippingOriginIncomplete =
      Boolean(form.shippingEnabled) &&
      (!emptyToNull(form.originProvince) ||
        !emptyToNull(form.originCity) ||
        !emptyToNull(form.originDistrict));
    if (isShippingOriginIncomplete && location.hash === "#shipping-setup") {
      setStatus({
        type: "error",
        message: "Select origin province, city/regency, and subdistrict before saving shipping setup.",
      });
      return;
    }
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
        originCountry: emptyToNull(form.originCountry) || "Indonesia",
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
  const bannerPreviewUrl = resolveAssetUrl(form.bannerUrl || "");
  const originProvinceOptions = useMemo(
    () => getProvinceOptions(form.originProvince),
    [form.originProvince]
  );
  const originCityOptions = useMemo(
    () => getCityOptions(form.originProvince, form.originCity),
    [form.originProvince, form.originCity]
  );
  const originDistrictOptions = useMemo(
    () => getDistrictOptions(form.originProvince, form.originCity, form.originDistrict),
    [form.originProvince, form.originCity, form.originDistrict]
  );
  const publicContactLabel =
    [profile?.phone, profile?.email, profile?.websiteUrl]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .join(" | ") || EMPTY_FIELD_LABEL;
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
  const setupChecks = [
    {
      label: "Public profile",
      ready: Boolean(completeness.isComplete),
      statusLabel: completeness.isComplete ? "Ready" : "Needs info",
      tone: completeness.isComplete ? "emerald" : "amber",
      helper: completeness.isComplete
        ? "Public profile ready."
        : `${missingFields.length || 1} info item${(missingFields.length || 1) === 1 ? "" : "s"} missing.`,
    },
    {
      label: "Payment setup",
      ready: Boolean(operationalReadiness.isReady),
      statusLabel: operationalReadiness.isReady ? "Ready" : "Required",
      tone: operationalReadiness.isReady ? "emerald" : "amber",
      helper: operationalReadiness.isReady ? "Ready for checkout." : "Complete payment setup.",
    },
    {
      label: "Shipping origin",
      ready: shippingSetupStatus.code === "READY",
      statusLabel: shippingSetupStatus.code === "READY" ? "Ready" : "Required",
      tone: shippingSetupStatus.code === "READY" ? "emerald" : "amber",
      helper:
        shippingSetupStatus.code === "READY"
          ? "Pickup origin ready."
          : "Shipping origin missing.",
    },
    {
      label: "Storefront visibility",
      ready: storefrontReady,
      statusLabel: storefrontReady ? "Unlocked" : "Locked",
      tone: storefrontReady ? "emerald" : "stone",
      helper: storefrontReady ? "Storefront unlocked." : "Locked until setup is complete.",
    },
  ];
  const setupStepsLeft = setupChecks.filter((item) => !item.ready).length;
  const readinessScore = Number(completeness.score || 0);
  const readinessStage =
    storefrontReady || readinessScore >= 100
      ? "Ready to go public"
      : readinessScore >= 80
        ? "Almost ready"
        : readinessScore >= 50
          ? "Getting closer"
          : "Setup in progress";
  const readinessHeadline = storefrontReady
    ? "Ready to go public"
    : setupStepsLeft === 1
      ? `${readinessStage} - 1 step left`
      : `${readinessStage} - ${setupStepsLeft} steps left`;
  const readinessMessage = storefrontReady
    ? "Public profile, checkout, and shipping are ready."
    : shippingSetupStatus.code !== "READY"
      ? "Complete shipping setup to unlock checkout and fulfillment."
      : !operationalReadiness.isReady
        ? "Complete payment setup to unlock checkout."
        : "Complete the remaining public profile fields.";
  const readinessSourceText = sellerFriendlyText(
    profile?.boundaries?.readinessSourceOfTruth ||
      operationalReadiness.sourceOfTruth ||
      "Saved store status, active payment setup, and shipping origin decide public readiness."
  );
  const storefrontBoundaryText = sellerFriendlyText(
    profile?.boundaries?.storefrontBoundary ||
      (storefrontReady
        ? "Buyer storefront can stay public-ready."
        : "Buyer storefront and checkout stay gated until blockers are complete.")
  );
  const hasShippingBlocker = shippingSetupStatus.code !== "READY";
  const hasPaymentBlocker = !operationalReadiness.isReady;
  const primaryCta =
    hasShippingBlocker
      ? { label: "Fix shipping", to: workspaceRoutes.shippingSetup() }
      : hasPaymentBlocker
        ? { label: "Payment setup", to: workspaceRoutes.paymentProfile() }
        : effectiveCanEdit && missingFields.length
          ? { label: "Fix profile", onClick: () => setIsEditing(true) }
          : storefrontPreviewHref
            ? { label: "View storefront", to: storefrontPreviewHref }
            : effectiveCanEdit
              ? { label: "Edit profile", onClick: () => setIsEditing(true) }
              : null;
  const primaryCtaLabel =
    String(primaryCta?.label || "").trim() ||
    (hasShippingBlocker
      ? "Fix shipping"
      : hasPaymentBlocker
        ? "Payment setup"
        : storefrontPreviewHref
          ? "View storefront"
          : "Edit profile");
  const safePrimaryCta = primaryCta
    ? { ...primaryCta, label: primaryCtaLabel }
    : { label: primaryCtaLabel, onClick: () => setIsEditing(true) };
  const publicMissingFields = missingFields.slice(0, 4);
  const hiddenPublicMissingCount = Math.max(0, missingFields.length - publicMissingFields.length);
  const editNavItems = [
    { label: "Media", id: "store-profile-media" },
    { label: "Public", id: "store-profile-public-details" },
    { label: "Contact", id: "store-profile-contact" },
    { label: "Address", id: "store-profile-address" },
    { label: "Shipping", id: "shipping-setup" },
  ];
  const scrollToEditSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr] xl:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Store readiness
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <p className="text-4xl font-semibold leading-none text-slate-900">
                {completeness.score || 0}%
              </p>
              <div className="pb-1">
                <h3 className="text-lg font-semibold text-slate-900">{readinessHeadline}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">{readinessMessage}</p>
              </div>
            </div>
            {storeReadyReasons[0] && !storefrontReady ? (
              <p className="mt-3 text-sm leading-5 text-amber-800">{storeReadyReasons[0]}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {safePrimaryCta.to ? (
                <Link
                  to={safePrimaryCta.to}
                  className={`${sellerPrimaryButtonClass} min-w-[104px] text-white`}
                  aria-label={safePrimaryCta.label}
                  title={safePrimaryCta.label}
                  style={{ color: "#fff" }}
                >
                  <span className="whitespace-nowrap text-white">{safePrimaryCta.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  aria-label={safePrimaryCta.label}
                  title={safePrimaryCta.label}
                  onClick={() => {
                    setStatus(null);
                    safePrimaryCta.onClick?.();
                  }}
                  className={`${sellerPrimaryButtonClass} min-w-[104px] text-white`}
                  style={{ color: "#fff" }}
                >
                  <span className="whitespace-nowrap text-white">{safePrimaryCta.label}</span>
                </button>
              )}
              {hasPaymentBlocker && safePrimaryCta.label !== "Payment setup" ? (
                <Link to={workspaceRoutes.paymentProfile()} className={sellerSecondaryButtonClass}>
                  Payment setup
                </Link>
              ) : null}
              {storefrontReady && storefrontPreviewHref && safePrimaryCta.label !== "View storefront" ? (
                <Link to={storefrontPreviewHref} className={sellerSecondaryButtonClass}>
                  View storefront
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {setupChecks.map((item) => (
              <div
                key={item.label}
                className={`rounded-lg border px-3 py-3 ${
                  item.ready
                    ? "border-emerald-200 bg-emerald-50"
                    : item.label === "Storefront visibility"
                      ? "border-slate-200 bg-slate-50"
                      : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <SellerWorkspaceBadge
                    label={item.statusLabel}
                    tone={item.tone}
                    className="bg-white"
                  />
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SellerWorkspaceDetailItem
            label="Public gate"
            value={storefrontReady ? "Unlocked" : "Locked"}
            hint={storefrontBoundaryText}
          />
          <SellerWorkspaceDetailItem
            label="Readiness source"
            value="Backend saved state"
            hint={readinessSourceText}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <SellerWorkspaceSectionCard
            title="What buyers see"
            hint="Public storefront preview."
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
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div className="h-28 bg-slate-200">
                {resolveAssetUrl(form.bannerUrl || profile.bannerUrl || "") ? (
                  <img
                    src={resolveAssetUrl(form.bannerUrl || profile.bannerUrl || "")}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="px-4 pb-4">
                <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-white text-lg font-semibold text-slate-400 shadow-sm">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt={profile.name || "Store logo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    String(profile.name || "ST").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {displayFieldValue(profile.name)}
                    </h3>
                    <SellerWorkspaceBadge
                      label={storefrontReady ? "Public ready" : "Locked"}
                      tone={storefrontReady ? "emerald" : "stone"}
                    />
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {storefrontPreviewHref || profile.slug || "Store URL not set"}
                  </p>
                  {!storefrontReady ? (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Visible after setup is complete.
                    </p>
                  ) : null}
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                    {profile.description || "Add a short store description for buyers."}
                  </p>
                  {storefrontPreviewHref ? (
                    <div className="mt-3">
                      <Link to={storefrontPreviewHref} className={compactSecondaryActionClass}>
                        View storefront
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Contact
                    </p>
                    <p className="mt-1 break-words font-medium text-slate-900">{publicContactLabel}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </p>
                    <p className="mt-1 line-clamp-2 font-medium text-slate-900">
                      {displayFieldValue(storefrontLocationLabel)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Shipping setup"
            hint="Pickup origin for seller orders."
            Icon={MapPin}
          >
            <p className="text-sm text-slate-600">
              {shippingSetupStatus.code === "READY"
                ? "Pickup origin is ready for seller orders."
                : "Shipping origin is blocking storefront readiness."}
            </p>

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
                  <p className="font-semibold text-slate-900">Shipping origin missing</p>
                  <div className="flex flex-wrap gap-2">
                    {shippingMissingFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field.key}
                        label={
                          String(field.key || "").toLowerCase() === "origindistrict" ||
                          /origin\s+district/i.test(String(field.label || ""))
                            ? "Origin Subdistrict"
                            : field.label
                        }
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
            title="Admin-managed"
            hint="Small governance note."
            Icon={ShieldCheck}
          >
            <p className="text-sm leading-6 text-slate-600">
              You can edit public details, contact, media, address, and shipping origin.
              Store name, slug, and status stay under admin governance.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Name", "Slug", "Status"].map((label) => (
                <SellerWorkspaceBadge key={label} label={label} tone="stone" />
              ))}
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Missing fields"
            hint="Compact checklist."
            Icon={Store}
          >
            {missingFields.length ? (
              <div className="space-y-2">
                {publicMissingFields.map((field) => (
                  <div
                    key={`${field.key}-${field.label}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {getCompactFieldLabel(field)}
                    </span>
                    <SellerWorkspaceBadge label="Missing" tone="amber" className="bg-white" />
                  </div>
                ))}
                {hiddenPublicMissingCount > 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                    +{hiddenPublicMissingCount} more
                  </div>
                ) : null}
              </div>
            ) : (
              <SellerWorkspaceNotice type="success">Public profile is ready.</SellerWorkspaceNotice>
            )}
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
              <div className="sticky top-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
                <div className="flex flex-wrap gap-2">
                  {editNavItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToEditSection(item.id)}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
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
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setStatus(null);
                  setIsUploadingBanner(true);
                  try {
                    const url = await uploadSellerStoreProfileImage(file);
                    setForm((current) => ({ ...current, bannerUrl: url }));
                    setStatus({
                      type: "success",
                      message: "Store banner uploaded. Save changes to persist it to the store profile.",
                    });
                  } catch (error) {
                    setStatus({
                      type: "error",
                      message:
                        error?.response?.data?.message ||
                        error?.message ||
                        "Failed to upload seller store banner.",
                    });
                  } finally {
                    setIsUploadingBanner(false);
                    event.target.value = "";
                  }
                }}
              />
              <section
                id="store-profile-media"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Media</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Shown on seller and storefront surfaces.
                    </p>
                  </div>
                  <SellerWorkspaceBadge
                    label={logoPreviewUrl || bannerPreviewUrl ? "Media ready" : "Default media"}
                    tone={logoPreviewUrl || bannerPreviewUrl ? "emerald" : "stone"}
                  />
                </div>
                <div className="mt-3 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-400">
                        {logoPreviewUrl ? (
                          <img src={logoPreviewUrl} alt={form.name || profile.name || "Store logo"} className="h-full w-full object-cover" />
                        ) : (
                          "ST"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">Logo image</p>
                        <p className="mt-1 text-xs text-slate-500">Square image for store identity.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                    </div>
                    <div className="mt-3">
                      <InputField
                        label="Logo URL"
                        hint="Paste an image URL or use upload."
                        value={form.logoUrl}
                        onChange={handleChange("logoUrl")}
                        readOnly={mutation.isPending || !editableFieldSet.has("logoUrl")}
                        disabled={mutation.isPending || !editableFieldSet.has("logoUrl")}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Banner image</p>
                        <p className="mt-1 text-xs text-slate-500">Wide storefront cover.</p>
                      </div>
                      <SellerWorkspaceBadge
                        label={bannerPreviewUrl ? "Banner ready" : "No banner"}
                        tone={bannerPreviewUrl ? "emerald" : "stone"}
                      />
                    </div>
                    <div className="mt-3 flex aspect-[16/5] items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100">
                      {bannerPreviewUrl ? (
                        <img
                          src={bannerPreviewUrl}
                          alt={form.name || profile.name ? `${form.name || profile.name} banner` : "Store banner"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="px-4 text-center">
                          <p className="text-sm font-semibold text-slate-700">No banner image yet</p>
                          <p className="mt-1 text-xs text-slate-500">Upload a PNG or JPEG cover.</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={mutation.isPending || isUploadingBanner || !editableFieldSet.has("bannerUrl")}
                        className={sellerSecondaryButtonClass}
                      >
                        {isUploadingBanner ? "Uploading..." : bannerPreviewUrl ? "Replace banner" : "Upload banner"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, bannerUrl: "" }));
                          setStatus({
                            type: "success",
                            message: "Store banner removed from the draft. Save changes to keep the storefront cover empty.",
                          });
                        }}
                        disabled={mutation.isPending || isUploadingBanner || !form.bannerUrl || !editableFieldSet.has("bannerUrl")}
                        className={sellerSecondaryButtonClass}
                      >
                        Remove banner
                      </button>
                    </div>
                    <div className="mt-3">
                      <InputField
                        label="Banner URL"
                        hint="Paste an image URL or use upload."
                        value={form.bannerUrl}
                        onChange={handleChange("bannerUrl")}
                        readOnly={mutation.isPending || !editableFieldSet.has("bannerUrl")}
                        disabled={mutation.isPending || !editableFieldSet.has("bannerUrl")}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-3">
                {formSections.map((section) => (
                  <section
                    key={section.title}
                    id={`store-profile-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
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
                  <SelectField
                    label="Shipping mode"
                    hint="Used for pickup."
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
                  </SelectField>
                  <SelectField
                    label="Origin Province"
                    value={form.originProvince}
                    onChange={handleOriginProvinceChange}
                    disabled={mutation.isPending}
                  >
                    <option value="">Select Province</option>
                    {originProvinceOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Origin City/Regency"
                    value={form.originCity}
                    onChange={handleOriginCityChange}
                    disabled={mutation.isPending || !form.originProvince}
                  >
                    <option value="">
                      {form.originProvince ? "Select City/Regency" : "Select Province first"}
                    </option>
                    {originCityOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Origin Subdistrict"
                    value={form.originDistrict}
                    onChange={handleChange("originDistrict")}
                    disabled={mutation.isPending || !form.originCity}
                  >
                    <option value="">
                      {form.originCity ? "Select Subdistrict" : "Select City/Regency first"}
                    </option>
                    {originDistrictOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </SelectField>
                  <InputField
                    label="Origin Postal Code"
                    value={form.originPostalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        originPostalCode: event.target.value.replace(/\D/g, "").slice(0, 5),
                      }))
                    }
                    inputMode="numeric"
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
                  <SelectField
                    label="Origin Country"
                    hint="Indonesia is used for seller pickup origin."
                    value={form.originCountry || "Indonesia"}
                    onChange={handleChange("originCountry")}
                    disabled={mutation.isPending}
                  >
                    <option value="Indonesia">Indonesia</option>
                  </SelectField>
                </div>
              </section>
            </form>
          )}
        </SellerWorkspaceSectionCard>
      </div>
    </div>
  );
}

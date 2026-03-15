import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, ImageIcon, MapPin, Save, ShieldCheck, Store } from "lucide-react";
import {
  getSellerStoreProfile,
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
});

const formatFieldName = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

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
  const queryClient = useQueryClient();
  const {
    sellerContext,
    workspaceStoreId: storeId,
    refetchSellerContext,
  } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canView = permissionKeys.includes("STORE_VIEW");
  const fallbackCanEdit = permissionKeys.includes("STORE_EDIT");
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(createFormState(null));

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
        title: "Store Identity",
        fields: [
          { key: "name", label: "Store Name", type: "text" },
          {
            key: "description",
            label: "Description",
            type: "textarea",
            hint:
              "Seller-managed store summary. This now feeds public store identity and the fallback body for microsite rich-about when customization content is empty.",
          },
          { key: "logoUrl", label: "Logo URL", type: "url" },
          { key: "bannerUrl", label: "Banner URL", type: "url" },
        ],
      },
      {
        title: "Contact Channels",
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
      name: String(form.name || "").trim(),
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
    };
    const filteredPayload = Object.fromEntries(
      Object.entries(nextPayload).filter(([key]) => editableFieldSet.has(key))
    );
    await mutation.mutateAsync(filteredPayload);
  };

  const profile = profileQuery.data;
  const completeness = profile?.completeness || {
    label: "Profile needs attention",
    tone: "warning",
    completedFields: 0,
    totalFields: 0,
    missingFields: [],
  };
  const editableFields = profile?.governance?.editableFields || [];
  const readOnlyFields = profile?.governance?.readOnlyFields || [];
  const missingFields = completeness.missingFields || [];
  const contract = profile?.contract || {
    notes: [],
    categories: {
      editableFields,
      readOnlyFields,
      publicStorefrontFields: [],
      operationalClientFields: [],
      notSurfacedFields: [],
    },
    fieldMatrix: [],
  };
  const editableFieldSet = useMemo(() => new Set(editableFields), [editableFields]);

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
        hint="Fetching the active store profile snapshot for this workspace."
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
        hint="This workspace does not expose a store profile snapshot yet."
        Icon={Store}
      >
        <SellerWorkspaceEmptyState
          title="No store profile data is available for this workspace yet"
          description="The seller profile lane will start rendering after store metadata exists for the active workspace."
          icon={<Store className="h-5 w-5" />}
        />
      </SellerWorkspaceSectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Store Profile"
        title="Seller store profile overview"
        description="Identity, contact, and address fields stay scoped to the active store. Seller-owned Store fields now drive public store identity and microsite contact surfaces, while admin customization still owns marketplace copy, contact-page layout, and rich content blocks."
        actions={[
          <SellerWorkspaceBadge
            key="status"
            label={profile.statusMeta?.label || profile.status || "Active"}
            tone={profile.statusMeta?.tone || "stone"}
          />,
          <SellerWorkspaceBadge
            key="completeness"
            label={completeness.label || "Profile needs attention"}
            tone={completeness.isComplete ? "emerald" : "amber"}
          />,
          <SellerWorkspaceBadge
            key="mode"
            label={effectiveCanEdit ? (isEditing ? "Editing" : "Editable") : "Read-only"}
            tone={effectiveCanEdit ? "sky" : "stone"}
          />,
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-3">
        <SellerWorkspaceSectionCard
          title="Identity"
          hint="Store-scoped seller snapshot"
          Icon={Store}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem label="Store Name" value={profile.name} />
            <SellerWorkspaceDetailItem
              label="Slug"
              value={profile.slug}
              hint="Locked during the current bridge phase."
            />
            <SellerWorkspaceDetailItem
              label="Store Status"
              value={profile.statusMeta?.label || profile.status}
              hint={profile.statusMeta?.description}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Contact"
          hint="Seller-managed touchpoints"
          Icon={Globe}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem label="Email" value={profile.email} />
            <SellerWorkspaceDetailItem label="Phone" value={profile.phone} />
            <SellerWorkspaceDetailItem label="WhatsApp" value={profile.whatsapp} />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Completeness"
          hint="Readiness for profile clarity"
          Icon={MapPin}
        >
          <p className="text-3xl font-semibold text-slate-900">{completeness.score || 0}%</p>
          <p className="mt-2 text-sm text-slate-600">
            {completeness.completedFields || 0} of {completeness.totalFields || 0} core fields are
            filled.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {completeness.description ||
              "Use this summary to reduce ambiguity between seller operations and storefront-facing metadata."}
          </p>
          {missingFields.length ? (
            <SellerWorkspaceNotice type="warning" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Missing Fields
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingFields.map((field) => (
                    <SellerWorkspaceBadge
                      key={field.key}
                      label={field.label}
                      tone="amber"
                      className="bg-white"
                    />
                  ))}
                </div>
              </div>
            </SellerWorkspaceNotice>
          ) : null}
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Media and Address Snapshot"
            hint="These fields stay store-scoped and follow the current profile contract."
            Icon={ImageIcon}
          >
            <div className="grid gap-3">
              <SellerWorkspaceDetailItem label="Logo URL" value={profile.logoUrl} />
              <SellerWorkspaceDetailItem label="Banner URL" value={profile.bannerUrl} />
              <SellerWorkspaceDetailItem label="Address Line 1" value={profile.addressLine1} />
              <SellerWorkspaceDetailItem label="Address Line 2" value={profile.addressLine2} />
              <SellerWorkspaceDetailItem label="City" value={profile.city} />
              <SellerWorkspaceDetailItem label="Province" value={profile.province} />
              <SellerWorkspaceDetailItem label="Postal Code" value={profile.postalCode} />
              <SellerWorkspaceDetailItem label="Country" value={profile.country} />
            </div>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Edit Governance"
            hint="The backend remains the source of truth for editable versus read-only fields."
            Icon={ShieldCheck}
          >
            <SellerWorkspaceNotice type="info">
              {profile.governance?.note ||
                "Only seller-safe identity and contact metadata can be updated from this page."}
            </SellerWorkspaceNotice>

            {contract.notes.length ? (
              <SellerWorkspaceNotice type="warning" className="mt-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                    Current Storefront Sync
                  </p>
                  {contract.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </SellerWorkspaceNotice>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                  Editable Here
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {editableFields.length ? (
                    editableFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field}
                        label={formatFieldName(field)}
                        tone="emerald"
                        className="bg-white"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-emerald-800">No editable fields exposed.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Read-only Snapshot
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {readOnlyFields.length ? (
                    readOnlyFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field}
                        label={formatFieldName(field)}
                        tone="stone"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No read-only fields noted.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
                  Public Storefront
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.categories?.publicStorefrontFields?.length ? (
                    contract.categories.publicStorefrontFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field}
                        label={formatFieldName(field)}
                        tone="sky"
                        className="bg-white"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-sky-900">No public storefront field noted.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">
                  Operational Client
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.categories?.operationalClientFields?.length ? (
                    contract.categories.operationalClientFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field}
                        label={formatFieldName(field)}
                        tone="amber"
                        className="bg-white"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-amber-900">No operational client field noted.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Not Surfaced
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract.categories?.notSurfacedFields?.length ? (
                    contract.categories.notSurfacedFields.map((field) => (
                      <SellerWorkspaceBadge
                        key={field}
                        label={formatFieldName(field)}
                        tone="stone"
                      />
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">All fields are already surfaced.</span>
                  )}
                </div>
              </div>
            </div>
          </SellerWorkspaceSectionCard>
        </div>

        <SellerWorkspaceSectionCard
          title="Store Profile Form"
          hint="Edit mode only opens when the backend confirms store edit permission."
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
                    {mutation.isPending ? "Saving..." : "Save Changes"}
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
                  Edit Profile
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
              ? isEditing
                ? "Edit mode is open for seller-safe fields only. Public storefront pages still mostly read store customization, not this profile contract."
                : "Seller-safe fields can be updated here when edit mode is open. Backend governance still decides which keys can be submitted."
              : "This actor can review the store profile but cannot submit updates. Editability stays controlled by backend seller permissions for the active store."}
          </SellerWorkspaceNotice>

          <form id="seller-store-profile-form" onSubmit={handleSubmit} className="space-y-5">
            {formSections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">{section.title}</h4>
                  <SellerWorkspaceBadge
                    label={isEditing ? "Editable mode" : "Read-only preview"}
                    tone={isEditing ? "sky" : "stone"}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {section.fields.map((field) => (
                    (() => {
                      const fieldEditable = editableFieldSet.has(field.key);
                      const fieldHint = fieldEditable
                        ? field.hint
                        : field.hint
                          ? `${field.hint} Locked by current backend governance.`
                          : "Locked by current backend governance.";
                      return (
                        <div
                          key={field.key}
                          className={field.type === "textarea" ? "md:col-span-2" : undefined}
                        >
                      <InputField
                        label={field.label}
                        hint={fieldHint}
                        multiline={field.type === "textarea"}
                        type={field.type === "textarea" ? undefined : field.type}
                        value={form[field.key]}
                        onChange={handleChange(field.key)}
                        readOnly={!isEditing || mutation.isPending || !fieldEditable}
                        disabled={!isEditing || mutation.isPending || !fieldEditable}
                      />
                        </div>
                      );
                    })()
                  ))}
                </div>
              </section>
            ))}
          </form>
        </SellerWorkspaceSectionCard>
      </section>
    </div>
  );
}

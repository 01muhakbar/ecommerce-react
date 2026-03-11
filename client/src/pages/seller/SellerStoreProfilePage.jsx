import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, ImageIcon, MapPin, Save, ShieldCheck, Store } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";
import {
  getSellerStoreProfile,
  updateSellerStoreProfile,
} from "../../api/sellerStoreProfile.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const inputClass =
  "mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200";

const textareaClass = `${inputClass} min-h-[120px] resize-y`;

const TONE_CLASS = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-stone-200 bg-stone-100 text-stone-700",
};

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

function Badge({ label, tone = "neutral" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}
    >
      {label}
    </span>
  );
}

function Field({ label, hint, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value || "-"}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function InputField({ label, hint, multiline = false, ...props }) {
  const Element = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
        {label}
      </span>
      <Element className={multiline ? textareaClass : inputClass} {...props} />
      {hint ? <p className="mt-2 text-xs text-stone-500">{hint}</p> : null}
    </label>
  );
}

export default function SellerStoreProfilePage() {
  const { storeId } = useParams();
  const queryClient = useQueryClient();
  const { sellerContext, refetchSellerContext } = useOutletContext() || {};
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
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update seller store profile.",
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
            hint: "Lightweight public-facing summary only. No storefront customization here.",
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
    await mutation.mutateAsync({
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
    });
  };

  if (!canView) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include store profile visibility.
        </p>
      </section>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading seller store profile...</p>
      </section>
    );
  }

  if (profileQuery.isError) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {getSellerRequestErrorMessage(profileQuery.error, {
            permissionMessage:
              "Your current seller access does not include store profile visibility.",
            fallbackMessage: "Failed to load seller store profile.",
          })}
        </p>
      </section>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">
          No store profile data is available for this workspace yet.
        </p>
      </section>
    );
  }

  const completeness = profile.completeness || {
    label: "Profile needs attention",
    tone: "warning",
    completedFields: 0,
    totalFields: 0,
    missingFields: [],
  };
  const editableFields = profile.governance?.editableFields || [];
  const readOnlyFields = profile.governance?.readOnlyFields || [];
  const missingFields = completeness.missingFields || [];

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_46%,#ecfccb_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Store Profile
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Seller store profile overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              Identity, contact, and address fields stay scoped to the active store. Editable
              fields are seller-managed metadata, while slug, status, and workspace ownership
              remain governed outside this form.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              label={profile.statusMeta?.label || profile.status || "Active"}
              tone={profile.statusMeta?.tone || "neutral"}
            />
            <Badge
              label={completeness.label || "Profile needs attention"}
              tone={completeness.isComplete ? "success" : "warning"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <Store className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Identity
              </p>
              <p className="mt-1 text-sm text-stone-500">Store-scoped seller snapshot</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <Field label="Store Name" value={profile.name} />
            <Field label="Slug" value={profile.slug} hint="Locked during the current bridge phase." />
            <Field
              label="Store Status"
              value={profile.statusMeta?.label || profile.status}
              hint={profile.statusMeta?.description}
            />
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Contact
              </p>
              <p className="mt-1 text-sm text-stone-500">Seller-managed touchpoints</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <Field label="Email" value={profile.email} />
            <Field label="Phone" value={profile.phone} />
            <Field label="WhatsApp" value={profile.whatsapp} />
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Completeness
              </p>
              <p className="mt-1 text-sm text-stone-500">Readiness for profile clarity</p>
            </div>
          </div>
          <p className="mt-5 text-3xl font-semibold text-stone-950">{completeness.score || 0}%</p>
          <p className="mt-2 text-sm text-stone-600">
            {completeness.completedFields || 0} of {completeness.totalFields || 0} core fields are
            filled.
          </p>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {completeness.description ||
              "Use this summary to reduce ambiguity between seller operations and storefront-facing metadata."}
          </p>

          {missingFields.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">
                Missing Fields
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingFields.map((field) => (
                  <span
                    key={field.key}
                    className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-900"
                  >
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <article className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-950">Media and Address Snapshot</h3>
                <p className="text-sm text-stone-500">
                  These fields stay store-scoped and follow the current profile contract.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <Field label="Logo URL" value={profile.logoUrl} />
              <Field label="Banner URL" value={profile.bannerUrl} />
              <Field label="Address Line 1" value={profile.addressLine1} />
              <Field label="Address Line 2" value={profile.addressLine2} />
              <Field label="City" value={profile.city} />
              <Field label="Province" value={profile.province} />
              <Field label="Postal Code" value={profile.postalCode} />
              <Field label="Country" value={profile.country} />
            </div>
          </article>

          <article className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-950">Edit Governance</h3>
                <p className="text-sm text-stone-500">
                  The backend remains the source of truth for editable versus read-only fields.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-700">
              {profile.governance?.note ||
                "Only seller-safe identity and contact metadata can be updated from this page."}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Editable Here
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {editableFields.length ? (
                    editableFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700"
                      >
                        {formatFieldName(field)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-stone-500">No editable fields exposed.</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Read-only Snapshot
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {readOnlyFields.length ? (
                    readOnlyFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700"
                      >
                        {formatFieldName(field)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-stone-500">No read-only fields noted.</span>
                  )}
                </div>
              </div>
            </div>
          </article>
        </div>

        <article className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-950">Store Profile Form</h3>
                <p className="text-sm text-stone-500">
                  Edit mode only opens when the backend confirms store edit permission.
                </p>
              </div>
            </div>

            {effectiveCanEdit ? (
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
                      disabled={mutation.isPending}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="seller-store-profile-form"
                      className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            ) : (
              <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                Read-only access
              </span>
            )}
          </div>

          {status ? (
            <div
              className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                status.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {status.message}
            </div>
          ) : null}

          {!effectiveCanEdit ? (
            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
              This actor can review the store profile but cannot submit updates. Editability
              stays controlled by backend seller permissions for the active store.
            </div>
          ) : null}

          <form id="seller-store-profile-form" onSubmit={handleSubmit} className="mt-5 space-y-6">
            {formSections.map((section) => (
              <section
                key={section.title}
                className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4"
              >
                <h4 className="text-sm font-semibold text-stone-900">{section.title}</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {section.fields.map((field) => (
                    <div
                      key={field.key}
                      className={field.type === "textarea" ? "md:col-span-2" : undefined}
                    >
                      <InputField
                        label={field.label}
                        hint={field.hint}
                        multiline={field.type === "textarea"}
                        type={field.type === "textarea" ? undefined : field.type}
                        value={form[field.key]}
                        onChange={handleChange(field.key)}
                        readOnly={!isEditing || mutation.isPending}
                        disabled={!isEditing || mutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </form>
        </article>
      </section>
    </div>
  );
}

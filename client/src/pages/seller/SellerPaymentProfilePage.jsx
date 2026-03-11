import { useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, ImageIcon, ShieldAlert } from "lucide-react";
import { getSellerPaymentProfile } from "../../api/sellerPaymentProfile.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const TONE_CLASS = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-stone-200 bg-stone-100 text-stone-700",
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

function Badge({ label, tone = "neutral" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone] || TONE_CLASS.neutral}`}
    >
      {label}
    </span>
  );
}

function InfoRow({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value || "-"}</p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export default function SellerPaymentProfilePage() {
  const { storeId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const hasPermission = sellerContext?.access?.permissionKeys?.includes("PAYMENT_PROFILE_VIEW");

  const profileQuery = useQuery({
    queryKey: ["seller", "payment-profile", storeId],
    queryFn: () => getSellerPaymentProfile(storeId),
    enabled: Boolean(storeId) && hasPermission,
    retry: false,
  });

  if (!hasPermission) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include payment profile visibility.
        </p>
      </section>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading seller payment profile...</p>
      </section>
    );
  }

  if (profileQuery.isError) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {getSellerRequestErrorMessage(profileQuery.error, {
            permissionMessage:
              "Your current seller access does not include payment profile visibility.",
            fallbackMessage: "Failed to load seller payment profile.",
          })}
        </p>
      </section>
    );
  }

  const profile = profileQuery.data;
  const workspaceStore = sellerContext?.store || null;

  if (!profile) {
    return (
      <div className="space-y-6">
        <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#fafaf9_0%,#ffffff_48%,#ecfccb_100%)] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
            Payment Profile
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-stone-950">
            No payment profile configured yet
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            The active store does not have a payment profile snapshot yet. Seller workspace stays
            read-only here and relies on the existing account or admin-managed onboarding lane.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className={cardClass}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-950">Read-only empty state</h3>
                <p className="mt-1 text-sm text-stone-500">
                  No payment setup action is exposed from seller workspace in this phase.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              Payment destination setup remains governed by the existing account or admin review
              flow. Seller workspace only shows the operational snapshot after it exists.
            </div>
          </article>

          <article className={cardClass}>
            <h3 className="text-lg font-semibold text-stone-950">Store Scope</h3>
            <div className="mt-5 grid gap-4">
              <InfoRow label="Store" value={workspaceStore?.name || "-"} />
              <InfoRow label="Store ID" value={storeId || "-"} />
              <InfoRow label="Store Status" value={workspaceStore?.status || "-"} />
            </div>
          </article>
        </section>
      </div>
    );
  }

  const readiness = profile.readiness || {};
  const verificationMeta = profile.verificationMeta || {};
  const activityMeta = profile.activityMeta || {};
  const missingFields = readiness.missingFields || [];

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_48%,#ecfccb_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Payment Profile
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Seller payment profile overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This page exposes a store-scoped payment setup snapshot only. Readiness is based on
              required payment destination fields plus the existing admin review status, not on a
              separate seller-only payment system.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge label={readiness.label || "Pending review"} tone={readiness.tone || "warning"} />
            <Badge
              label={verificationMeta.label || "Pending review"}
              tone={verificationMeta.tone || "warning"}
            />
            <Badge label={activityMeta.label || "Inactive"} tone={activityMeta.tone || "neutral"} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Payment Type
              </p>
              <p className="mt-1 text-sm text-stone-500">Store-scoped operational snapshot</p>
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold text-stone-950">{profile.paymentType}</p>
          <p className="mt-2 text-sm text-stone-600">Provider: {profile.providerCode}</p>
          <p className="mt-1 text-sm text-stone-600">Profile ID: {profile.id}</p>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <BadgeCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Merchant
              </p>
              <p className="mt-1 text-sm text-stone-500">Read-only account-managed data</p>
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold text-stone-950">{profile.merchantName || "-"}</p>
          <p className="mt-2 text-sm text-stone-600">Account: {profile.accountName || "-"}</p>
          <p className="mt-1 text-sm text-stone-600">Merchant ID: {profile.merchantId || "-"}</p>
        </article>

        <article className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Readiness
          </p>
          <p className="mt-4 text-3xl font-semibold text-stone-950">
            {readiness.completedFields || 0}/{readiness.totalFields || 0}
          </p>
          <p className="mt-2 text-sm text-stone-600">{readiness.description || "-"}</p>
          {missingFields.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">
                Missing Required Fields
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">QRIS Preview</h3>
              <p className="text-sm text-stone-500">Read-only payment destination image</p>
            </div>
          </div>

          {profile.qrisImageUrl ? (
            <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200 bg-stone-50 p-4">
              <img
                src={profile.qrisImageUrl}
                alt={`${profile.merchantName || profile.accountName || "Seller"} QRIS`}
                className="mx-auto max-h-[420px] w-full rounded-2xl object-contain"
              />
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
              No QRIS image snapshot is available for this store yet.
            </div>
          )}

          <div className="mt-5 grid gap-4">
            <InfoRow label="Store" value={profile.store?.name || workspaceStore?.name} />
            <InfoRow label="Store Slug" value={profile.store?.slug || workspaceStore?.slug} />
            <InfoRow label="Store Status" value={profile.store?.status || workspaceStore?.status} />
          </div>
        </article>

        <div className="space-y-6">
          <article className={cardClass}>
            <h3 className="text-lg font-semibold text-stone-950">Instruction Snapshot</h3>
            <p className="mt-2 text-sm text-stone-500">
              This text is displayed in seller workspace as a read-only payment instruction.
            </p>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-700">
              {profile.instructionText || "No payment instruction text has been set."}
            </div>

            {profile.qrisPayload ? (
              <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-700">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  QRIS Payload
                </p>
                <p className="mt-2 break-all">{profile.qrisPayload}</p>
              </div>
            ) : null}
          </article>

          <article className={cardClass}>
            <h3 className="text-lg font-semibold text-stone-950">Governance and Timeline</h3>
            <p className="mt-2 text-sm text-stone-500">
              Seller workspace consumes this as a snapshot. It does not open write actions here.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <InfoRow
                label="Verification"
                value={verificationMeta.label || profile.verificationStatus}
                hint={verificationMeta.description}
              />
              <InfoRow
                label="Activity"
                value={activityMeta.label || (profile.isActive ? "Active" : "Inactive")}
                hint={activityMeta.description}
              />
              <InfoRow label="Created" value={formatDate(profile.createdAt)} />
              <InfoRow label="Updated" value={formatDate(profile.updatedAt)} />
              <InfoRow label="Verified" value={formatDate(profile.verifiedAt)} />
              <InfoRow
                label="Editability"
                value={profile.governance?.canEdit ? "Editable" : "Read-only"}
                hint={profile.governance?.note}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              Payment profile readiness is a combination of required destination fields,
              verification review, and active status. Seller workspace only reports that result.
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

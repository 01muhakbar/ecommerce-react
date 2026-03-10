import { useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, ImageIcon, ShieldAlert } from "lucide-react";
import { getSellerPaymentProfile } from "../../api/sellerPaymentProfile.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const STATUS_CLASS = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-stone-300 bg-stone-200 text-stone-700",
};

const ACTIVE_CLASS = {
  true: "border-emerald-200 bg-emerald-50 text-emerald-700",
  false: "border-stone-200 bg-stone-100 text-stone-700",
};

const getStatusClass = (value) =>
  STATUS_CLASS[String(value || "").toUpperCase()] ||
  "border-stone-200 bg-stone-100 text-stone-700";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function Badge({ label, className }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
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
    const status = Number(profileQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {status === 404
            ? "Store not found."
            : profileQuery.error?.response?.data?.message ||
              profileQuery.error?.message ||
              "Failed to load seller payment profile."}
        </p>
      </section>
    );
  }

  const profile = profileQuery.data;

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
            This seller workspace is read-only. The store does not have an active payment
            profile record yet, or it has not been configured through the existing account/admin
            flow.
          </p>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Read-only empty state</h3>
              <p className="mt-1 text-sm text-stone-500">
                No update action is exposed here in this bridge phase.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const isActive = Boolean(profile.isActive);

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
              This page reuses the existing store payment profile domain and exposes a safe
              read-only seller view without touching the existing admin/account review flow.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge
              label={profile.verificationStatus || "PENDING"}
              className={getStatusClass(profile.verificationStatus)}
            />
            <Badge
              label={isActive ? "ACTIVE" : "INACTIVE"}
              className={ACTIVE_CLASS[String(isActive)]}
            />
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
              <p className="mt-1 text-sm text-stone-500">Static profile snapshot</p>
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
              <p className="mt-1 text-sm text-stone-500">Read-only account data</p>
            </div>
          </div>
          <p className="mt-4 text-lg font-semibold text-stone-950">{profile.merchantName || "-"}</p>
          <p className="mt-2 text-sm text-stone-600">Account: {profile.accountName || "-"}</p>
          <p className="mt-1 text-sm text-stone-600">Merchant ID: {profile.merchantId || "-"}</p>
        </article>

        <article className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Review Timeline
          </p>
          <dl className="mt-4 space-y-3 text-sm text-stone-600">
            <div className="flex items-center justify-between gap-3">
              <dt>Created</dt>
              <dd className="font-semibold text-stone-900">{formatDate(profile.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Updated</dt>
              <dd className="font-semibold text-stone-900">{formatDate(profile.updatedAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Verified</dt>
              <dd className="font-semibold text-stone-900">{formatDate(profile.verifiedAt)}</dd>
            </div>
          </dl>
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
              <p className="text-sm text-stone-500">Read-only image snapshot</p>
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
              No QRIS image available.
            </div>
          )}
        </article>

        <article className={cardClass}>
          <h3 className="text-lg font-semibold text-stone-950">Instruction Snapshot</h3>
          <p className="mt-2 text-sm text-stone-500">
            This text is visible in read-only mode only.
          </p>

          <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-7 text-stone-700">
            {profile.instructionText || "No payment instruction text has been set."}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            Write actions remain closed in this phase. Any profile edits or review flows still
            belong to the existing account/admin paths.
          </div>
        </article>
      </section>
    </div>
  );
}

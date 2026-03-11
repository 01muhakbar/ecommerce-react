import { useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, ImageIcon, ShieldAlert } from "lucide-react";
import { getSellerPaymentProfile } from "../../api/sellerPaymentProfile.ts";
import {
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

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
      <SellerWorkspaceSectionCard
        title="Payment profile access is unavailable"
        hint="Your current seller access does not include payment profile visibility."
        Icon={ShieldAlert}
      />
    );
  }

  if (profileQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading seller payment profile"
        hint="Fetching the current store payment snapshot."
        Icon={CreditCard}
      />
    );
  }

  if (profileQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load seller payment profile"
        hint={getSellerRequestErrorMessage(profileQuery.error, {
          permissionMessage:
            "Your current seller access does not include payment profile visibility.",
          fallbackMessage: "Failed to load seller payment profile.",
        })}
        Icon={ShieldAlert}
      />
    );
  }

  const profile = profileQuery.data;
  const workspaceStore = sellerContext?.store || null;

  if (!profile) {
    return (
      <div className="space-y-6">
        <SellerWorkspaceSectionHeader
          eyebrow="Payment Profile"
          title="No payment profile configured yet"
          description="The active store does not have a payment profile snapshot yet. Seller workspace stays read-only here and relies on the existing account or admin-managed onboarding lane."
          actions={[<SellerWorkspaceBadge key="mode" label="Read-only snapshot" tone="stone" />]}
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <SellerWorkspaceSectionCard
            title="Read-only empty state"
            hint="No payment setup action is exposed from seller workspace in this phase."
            Icon={ShieldAlert}
          >
            <SellerWorkspaceNotice type="warning">
              Payment destination setup remains governed by the existing account or admin review
              flow. Seller workspace only shows the operational snapshot after it exists.
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Store Scope"
            hint="The empty state still stays tenant-scoped to the active seller store."
            Icon={BadgeCheck}
          >
            <div className="grid gap-3">
              <SellerWorkspaceDetailItem label="Store" value={workspaceStore?.name || "-"} />
              <SellerWorkspaceDetailItem label="Store ID" value={storeId || "-"} />
              <SellerWorkspaceDetailItem
                label="Store Status"
                value={workspaceStore?.status || "-"}
              />
            </div>
          </SellerWorkspaceSectionCard>
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
      <SellerWorkspaceSectionHeader
        eyebrow="Payment Profile"
        title="Seller payment profile overview"
        description="This page exposes a store-scoped payment setup snapshot only. Readiness is based on required payment destination fields plus the existing admin review status, not on a separate seller-only payment system."
        actions={[
          <SellerWorkspaceBadge
            key="snapshot"
            label="Read-only snapshot"
            tone="stone"
          />,
          <SellerWorkspaceBadge
            key="readiness"
            label={readiness.label || "Pending review"}
            tone={readiness.tone || "amber"}
          />,
          <SellerWorkspaceBadge
            key="verification"
            label={verificationMeta.label || "Pending review"}
            tone={verificationMeta.tone || "amber"}
          />,
          <SellerWorkspaceBadge
            key="activity"
            label={activityMeta.label || "Inactive"}
            tone={activityMeta.tone || "stone"}
          />,
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <SellerWorkspaceSectionCard
          title="Payment Type"
          hint="Store-scoped operational snapshot"
          Icon={CreditCard}
        >
          <p className="text-lg font-semibold text-slate-900">{profile.paymentType}</p>
          <p className="mt-2 text-sm text-slate-600">Provider: {profile.providerCode}</p>
          <p className="mt-1 text-sm text-slate-600">Profile ID: {profile.id}</p>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Merchant"
          hint="Read-only account-managed data"
          Icon={BadgeCheck}
        >
          <p className="text-lg font-semibold text-slate-900">{profile.merchantName || "-"}</p>
          <p className="mt-2 text-sm text-slate-600">Account: {profile.accountName || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">Merchant ID: {profile.merchantId || "-"}</p>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Readiness"
          hint="Operational completeness of this payment destination snapshot."
          Icon={ShieldAlert}
        >
          <p className="text-3xl font-semibold text-slate-900">
            {readiness.completedFields || 0}/{readiness.totalFields || 0}
          </p>
          <p className="mt-2 text-sm text-slate-600">{readiness.description || "-"}</p>
          {missingFields.length ? (
            <SellerWorkspaceNotice type="warning" className="mt-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                  Missing Required Fields
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SellerWorkspaceSectionCard
          title="QRIS Preview"
          hint="Read-only payment destination image"
          Icon={ImageIcon}
        >
          {profile.qrisImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={profile.qrisImageUrl}
                alt={`${profile.merchantName || profile.accountName || "Seller"} QRIS`}
                className="mx-auto max-h-[420px] w-full rounded-2xl object-contain"
              />
            </div>
          ) : (
            <SellerWorkspaceEmptyState
              title="No QRIS image snapshot is available"
              description="This store does not expose a QRIS image preview yet."
              icon={<ImageIcon className="h-5 w-5" />}
            />
          )}

          <div className="mt-5 grid gap-3">
            <SellerWorkspaceDetailItem
              label="Store"
              value={profile.store?.name || workspaceStore?.name}
            />
            <SellerWorkspaceDetailItem
              label="Store Slug"
              value={profile.store?.slug || workspaceStore?.slug}
            />
            <SellerWorkspaceDetailItem
              label="Store Status"
              value={profile.store?.status || workspaceStore?.status}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Instruction Snapshot"
            hint="This text is displayed in seller workspace as a read-only payment instruction."
            Icon={CreditCard}
          >
            <SellerWorkspaceNotice type="info">
              This payment destination remains read-only inside seller workspace. Any setup or
              verification mutation still belongs to the existing account or admin lane.
            </SellerWorkspaceNotice>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
              {profile.instructionText || "No payment instruction text has been set."}
            </div>

            {profile.qrisPayload ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  QRIS Payload
                </p>
                <p className="mt-2 break-all">{profile.qrisPayload}</p>
              </div>
            ) : null}
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Governance and Timeline"
            hint="Seller workspace consumes this as a snapshot and does not open write actions here."
            Icon={ShieldAlert}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <SellerWorkspaceDetailItem
                label="Verification"
                value={verificationMeta.label || profile.verificationStatus}
                hint={verificationMeta.description}
              />
              <SellerWorkspaceDetailItem
                label="Activity"
                value={activityMeta.label || (profile.isActive ? "Active" : "Inactive")}
                hint={activityMeta.description}
              />
              <SellerWorkspaceDetailItem label="Created" value={formatDate(profile.createdAt)} />
              <SellerWorkspaceDetailItem label="Updated" value={formatDate(profile.updatedAt)} />
              <SellerWorkspaceDetailItem label="Verified" value={formatDate(profile.verifiedAt)} />
              <SellerWorkspaceDetailItem
                label="Editability"
                value={profile.governance?.canEdit ? "Editable" : "Read-only"}
                hint={profile.governance?.note}
              />
            </div>

            <SellerWorkspaceNotice type="warning" className="mt-5">
              Payment profile readiness is a combination of required destination fields,
              verification review, and active status. Seller workspace only reports that result.
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}

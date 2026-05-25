import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchAdminStoreProfiles,
  updateAdminStoreProfile,
} from "../../api/adminStoreProfile.ts";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsMetricCard,
  AdminOpsPageHeader,
  AdminOpsStatusBadge,
  getReadinessBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const textOrFallback = (value, fallback = "-") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const fieldLabel = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildPreviewValue = (snapshot, key) => {
  const value = snapshot?.[key];
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  return String(value);
};

function StatusPill({ label, tone = "NEUTRAL" }) {
  return <AdminOpsStatusBadge label={label} tone={tone} />;
}

function GovernanceBlock({ title, toneClass, fields, snapshot }) {
  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</p>
      <div className="mt-3 space-y-2">
        {fields.length > 0 ? (
          fields.map((field) => (
            <div
              key={field}
              className="rounded-lg border border-white/60 bg-white/70 px-3 py-2"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {fieldLabel(field)}
              </p>
              <p className="mt-1 text-sm text-slate-900">{buildPreviewValue(snapshot, field)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No fields available.</p>
        )}
      </div>
    </div>
  );
}

export default function AdminStoreProfilePage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});

  const profilesQuery = useQuery({
    queryKey: ["admin-store-profiles"],
    queryFn: fetchAdminStoreProfiles,
  });

  const mutation = useMutation({
    mutationFn: ({ storeId, payload }) => updateAdminStoreProfile(storeId, payload),
    onSuccess: (entry) => {
      queryClient.setQueryData(["admin-store-profiles"], (current) => {
        const items = Array.isArray(current) ? current : [];
        return items.map((item) =>
          Number(item?.store?.id) === Number(entry?.store?.id) ? entry : item
        );
      });
      setDrafts((current) => ({
        ...current,
        [String(entry?.store?.id || "")]: {
          name: entry?.store?.name || "",
          slug: entry?.store?.slug || "",
          status: entry?.store?.status || "ACTIVE",
        },
      }));
    },
  });

  const items = useMemo(
    () => (Array.isArray(profilesQuery.data) ? profilesQuery.data : []),
    [profilesQuery.data]
  );
  const profileSummary = useMemo(() => {
    const total = items.length;
    const active = items.filter((entry) => entry?.store?.status === "ACTIVE").length;
    const publicReady = items.filter(
      (entry) => entry?.publicIdentity?.summary?.operationalReadiness?.isReady
    ).length;
    const complete = items.filter((entry) => entry?.store?.completeness?.isComplete).length;
    const shippingReady = items.filter((entry) => entry?.store?.isShippingReady).length;
    return { total, active, publicReady, complete, shippingReady };
  }, [items]);
  const hasStores = profileSummary.total > 0;

  const getDraft = (entry) => {
    const key = String(entry?.store?.id || "");
    return (
      drafts[key] || {
        name: entry?.store?.name || "",
        slug: entry?.store?.slug || "",
        status: entry?.store?.status || "ACTIVE",
      }
    );
  };

  const updateDraft = (entry, nextPartial) => {
    const key = String(entry?.store?.id || "");
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...getDraft(entry),
        ...nextPartial,
      },
    }));
  };

  const getErrorMessage = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    "Failed to update store profile.";

  if (profilesQuery.isLoading) {
    return <AdminOpsLoadingState title="Loading store profiles..." />;
  }

  if (profilesQuery.isError) {
    return (
      <AdminOpsErrorState
        message={
          profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store profiles."
        }
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminOpsPageHeader
        title="Store Profile"
        description="Admin-owned identity and storefront readiness."
        meta={`${items.length} store${items.length === 1 ? "" : "s"}`}
        badges={
          <>
            <AdminOpsStatusBadge
              {...getReadinessBadge(
                hasStores && profileSummary.publicReady === profileSummary.total,
                { missing: !hasStores }
              )}
            />
            <AdminOpsStatusBadge
              label={
                hasStores && profileSummary.shippingReady === profileSummary.total
                  ? "Verified"
                  : "Needs attention"
              }
              tone={
                hasStores && profileSummary.shippingReady === profileSummary.total
                  ? "verified"
                  : "attention"
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <AdminOpsMetricCard
          label="Active stores"
          badgeLabel={hasStores && profileSummary.active === profileSummary.total ? "Ready" : "Inactive"}
          value={`${profileSummary.active}/${profileSummary.total}`}
          helper="Admin status is the first public gate."
          tone={hasStores && profileSummary.active === profileSummary.total ? "ready" : "inactive"}
        />
        <AdminOpsMetricCard
          label="Public ready"
          badgeLabel={hasStores && profileSummary.publicReady > 0 ? "Ready" : "Missing"}
          value={profileSummary.publicReady}
          helper="Storefront opens only when readiness is true."
          tone={hasStores && profileSummary.publicReady > 0 ? "ready" : "missing"}
        />
        <AdminOpsMetricCard
          label="Complete"
          badgeLabel={hasStores && profileSummary.complete === profileSummary.total ? "Verified" : "Needs attention"}
          value={`${profileSummary.complete}/${profileSummary.total}`}
          helper="Core profile fields filled."
          tone={hasStores && profileSummary.complete === profileSummary.total ? "verified" : "attention"}
        />
        <AdminOpsMetricCard
          label="Shipping"
          badgeLabel={hasStores && profileSummary.shippingReady === profileSummary.total ? "Ready" : "Needs attention"}
          value={`${profileSummary.shippingReady}/${profileSummary.total}`}
          helper="Origin setup for fulfillment."
          tone={hasStores && profileSummary.shippingReady === profileSummary.total ? "ready" : "attention"}
        />
      </div>

      {items.length === 0 ? (
        <AdminOpsEmptyState
          title="No stores found"
          description="Store profile rows will appear after sellers are provisioned."
        />
      ) : (
        <div className="grid gap-4">
          {items.map((entry) => {
            const store = entry.store;
            const publicIdentity = entry.publicIdentity;
            const owner = entry.owner;
            const draft = getDraft(entry);
            const pendingStoreId = Number(mutation.variables?.storeId || 0);
            const isBusy = mutation.isPending && pendingStoreId === Number(store?.id || 0);
            const adminOwnedFields = store?.contract?.categories?.adminOwnedFields || [];
            const sellerEditableFields = store?.contract?.categories?.sellerEditableFields || [];
            const publicSafeFields = store?.contract?.categories?.publicSafeFields || [];
            const missingFields = store?.completeness?.missingFields || [];
            const storefrontHref = store?.slug
              ? `/store/${encodeURIComponent(store.slug)}`
              : null;
            const publicOperationalReadiness =
              entry?.publicIdentity?.summary?.operationalReadiness || null;
            const canOpenStorefront = Boolean(
              storefrontHref && publicOperationalReadiness?.isReady
            );

            return (
              <section
                key={store?.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{store?.name || "Store"}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {owner?.name || "-"} ({owner?.email || "-"}) / Slug @{store?.slug || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={store?.statusMeta?.label || store?.status || "Active"}
                      tone={store?.statusMeta?.tone}
                    />
                    {publicOperationalReadiness ? (
                      <StatusPill
                        label={publicOperationalReadiness.label}
                        tone={publicOperationalReadiness.tone}
                      />
                    ) : null}
                    <StatusPill
                      label={store?.completeness?.label || "Profile status"}
                      tone={store?.completeness?.isComplete ? "SUCCESS" : "WARNING"}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Admin-Owned Identity
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Core identity fields remain admin-governed.
                          </p>
                        </div>
                        {canOpenStorefront ? (
                          <Link
                            to={storefrontHref}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Open Storefront
                          </Link>
                        ) : publicOperationalReadiness ? (
                          <StatusPill
                            label="Storefront gated"
                            tone={publicOperationalReadiness.tone}
                          />
                        ) : null}
                      </div>

                      <form
                        className="mt-4 grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          mutation.mutate({
                            storeId: store.id,
                            payload: {
                              name: draft.name,
                              slug: draft.slug,
                              status: draft.status,
                            },
                          });
                        }}
                      >
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Store Name
                          </span>
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                            value={draft.name}
                            onChange={(event) => updateDraft(entry, { name: event.target.value })}
                            disabled={isBusy}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Slug
                          </span>
                          <input
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                            value={draft.slug}
                            onChange={(event) => updateDraft(entry, { slug: event.target.value })}
                            disabled={isBusy}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Status
                          </span>
                          <select
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                            value={draft.status}
                            onChange={(event) => updateDraft(entry, { status: event.target.value })}
                            disabled={isBusy}
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
                          </select>
                        </label>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? "Saving..." : "Save Core Identity"}
                          </button>
                          <p className="text-xs text-slate-500">
                            Seller-owned fields stay read-only here and remain editable from seller workspace.
                          </p>
                        </div>
                        {mutation.isError && pendingStoreId === Number(store?.id || 0) ? (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                            {getErrorMessage(mutation.error)}
                          </div>
                        ) : null}
                      </form>
                    </div>

                    <GovernanceBlock
                      title="Seller-Editable Preview"
                      toneClass="border-sky-200 bg-sky-50"
                      fields={sellerEditableFields}
                      snapshot={store}
                    />
                  </div>

                  <div className="space-y-4">
                    <GovernanceBlock
                      title="Public-Safe Storefront Preview"
                      toneClass="border-emerald-200 bg-emerald-50"
                      fields={publicSafeFields}
                      snapshot={publicIdentity}
                    />

                    {publicOperationalReadiness ? (
                      <div
                        className={`rounded-xl border px-4 py-4 ${
                          publicOperationalReadiness.isReady
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-amber-200 bg-amber-50"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Public Operational Gate
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusPill
                            label={publicOperationalReadiness.label}
                            tone={publicOperationalReadiness.tone}
                          />
                        </div>
                        <p className="mt-3 text-sm text-slate-700">
                          {publicOperationalReadiness.description ||
                            "Public store-facing lanes follow the current readiness gate."}
                        </p>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Shipping Setup
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusPill
                          label={store?.shippingSetupStatus?.label || "Unavailable"}
                          tone={
                            store?.shippingSetupStatus?.code === "READY"
                              ? "SUCCESS"
                              : store?.shippingSetupStatus?.code === "DISABLED"
                                ? "NEUTRAL"
                                : "WARNING"
                          }
                        />
                        <StatusPill
                          label={store?.isShippingReady ? "Shipping ready" : "Needs shipping setup"}
                          tone={store?.isShippingReady ? "SUCCESS" : "WARNING"}
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-700">
                        {store?.shippingSetupMeta?.message ||
                          store?.shippingSetupStatus?.description ||
                          "Shipping setup readiness is unavailable for this store."}
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Origin Contact
                          </p>
                          <p className="mt-1 text-sm text-slate-900">
                            {store?.shippingSetupSummary?.originContactName || "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/60 bg-white/70 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Origin Address
                          </p>
                          <p className="mt-1 text-sm text-slate-900">
                            {store?.shippingSetupSummary?.originAddressLine || "-"}
                          </p>
                        </div>
                      </div>
                      {store?.missingShippingFields?.length ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          Missing shipping fields:{" "}
                          {store.missingShippingFields.map((field) => field.label).join(", ")}.
                        </div>
                      ) : null}
                    </div>

                    <GovernanceBlock
                      title="Admin-Owned Governance Matrix"
                      toneClass="border-amber-200 bg-amber-50"
                      fields={adminOwnedFields}
                      snapshot={store}
                    />

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Contract Notes
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        {(store?.contract?.notes || []).map((note) => (
                          <p key={note}>{note}</p>
                        ))}
                      </div>
                      {missingFields.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                          Missing profile fields: {missingFields.map((field) => field.label).join(", ")}.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchAdminStoreProfiles,
  updateAdminStoreProfile,
} from "../../api/adminStoreProfile.ts";

const STATUS_STYLES = {
  SUCCESS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  WARNING: "border-amber-200 bg-amber-50 text-amber-700",
  DANGER: "border-rose-200 bg-rose-50 text-rose-700",
  NEUTRAL: "border-slate-200 bg-slate-100 text-slate-700",
};

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
  const className =
    STATUS_STYLES[String(tone || "").toUpperCase()] || STATUS_STYLES.NEUTRAL;
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
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
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading store profiles...
      </div>
    );
  }

  if (profilesQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store profiles."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">Store Profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Govern the core store identity here. Store Profile stays separate from Store Customization and remains the source of truth for seller, admin, and storefront sync.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length} store{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No stores found yet.
        </div>
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

            return (
              <section
                key={store?.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{store?.name || "Store"}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {owner?.name || "-"} ({owner?.email || "-"}) · Slug @{store?.slug || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={store?.statusMeta?.label || store?.status || "Active"}
                      tone={store?.statusMeta?.tone}
                    />
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
                        {storefrontHref ? (
                          <Link
                            to={storefrontHref}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Open Storefront
                          </Link>
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

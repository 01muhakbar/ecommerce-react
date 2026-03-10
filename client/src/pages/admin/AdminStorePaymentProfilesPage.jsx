import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStorePaymentProfiles,
  reviewAdminStorePaymentProfile,
} from "../../api/storePaymentProfiles.ts";

const STATUS_STYLES = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function AdminStorePaymentProfilesPage() {
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: ["admin-store-payment-profiles"],
    queryFn: fetchAdminStorePaymentProfiles,
  });

  const mutation = useMutation({
    mutationFn: ({ storeId, verificationStatus }) =>
      reviewAdminStorePaymentProfile(storeId, verificationStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-payment-profiles"] });
    },
  });

  const items = useMemo(
    () => (Array.isArray(profilesQuery.data) ? profilesQuery.data : []),
    [profilesQuery.data]
  );

  if (profilesQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading store payment profiles...
      </div>
    );
  }

  if (profilesQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store payment profiles."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-800">
            Store Payment Profiles
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review static QRIS setup per store before it can be activated.
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length} store{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No store payment profiles found yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((entry) => {
            const profile = entry.paymentProfile;
            const currentStatus = String(
              profile?.verificationStatus || "NOT_CONFIGURED"
            ).toUpperCase();
            const statusClass =
              STATUS_STYLES[currentStatus] ||
              "border-slate-200 bg-slate-100 text-slate-700";
            const pendingStoreId = mutation.variables?.storeId;
            const isBusy =
              mutation.isPending && Number(pendingStoreId) === Number(entry.store.id);

            return (
              <section
                key={entry.store.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {entry.store.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Owner: {entry.owner?.name || "-"} ({entry.owner?.email || "-"})
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>
                    {currentStatus === "NOT_CONFIGURED" ? "Not Configured" : currentStatus}
                  </span>
                </div>

                {!profile ? (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    This store has no payment profile yet.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Account Name
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile.accountName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Merchant Name
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile.merchantName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Merchant ID
                        </p>
                        <p className="mt-2 text-sm text-slate-900">{profile.merchantId || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Active
                        </p>
                        <p className="mt-2 text-sm text-slate-900">
                          {profile.isActive ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Instruction Text
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {profile.instructionText || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      {profile.qrisImageUrl ? (
                        <img
                          src={profile.qrisImageUrl}
                          alt={`QRIS ${entry.store.name}`}
                          className="h-48 w-full rounded-lg bg-white object-contain p-2"
                        />
                      ) : (
                        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                          No QRIS image
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {profile ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        mutation.mutate({
                          storeId: entry.store.id,
                          verificationStatus: "ACTIVE",
                        })
                      }
                      disabled={isBusy}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? "Updating..." : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mutation.mutate({
                          storeId: entry.store.id,
                          verificationStatus: "REJECTED",
                        })
                      }
                      disabled={isBusy}
                      className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mutation.mutate({
                          storeId: entry.store.id,
                          verificationStatus: "INACTIVE",
                        })
                      }
                      disabled={isBusy}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Deactivate
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

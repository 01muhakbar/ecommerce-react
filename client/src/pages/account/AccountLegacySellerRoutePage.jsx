import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CreditCard } from "lucide-react";
import {
  listSellerWorkspaceStores,
} from "../../api/sellerWorkspace.ts";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";

const PANEL_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)]";

const LANE_CONFIG = {
  paymentProfile: {
    title: "Legacy store payment profile route",
    description:
      "This legacy account route is being sunset. Payment setup now belongs to the seller workspace and uses store-scoped seller APIs.",
    requiredPermissions: ["PAYMENT_PROFILE_VIEW"],
    resolvePath: (store) => createSellerWorkspaceRoutes(store).paymentProfile(),
    ctaLabel: "Open seller payment setup",
  },
  paymentReview: {
    title: "Legacy store payment review route",
    description:
      "This legacy account route is being sunset. Buyer payment proof review now belongs to the seller workspace finance lane.",
    requiredPermissions: ["ORDER_VIEW", "PAYMENT_STATUS_VIEW"],
    resolvePath: (store) => createSellerWorkspaceRoutes(store).paymentReview(),
    ctaLabel: "Open seller payment review",
  },
};

const hasRequiredPermissions = (item, requiredPermissions) => {
  const permissionKeys = Array.isArray(item?.access?.permissionKeys) ? item.access.permissionKeys : [];
  return requiredPermissions.every((permission) => permissionKeys.includes(permission));
};

export default function AccountLegacySellerRoutePage({ lane = "paymentProfile" }) {
  const config = LANE_CONFIG[lane] || LANE_CONFIG.paymentProfile;
  const storesQuery = useQuery({
    queryKey: ["seller", "workspace", "stores"],
    queryFn: listSellerWorkspaceStores,
    retry: false,
  });

  const accessibleStores = useMemo(() => {
    const items = Array.isArray(storesQuery.data) ? storesQuery.data : [];
    return items.filter((item) => hasRequiredPermissions(item, config.requiredPermissions));
  }, [config.requiredPermissions, storesQuery.data]);

  if (storesQuery.isLoading) {
    return (
      <section className={PANEL_CLASS}>
        <p className="text-sm text-slate-500">Resolving seller workspace access...</p>
      </section>
    );
  }

  if (storesQuery.isError) {
    return (
      <section className={PANEL_CLASS}>
        <p className="text-sm text-rose-600">
          {storesQuery.error?.response?.data?.message ||
            storesQuery.error?.message ||
            "Failed to resolve seller workspace access."}
        </p>
      </section>
    );
  }

  if (accessibleStores.length === 1) {
    return <Navigate to={config.resolvePath(accessibleStores[0].store)} replace />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">
              Legacy Route
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{config.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">{config.description}</p>
          </div>
        </div>
      </section>

      {accessibleStores.length > 1 ? (
        <section className={PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Choose seller workspace scope</h2>
              <p className="mt-1 text-sm text-slate-600">
                Multiple seller stores are available for this account. Open the canonical seller lane with an explicit store scope.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {accessibleStores.map((entry) => (
              <Link
                key={entry.store.id}
                to={config.resolvePath(entry.store)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white"
              >
                <div>
                  <p className="font-semibold text-slate-900">{entry.store.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    @{entry.store.slug} • {entry.access.roleCode || "SELLER"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  {config.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {accessibleStores.length === 0 ? (
        <section className={PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">No seller access for this lane</h2>
              <p className="mt-1 text-sm text-slate-600">
                This account does not currently have seller workspace access for the requested lane. Open your invitation list or ask the store owner to grant the required seller role.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/user/store-invitations"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Open store invitations
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

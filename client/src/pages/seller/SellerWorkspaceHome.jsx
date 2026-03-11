import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, Lock, Shield, Store, UserRound } from "lucide-react";
import {
  SellerWorkspaceBadge,
  SellerWorkspaceInset,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

export default function SellerWorkspaceHome() {
  const { sellerContext } = useOutletContext() || {};

  const permissionGroups = useMemo(() => {
    const permissionKeys = sellerContext?.access?.permissionKeys || [];
    return [
      {
        title: "Store Access",
        items: permissionKeys.filter((key) => key.startsWith("STORE_")),
      },
      {
        title: "Catalog and Inventory",
        items: permissionKeys.filter(
          (key) =>
            key.startsWith("PRODUCT_") ||
            key.startsWith("CATEGORY_") ||
            key.startsWith("ATTRIBUTE_") ||
            key.startsWith("INVENTORY_")
        ),
      },
      {
        title: "Orders and Payments",
        items: permissionKeys.filter(
          (key) =>
            key.startsWith("ORDER_") ||
            key.startsWith("PAYMENT_") ||
            key.startsWith("AUDIT_")
        ),
      },
      {
        title: "Growth and Storefront",
        items: permissionKeys.filter(
          (key) => key.startsWith("COUPON_") || key.startsWith("STOREFRONT_")
        ),
      },
    ].filter((group) => group.items.length > 0);
  }, [sellerContext]);

  const permissionCount = sellerContext?.access?.permissionKeys?.length || 0;

  return (
    <div className="space-y-6">
      <SellerWorkspacePanel className="px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Foundation Status
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Seller shell is aligned for workspace validation
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              This overview keeps the seller home operational while moving the shell closer to the
              Admin workspace rhythm. Access, tenant context, and navigation readiness remain the
              first things verified here before broader seller UI parity is opened.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SellerWorkspaceBadge
              label={sellerContext?.store?.status || "ACTIVE"}
              tone="emerald"
            />
            <SellerWorkspaceBadge
              label={sellerContext?.access?.accessMode || "UNKNOWN"}
              tone="amber"
            />
            <SellerWorkspaceBadge label={`${permissionCount} permissions`} />
          </div>
        </div>
      </SellerWorkspacePanel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerWorkspaceStatCard
          label="Store"
          value={sellerContext?.store?.name || "-"}
          hint={`Slug: ${sellerContext?.store?.slug || "-"}`}
          Icon={Store}
          tone="emerald"
        />
        <SellerWorkspaceStatCard
          label="Access Mode"
          value={sellerContext?.access?.accessMode || "-"}
          hint={`Membership: ${sellerContext?.access?.membershipStatus || "-"}`}
          Icon={Shield}
          tone="amber"
        />
        <SellerWorkspaceStatCard
          label="Resolved Role"
          value={sellerContext?.access?.roleCode || "-"}
          hint={sellerContext?.access?.isOwner ? "Owner bridge is active." : "Resolved from active membership."}
          Icon={UserRound}
        />
        <SellerWorkspaceStatCard
          label="Permissions"
          value={String(permissionCount)}
          hint="These are resolved by the backend and consumed by the frontend."
          Icon={CheckCircle2}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SellerWorkspacePanel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Access Summary</h3>
              <p className="text-sm text-slate-500">
                Directly sourced from `GET /api/seller/stores/:storeId/context`
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <SellerWorkspaceInset className="bg-slate-50 px-4 py-4 shadow-none">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Store Status
              </dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {sellerContext?.store?.status || "-"}
              </dd>
            </SellerWorkspaceInset>
            <SellerWorkspaceInset className="bg-slate-50 px-4 py-4 shadow-none">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Member Reference
              </dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {sellerContext?.access?.memberId ?? "Virtual owner"}
              </dd>
            </SellerWorkspaceInset>
          </dl>

          <SellerWorkspaceNotice type="warning" className="mt-5">
            The frontend only uses these permissions for visibility and read-only states.
            Final authorization remains enforced by the backend.
          </SellerWorkspaceNotice>
        </SellerWorkspacePanel>

        <SellerWorkspacePanel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Current Phase Boundaries</h3>
              <p className="text-sm text-slate-500">Read-only shell only</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-slate-600">
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Product, coupon, storefront, and fulfillment write flows are intentionally still
              closed.
            </li>
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Light store metadata edit is open for seller users with <code>STORE_EDIT</code>.
            </li>
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              This shell validates tenant access, role resolution, and navigation readiness first.
            </li>
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Upcoming modules can extend this layout without changing the namespace or access
              contract.
            </li>
          </ul>
        </SellerWorkspacePanel>
      </section>

      <SellerWorkspacePanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Resolved Permission Keys</h3>
            <p className="mt-1 text-sm text-slate-500">
              Grouped for fast inspection during bridge-phase validation.
            </p>
          </div>
          <SellerWorkspaceBadge label={`${permissionCount} permissions`} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {permissionGroups.map((group) => (
            <SellerWorkspaceInset
              key={group.title}
              className="bg-slate-50 px-4 py-4 shadow-none"
            >
              <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((permissionKey) => (
                  <SellerWorkspaceBadge
                    key={permissionKey}
                    label={permissionKey}
                    tone="emerald"
                  />
                ))}
              </div>
            </SellerWorkspaceInset>
          ))}
        </div>
      </SellerWorkspacePanel>
    </div>
  );
}

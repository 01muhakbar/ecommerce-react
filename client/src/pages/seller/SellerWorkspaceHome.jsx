import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { CheckCircle2, Lock, Shield, Store, UserRound } from "lucide-react";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

function StatCard({ label, value, hint, Icon }) {
  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-stone-950">{value}</p>
          {hint ? <p className="mt-2 text-sm leading-6 text-stone-600">{hint}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}

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
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#f0fdf4_100%)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
          Overview
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-stone-950">
          Seller workspace foundation is active
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
          This shell is read-only and already wired to the backend seller context resolver.
          It is safe to use for validating tenant access, owner bridge behavior, and initial
          navigation before any write-heavy seller modules are opened.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Store"
          value={sellerContext?.store?.name || "-"}
          hint={`Slug: ${sellerContext?.store?.slug || "-"}`}
          Icon={Store}
        />
        <StatCard
          label="Access Mode"
          value={sellerContext?.access?.accessMode || "-"}
          hint={`Membership: ${sellerContext?.access?.membershipStatus || "-"}`}
          Icon={Shield}
        />
        <StatCard
          label="Resolved Role"
          value={sellerContext?.access?.roleCode || "-"}
          hint={sellerContext?.access?.isOwner ? "Owner bridge is active." : "Resolved from active membership."}
          Icon={UserRound}
        />
        <StatCard
          label="Permissions"
          value={String(permissionCount)}
          hint="These are resolved by the backend and consumed by the frontend."
          Icon={CheckCircle2}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Access Summary</h3>
              <p className="text-sm text-stone-500">
                Directly sourced from `GET /api/seller/stores/:storeId/context`
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Store Status
              </dt>
              <dd className="mt-2 text-base font-semibold text-stone-900">
                {sellerContext?.store?.status || "-"}
              </dd>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Member Reference
              </dt>
              <dd className="mt-2 text-base font-semibold text-stone-900">
                {sellerContext?.access?.memberId ?? "Virtual owner"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
            The frontend only uses these permissions for visibility and read-only states.
            Final authorization remains enforced by the backend.
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Current Phase Boundaries</h3>
              <p className="text-sm text-stone-500">Read-only shell only</p>
            </div>
          </div>
          <ul className="mt-5 space-y-3 text-sm text-stone-600">
            <li className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              Product, coupon, storefront, and fulfillment write flows are intentionally still
              closed.
            </li>
            <li className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              Light store metadata edit is open for seller users with <code>STORE_EDIT</code>.
            </li>
            <li className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              This shell validates tenant access, role resolution, and navigation readiness first.
            </li>
            <li className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              Upcoming modules can extend this layout without changing the namespace or access
              contract.
            </li>
          </ul>
        </article>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Resolved Permission Keys</h3>
            <p className="mt-1 text-sm text-stone-500">
              Grouped for fast inspection during bridge-phase validation.
            </p>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
            {permissionCount} permissions
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {permissionGroups.map((group) => (
            <section key={group.title} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <h4 className="text-sm font-semibold text-stone-900">{group.title}</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.items.map((permissionKey) => (
                  <span
                    key={permissionKey}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    {permissionKey}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

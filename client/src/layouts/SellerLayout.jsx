import { useMemo } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CreditCard,
  History,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
} from "lucide-react";
import { getSellerWorkspaceContext } from "../api/sellerWorkspace.ts";

const shellCardClass =
  "rounded-[28px] border border-stone-200 bg-white/90 p-5 shadow-[0_20px_45px_-32px_rgba(28,25,23,0.35)] backdrop-blur";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function SellerShellState({ title, description, tone = "neutral", children }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-stone-200 bg-white text-stone-700";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f2ea_0%,#fbfaf7_42%,#f3f7f6_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <section className={`${shellCardClass} ${toneClass}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">
            Seller Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-stone-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">{description}</p>
          {children ? <div className="mt-6">{children}</div> : null}
        </section>
      </div>
    </div>
  );
}

function AccessBadge({ label, tone = "stone" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}

function SellerSidebar({ storeId, sellerContext }) {
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const hasPermission = (permissionKey) => permissionKeys.includes(permissionKey);

  const navItems = [
    {
      label: "Overview",
      to: `/seller/stores/${storeId}`,
      Icon: LayoutDashboard,
      enabled: hasPermission("STORE_VIEW"),
      implemented: true,
      description: "Store summary and access overview.",
    },
    {
      label: "Store Profile",
      to: `/seller/stores/${storeId}/profile`,
      Icon: Store,
      enabled: hasPermission("STORE_VIEW"),
      implemented: true,
      description: "Read and light-edit store metadata.",
    },
    {
      label: "Orders",
      to: `/seller/stores/${storeId}/orders`,
      Icon: ShoppingBag,
      enabled: hasPermission("ORDER_VIEW"),
      implemented: true,
      description: "Read-only suborder overview.",
    },
    {
      label: "Payment Profile",
      to: `/seller/stores/${storeId}/payment-profile`,
      Icon: CreditCard,
      enabled: hasPermission("PAYMENT_PROFILE_VIEW"),
      implemented: true,
      description: "Read-only payment profile overview.",
    },
    {
      label: "Team",
      to: `/seller/stores/${storeId}/team`,
      Icon: Users,
      enabled:
        hasPermission("STORE_MEMBERS_MANAGE") || hasPermission("STORE_ROLES_MANAGE"),
      implemented: true,
      description: "Read-only team shell and membership summary.",
    },
    {
      label: "Team Audit",
      to: `/seller/stores/${storeId}/team/audit`,
      Icon: History,
      enabled: hasPermission("AUDIT_LOG_VIEW"),
      implemented: true,
      description: "Read-only team mutation trail.",
    },
    {
      label: "Catalog",
      to: `/seller/stores/${storeId}/catalog`,
      Icon: Package,
      enabled: hasPermission("PRODUCT_VIEW"),
      implemented: true,
      description: "Read-only seller catalog list.",
    },
    {
      label: "Coupons",
      to: "#",
      Icon: TicketPercent,
      enabled: hasPermission("COUPON_VIEW"),
      implemented: false,
      description: "Coming soon",
    },
    {
      label: "Storefront",
      to: "#",
      Icon: Store,
      enabled: hasPermission("STOREFRONT_VIEW"),
      implemented: false,
      description: "Coming soon",
    },
  ];

  return (
    <aside className={shellCardClass}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-amber-100">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Seller Area
          </p>
          <p className="mt-1 text-sm font-semibold text-stone-900">
            {sellerContext?.store?.name || "Seller Workspace"}
          </p>
        </div>
      </div>

      <nav className="mt-6 space-y-2">
        {navItems
          .filter((item) => item.enabled)
          .map((item) =>
            item.implemented ? (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === `/seller/stores/${storeId}`}
                className={({ isActive }) =>
                  [
                    "group flex items-center justify-between rounded-2xl px-4 py-3 transition",
                    isActive
                      ? "bg-stone-900 text-amber-50"
                      : "border border-transparent text-stone-600 hover:border-stone-200 hover:bg-stone-50 hover:text-stone-900",
                  ].join(" ")
                }
              >
                <span className="flex items-center gap-3">
                  <item.Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </span>
                <span className="text-[11px] uppercase tracking-[0.2em] opacity-70">
                  Live
                </span>
              </NavLink>
            ) : (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-3 text-stone-500"
              >
                <span className="flex items-center gap-3">
                  <item.Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  Soon
                </span>
              </div>
            )
          )}
      </nav>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        <p className="font-semibold">Bridge Phase</p>
        <p className="mt-2 leading-6 text-amber-800">
          Low-risk seller modules are active. Backend access is tenant-scoped, while
          write-heavy catalog, coupon, storefront, and fulfillment flows remain closed.
        </p>
      </div>
    </aside>
  );
}

export default function SellerLayout() {
  const { storeId } = useParams();
  const numericStoreId = Number(storeId);

  const sellerContextQuery = useQuery({
    queryKey: ["seller", "workspace", "context", numericStoreId],
    queryFn: () => getSellerWorkspaceContext(numericStoreId),
    enabled: Number.isInteger(numericStoreId) && numericStoreId > 0,
    retry: false,
  });

  const sellerContext = sellerContextQuery.data;

  const contextValue = useMemo(
    () => ({
      sellerContext,
      refetchSellerContext: sellerContextQuery.refetch,
    }),
    [sellerContext, sellerContextQuery.refetch]
  );

  if (!Number.isInteger(numericStoreId) || numericStoreId <= 0) {
    return (
      <SellerShellState
        title="Invalid Store"
        description="Seller workspace needs a valid store id in the URL."
        tone="danger"
      />
    );
  }

  if (sellerContextQuery.isLoading) {
    return (
      <SellerShellState
        title="Loading Seller Workspace"
        description="Resolving store context and seller access from the backend."
      />
    );
  }

  if (sellerContextQuery.isError) {
    const status = Number(sellerContextQuery.error?.response?.status || 0);

    if (status === 401) {
      return (
        <SellerShellState
          title="Seller Session Required"
          description="Sign in first to continue to the seller workspace."
          tone="danger"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth/login"
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
            >
              Store Login
            </Link>
            <Link
              to="/admin/login"
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700"
            >
              Admin Login
            </Link>
          </div>
        </SellerShellState>
      );
    }

    if (status === 403) {
      return (
        <SellerShellState
          title="Access Forbidden"
          description={getErrorMessage(
            sellerContextQuery.error,
            "This account does not have access to the selected seller workspace."
          )}
          tone="danger"
        />
      );
    }

    if (status === 404) {
      return (
        <SellerShellState
          title="Store Not Found"
          description={getErrorMessage(
            sellerContextQuery.error,
            "The selected store could not be found."
          )}
          tone="danger"
        />
      );
    }

    return (
      <SellerShellState
        title="Workspace Unavailable"
        description={getErrorMessage(
          sellerContextQuery.error,
          "Seller workspace context could not be loaded."
        )}
        tone="danger"
      >
        <button
          type="button"
          onClick={() => sellerContextQuery.refetch()}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
        >
          Retry
        </button>
      </SellerShellState>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f2ea_0%,#fbfaf7_42%,#f3f7f6_100%)] px-4 py-6 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className={`${shellCardClass} overflow-hidden`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-stone-500">
                Seller Workspace
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
                  {sellerContext?.store?.name || "Store"}
                </h1>
                <AccessBadge label={sellerContext?.store?.status || "ACTIVE"} />
              </div>
              <p className="text-sm text-stone-600">
                Tenant-scoped seller shell powered by backend access resolution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AccessBadge label={sellerContext?.access?.accessMode || "UNKNOWN"} tone="amber" />
              <AccessBadge label={sellerContext?.access?.roleCode || "UNKNOWN"} tone="emerald" />
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                {sellerContext?.store?.slug || "store"}
              </span>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <SellerSidebar storeId={numericStoreId} sellerContext={sellerContext} />
          <main className={shellCardClass}>
            <Outlet context={contextValue} />
          </main>
        </section>
      </div>
    </div>
  );
}

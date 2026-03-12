import { useMemo } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  History,
  LayoutDashboard,
  Package,
  Search,
  ShoppingBag,
  Store,
  TicketPercent,
  Users,
} from "lucide-react";
import {
  getSellerWorkspaceContext,
  getSellerWorkspaceContextBySlug,
} from "../api/sellerWorkspace.ts";
import {
  sellerShellPageClass,
  SellerWorkspaceBadge,
  SellerWorkspacePanel,
} from "../components/seller/SellerWorkspaceFoundation.jsx";
import {
  buildSellerWorkspacePath,
  createSellerWorkspaceRoutes,
  isLegacySellerStoreIdParam,
  normalizeSellerStoreParam,
  replaceSellerWorkspaceStorePath,
} from "../utils/sellerWorkspaceRoute.js";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const joinClassNames = (...items) => items.filter(Boolean).join(" ");

const getSellerPageMeta = (pathname) => {
  if (pathname.includes("/team/audit")) {
    return {
      title: "Team Audit",
      subtitle: "Tenant-scoped membership trail for the active store.",
    };
  }

  if (pathname.includes("/team/")) {
    return {
      title: "Member Lifecycle",
      subtitle: "Membership timeline and role snapshot for the current store.",
    };
  }

  if (pathname.endsWith("/team")) {
    return {
      title: "Team",
      subtitle: "Seller membership workspace for the active store.",
    };
  }

  if (pathname.includes("/catalog/")) {
    return {
      title: "Product Detail",
      subtitle: "Seller-facing catalog detail scoped to this store.",
    };
  }

  if (pathname.endsWith("/catalog")) {
    return {
      title: "Catalog",
      subtitle: "Read model for products owned by the current store.",
    };
  }

  if (pathname.includes("/orders/")) {
    return {
      title: "Order Detail",
      subtitle: "Suborder operations remain scoped to the current store.",
    };
  }

  if (pathname.endsWith("/orders")) {
    return {
      title: "Orders",
      subtitle: "Store-owned suborders, payment state, and fulfillment controls for seller operations.",
    };
  }

  if (pathname.endsWith("/payment-review")) {
    return {
      title: "Payment Review",
      subtitle: "Store-scoped finance review lane for buyer payment proofs in the active seller workspace.",
    };
  }

  if (pathname.endsWith("/payment-profile")) {
    return {
      title: "Payment Setup",
      subtitle: "Store-scoped finance setup snapshot and admin review readiness for the active seller store.",
    };
  }

  if (pathname.endsWith("/profile")) {
    return {
      title: "Store Profile",
      subtitle: "Seller-managed identity and contact metadata for this store.",
    };
  }

  return {
    title: "Overview",
    subtitle: "Workspace summary, access context, and seller readiness.",
  };
};

function SellerShellState({ title, description, tone = "neutral", children }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`${sellerShellPageClass} px-4 py-8 sm:px-6`}>
      <div className="mx-auto max-w-4xl">
        <SellerWorkspacePanel className={`${toneClass} px-5 py-6 sm:px-6`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">
            Seller Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          {children ? <div className="mt-6">{children}</div> : null}
        </SellerWorkspacePanel>
      </div>
    </div>
  );
}

function SellerSidebar({ storeSlug, sellerContext }) {
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const hasPermission = (permissionKey) => permissionKeys.includes(permissionKey);
  const sellerRoutes = createSellerWorkspaceRoutes(storeSlug);

  const navSections = [
    {
      title: "Overview",
      items: [
        {
          label: "Overview",
          to: sellerRoutes.home(),
          Icon: LayoutDashboard,
          enabled: hasPermission("STORE_VIEW"),
          implemented: true,
          meta: "Workspace home",
        },
        {
          label: "Store Profile",
          to: sellerRoutes.profile(),
          Icon: Store,
          enabled: hasPermission("STORE_VIEW"),
          implemented: true,
          meta: "Identity and metadata",
        },
      ],
    },
    {
      title: "Commerce",
      items: [
        {
          label: "Catalog",
          to: sellerRoutes.catalog(),
          Icon: Package,
          enabled: hasPermission("PRODUCT_VIEW"),
          implemented: true,
          meta: "Seller read model",
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Orders",
          to: sellerRoutes.orders(),
          Icon: ShoppingBag,
          enabled: hasPermission("ORDER_VIEW"),
          implemented: true,
          meta: "Suborder operations",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          label: "Payment Review",
          to: sellerRoutes.paymentReview(),
          Icon: BadgeCheck,
          enabled: hasPermission("ORDER_VIEW") && hasPermission("PAYMENT_STATUS_VIEW"),
          implemented: true,
          meta: "Buyer proof review lane",
        },
        {
          label: "Payment Setup",
          to: sellerRoutes.paymentProfile(),
          Icon: CreditCard,
          enabled: hasPermission("PAYMENT_PROFILE_VIEW"),
          implemented: true,
          meta: "Read-only setup snapshot",
        },
      ],
    },
    {
      title: "Workspace",
      items: [
        {
          label: "Team",
          to: sellerRoutes.team(),
          Icon: Users,
          enabled: hasPermission("STORE_MEMBERS_MANAGE"),
          implemented: true,
          meta: "Membership lane",
        },
        {
          label: "Team Audit",
          to: sellerRoutes.teamAudit(),
          Icon: History,
          enabled: hasPermission("AUDIT_LOG_VIEW"),
          implemented: true,
          meta: "Operational trail",
        },
        {
          label: "Coupons",
          to: "#",
          Icon: TicketPercent,
          enabled: hasPermission("COUPON_VIEW"),
          implemented: false,
          meta: "Soon",
        },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.enabled),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="flex h-full min-h-screen w-full flex-col border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:w-[274px]">
      <div className="border-b border-slate-100 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900">Seller Hub</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Admin-aligned workspace
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Store
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">
            {sellerContext?.store?.name || "Seller Workspace"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SellerWorkspaceBadge label={sellerContext?.store?.slug || "store"} />
            <SellerWorkspaceBadge
              label={sellerContext?.store?.status || "ACTIVE"}
              tone="emerald"
            />
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Seller sidebar">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.items.map((item) =>
                item.implemented ? (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.to === sellerRoutes.home()}
                    className={({ isActive }) =>
                      joinClassNames(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                        isActive
                          ? "bg-emerald-50 text-teal-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={joinClassNames(
                            "absolute inset-y-2 left-0 w-[3px] rounded-full",
                            isActive ? "bg-emerald-500" : "bg-transparent"
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={joinClassNames(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition",
                            isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
                          )}
                        >
                          <item.Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.label}</span>
                          <span className="block truncate text-xs text-slate-400">{item.meta}</span>
                        </span>
                        <ChevronRight
                          className={joinClassNames(
                            "h-4 w-4 transition",
                            isActive ? "text-emerald-600" : "text-slate-300"
                          )}
                        />
                      </>
                    )}
                  </NavLink>
                ) : (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-400">
                      <item.Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-slate-400">{item.meta}</span>
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Soon
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-slate-100 px-4 py-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-semibold">Bridge Phase</p>
          <p className="mt-2 leading-6 text-amber-800">
            Tenant access is live. Seller operations and finance lanes remain intentionally narrow while the workspace baseline is stabilized.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default function SellerLayout() {
  const { storeSlug } = useParams();
  const { pathname, search, hash } = useLocation();
  const normalizedStoreSlug = normalizeSellerStoreParam(storeSlug);
  const isLegacyIdRoute = isLegacySellerStoreIdParam(normalizedStoreSlug);

  const sellerContextQuery = useQuery({
    queryKey: [
      "seller",
      "workspace",
      "context",
      isLegacyIdRoute ? "legacy-id" : "slug",
      normalizedStoreSlug,
    ],
    queryFn: () =>
      isLegacyIdRoute
        ? getSellerWorkspaceContext(normalizedStoreSlug)
        : getSellerWorkspaceContextBySlug(normalizedStoreSlug),
    enabled: Boolean(normalizedStoreSlug),
    retry: false,
  });

  const sellerContext = sellerContextQuery.data;
  const canonicalStoreSlug =
    normalizeSellerStoreParam(sellerContext?.store?.slug) || normalizedStoreSlug;
  const canonicalStoreId = Number(sellerContext?.store?.id || 0) || null;
  const pageMeta = getSellerPageMeta(pathname);

  const contextValue = useMemo(
    () => ({
      sellerContext,
      workspaceStoreId: canonicalStoreId,
      workspaceStoreSlug: canonicalStoreSlug,
      refetchSellerContext: sellerContextQuery.refetch,
    }),
    [canonicalStoreId, canonicalStoreSlug, sellerContext, sellerContextQuery.refetch]
  );

  if (!normalizedStoreSlug) {
    return (
      <SellerShellState
        title="Invalid Store"
        description="Seller workspace needs a valid store slug in the URL."
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

  if (sellerContext && canonicalStoreSlug && normalizedStoreSlug !== canonicalStoreSlug) {
    return (
      <Navigate
        to={`${replaceSellerWorkspaceStorePath(pathname, canonicalStoreSlug)}${search}${hash}`}
        replace
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
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Store Login
            </Link>
            <Link
              to="/admin/login"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
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
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </SellerShellState>
    );
  }

  return (
    <div className={`layout ${sellerShellPageClass}`}>
      <SellerSidebar storeSlug={canonicalStoreSlug} sellerContext={sellerContext} />

      <div className="layout__content min-w-0 flex-1 bg-slate-100">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-700">
                <Store className="h-[18px] w-[18px]" />
              </div>
              <div className="grid min-w-0 gap-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Seller Workspace
                </p>
                <p className="truncate text-[15px] font-bold text-slate-900">{pageMeta.title}</p>
              </div>
              <div className="hidden h-11 min-w-[220px] max-w-[420px] flex-1 items-center rounded-[14px] border border-slate-200 bg-white px-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)] lg:flex">
                <Search className="h-4 w-4 text-slate-400" />
                <span className="ml-3 truncate text-sm text-slate-500">
                  {sellerContext?.store?.name || "Store"} · {sellerContext?.store?.slug || "store"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-[0_10px_20px_rgba(15,23,42,0.05)]">
              <SellerWorkspaceBadge
                label={sellerContext?.access?.accessMode || "UNKNOWN"}
                tone="amber"
              />
              <SellerWorkspaceBadge
                label={sellerContext?.access?.roleCode || "UNKNOWN"}
                tone="emerald"
              />
              <SellerWorkspaceBadge
                label={sellerContext?.store?.status || "ACTIVE"}
                tone="sky"
                className="hidden sm:inline-flex"
              />
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                {sellerContext?.access?.memberId ?? "Owner bridge"}
              </span>
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-[26px] sm:px-6 sm:py-[26px]">
          <div className="mx-auto w-full max-w-[1280px] space-y-5">
            <SellerWorkspacePanel className="px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Workspace Context
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                    {sellerContext?.store?.name || "Store"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{pageMeta.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SellerWorkspaceBadge label={sellerContext?.store?.slug || "store"} />
                  <SellerWorkspaceBadge
                    label={canonicalStoreId ? `Store #${canonicalStoreId}` : "Store"}
                    className="bg-slate-50"
                  />
                </div>
              </div>
            </SellerWorkspacePanel>

            <Outlet context={contextValue} />
          </div>
        </main>
      </div>
    </div>
  );
}

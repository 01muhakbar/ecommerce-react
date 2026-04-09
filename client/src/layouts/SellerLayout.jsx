import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronRight,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
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
  createSellerWorkspaceRoutes,
  isLegacySellerStoreIdParam,
  normalizeSellerStoreParam,
  replaceSellerWorkspaceStorePath,
} from "../utils/sellerWorkspaceRoute.js";
import { useSellerAuth } from "../auth/authDomainHooks.js";
import useStoredBoolean from "../hooks/useStoredBoolean.js";
import WorkspaceSidebarBrand from "../components/workspace/WorkspaceSidebarBrand.jsx";
import ThemeToggle from "../components/admin/ThemeToggle.jsx";
import { resolveAssetUrl } from "../lib/assetUrl.js";
import {
  getSellerNotificationUnreadCount,
  getSellerNotifications,
  markAllSellerNotificationsRead,
  markSellerNotificationRead,
} from "../api/sellerNotifications.ts";

const SELLER_SIDEBAR_COLLAPSED_KEY = "seller_sidebar_collapsed";
const SELLER_THEME_KEY = "seller_theme";
const SELLER_LANGUAGE_KEY = "seller_language";
const SELLER_HEADER_LANGUAGES = [
  { isoCode: "en", label: "US English" },
  { isoCode: "id", label: "ID Indonesia" },
];

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const joinClassNames = (...items) => items.filter(Boolean).join(" ");

const readStoredSellerTheme = () => {
  if (typeof window === "undefined") return "light";
  const value = String(window.localStorage.getItem(SELLER_THEME_KEY) || "").trim();
  return value === "dark" ? "dark" : "light";
};

const readStoredSellerLanguage = () => {
  if (typeof window === "undefined") return SELLER_HEADER_LANGUAGES[0];
  try {
    const raw = JSON.parse(window.localStorage.getItem(SELLER_LANGUAGE_KEY) || "null");
    const isoCode = String(raw?.isoCode || "").trim().toLowerCase();
    return (
      SELLER_HEADER_LANGUAGES.find((item) => item.isoCode === isoCode) ||
      SELLER_HEADER_LANGUAGES[0]
    );
  } catch {
    return SELLER_HEADER_LANGUAGES[0];
  }
};

const persistSellerLanguage = (value) => {
  if (typeof window === "undefined" || !value) return;
  window.localStorage.setItem(
    SELLER_LANGUAGE_KEY,
    JSON.stringify({
      isoCode: value.isoCode,
      label: value.label,
    })
  );
};

const getSellerIdentityInitials = (sellerContext) => {
  const source = String(
    sellerContext?.store?.name ||
      sellerContext?.store?.slug ||
      sellerContext?.access?.roleCode ||
      "S"
  ).trim();
  if (!source) return "S";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const formatSellerNotificationTime = (value) => {
  if (!value) return "";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "";
  return timestamp.toLocaleString("en-SG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getSellerNotificationLabel = (notification) => {
  const actionCode = String(notification?.meta?.actionCode || notification?.type || "")
    .trim()
    .toUpperCase();
  if (actionCode === "SELLER_SUBORDER_CREATED") return "New suborder";
  if (actionCode === "SELLER_PAYMENT_REVIEW_REQUIRED") return "Needs review";
  if (actionCode === "SELLER_PAYMENT_FAILED") return "Payment failed";
  return "Seller update";
};

const resolveSellerNotificationRoute = (notification, sellerRoutes) => {
  const meta = notification?.meta && typeof notification.meta === "object" ? notification.meta : {};
  const directRoute = String(meta.route || "").trim();
  if (directRoute) return directRoute;

  const actionCode = String(meta.actionCode || notification?.type || "")
    .trim()
    .toUpperCase();
  const suborderId = Number(meta.suborderId || 0);
  if (
    ["SELLER_SUBORDER_CREATED", "SELLER_PAYMENT_FAILED"].includes(actionCode) &&
    Number.isFinite(suborderId) &&
    suborderId > 0
  ) {
    return sellerRoutes.orderDetail(suborderId);
  }
  if (actionCode === "SELLER_PAYMENT_REVIEW_REQUIRED") {
    return sellerRoutes.paymentReview();
  }
  return null;
};

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

  if (pathname.endsWith("/catalog/products/new")) {
    return {
      title: "New Product",
      subtitle: "Seller draft authoring lane scoped to the active store.",
    };
  }

  if (pathname.endsWith("/edit")) {
    return {
      title: "Edit Product Draft",
      subtitle: "Seller draft editing lane scoped to the active store.",
    };
  }

  if (pathname.includes("/catalog/products/")) {
    return {
      title: "Product Detail",
      subtitle: "Seller-facing catalog detail scoped to this store.",
    };
  }

  if (pathname.endsWith("/catalog/products")) {
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

  if (pathname.endsWith("/coupons")) {
    return {
      title: "Coupons",
      subtitle: "Store-scoped coupon management for the active seller store.",
    };
  }

  if (pathname.endsWith("/store-profile") || pathname.endsWith("/profile")) {
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
    <div className={`${sellerShellPageClass} px-4 py-6 sm:px-6`}>
      <div className="mx-auto max-w-4xl">
        <SellerWorkspacePanel className={`${toneClass} px-4 py-5 sm:px-5`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">
            Seller Workspace
          </p>
          <h1 className="mt-2.5 text-[1.8rem] font-semibold text-slate-950">{title}</h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-5 text-slate-600">{description}</p>
          {children ? <div className="mt-5">{children}</div> : null}
        </SellerWorkspacePanel>
      </div>
    </div>
  );
}

function SellerNotificationsMenu({
  open = false,
  onToggle,
  containerRef,
  unreadCount = 0,
  items = [],
  isLoading = false,
  isDark = false,
  onItemClick,
  onMarkAllRead,
  isMarkingAllRead = false,
}) {
  return (
    <div className="navbar__notify" ref={containerRef}>
      <button
        type="button"
        className="navbar__icon navbar__icon--notify"
        aria-label="Seller notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Bell size={18} />
        {unreadCount > 0 ? <span className="navbar__badge">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="navbar__notify-menu" role="menu">
          <div className="navbar__notify-head">
            <p>Seller Notifications</p>
            <div className="flex items-center gap-2">
              <span>{unreadCount} unread</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  disabled={isMarkingAllRead}
                  className="rounded-full border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-emerald-300 dark:hover:bg-slate-800"
                >
                  Read all
                </button>
              ) : null}
            </div>
          </div>
          {isLoading && items.length === 0 ? (
            <p className="navbar__notify-empty">Loading seller notifications...</p>
          ) : items.length === 0 ? (
            <p className="navbar__notify-empty">
              No seller notifications yet for this workspace.
            </p>
          ) : (
            <div className="navbar__notify-list">
              {items.map((notification) => {
                const meta =
                  notification?.meta && typeof notification.meta === "object"
                    ? notification.meta
                    : {};
                const message = String(meta.message || "").trim();
                const timeLabel = formatSellerNotificationTime(notification?.createdAt);
                const badgeLabel = getSellerNotificationLabel(notification);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    role="menuitem"
                    className={`navbar__notify-item ${notification?.isRead ? "" : "is-unread"} w-full text-left`}
                    onClick={() => onItemClick?.(notification)}
                  >
                    <span
                      className={`navbar__notify-dot mt-1.5 ${
                        notification?.isRead ? "opacity-30" : ""
                      }`}
                      aria-hidden="true"
                    />
                    <div className="navbar__notify-main">
                      <p className="navbar__notify-title">{notification?.title || "Seller notification"}</p>
                      {message ? (
                        <p
                          className={joinClassNames(
                            "mt-1 text-[11px] leading-5",
                            isDark ? "text-slate-400" : "text-slate-500"
                          )}
                        >
                          {message}
                        </p>
                      ) : null}
                      <div className="navbar__notify-meta">
                        <span className="navbar__notify-label">{badgeLabel}</span>
                        {timeLabel ? <span className="navbar__notify-time">{timeLabel}</span> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SellerProfileMenu({
  open = false,
  onToggle,
  onClose,
  containerRef,
  sellerContext,
  sellerRoutes,
  onLogout,
}) {
  const navigate = useNavigate();
  const initials = useMemo(() => getSellerIdentityInitials(sellerContext), [sellerContext]);
  const logoUrl = resolveAssetUrl(
    sellerContext?.store?.logoUrl || sellerContext?.store?.imageUrl || ""
  );

  const goto = (path) => {
    onClose?.();
    navigate(path);
  };

  const handleLogout = async () => {
    onClose?.();
    await onLogout?.();
  };

  return (
    <div className="navbar__profile" ref={containerRef}>
      <button
        type="button"
        className="navbar__avatar navbar__avatar--button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Seller profile menu"
        title={sellerContext?.store?.name || "Seller profile menu"}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={sellerContext?.store?.name || "Seller store"}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </button>

      {open ? (
        <div className="navbar__profile-menu" role="menu">
          <button
            type="button"
            className="navbar__profile-item"
            onClick={() => goto(sellerRoutes.home())}
            role="menuitem"
          >
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className="navbar__profile-item"
            onClick={() => goto(sellerRoutes.storeProfile())}
            role="menuitem"
          >
            <UserRound size={14} />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            className="navbar__profile-item navbar__profile-item--danger"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SellerSidebar({
  storeSlug,
  sellerContext,
  collapsed = false,
  isDark = false,
  onLogout,
}) {
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const hasPermission = (permissionKey) => permissionKeys.includes(permissionKey);
  const sellerRoutes = createSellerWorkspaceRoutes(storeSlug);
  const location = useLocation();
  const pathname = location.pathname;
  const shippingSetupStatus = sellerContext?.store?.shippingSetupStatus || null;
  const shippingSetupMeta = sellerContext?.store?.shippingSetupMeta || null;

  const normalizeActivePath = (to) => String(to || "").split("#")[0].split("?")[0];
  const isPathActive = (to) =>
    pathname === normalizeActivePath(to) ||
    (normalizeActivePath(to) !== sellerRoutes.home() &&
      pathname.startsWith(`${normalizeActivePath(to)}/`));

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
        },
        {
          label: "Store Profile",
          to: sellerRoutes.storeProfile(),
          Icon: Store,
          enabled: hasPermission("STORE_VIEW"),
          implemented: true,
        },
        {
          label: "Shipping Setup",
          to: sellerRoutes.shippingSetup(),
          Icon: Truck,
          enabled: hasPermission("STORE_VIEW"),
          implemented: true,
          meta: shippingSetupMeta?.message || "Origin & readiness",
          badge: shippingSetupStatus
            ? {
                label: shippingSetupStatus.label || "Unavailable",
                tone: shippingSetupStatus.tone || "stone",
              }
            : null,
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
          children: [
            {
              label: "Products",
              to: sellerRoutes.catalog(),
            },
            {
              label: "Coupons",
              to: sellerRoutes.coupons(),
            },
          ],
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
        },
        {
          label: "Payment Setup",
          to: sellerRoutes.paymentProfile(),
          Icon: CreditCard,
          enabled: hasPermission("PAYMENT_PROFILE_VIEW"),
          implemented: true,
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
        },
        {
          label: "Team Audit",
          to: sellerRoutes.teamAudit(),
          Icon: History,
          enabled: hasPermission("AUDIT_LOG_VIEW"),
          implemented: true,
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
    <aside
      className={joinClassNames(
        "flex w-full flex-col transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:self-start lg:overflow-hidden",
        isDark ? "border-r border-slate-800 bg-slate-950" : "border-r border-slate-200 bg-white",
        collapsed ? "lg:w-[94px]" : "lg:w-[266px]"
      )}
    >
      <div
        className={joinClassNames(
          "border-b py-4",
          isDark ? "border-slate-800" : "border-slate-100",
          collapsed ? "px-3" : "px-4"
        )}
      >
        <WorkspaceSidebarBrand
          brandName="TP PRENEURS"
          workspaceLabel="Seller Workspace"
          workspaceKey="seller"
          collapsed={collapsed}
        />
        {collapsed ? (
          <div
            className="mt-3 flex justify-center"
            title={sellerContext?.store?.name || "Seller Workspace"}
          >
            <div
              className={joinClassNames(
                "flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold",
                isDark
                  ? "border-slate-700 bg-slate-900 text-slate-100"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              {(sellerContext?.store?.name || "S").trim().charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <div
            className={joinClassNames(
              "mt-3 rounded-xl border px-3 py-3",
              isDark
                ? "border-slate-700 bg-slate-900"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <p
              className={joinClassNames(
                "text-xs font-semibold uppercase tracking-wide",
                isDark ? "text-slate-400" : "text-slate-500"
              )}
            >
              Active Store
            </p>
            <p
              className={joinClassNames(
                "mt-2 truncate text-sm font-semibold",
                isDark ? "text-slate-50" : "text-slate-900"
              )}
            >
              {sellerContext?.store?.name || "Seller Workspace"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SellerWorkspaceBadge label={sellerContext?.store?.slug || "store"} />
              <SellerWorkspaceBadge
                label={sellerContext?.store?.status || "ACTIVE"}
                tone="emerald"
              />
              {shippingSetupStatus ? (
                <SellerWorkspaceBadge
                  label={`Shipping ${shippingSetupStatus.label || "Unavailable"}`}
                  tone={shippingSetupStatus.tone || "stone"}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      <nav
        className={joinClassNames(
          "flex-1 space-y-3 overflow-y-auto py-3.5",
          collapsed ? "px-2" : "px-3"
        )}
        aria-label="Seller sidebar"
      >
        {navSections.map((section) => (
          <div key={section.title}>
            {collapsed ? null : (
              <p
                className={joinClassNames(
                  "mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  isDark ? "text-slate-400" : "text-slate-400"
                )}
              >
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) =>
                item.implemented ? (
                  item.children?.length && !collapsed ? (
                    <div key={item.label} className="space-y-1">
                      <div
                        className={joinClassNames(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                          item.children.some((child) => isPathActive(child.to))
                            ? isDark
                              ? "bg-[#052e25] text-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                              : "bg-emerald-50 text-teal-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
                            : isDark
                              ? "text-slate-100"
                              : "text-slate-600"
                        )}
                      >
                        <span
                          className={joinClassNames(
                            "absolute inset-y-1.5 left-0 w-[3px] rounded-full",
                            item.children.some((child) => isPathActive(child.to))
                              ? "bg-emerald-500"
                              : "bg-transparent"
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={joinClassNames(
                            "flex h-8 w-8 items-center justify-center rounded-xl transition",
                            item.children.some((child) => isPathActive(child.to))
                              ? isDark
                                ? "bg-emerald-950 text-emerald-200"
                                : "bg-emerald-100 text-emerald-700"
                              : isDark
                                ? "bg-slate-800 text-slate-200"
                                : "bg-slate-100 text-slate-500"
                          )}
                        >
                          <item.Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={joinClassNames(
                              "block truncate font-semibold",
                              item.children.some((child) => isPathActive(child.to))
                                ? isDark
                                  ? "!text-white"
                                  : "text-teal-700"
                                : isDark
                                  ? "!text-slate-100"
                                  : "text-slate-700"
                            )}
                          >
                            {item.label}
                          </span>
                        </span>
                        <ChevronRight
                          className={joinClassNames(
                            "h-4 w-4 transition",
                            item.children.some((child) => isPathActive(child.to))
                              ? isDark
                                ? "rotate-90 text-emerald-200"
                                : "rotate-90 text-emerald-600"
                              : isDark
                                ? "text-slate-400"
                                : "text-slate-300"
                          )}
                        />
                      </div>

                      <div
                        className={joinClassNames(
                          "ml-[2.9rem] space-y-1 border-l pl-3",
                          isDark ? "border-slate-800" : "border-slate-200"
                        )}
                      >
                        {item.children.map((child) => (
                          <NavLink
                            key={child.label}
                            to={child.to}
                            end={child.to === sellerRoutes.catalog()}
                            className={({ isActive }) =>
                              joinClassNames(
                                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                                isActive
                                  ? isDark
                                    ? "bg-[#052e25] font-semibold text-white"
                                    : "bg-emerald-50 font-semibold text-teal-700"
                                  : isDark
                                    ? "text-slate-200 hover:bg-slate-800 hover:text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={joinClassNames(
                                    "h-1.5 w-1.5 rounded-full",
                                    isActive
                                      ? "bg-emerald-300"
                                      : isDark
                                        ? "bg-slate-400"
                                        : "bg-slate-300"
                                  )}
                                  aria-hidden="true"
                                />
                                <span
                                  className={joinClassNames(
                                    "truncate",
                                    isActive
                                      ? isDark
                                        ? "!text-white"
                                        : "text-teal-700"
                                      : isDark
                                        ? "!text-slate-200"
                                        : "text-slate-700"
                                  )}
                                >
                                  {child.label}
                                </span>
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.to === sellerRoutes.home() || item.to === sellerRoutes.catalog()}
                      title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          joinClassNames(
                            "group relative flex items-center rounded-xl py-2 text-sm transition",
                            collapsed ? "justify-center px-2" : "gap-3 px-3",
                            isActive
                              ? isDark
                              ? "bg-[#052e25] text-white shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]"
                              : "bg-emerald-50 text-teal-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
                            : isDark
                              ? "text-slate-100 hover:bg-slate-800 hover:text-white"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          )
                        }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={joinClassNames(
                              "absolute inset-y-1.5 left-0 w-[3px] rounded-full",
                              isActive ? "bg-emerald-500" : "bg-transparent"
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={joinClassNames(
                              "flex h-8 w-8 items-center justify-center rounded-xl transition",
                              isActive
                                ? isDark
                                  ? "bg-emerald-950 text-emerald-200"
                                  : "bg-emerald-100 text-emerald-700"
                                : isDark
                                  ? "bg-slate-800 text-slate-200 group-hover:bg-slate-700 group-hover:text-white"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700"
                            )}
                          >
                            <item.Icon className="h-[18px] w-[18px]" />
                          </span>
                          {collapsed ? null : (
                            <>
                              <span className="min-w-0 flex-1">
                                <span
                                  className={joinClassNames(
                                    "block truncate font-semibold",
                                    isActive
                                      ? isDark
                                        ? "!text-white"
                                        : "text-teal-700"
                                      : isDark
                                        ? "!text-slate-100"
                                        : "text-slate-700"
                                  )}
                                  >
                                    {item.label}
                                  </span>
                                  {item.badge ? (
                                    <span className="mt-1 block">
                                      <SellerWorkspaceBadge
                                        label={item.badge.label}
                                        tone={item.badge.tone}
                                      />
                                    </span>
                                  ) : null}
                                {item.meta ? (
                                  <span
                                    className={joinClassNames(
                                      "block truncate text-xs",
                                      isDark ? "text-slate-400" : "text-slate-400"
                                    )}
                                  >
                                    {item.meta}
                                  </span>
                                ) : null}
                              </span>
                              <ChevronRight
                                className={joinClassNames(
                                  "h-4 w-4 transition",
                                  isActive
                                    ? isDark
                                      ? "text-emerald-200"
                                      : "text-emerald-600"
                                    : isDark
                                      ? "text-slate-400"
                                      : "text-slate-300"
                                )}
                              />
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                ) : (
                  <div
                    key={item.label}
                    title={collapsed ? item.label : undefined}
                    className={joinClassNames(
                      "rounded-xl border border-dashed py-2",
                      isDark
                        ? "border-slate-700 bg-slate-900 text-slate-400"
                        : "border-slate-200 bg-slate-50 text-slate-500",
                      collapsed
                        ? "flex items-center justify-center px-2"
                        : "flex items-center gap-3 px-3"
                    )}
                  >
                    <span
                      className={joinClassNames(
                        "flex h-8 w-8 items-center justify-center rounded-xl",
                        isDark ? "bg-slate-800 text-slate-500" : "bg-white text-slate-400"
                      )}
                    >
                      <item.Icon className="h-[18px] w-[18px]" />
                    </span>
                    {collapsed ? null : (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.label}</span>
                          {item.meta ? (
                            <span className="block truncate text-xs text-slate-400">{item.meta}</span>
                          ) : null}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Soon
                        </span>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={joinClassNames(
          "mt-auto border-t py-3.5",
          isDark ? "border-slate-800" : "border-slate-100",
          collapsed ? "px-3" : "px-4"
        )}
      >
        <button
          type="button"
          onClick={() => void onLogout?.()}
          title={collapsed ? "Log Out" : undefined}
          className={joinClassNames(
            "inline-flex w-full items-center justify-center rounded-xl border text-sm font-semibold transition",
            collapsed ? "h-11 px-0" : "h-12 gap-2.5 px-4",
            isDark
              ? "border-emerald-900 bg-[#052e25] text-emerald-200 hover:bg-[#064e3b]"
              : "border-emerald-600 bg-emerald-500 text-white hover:bg-emerald-600"
          )}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {collapsed ? null : <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default function SellerLayout() {
  const { storeSlug } = useParams();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sellerAuth = useSellerAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useStoredBoolean(
    SELLER_SIDEBAR_COLLAPSED_KEY,
    false
  );
  const [theme, setTheme] = useState(readStoredSellerTheme);
  const [selectedLanguage, setSelectedLanguage] = useState(readStoredSellerLanguage);
  const [langOpen, setLangOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const langDropdownRef = useRef(null);
  const notifyDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
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
    enabled: Boolean(normalizedStoreSlug) && !sellerAuth.isLoading,
    retry: false,
  });

  const sellerContext = sellerContextQuery.data;
  const canonicalStoreSlug =
    normalizeSellerStoreParam(sellerContext?.store?.slug) || normalizedStoreSlug;
  const canonicalStoreId = Number(sellerContext?.store?.id || 0) || null;
  const pageMeta = getSellerPageMeta(pathname);
  const sellerRoutes = createSellerWorkspaceRoutes(canonicalStoreSlug);
  const chipText = (selectedLanguage?.label || SELLER_HEADER_LANGUAGES[0].label).toUpperCase();
  const isDark = theme === "dark";
  const sellerNotificationCountQuery = useQuery({
    queryKey: ["seller", "notifications", canonicalStoreId, "count"],
    queryFn: () => getSellerNotificationUnreadCount(canonicalStoreId),
    enabled: Boolean(canonicalStoreId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const sellerNotificationsQuery = useQuery({
    queryKey: ["seller", "notifications", canonicalStoreId, "list"],
    queryFn: () => getSellerNotifications(canonicalStoreId, { limit: 8 }),
    enabled: Boolean(canonicalStoreId) && activeMenu === "notify",
    refetchInterval: activeMenu === "notify" ? 15_000 : false,
    refetchOnWindowFocus: true,
  });
  const markSellerNotificationReadMutation = useMutation({
    mutationFn: (notificationId) => markSellerNotificationRead(canonicalStoreId, notificationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["seller", "notifications", canonicalStoreId, "count"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "notifications", canonicalStoreId, "list"],
        }),
      ]);
    },
  });
  const markAllSellerNotificationsReadMutation = useMutation({
    mutationFn: () => markAllSellerNotificationsRead(canonicalStoreId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["seller", "notifications", canonicalStoreId, "count"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["seller", "notifications", canonicalStoreId, "list"],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SELLER_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    persistSellerLanguage(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    if (!langOpen) return undefined;
    const onMouseDown = (event) => {
      if (!langDropdownRef.current?.contains(event.target)) {
        setLangOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [langOpen]);

  useEffect(() => {
    if (!activeMenu) return undefined;
    const onMouseDown = (event) => {
      const targetRef =
        activeMenu === "notify"
          ? notifyDropdownRef
          : activeMenu === "profile"
            ? profileDropdownRef
            : null;
      if (targetRef?.current && !targetRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenu]);

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
        description={
          sellerAuth.isLoading
            ? "Checking shared session and seller workspace access."
            : "Resolving store context and seller access from the backend."
        }
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
          description={
            sellerAuth.isAdminSession
              ? "This current session is admin-oriented. Sign in with a storefront account that already has seller workspace access for this store."
              : "Sign in with a storefront account that already has seller workspace access for this store."
          }
          tone="danger"
        >
          <div className="flex flex-wrap gap-3">
            <Link
              to="/auth/login"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Storefront Login
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
        >
          {sellerAuth.isAdminSession ? (
            <p className="text-sm leading-5 text-slate-600">
              Admin session remains valid for admin workspace only. Seller workspace requires a
              storefront account with seller membership on this store.
            </p>
          ) : null}
        </SellerShellState>
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

  const handleLanguageSelect = (language) => {
    setSelectedLanguage(language);
    persistSellerLanguage(language);
    setLangOpen(false);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const toggleMenu = (menuName) => {
    setLangOpen(false);
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleSellerLogout = async () => {
    await sellerAuth.logout?.();
    navigate("/auth/login", { replace: true });
  };

  const handleSellerNotificationClick = async (notification) => {
    const notificationId = Number(notification?.id || 0);
    const nextRoute = resolveSellerNotificationRoute(notification, sellerRoutes);

    if (notificationId > 0 && !notification?.isRead) {
      try {
        await markSellerNotificationReadMutation.mutateAsync(notificationId);
      } catch {
        // keep navigation usable even if mark-read fails
      }
    }

    setActiveMenu(null);
    if (nextRoute) {
      navigate(nextRoute);
    }
  };

  const handleMarkAllSellerNotificationsRead = async () => {
    try {
      await markAllSellerNotificationsReadMutation.mutateAsync();
    } catch {
      // keep dropdown stable; unread count will refresh on next poll
    }
  };

  return (
    <div
      className={`layout ${sellerShellPageClass} ${
        isDark ? "admin-theme-dark dark" : "admin-theme-light"
      }`}
      data-seller-theme={theme}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      <SellerSidebar
        storeSlug={canonicalStoreSlug}
        sellerContext={sellerContext}
        collapsed={sidebarCollapsed}
        isDark={isDark}
        onLogout={handleSellerLogout}
      />

      <div className={`layout__content min-w-0 flex-1 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
        <header className="navbar">
          <div className="navbar__left">
            <button
              className={`navbar__menu ${sidebarCollapsed ? "is-active" : ""}`}
              aria-label={sidebarCollapsed ? "Expand seller sidebar" : "Collapse seller sidebar"}
              aria-pressed={sidebarCollapsed}
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              <Menu className="navbar__menu-icon" />
            </button>
            <div className="navbar__title-block">
              <p className="navbar__eyebrow">Seller Workspace</p>
              <p className="navbar__page-title">{pageMeta.title}</p>
            </div>
            <div className="navbar__search-shell" role="search" aria-label="Seller search">
              <Search size={16} className="navbar__search-icon" />
              <input
                type="search"
                value=""
                readOnly
                tabIndex={-1}
                aria-label="Seller search placeholder"
                placeholder={`Search inside ${pageMeta.title.toLowerCase()}...`}
                className="navbar__search-input"
              />
            </div>
          </div>
          <div className="navbar__actions">
            <div className="navbar__cluster">
              <div className="navbar__lang-wrap" ref={langDropdownRef}>
                <button
                  className={`navbar__lang ${langOpen ? "is-open" : ""}`}
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    setLangOpen((prev) => !prev);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={langOpen}
                >
                  <span className="navbar__lang-text">{chipText}</span>
                  <ChevronDown className="navbar__lang-caret" />
                </button>
                {langOpen ? (
                  <div className="navbar__lang-menu" role="menu">
                    {SELLER_HEADER_LANGUAGES.map((language) => {
                      const isSelected = selectedLanguage?.isoCode === language.isoCode;
                      return (
                        <button
                          key={language.isoCode}
                          type="button"
                          role="menuitem"
                          className={`navbar__lang-item ${isSelected ? "is-selected" : ""}`}
                          onClick={() => handleLanguageSelect(language)}
                        >
                          <span className="navbar__lang-item-main">
                            {language.label.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
              <SellerNotificationsMenu
                open={activeMenu === "notify"}
                onToggle={() => toggleMenu("notify")}
                containerRef={notifyDropdownRef}
                unreadCount={Number(sellerNotificationCountQuery.data?.count || 0)}
                items={sellerNotificationsQuery.data?.items || []}
                isLoading={sellerNotificationsQuery.isLoading}
                isDark={isDark}
                onItemClick={handleSellerNotificationClick}
                onMarkAllRead={handleMarkAllSellerNotificationsRead}
                isMarkingAllRead={markAllSellerNotificationsReadMutation.isPending}
              />
              <SellerProfileMenu
                open={activeMenu === "profile"}
                onToggle={() => toggleMenu("profile")}
                onClose={() => setActiveMenu(null)}
                containerRef={profileDropdownRef}
                sellerContext={sellerContext}
                sellerRoutes={sellerRoutes}
                onLogout={handleSellerLogout}
              />
            </div>
          </div>
        </header>

        <main className="w-full px-4 py-5 sm:px-6 sm:py-5">
          <div className="mx-auto w-full max-w-[1280px] space-y-4">
            <SellerWorkspacePanel
              className={joinClassNames(
                "px-4 py-3.5 sm:px-5",
                isDark
                  ? "!border-slate-800 !bg-slate-900/92 !shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]"
                  : ""
              )}
            >
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p
                    className={joinClassNames(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}
                  >
                    Workspace Context
                  </p>
                  <h1
                    className={joinClassNames(
                      "mt-1.5 text-[1.5rem] font-semibold tracking-tight",
                      isDark ? "text-slate-50" : "text-slate-900"
                    )}
                  >
                    {sellerContext?.store?.name || "Store"}
                  </h1>
                  <p
                    className={joinClassNames(
                      "mt-1 text-sm leading-5",
                      isDark ? "text-slate-300" : "text-slate-500"
                    )}
                  >
                    {pageMeta.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SellerWorkspaceBadge
                    label={sellerContext?.store?.slug || "store"}
                    className={
                      isDark ? "!border-slate-700 !bg-slate-800 !text-slate-200" : ""
                    }
                  />
                  <SellerWorkspaceBadge
                    label={canonicalStoreId ? `Store #${canonicalStoreId}` : "Store"}
                    className={
                      isDark
                        ? "!border-slate-700 !bg-slate-800 !text-slate-200"
                        : "bg-slate-50"
                    }
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

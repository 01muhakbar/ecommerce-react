import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth.js";
import { can } from "../../constants/permissions.js";
import WorkspaceSidebarBrand from "../workspace/WorkspaceSidebarBrand.jsx";
import "./Sidebar.css";

const IconGrid = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);

const IconBoxes = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M4 7l8-4 8 4-8 4-8-4Z" />
    <path d="M4 7v10l8 4 8-4V7" />
    <path d="M12 11v10" />
  </svg>
);

const IconUsers = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M4 19c0-3 3-5 6-5s6 2 6 5" />
    <path d="M14 19c0-2.2 2.2-4 5-4" />
  </svg>
);

const IconReceipt = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" />
    <path d="M9 7h6M9 11h6M9 15h4" />
  </svg>
);

const IconStaff = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const IconSettings = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
    <path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.6-2-3.4-2.4.7a8 8 0 0 0-1.7-1l-.4-2.5H10l-.4 2.5a8 8 0 0 0-1.7 1l-2.4-.7-2 3.4 2 1.6a7.9 7.9 0 0 0 .1 2l-2 1.6 2 3.4 2.4-.7a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4.7 2-3.4-2-1.6Z" />
  </svg>
);

const IconGlobe = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9Z" />
  </svg>
);

const IconStore = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M4 7h16l-1.5 5H5.5L4 7Z" />
    <path d="M6 12v8h12v-8" />
    <path d="M9 12v8M15 12v8" />
  </svg>
);

const ChevronDown = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path
      d="M7 10l5 5 5-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconLogout = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
    <path d="M14 17l5-5-5-5" />
    <path d="M9 12h10" />
  </svg>
);

const MENU = [
  {
    section: "Overview",
    label: "Dashboard",
    to: "/admin",
    icon: IconGrid,
    perm: "DASHBOARD_VIEW",
  },
  {
    section: "Commerce",
    label: "Catalog",
    icon: IconBoxes,
    hasCaret: true,
    children: [
      { label: "Products", to: "/admin/catalog/products", perm: "PRODUCTS_VIEW" },
      { label: "Categories", to: "/admin/catalog/categories", perm: "CATEGORIES_CRUD" },
      { label: "Attributes", to: "/admin/catalog/attributes", perm: "ATTRIBUTES_CRUD" },
      { label: "Coupons", to: "/admin/catalog/coupons", perm: "COUPONS_CRUD" },
    ],
  },
  {
    section: "Commerce",
    label: "Customers",
    to: "/admin/customers",
    icon: IconUsers,
    perm: "CUSTOMERS_VIEW",
  },
  {
    section: "Commerce",
    label: "Orders",
    to: "/admin/orders",
    icon: IconReceipt,
    perm: "ORDERS_VIEW",
  },
  {
    section: "Workspace",
    label: "Our Staff",
    to: "/admin/our-staff",
    icon: IconStaff,
    perm: "STAFF_MANAGE",
  },
  {
    section: "Workspace",
    label: "Settings",
    to: "/admin/settings",
    icon: IconSettings,
    perm: "SETTINGS_MANAGE",
  },
  {
    section: "Workspace",
    label: "International",
    icon: IconGlobe,
    hasCaret: true,
    children: [
      { label: "Languages", to: "/admin/international/languages", perm: "SETTINGS_MANAGE" },
      { label: "Currencies", to: "/admin/international/currencies", perm: "SETTINGS_MANAGE" },
    ],
  },
  {
    section: "Workspace",
    label: "Online Store",
    icon: IconStore,
    hasCaret: true,
    children: [
      { label: "View Store", to: "/", perm: "DASHBOARD_VIEW" },
      {
        label: "Store Customization",
        to: "/admin/store/customization",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Profile",
        to: "/admin/online-store/store-profile",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Settings",
        to: "/admin/store/store-settings",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Payment",
        to: "/admin/online-store/store-payment",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Payment Review",
        to: "/admin/online-store/payment-review",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Payment Audit",
        to: "/admin/online-store/payment-audit",
        perm: "DASHBOARD_VIEW",
      },
      {
        label: "Payment Profiles",
        to: "/admin/store/payment-profiles",
        perm: "SETTINGS_MANAGE",
      },
      {
        label: "Store Applications",
        to: "/admin/store/applications",
        perm: "STORE_APPLICATIONS_REVIEW",
      },
    ],
  },
];

const matchesRoute = (targetPath, currentPath) => {
  if (!targetPath) return false;
  if (targetPath === currentPath) return true;
  if (targetPath === "/") return currentPath === "/";
  return currentPath.startsWith(`${targetPath}/`);
};

export default function Sidebar({ collapsed = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [openMenus, setOpenMenus] = useState({
    Catalog: true,
    International:
      pathname.startsWith("/admin/international/languages") ||
      pathname.startsWith("/admin/international/currencies") ||
      pathname.startsWith("/admin/languages") ||
      pathname.startsWith("/admin/currencies"),
    "Online Store":
      pathname.startsWith("/admin/online-store/") ||
      pathname.startsWith("/admin/store/") ||
      pathname.startsWith("/admin/store-customization") ||
      pathname.startsWith("/admin/store-settings") ||
      pathname.startsWith("/admin/store/payment-profiles"),
  });

  useEffect(() => {
    if (
      pathname.startsWith("/admin/international/languages") ||
      pathname.startsWith("/admin/international/currencies") ||
      pathname.startsWith("/admin/languages") ||
      pathname.startsWith("/admin/currencies")
    ) {
      setOpenMenus((prev) =>
        prev.International ? prev : { ...prev, International: true }
      );
    }
  }, [pathname]);

  useEffect(() => {
    if (
      pathname.startsWith("/admin/online-store/") ||
      pathname.startsWith("/admin/store/") ||
      pathname.startsWith("/admin/store-customization") ||
      pathname.startsWith("/admin/store-settings") ||
      pathname.startsWith("/admin/store/payment-profiles")
    ) {
      setOpenMenus((prev) =>
        prev["Online Store"] ? prev : { ...prev, "Online Store": true }
      );
    }
  }, [pathname]);

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleLogout = async () => {
    await logout?.();
    queryClient.removeQueries({ queryKey: ["admin", "me"], exact: true });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
    navigate("/admin/login", { replace: true });
  };

  const allowedMenu = MENU.map((item) => {
    if (!item.children) {
      return item.perm ? (can(user, item.perm) ? item : null) : item;
    }
    const children = item.children.filter((child) =>
      child.perm ? can(user, child.perm) : true
    );
    if (children.length === 0) {
      return null;
    }
    return { ...item, children };
  }).filter(Boolean);

  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar__brand">
        <WorkspaceSidebarBrand
          brandName="TP PRENEURS"
          workspaceLabel="Admin Workspace"
          workspaceKey="admin"
          collapsed={collapsed}
        />
      </div>

      <nav className="sidebar__menu" aria-label="Sidebar">
        {allowedMenu.map((item, index) => {
          const hasChildren = Array.isArray(item.children);
          const isOpen = !!openMenus[item.label];
          const canToggle = item.hasCaret && hasChildren;
          const hasActiveChild = hasChildren
            ? item.children.some((child) => matchesRoute(child.to, pathname))
            : false;
          const showSectionTitle =
            index === 0 || allowedMenu[index - 1]?.section !== item.section;

          return (
            <div key={item.label} className="sidebar__group">
              {showSectionTitle ? (
                <p className="sidebar__section-title">{item.section}</p>
              ) : null}
              {item.to && !hasChildren ? (
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "is-active" : ""}`
                  }
                >
                  <span className="sidebar__icon">
                    <item.icon className="sidebar__icon-svg" />
                  </span>
                  <span className="sidebar__label">{item.label}</span>
                </NavLink>
              ) : (
                <button
                  type="button"
                  className={`sidebar__link sidebar__link--button ${
                    canToggle && isOpen ? "is-open" : ""
                  } ${hasActiveChild ? "is-current" : ""}`}
                  onClick={canToggle ? () => toggleMenu(item.label) : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar__icon">
                    <item.icon className="sidebar__icon-svg" />
                  </span>
                  <span className="sidebar__label">{item.label}</span>

                  {item.hasCaret ? (
                    <span className="sidebar__caret" aria-hidden="true">
                      <ChevronDown className="sidebar__caret-svg" />
                    </span>
                  ) : null}
                </button>
              )}

              {hasChildren && isOpen ? (
                <div
                  className={`sidebar__submenu ${
                    collapsed ? "sidebar__submenu--floating" : ""
                  }`}
                  role="group"
                >
                  {item.children.length === 0 ? (
                    <button
                      type="button"
                      className="sidebar__sublink"
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="sidebar__subdot" aria-hidden="true" />
                      <span className="sidebar__label">No items</span>
                    </button>
                  ) : (
                    item.children.map((child) =>
                      child.to ? (
                        <NavLink
                          key={`${item.label}-${child.label}`}
                          to={child.to}
                          title={collapsed ? child.label : undefined}
                          className={({ isActive }) =>
                            `sidebar__sublink ${isActive ? "is-active" : ""}`
                          }
                        >
                          <span className="sidebar__subdot" aria-hidden="true" />
                          <span className="sidebar__label">{child.label}</span>
                        </NavLink>
                      ) : (
                        <button
                          key={`${item.label}-${child.label}`}
                          type="button"
                          className="sidebar__sublink"
                          title={collapsed ? child.label : undefined}
                        >
                          <span className="sidebar__subdot" aria-hidden="true" />
                          <span className="sidebar__label">{child.label}</span>
                        </button>
                      )
                    )
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__logout"
          onClick={handleLogout}
          title={collapsed ? "Log Out" : undefined}
        >
          <span className="sidebar__logout-icon" aria-hidden="true">
            <IconLogout className="sidebar__icon-svg" />
          </span>
          <span className="sidebar__logout-label">Log Out</span>
        </button>
      </div>
    </aside>
  );
}

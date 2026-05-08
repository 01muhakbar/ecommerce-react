import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/useAuth.js";
import WorkspaceSidebarBrand from "../workspace/WorkspaceSidebarBrand.jsx";
import { getAllowedAdminNavigation, matchesRoute } from "./adminNavigation.jsx";
import "./Sidebar.css";

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

export default function Sidebar({ collapsed = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [openMenus, setOpenMenus] = useState({
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

  const allowedMenu = getAllowedAdminNavigation(user);

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
          const isDisabled = item.disabled === true;
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
              {item.to && !hasChildren && !isDisabled ? (
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
              ) : hasChildren ? (
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
              ) : (
                <div
                  className="sidebar__link is-disabled"
                  title={collapsed ? item.label : "Coming soon"}
                  aria-disabled="true"
                >
                  <span className="sidebar__icon">
                    <item.icon className="sidebar__icon-svg" />
                  </span>
                  <span className="sidebar__label">{item.label}</span>
                </div>
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

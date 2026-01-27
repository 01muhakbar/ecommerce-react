import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import "./Sidebar.css";

const BrandBagIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar__brand-svg">
    <path
      d="M7 9h10l-1 10H8L7 9Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M9 9V7a3 3 0 1 1 6 0v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

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

const IconPages = (props) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <rect x="4" y="4" width="8" height="8" rx="2" />
    <rect x="12" y="4" width="8" height="8" rx="2" />
    <rect x="4" y="12" width="8" height="8" rx="2" />
    <rect x="12" y="12" width="8" height="8" rx="2" />
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

const MENU = [
  { label: "Dashboard", to: "/admin", icon: IconGrid },
  {
    label: "Catalog",
    icon: IconBoxes,
    hasCaret: true,
    children: [
      { label: "Products", to: "/admin/products" },
      { label: "Categories" },
      { label: "Attributes" },
      { label: "Coupons" },
    ],
  },
  { label: "Customers", to: "/admin/customers", icon: IconUsers },
  { label: "Orders", to: "/admin/orders", icon: IconReceipt },
  { label: "Our Staff", icon: IconStaff },
  { label: "Settings", to: "/admin/settings", icon: IconSettings },
  {
    label: "International",
    icon: IconGlobe,
    hasCaret: true,
    children: [{ label: "Languages" }],
  },
  {
    label: "Online Store",
    icon: IconStore,
    hasCaret: true,
    children: [
      { label: "View Store" },
      { label: "Store Customization" },
      { label: "Store Settings" },
    ],
  },
  { label: "Pages", icon: IconPages, hasCaret: true, children: [] },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const [openMenus, setOpenMenus] = useState({
    Catalog: true,
    International: false,
    "Online Store": false,
    Pages: false,
  });

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-icon">
          <BrandBagIcon />
        </span>
        Dashtar
      </div>

      <nav className="sidebar__menu" aria-label="Sidebar">
        {MENU.map((item) => {
          const hasChildren = Array.isArray(item.children);
          const isOpen = !!openMenus[item.label];
          const canToggle = item.hasCaret && hasChildren;

          return (
            <div key={item.label} className="sidebar__group">
              {item.to && !hasChildren ? (
                <NavLink
                  to={item.to}
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
                  }`}
                  onClick={canToggle ? () => toggleMenu(item.label) : undefined}
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
                <div className="sidebar__submenu" role="group">
                  {item.children.length === 0 ? (
                    <button type="button" className="sidebar__sublink">
                      <span className="sidebar__subdot" aria-hidden="true" />
                      <span className="sidebar__label">No items</span>
                    </button>
                  ) : (
                    item.children.map((child) =>
                      child.to ? (
                        <NavLink
                          key={`${item.label}-${child.label}`}
                          to={child.to}
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
        <button type="button" className="sidebar__logout" onClick={() => logout?.()}>
          Log Out
        </button>
      </div>
    </aside>
  );
}

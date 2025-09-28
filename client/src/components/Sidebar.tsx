import React from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/api/auth";

// --- Icon Components ---
const DashboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
);
const CatalogIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
  </svg>
);
const OrdersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
const CustomersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const StaffIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
);
const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);
const InternationalIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
);
const OnlineStoreIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path d="M18 6h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4v4H6V6h4"></path>
        <path d="M14 6L10 2"></path>
        <path d="M10 6L6 2"></path>
    </svg>
);
const PagesIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
);
const LogoutIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

// --- Type Definitions ---
interface SidebarProps {
  isOpen: boolean;
  handleLogout: () => void;
  isLoggingOut: boolean;
}

interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

// --- Main Component ---
const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  handleLogout,
  isLoggingOut,
}) => {
  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });

  const isSuper = me?.role === "Super Admin";

  const allNavItems: NavItem[] = [
    { key: "dashboard", to: "/admin/dashboard", label: "Dashboard", icon: DashboardIcon },
    { key: "catalog", to: "/admin/catalog/products", label: "Catalog", icon: CatalogIcon },
    { key: "orders", to: "/admin/orders", label: "Orders", icon: OrdersIcon },
    { key: "customers", to: "/admin/customers", label: "Customers", icon: CustomersIcon },
    { key: "our-staff", to: "/admin/our-staff", label: "Our Staff", icon: StaffIcon },
    { key: "settings", to: "/admin/settings", label: "Settings", icon: SettingsIcon },
    { key: "international", to: "/admin/international", label: "International", icon: InternationalIcon },
    { key: "online-store", to: "/admin/online-store", label: "Online Store", icon: OnlineStoreIcon },
    { key: "pages", to: "/admin/pages", label: "Pages", icon: PagesIcon },
  ];

  const visibleNavItems = allNavItems.filter(it => isSuper || me?.routes?.includes(it.key));

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center p-3 my-1 rounded-lg transition-colors ${
      isActive
        ? "bg-teal-100 text-teal-700 font-bold"
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
    }`;

  return (
    <aside
      className={`fixed top-0 left-0 z-40 w-64 h-screen bg-white shadow-lg transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
        </div>

        <nav className="flex-grow p-4">
          <ul>
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={navLinkClasses}>
                  <item.icon
                    className="h-6 w-6 mr-3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center p-3 rounded-lg transition-colors text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            <LogoutIcon
              className="h-6 w-6 mr-3"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <span>{isLoggingOut ? "Logging out..." : "Log Out"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

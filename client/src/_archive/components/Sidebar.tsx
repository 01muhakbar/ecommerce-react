import { useEffect, useState } from "react";
// Removed unused import
import { motion } from "framer-motion";
import NavItem from "./admin/NavItem";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import {
  // ... (icons)
  DashboardIcon,
  CatalogIcon,
  OrdersIcon,
  CustomersIcon,
  StaffIcon,
  SettingsIcon,
  InternationalIcon,
  OnlineStoreIcon,
  PagesIcon,
  // LogoutIcon, // Unused
} from "./admin/Icons"; // Assuming icons are in a separate file
import { filterMenu } from "@/utils/menu";
import { isSuperAdmin } from "@/utils/role";
import { LogoutButton } from "./LogoutButton";

// --- Main Component ---
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin.sidebarCollapsed");
    if (saved) {
      setCollapsed(saved === "1");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        setCollapsed((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    localStorage.setItem("admin.sidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const me = useAuthStore.getState().user ?? null;

  const allNavItems = [
    {
      key: "dashboard",
      to: "/admin/dashboard",
      label: "Dashboard",
      icon: <DashboardIcon className="h-6 w-6" />,
    },
    {
      key: "catalog",
      to: "/admin/catalog",
      label: "Catalog",
      icon: <CatalogIcon className="h-6 w-6" />,
      children: [
        { to: "/admin/catalog/products", label: "Products" },
        { to: "/admin/catalog/categories", label: "Categories" },
        { to: "/admin/catalog/attributes", label: "Attributes" },
        { to: "/admin/catalog/coupons", label: "Coupons" },
      ],
    },
    {
      key: "orders",
      to: "/admin/orders",
      label: "Orders",
      icon: <OrdersIcon className="h-6 w-6" />,
    },
    {
      key: "customers",
      to: "/admin/customers",
      label: "Customers",
      icon: <CustomersIcon className="h-6 w-6" />,
    },
    {
      key: "our-staff",
      to: "/admin/staff",
      label: "Our Staff",
      icon: <StaffIcon className="h-6 w-6" />,
      minRole: "super admin" as const,
    },
    {
      key: "settings",
      to: "/admin/settings",
      label: "Settings",
      icon: <SettingsIcon className="h-6 w-6" />,
    },
    {
      key: "international",
      to: "/admin/international",
      label: "International",
      icon: <InternationalIcon className="h-6 w-6" />,
    },
    {
      key: "online-store",
      to: "/admin/online-store",
      label: "Online Store",
      icon: <OnlineStoreIcon className="h-6 w-6" />,
    },
    {
      key: "pages",
      to: "/admin/pages",
      label: "Pages",
      icon: <PagesIcon className="h-6 w-6" />,
    },
  ];

  const visibleNavItems = isSuperAdmin(me?.role)
    ? allNavItems
    : filterMenu(
        allNavItems as any,
        me ? { role: me.role, routes: (me as any).routes ?? [] } : undefined
      );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="fixed top-0 left-0 z-40 h-screen bg-white/70 backdrop-blur-lg shadow-lg"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b h-16">
          <motion.div
            initial={false}
            animate={{ opacity: collapsed ? 0 : 1 }}
            className="font-semibold truncate"
          >
            {!collapsed && "Admin Panel"}
          </motion.div>
          <button
            className="rounded p-2 hover:bg-gray-100 focus:outline-none focus:ring"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Toggle sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>

        <nav className="flex-grow p-2">
          {visibleNavItems.map((item: any) => (
            <div key={(item as any).key}>
              <NavItem
                to={item.to}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
              />
              {!collapsed && (item as any).children && (
                <div className="ml-8 my-2 space-y-1 border-l border-slate-200">
                  {(item as any).children.map(
                    (child: { to: string; label: string }) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `block py-1 px-4 text-sm transition-colors ${
                            isActive
                              ? "font-medium text-emerald-600"
                              : "text-slate-600 hover:text-slate-900"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-2 border-t">
          <LogoutButton />
        </div>
      </div>
    </motion.aside>
  );
}

import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { filterMenu } from "@/utils/menu";
import { isSuperAdmin } from "@/utils/role";
import LogoutButton from "@/components/auth/LogoutButton";

type Props = {
  collapsed?: boolean;
  onToggle?: () => void;
  isOverlay?: boolean;
  open?: boolean;
  onClose?: () => void;
};

const NAV = [
  { key: "dashboard", to: "/admin/dashboard", label: "Dashboard", icon: "🏷️" },
  { key: "catalog", to: "/admin/products", label: "Catalog", icon: "🧺" },
  { key: "customers", to: "/admin/customers", label: "Customers", icon: "👥" },
  { key: "orders", to: "/admin/orders", label: "Orders", icon: "🧾" },
  {
    key: "our-staff",
    to: "/admin/staff",
    label: "Our Staff",
    icon: "🧑‍💼",
    minRole: "super admin" as const,
  },
  { key: "settings", to: "/admin/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({
  collapsed = false,
  onToggle,
  isOverlay = false,
  open = false,
  onClose,
}: Props) {
  const width = collapsed ? 72 : 260;
  const me = useAuthStore((s) => s.user);
  const visibleNavItems = isSuperAdmin(me?.role)
    ? (NAV as any)
    : filterMenu(NAV as any, me ?? undefined);

  return (
    <>
      <AnimatePresence>
        {isOverlay && open && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {(isOverlay ? open : true) && (
          <motion.aside
            className={`relative z-50 pointer-events-auto border-r bg-white h-dvh flex flex-col ${
              isOverlay ? "fixed top-0 left-0" : ""
            }`}
            initial={{ x: isOverlay ? -width : 0, width }}
            animate={{ x: 0, width }}
            exit={{ x: isOverlay ? -width : 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex-grow overflow-y-auto">
              <div className="flex items-center justify-between h-14 px-3">
                {!collapsed && (
                  <span className="text-lg font-semibold text-emerald-600">
                    Dashtar
                  </span>
                )}
                <button
                  onClick={isOverlay ? onClose : onToggle}
                  className="rounded p-2 hover:bg-slate-100 focus:outline-none focus:ring"
                  aria-label="Toggle sidebar"
                >
                  ≡
                </button>
              </div>

              <nav className="mt-2">
                {visibleNavItems.map((item: any) => (
                  <NavLink
                    key={(item as any).key || item.to}
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `group mx-2 my-1 flex items-center gap-3 rounded-lg px-3 py-2
                       hover:bg-emerald-50 ${
                         isActive
                           ? "bg-emerald-50 text-emerald-600 font-medium"
                           : "text-slate-700"
                       }`
                    }
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span
                      className={`truncate transition-all ${
                        collapsed
                          ? "opacity-0 -translate-x-2 w-0"
                          : "opacity-100 translate-x-0"
                      }`}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                ))}
              </nav>
            </div>

            {/* Sticky logout button at the bottom */}
            <div className="mt-auto p-3 sticky bottom-0 bg-white pointer-events-auto border-t">
              <LogoutButton />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

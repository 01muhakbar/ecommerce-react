import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
}

export default function NavItem({ to, label, icon, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group relative mx-2 my-1 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
          isActive ? "bg-gray-100 font-medium" : "hover:bg-gray-100"
        }`
      }
    >
      <span className="shrink-0">{icon}</span>
      <motion.span
        initial={false}
        animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -8 : 0 }}
        transition={{ duration: 0.18 }}
        className={`truncate ${collapsed ? "pointer-events-none absolute" : ""}`}
        style={{ left: collapsed ? 64 : "auto" }}
      >
        {label}
      </motion.span>

      {/* Tooltip saat collapsed */}
      {collapsed && (
        <span
          role="tooltip"
          className="invisible absolute left-16 z-10 w-auto min-w-max origin-left scale-95 rounded bg-black/80 px-2 py-1 text-xs text-white opacity-0 transition-all group-hover:visible group-hover:scale-100 group-hover:opacity-100"
        >
          {label}
        </span>
      )}
    </NavLink>
  );
}

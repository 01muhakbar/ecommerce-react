import { NavLink, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { useState } from "react";
import {
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Star,
  User,
} from "lucide-react";
import { useAuth } from "../auth/useAuth.js";
import { useCartStore } from "../store/cart.store.ts";

const navItems = [
  { to: "/account", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/account/orders", label: "My Orders", Icon: ClipboardList },
  { to: "/account/my-review", label: "My Review", Icon: Star },
  { to: "/account/profile", label: "Update Profile", Icon: User },
];

const disabledItems = [{ label: "Change Password", Icon: KeyRound }];

const getInitials = (value) => {
  const text = String(value || "").trim();
  if (!text) return "U";
  if (text.includes("@")) {
    return text.split("@")[0].slice(0, 2).toUpperCase();
  }
  const parts = text.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function AccountSidebar({ user, onLogout, isLoggingOut }) {
  const displayName = user?.name || user?.fullName || "Guest User";
  const email = user?.email || "No email provided";
  const initials = getInitials(user?.name || user?.email || "User");
  return (
    <aside className="lg:sticky lg:top-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-500">
              {initials}
            </div>
            <span className="absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
        </div>

        <nav className="mt-6 flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/account"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-emerald-100 text-emerald-700 font-semibold"
                    : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700",
                ].join(" ")
              }
            >
              <item.Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {disabledItems.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 opacity-60"
            >
              <item.Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}

export default function AccountLayout() {
  const navigate = useNavigate();
  const { user } = useOutletContext() || {};
  const { logout } = useAuth() || {};
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (typeof logout === "function") {
        await logout();
      }
    } finally {
      const cart = useCartStore.getState();
      cart.reset();
      cart.setMode("guest");
      try {
        sessionStorage.removeItem("cart_remote_ok");
        sessionStorage.removeItem("pending_cart_add_consumed");
      } catch {
        // ignore storage errors
      }
      navigate("/", { replace: true });
      setIsLoggingOut(false);
    }
  };
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <AccountSidebar user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
      <main className="rounded-xl border border-slate-200 bg-white p-6">
        <Outlet context={{ user }} />
      </main>
    </section>
  );
}

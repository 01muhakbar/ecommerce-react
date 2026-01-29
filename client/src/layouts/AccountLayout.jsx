import { NavLink, Outlet, useOutletContext } from "react-router-dom";

const navItems = [
  { to: "/account", label: "Dashboard" },
  { to: "/account/orders", label: "My Orders" },
  { to: "/account/profile", label: "Update Profile" },
];

function AccountSidebar() {
  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:w-60">
      <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
        My Account
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/account"}
            className={({ isActive }) =>
              [
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default function AccountLayout() {
  const { user } = useOutletContext() || {};
  return (
    <section className="grid gap-6 md:grid-cols-[240px_1fr]">
      <AccountSidebar />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Account</h1>
            <p className="text-sm text-slate-500">
              {user?.email ? `Signed in as ${user.email}` : "Manage your details and orders."}
            </p>
          </div>
        </div>
        <Outlet context={{ user }} />
      </div>
    </section>
  );
}

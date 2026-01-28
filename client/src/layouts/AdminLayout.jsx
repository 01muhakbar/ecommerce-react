import { Link, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/axios.ts";

export default function AdminLayout() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore logout errors, still redirect
    } finally {
      qc.removeQueries({ queryKey: ["admin", "me"] });
      qc.removeQueries({ queryKey: ["auth", "me"] });
      qc.removeQueries({ queryKey: ["me"] });
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl">
        <aside className="w-64 border-r border-slate-200 bg-white px-6 py-8">
          <div className="text-lg font-semibold">Dashtar Lite</div>
          <nav className="mt-8 space-y-2 text-sm">
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/dashboard">
              Dashboard
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/products">
              Products
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/categories">
              Categories
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/orders">
              Orders
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/coupons">
              Coupons
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/customers">
              Customers
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/admin/settings">
              Settings
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-slate-100" to="/">
              Storefront
            </Link>
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div className="text-sm text-slate-500">Admin Console</div>
            <div className="flex items-center gap-4 text-sm">
              <div className="rounded-full bg-slate-100 px-3 py-1">
                {user?.email || "admin"}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-900"
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 px-6 py-6">
            <Outlet context={{ user }} />
          </main>
        </div>
      </div>
    </div>
  );
}

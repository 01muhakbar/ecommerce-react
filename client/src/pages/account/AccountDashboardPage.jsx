import { useOutletContext } from "react-router-dom";

export default function AccountDashboardPage() {
  const { user } = useOutletContext() || {};
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Welcome back</h2>
        <p className="mt-1 text-sm text-slate-600">
          {user?.name ? `Hello ${user.name}, here is your account overview.` : "Here is your account overview."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Profile
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Keep your contact details up to date to speed up checkout.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Orders
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Review your latest orders and track their status.
          </p>
        </div>
      </div>
    </div>
  );
}

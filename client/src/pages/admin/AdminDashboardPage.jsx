import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/axios.ts";
import { moneyIDR } from "../../utils/money.js";

export default function AdminDashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["admin-stats", "overview"],
    queryFn: () => api.get("/admin/stats/overview").then((r) => r.data),
  });

  const stats = statsQuery.data || {};
  const cards = [
    {
      label: "Today",
      value: statsQuery.isLoading ? "..." : moneyIDR(stats.todayRevenue),
      sub: statsQuery.isLoading ? "..." : `${stats.todayOrdersCount || 0} orders`,
    },
    {
      label: "Yesterday",
      value: statsQuery.isLoading ? "..." : moneyIDR(stats.yesterdayRevenue),
      sub: statsQuery.isLoading ? "..." : `${stats.yesterdayOrdersCount || 0} orders`,
    },
    {
      label: "This Month",
      value: statsQuery.isLoading ? "..." : moneyIDR(stats.monthRevenue),
      sub: statsQuery.isLoading ? "..." : `${stats.monthOrdersCount || 0} orders`,
    },
    {
      label: "All Time",
      value: statsQuery.isLoading ? "..." : moneyIDR(stats.allTimeRevenue),
      sub: statsQuery.isLoading ? "..." : `${stats.allTimeOrdersCount || 0} orders`,
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview of your store activity.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase text-slate-400">{card.label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{card.value}</div>
            {card.sub ? (
              <div className="mt-1 text-xs text-slate-500">{card.sub}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

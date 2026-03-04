import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, PackagePlus, ShoppingBag, Users } from "lucide-react";
import { api } from "../../api/axios.ts";
import { fetchAdminOrders } from "../../lib/adminApi.js";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import { moneyIDR } from "../../utils/money.js";

const kpiCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

const toText = (value) => String(value ?? "").trim();

const formatOrderDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const getInvoice = (order) => toText(order?.invoiceNo || order?.invoice || order?.ref) || `#${order?.id || "-"}`;
const getCustomer = (order) =>
  toText(order?.customerName || order?.customer?.name || order?.customer?.email) || "Guest";
const getMethod = (order) => toText(order?.paymentMethod || order?.method) || "N/A";

export default function AdminDashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["admin-stats", "overview"],
    queryFn: () => api.get("/admin/stats/overview").then((r) => r.data),
  });

  const recentOrdersQuery = useQuery({
    queryKey: ["admin-dashboard", "recent-orders"],
    queryFn: () => fetchAdminOrders({ page: 1, limit: 5 }),
  });

  const stats = statsQuery.data || {};
  const recentOrders = Array.isArray(recentOrdersQuery.data?.data) ? recentOrdersQuery.data.data : [];
  const recentMeta = recentOrdersQuery.data?.meta || { total: recentOrders.length };

  const cards = useMemo(
    () => [
      {
        label: "Today",
        value: statsQuery.isLoading ? "..." : moneyIDR(stats.todayRevenue),
        sub: statsQuery.isLoading ? "..." : `${stats.todayOrdersCount || 0} orders`,
        icon: ShoppingBag,
      },
      {
        label: "Yesterday",
        value: statsQuery.isLoading ? "..." : moneyIDR(stats.yesterdayRevenue),
        sub: statsQuery.isLoading ? "..." : `${stats.yesterdayOrdersCount || 0} orders`,
        icon: ClipboardList,
      },
      {
        label: "This Month",
        value: statsQuery.isLoading ? "..." : moneyIDR(stats.monthRevenue),
        sub: statsQuery.isLoading ? "..." : `${stats.monthOrdersCount || 0} orders`,
        icon: PackagePlus,
      },
      {
        label: "All Time",
        value: statsQuery.isLoading ? "..." : moneyIDR(stats.allTimeRevenue),
        sub: statsQuery.isLoading ? "..." : `${stats.allTimeOrdersCount || 0} orders`,
        icon: Users,
      },
    ],
    [stats, statsQuery.isLoading]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Dashboard
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Dashboard
            </h1>
            <p className="text-sm text-slate-500">Overview of store performance and recent activity.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">All-time orders</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{Number(stats.allTimeOrdersCount || 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Monthly orders</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{Number(stats.monthOrdersCount || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={kpiCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{card.value}</p>
                  {card.sub ? <p className="mt-1 text-xs text-slate-500">{card.sub}</p> : null}
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-sm text-slate-500">Navigate faster to common admin tasks.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/products/new"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              <PackagePlus className="h-4 w-4" />
              Add Product
            </Link>
            <Link
              to="/admin/orders"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              View Orders
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
              View all
            </Link>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{recentOrders.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{Number(recentMeta.total || 0)}</span> records
        </div>

        {recentOrdersQuery.isLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading recent orders...</div>
        ) : recentOrdersQuery.isError ? (
          <div className="px-4 py-6 text-sm text-rose-600">
            {recentOrdersQuery.error?.response?.data?.message || "Failed to load recent orders."}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No recent orders found.</div>
        ) : (
          <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={tableHeadCell}>Invoice</th>
                  <th className={tableHeadCell}>Customer</th>
                  <th className={tableHeadCell}>Method</th>
                  <th className={tableHeadCell}>Date</th>
                  <th className={tableHeadCell}>Status</th>
                  <th className={`${tableHeadCell} text-right`}>Amount</th>
                  <th className={`${tableHeadCell} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id || getInvoice(order)} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className={`${tableCell} font-medium text-slate-900`}>{getInvoice(order)}</td>
                    <td className={tableCell}>{getCustomer(order)}</td>
                    <td className={tableCell}>{getMethod(order)}</td>
                    <td className={`${tableCell} text-slate-600`}>{formatOrderDate(order?.createdAt)}</td>
                    <td className={tableCell}>
                      <OrderStatusBadge status={order?.status} />
                    </td>
                    <td className={`${tableCell} text-right font-medium tabular-nums text-slate-900`}>
                      {moneyIDR(order?.totalAmount || 0)}
                    </td>
                    <td className={`${tableCell} text-right`}>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import { CheckCircle, Eye, RotateCw, ShoppingCart, Truck } from "lucide-react";
import { api } from "../../api/axios.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "../../utils/orderStatus.js";

const fetchOrders = async () => {
  const { data } = await api.get("/store/my/orders");
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.orderTime || null;

const getOrderTimestamp = (order) => {
  const value = getOrderDateValue(order);
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getOrderRef = (order) => order?.invoiceNo || order?.orderId || order?.id || null;

export default function AccountDashboardPage() {
  const { user } = useOutletContext() || {};
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account", "orders", "my"],
    queryFn: () => fetchOrders(),
  });

  const orders = data?.data || [];
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "pending"
  ).length;
  const processingOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "processing"
  ).length;
  const completeOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "complete"
  ).length;

  const statCards = [
    {
      label: "Total Orders",
      value: totalOrders,
      Icon: ShoppingCart,
      tone: "bg-rose-100 text-rose-600",
    },
    {
      label: "Pending Orders",
      value: pendingOrders,
      Icon: RotateCw,
      tone: "bg-amber-100 text-amber-600",
    },
    {
      label: "Processing Orders",
      value: processingOrders,
      Icon: Truck,
      tone: "bg-sky-100 text-sky-600",
    },
    {
      label: "Complete Orders",
      value: completeOrders,
      Icon: CheckCircle,
      tone: "bg-emerald-100 text-emerald-600",
    },
  ];

  const recentOrders = [...orders]
    .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
    .slice(0, 5);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.name ? `Welcome back, ${user.name}.` : "Welcome back."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.tone}`}>
              <card.Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
        <div className="rounded-xl border border-slate-200 bg-white">
          {isLoading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : isError ? (
            <div className="p-4 text-sm text-rose-600">
              {error?.response?.status === 401
                ? "Please login to see your orders."
                : "Failed to load orders."}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">You do not have any orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">OrderTime</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Shipping</th>
                    <th className="px-4 py-3">Shipping Cost</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const orderRef = getOrderRef(order);
                    const statusLabel = getOrderStatusLabel(order.status);
                    return (
                      <tr
                        key={order.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {orderRef || `#${order.id}`}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(getOrderDateValue(order))}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.paymentMethod || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getOrderStatusBadgeClass(
                              order.status
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">-</td>
                        <td className="px-4 py-3 text-slate-600">-</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {money(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {orderRef ? (
                            <Link
                              to={`/order/${encodeURIComponent(orderRef)}`}
                              className="inline-flex items-center justify-center text-emerald-700 hover:text-emerald-900"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View order</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

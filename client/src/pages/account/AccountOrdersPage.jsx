import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/axios.ts";

const fetchOrders = async () => {
  const { data } = await api.get("/store/my/orders");
  return data;
};

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const statusStyles = (status = "") => {
  const s = String(status).toLowerCase();
  if (s.includes("deliver")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("ship")) return "bg-blue-100 text-blue-700";
  if (s.includes("process") || s.includes("pending"))
    return "bg-amber-100 text-amber-700";
  if (s.includes("cancel") || s.includes("fail")) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
};

const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
];

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function AccountOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account", "orders", "my"],
    queryFn: () => fetchOrders(),
  });

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading orders...</div>;
  }

  if (isError) {
    const status = error?.response?.status;
    if (status === 401) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Please login.{" "}
          <Link to="/login" className="font-medium text-amber-800 underline">
            Go to login
          </Link>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        Failed to load orders.
      </div>
    );
  }

  const orders = data?.data || [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
    const orderStatus = String(order.status || "").trim().toLowerCase();
    const statusOk = statusFilter === "all" || orderStatus === statusFilter;
    const invoiceValue = String(
      order.invoiceNo || order.invoice || order.ref || order.id || ""
    ).toLowerCase();
    const searchOk = !normalizedQuery || invoiceValue.includes(normalizedQuery);
    return statusOk && searchOk;
  });
  if (!orders.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        You do not have any orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoice..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
          />
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-sm text-slate-500">No orders found.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Invoice</th>
                <th className="py-2">Status</th>
                <th className="py-2">Total</th>
                <th className="py-2">Created</th>
                <th className="py-2">Payment</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const invoiceNo = order.invoiceNo || order.invoice || order.ref || null;
                const trackRef = invoiceNo || order.id;
                return (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="py-2">{invoiceNo || `#${order.id}`}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2">{money(order.totalAmount)}</td>
                    <td className="py-2">{formatDate(order.createdAt)}</td>
                    <td className="py-2">{order.paymentMethod || "-"}</td>
                    <td className="py-2 text-right">
                      {trackRef ? (
                        <Link
                          to={`/order/${encodeURIComponent(trackRef)}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          Track
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
        )}
      </div>
    </div>
  );
}

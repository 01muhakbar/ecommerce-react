import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminOrders } from "../lib/adminApi.js";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function Orders() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q: debouncedSearch || undefined,
      status: status || undefined,
    }),
    [page, pageSize, debouncedSearch, status]
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => fetchAdminOrders(params),
    keepPreviousData: true,
  });

  const items = ordersQuery.data?.data || [];
  const meta = ordersQuery.data?.meta || { page: 1, pageSize, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-500">Track and manage order flow.</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search orders"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {ordersQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading orders...
        </div>
      ) : ordersQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {ordersQuery.error?.response?.data?.message || "Failed to load orders."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No orders found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {order.invoiceNo || `#${order.id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.customerName || order.customer?.name || "Guest"}
                    {order.customer?.email ? (
                      <div className="text-xs text-slate-400">{order.customer.email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{currency.format(order.totalAmount || 0)}</td>
                  <td className="px-4 py-3 capitalize">{order.status || "-"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
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

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
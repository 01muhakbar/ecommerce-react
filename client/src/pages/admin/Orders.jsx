import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrders, updateAdminOrderStatus } from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS, toUIStatus } from "../../constants/orderStatus.js";
import { moneyIDR } from "../../utils/money.js";
import QueryState from "../../components/UI/QueryState.jsx";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";

export default function Orders() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const [rowError, setRowError] = useState("");
  const queryClient = useQueryClient();

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
      limit,
      q: debouncedSearch || undefined,
      status: status || undefined,
    }),
    [page, limit, debouncedSearch, status]
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => fetchAdminOrders(params),
    keepPreviousData: true,
  });
  if (import.meta.env.DEV && ordersQuery.data?.data?.[0]) {
    console.log("[admin/orders] sample", ordersQuery.data.data[0]);
  }

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }) => updateAdminOrderStatus(orderId, payload),
    onSuccess: () => {
      setRowError("");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
    },
    onSettled: () => {
      setPendingUpdateId(null);
    },
    onError: (error) => {
      setRowError(
        error?.response?.data?.message ?? error?.message ?? "Failed to update status."
      );
    },
  });

  const items = ordersQuery.data?.data || [];
  const meta = ordersQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const filteredItems = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const statusFilter = status.trim().toLowerCase();
    return items.filter((order) => {
      const orderStatus = (order.status || "").toString().toLowerCase();
      if (statusFilter && orderStatus !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        order.id,
        order.invoiceNo,
        order.invoice,
        order.ref,
        order.customerName,
        order.customer?.name,
        order.customer?.email,
        order.customerEmail,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase())
        .join(" ");
      return haystack.includes(needle);
    });
  }, [items, debouncedSearch, status]);
  const isEmpty =
    !ordersQuery.isLoading && !ordersQuery.isError && filteredItems.length === 0;

  const onSearchSubmit = (event) => {
    event.preventDefault();
    setDebouncedSearch(search.trim());
    setPage(1);
  };

  const onUpdateStatus = (order, nextStatus) => {
    if (!nextStatus) return;
    setRowError("");
    setPendingUpdateId(order.id);
    updateMutation.mutate({ orderId: order.id, payload: { status: nextStatus } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-slate-500">Track and manage order flow.</p>
      </div>

      <form
        onSubmit={onSearchSubmit}
        className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari Order ID / Ref / Email"
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
          {ORDER_STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      <QueryState
        isLoading={ordersQuery.isLoading}
        isError={ordersQuery.isError}
        error={ordersQuery.error}
        isEmpty={isEmpty}
        emptyTitle="Belum ada pesanan"
        emptyHint="Pesanan akan muncul di sini setelah ada checkout."
        onRetry={() => ordersQuery.refetch()}
      >
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
              {filteredItems.map((order) => {
                const uiStatus = toUIStatus(order.status || "pending");
                const isUpdating = pendingUpdateId === order.id;
                return (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {order.invoiceNo || order.invoice || `#${order.id ?? "-"}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {order.customerName || order.customer?.name || "Guest"}
                    {order.customer?.email ? (
                      <div className="text-xs text-slate-400">{order.customer.email}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{moneyIDR(order.totalAmount || 0)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={uiStatus || "-"} />
                    <div className="mt-2">
                      <select
                        value={uiStatus}
                        onChange={(event) => onUpdateStatus(order, event.target.value)}
                        disabled={isUpdating}
                        className="rounded-full border border-slate-200 px-2 py-1 text-xs"
                      >
                        {ORDER_STATUS_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleString("id-ID")
                      : order.created_at
                      ? new Date(order.created_at).toLocaleString("id-ID")
                      : "-"}
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
              );
              })}
            </tbody>
          </table>
        </div>
      </QueryState>

      {rowError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {rowError}
        </div>
      ) : null}

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

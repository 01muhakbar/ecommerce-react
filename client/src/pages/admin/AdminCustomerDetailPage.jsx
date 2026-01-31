import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchAdminCustomer,
  fetchAdminCustomerOrders,
  fetchAdminOrders,
} from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS } from "../../constants/orderStatus.js";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

const STATUS_CLASS = {
  pending: "bg-slate-100 text-slate-700",
  paid: "bg-emerald-100 text-emerald-700",
  processing: "bg-amber-100 text-amber-700",
  cancelled: "bg-rose-100 text-rose-700",
  refunded: "bg-violet-100 text-violet-700",
};

const normalizeOrdersResponse = (res) => {
  const root = res?.data ?? res;
  const items = Array.isArray(root)
    ? root
    : Array.isArray(root?.items)
    ? root.items
    : Array.isArray(root?.data?.items)
    ? root.data.items
    : Array.isArray(root?.data)
    ? root.data
    : [];
  const meta = root?.meta || root?.data?.meta || res?.meta || null;
  return { items, meta };
};

const orderInvoice = (order) => order?.invoiceNo || order?.invoice || order?.ref || `#${order?.id}`;

export default function AdminCustomerDetailPage() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [recentLimit] = useState(5);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const customerQuery = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => fetchAdminCustomer(id),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setQ(qInput.trim());
    }, 450);
    return () => clearTimeout(handler);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [q, status, limit, id]);

  const ordersParams = useMemo(
    () => ({ page: 1, limit: recentLimit, pageSize: recentLimit, userId: id }),
    [recentLimit, id]
  );

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", "customerRecent", id, recentLimit],
    queryFn: () => fetchAdminOrders(ordersParams),
    enabled: Boolean(id),
  });

  const listParams = useMemo(
    () => ({
      page,
      limit,
      pageSize: limit,
      q: q || undefined,
      status: status || undefined,
    }),
    [page, limit, q, status]
  );

  const customerOrdersQuery = useQuery({
    queryKey: ["admin", "customerOrders", id, page, limit, q, status],
    queryFn: () => fetchAdminCustomerOrders(id, listParams),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });

  const customer = customerQuery.data?.data || null;
  const { items: recentOrders, meta: recentMeta } = normalizeOrdersResponse(ordersQuery.data);
  const { items: orders, meta: ordersMeta } = normalizeOrdersResponse(customerOrdersQuery.data);
  const totalOrders = recentMeta?.total ?? recentOrders.length;
  const totalSpent = recentOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || order.total || 0),
    0
  );
  const total = ordersMeta?.total ?? orders.length;
  const totalPages = ordersMeta?.totalPages ?? Math.max(1, Math.ceil(total / limit));

  if (customerQuery.isLoading) {
    return <div className="text-sm text-slate-500">Loading customer...</div>;
  }

  if (customerQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        {customerQuery.error?.response?.data?.message || "Failed to load customer."}
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Customer not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/customers" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to Customers
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Customer Detail</h1>
        <p className="text-sm text-slate-500">Customer ID #{customer.id}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Profile</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div>Name: {customer.name || "-"}</div>
            <div>Email: {customer.email || "-"}</div>
            <div>Phone: {customer.phone || "-"}</div>
            <div>Role: {customer.role || "-"}</div>
            <div>
              Joined: {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("id-ID") : "-"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Summary</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div>Total orders: {totalOrders ?? "-"}</div>
            <div>Total spent: {totalOrders ? currency.format(totalSpent) : "-"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Orders</h3>
          <div className="text-xs text-slate-400">Last {recentLimit}</div>
        </div>
        {ordersQuery.isLoading ? (
          <div className="mt-3 text-sm text-slate-500">Loading orders...</div>
        ) : recentOrders.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">No orders found.</div>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Invoice</th>
                <th className="py-2">Total</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-900">
                    {orderInvoice(order)}
                  </td>
                  <td className="py-2">
                    {currency.format(order.totalAmount || order.total || 0)}
                  </td>
                  <td className="py-2 capitalize">{order.status || "-"}</td>
                  <td className="py-2 text-slate-500">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString("id-ID") : "-"}
                  </td>
                  <td className="py-2">
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
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Orders</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={qInput}
              onChange={(event) => setQInput(event.target.value)}
              placeholder="Search invoice..."
              className="w-56 rounded-full border border-slate-200 px-3 py-1.5 text-sm"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        </div>

        {customerOrdersQuery.isLoading ? (
          <div className="mt-3 text-sm text-slate-500">Loading orders...</div>
        ) : customerOrdersQuery.isError ? (
          <div className="mt-3 text-sm text-rose-600">
            {customerOrdersQuery.error?.response?.data?.message || "Failed to load orders."}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">No orders found.</div>
        ) : (
          <>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Created</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const statusKey = String(order.status || "").toLowerCase();
                  return (
                  <tr key={order.id} className="border-t border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {orderInvoice(order)}
                    </td>
                    <td className="py-2">
                      {currency.format(order.totalAmount || order.total || 0)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          STATUS_CLASS[statusKey] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : "Unknown"}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="py-2">
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-slate-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

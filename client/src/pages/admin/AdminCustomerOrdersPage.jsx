import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PackageSearch, Search } from "lucide-react";
import {
  fetchAdminCustomer,
  fetchAdminCustomerOrders,
  fetchAdminOrders,
} from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS } from "../../constants/orderStatus.js";
import { formatCurrency } from "../../utils/format.js";
import { getOrderTruthStatus } from "../../utils/orderTruth.js";

const STATUS_OPTIONS = ORDER_STATUS_OPTIONS;

const STATUS_CLASS = {
  pending: "border-slate-200 bg-slate-100 text-slate-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  processing: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
  refunded: "border-violet-200 bg-violet-50 text-violet-700",
  delivered: "border-sky-200 bg-sky-50 text-sky-700",
  shipped: "border-indigo-200 bg-indigo-50 text-indigo-700",
  complete: "border-emerald-200 bg-emerald-50 text-emerald-700",
  shipping: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const fieldClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

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

const orderInvoice = (order) =>
  order?.invoiceNo || order?.invoice || order?.ref || `#${order?.id}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const toText = (value) => String(value ?? "").trim();

function OrderStatusBadge({ order }) {
  const status = getOrderTruthStatus(order);
  const key = status.bucket;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        STATUS_CLASS[key] || STATUS_CLASS.pending
      }`}
    >
      {status.label}
    </span>
  );
}

export default function AdminCustomerOrdersPage() {
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

  const recentOrdersParams = useMemo(
    () => ({ page: 1, limit: recentLimit, pageSize: recentLimit, userId: id }),
    [recentLimit, id]
  );

  const recentOrdersQuery = useQuery({
    queryKey: ["admin-orders", "customerRecent", id, recentLimit],
    queryFn: () => fetchAdminOrders(recentOrdersParams),
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
  const { items: recentOrders, meta: recentMeta } = normalizeOrdersResponse(recentOrdersQuery.data);
  const { items: orders, meta: ordersMeta } = normalizeOrdersResponse(customerOrdersQuery.data);
  const totalOrders = recentMeta?.total ?? recentOrders.length;
  const totalSpent = recentOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || order.total || 0),
    0
  );
  const total = ordersMeta?.total ?? orders.length;
  const totalPages = ordersMeta?.totalPages ?? Math.max(1, Math.ceil(total / limit));

  if (customerQuery.isLoading) {
    return <div className="text-sm text-slate-500">Loading customer orders...</div>;
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
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Customers / Orders
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Customer Order List
            </h1>
            <p className="text-sm text-slate-500">
              {customer.name || "Customer"} • {customer.email || "-"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total orders</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totalOrders ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Recent spent</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatCurrency(totalSpent || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            to="/admin/customers"
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Back to Customers
          </Link>
          <Link
            to={`/admin/customers/${encodeURIComponent(customer.id)}`}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            View Customer Detail
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Orders
            </h3>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[640px]">
              <div className="relative sm:col-span-1 xl:min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={qInput}
                  onChange={(event) => setQInput(event.target.value)}
                  placeholder="Search invoice..."
                  className={`${fieldClass} w-full pl-9`}
                />
              </div>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={fieldClass}
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
                className={fieldClass}
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{orders.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{total}</span> records
        </div>

        {customerOrdersQuery.isLoading ? (
          <div className="px-4 py-4 text-sm text-slate-500">Loading orders...</div>
        ) : customerOrdersQuery.isError ? (
          <div className="px-4 py-4 text-sm text-rose-600">
            {customerOrdersQuery.error?.response?.data?.message || "Failed to load orders."}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <PackageSearch className="h-7 w-7" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">
              This customer has no order yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Customer order activity will appear here after checkout is completed.
            </p>
          </div>
        ) : (
          <>
            <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={tableHeadCell}>Invoice</th>
                    <th className={`${tableHeadCell} text-right`}>Total</th>
                    <th className={tableHeadCell}>Status</th>
                    <th className={tableHeadCell}>Created</th>
                    <th className={`${tableHeadCell} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className={`${tableCell} font-medium text-slate-900`}>
                        {orderInvoice(order)}
                      </td>
                      <td className={`${tableCell} text-right font-medium tabular-nums text-slate-700`}>
                        {formatCurrency(order.totalAmount || order.total || 0)}
                      </td>
                      <td className={tableCell}>
                        <OrderStatusBadge order={order} />
                      </td>
                      <td className={`${tableCell} text-slate-500`}>
                        {formatDate(order.createdAt)}
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

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm">
              <div className="text-slate-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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

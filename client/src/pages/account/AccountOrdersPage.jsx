import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/axios.ts";

const fetchOrders = async (page, limit) => {
  const { data } = await api.get("/store/orders", {
    params: { page, limit },
  });
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

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function AccountOrdersPage() {
  const [page, setPage] = useState(1);
  const limit = 10;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account", "orders", page, limit],
    queryFn: () => fetchOrders(page, limit),
    keepPreviousData: true,
  });

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading orders...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        Failed to load orders.
      </div>
    );
  }

  const orders = data?.data || [];
  const meta = data?.meta || {};
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  if (!orders.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        You do not have any orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link
          key={order.id}
          to={`/account/orders/${order.id}`}
          className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Order {order.ref || `#${order.id}`}
              </p>
              <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">
                {money(order.totalAmount)}
              </p>
              <span
                className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles(
                  order.status
                )}`}
              >
                {order.status}
              </span>
            </div>
          </div>
        </Link>
      ))}

      <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

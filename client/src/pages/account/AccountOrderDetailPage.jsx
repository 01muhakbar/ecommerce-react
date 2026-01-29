import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/axios.ts";

const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/store/orders/my/${orderId}`);
  return data;
};

const money = (value) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
    Number(value || 0)
  );

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

export default function AccountOrderDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account", "orders", id],
    queryFn: () => fetchOrder(id),
  });

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading order...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        Failed to load order details.
      </div>
    );
  }

  const order = data?.data;
  if (!order) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Order</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {order.ref || `#${order.id}`}
          </h2>
          <p className="text-xs text-slate-500">Placed {formatDate(order.createdAt)}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <div>Payment: {order.paymentMethod || "-"}</div>
          <div>Total: {money(order.totalAmount)}</div>
          <div>Discount: {money(order.discount)}</div>
          <div>Subtotal: {money(order.subtotal)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        <div className="mt-3 space-y-3">
          {(order.items || []).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.quantity} × {money(item.price)}
                </p>
              </div>
              <div className="font-semibold text-slate-900">
                {money(item.lineTotal)}
              </div>
            </div>
          ))}
          {(!order.items || !order.items.length) && (
            <p className="text-sm text-slate-500">No items found.</p>
          )}
        </div>
      </div>

      <Link to="/account/orders" className="text-sm font-medium text-slate-700 hover:text-slate-900">
        ← Back to orders
      </Link>
    </div>
  );
}

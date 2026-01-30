import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrder, updateAdminOrderStatus } from "../../lib/adminApi.js";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

const STATUS_OPTIONS = [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];

const labelize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

export default function OrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState(null);

  const orderQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => fetchAdminOrder(id),
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }) => updateAdminOrderStatus(orderId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"], exact: false });
      orderQuery.refetch();
      setNotice({ type: "success", message: "Status updated." });
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ||
        "Failed to update status.";
      setNotice({ type: "error", message: msg });
    },
  });

  const order =
    orderQuery.data?.data ??
    orderQuery.data?.data?.data ??
    orderQuery.data?.data?.order ??
    null;
  const items = order?.items || [];
  const currentStatus = (order?.status ?? "").toString();

  useEffect(() => {
    setStatus(currentStatus || "");
  }, [currentStatus]);

  if (orderQuery.isLoading) {
    return <div className="text-sm text-slate-500">Loading order...</div>;
  }

  if (orderQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
        {orderQuery.error?.response?.data?.message || "Failed to load order."}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/orders" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to Orders
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Order Detail</h1>
        <p className="text-sm text-slate-500">Invoice {order.invoiceNo || `#${order.id}`}</p>
      </div>

      {notice ? (
        <div
          className={`rounded-2xl px-4 py-2 text-sm ${
            notice.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Summary</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div>Status: {order.status}</div>
            <div>Total: {currency.format(order.totalAmount || 0)}</div>
            <div>
              Created: {order.createdAt ? new Date(order.createdAt).toLocaleString("id-ID") : "-"}
            </div>
            <div>Payment: {order.method || "COD"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">Customer</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <div>{order.customerName || "Guest"}</div>
            {order.customerPhone ? <div>{order.customerPhone}</div> : null}
            {order.customerAddress ? <div>{order.customerAddress}</div> : null}
            {order.customerNotes ? <div>Notes: {order.customerNotes}</div> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Items</h3>
          <div className="text-xs text-slate-400">{items.length} items</div>
        </div>
        {items.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">No items found.</div>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">
                    {item.product?.name || `Product #${item.productId}`}
                  </td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">{currency.format(item.price || 0)}</td>
                  <td className="py-2 text-right">{currency.format(item.lineTotal || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold">Update Status</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select status</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {labelize(value)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => updateMutation.mutate({ orderId: order.id, payload: { status } })}
            disabled={updateMutation.isPending || !status || status === currentStatus}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

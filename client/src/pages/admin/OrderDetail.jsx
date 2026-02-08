import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrder, updateAdminOrderStatus } from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS } from "../../constants/orderStatus.js";
import QueryState from "../../components/UI/QueryState.jsx";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

const labelize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

export default function OrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const noticeTimerRef = useRef(null);

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
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
      setErrorMessage("");
      setSuccessMessage("Berhasil memperbarui status.");
      noticeTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        noticeTimerRef.current = null;
      }, 3000);
    },
    onError: (err) => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = null;
      }
      const rawMsg = err?.response?.data?.message ?? err?.message;
      const msg = typeof rawMsg === "string" ? rawMsg : "Failed to update status.";
      setSuccessMessage("");
      setErrorMessage(msg);
    },
  });

  const order =
    orderQuery.data?.data ??
    orderQuery.data?.data?.data ??
    orderQuery.data?.data?.order ??
    null;
  const items = order?.items || [];
  const currentStatus = (order?.status ?? "").toString();
  const selectedStatus = status;
  const norm = (value) => (value || "").toString().trim().toLowerCase();
  const isSameStatus = norm(selectedStatus) === norm(currentStatus);

  useEffect(() => {
    setStatus(currentStatus || "");
  }, [currentStatus]);
  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const invoiceRef = order?.invoiceNo || order?.invoice || order?.ref || id || "—";
  const createdAt = order?.createdAt
    ? new Date(order.createdAt).toLocaleString("id-ID")
    : "-";
  const itemCount = items.length;
  const customerEmail =
    order?.customerEmail || order?.customer?.email || "—";
  const isEmpty = !orderQuery.isLoading && !orderQuery.isError && !order;
  const mutationState = updateMutation.isPending
    ? "pending"
    : updateMutation.isError
      ? "error"
      : updateMutation.isSuccess
        ? "success"
        : "idle";

  return (
    <div className="space-y-6">
      <Link to="/admin/orders" className="text-sm text-slate-500 hover:text-slate-900">
        ← Back to Orders
      </Link>

      <QueryState
        isLoading={orderQuery.isLoading}
        isError={orderQuery.isError}
        error={orderQuery.error}
        isEmpty={isEmpty}
        emptyTitle="Order tidak ditemukan"
        emptyHint="Cek kembali link / ref order."
        onRetry={() => orderQuery.refetch()}
      >
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Order #{invoiceRef}</h1>
              <p className="text-sm text-slate-500">Created {createdAt}</p>
            </div>
            <OrderStatusBadge status={order?.status || "-"} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              Total {currency.format(order?.totalAmount || 0)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              {itemCount} items
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
              {customerEmail}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">Action Bar</div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedStatus}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select status</option>
                {ORDER_STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {labelize(value)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({ orderId: order.id, payload: { status: selectedStatus } })
                }
                disabled={updateMutation.isPending || !selectedStatus || isSameStatus}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateMutation.isPending ? "Updating..." : "Update status"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Customer & Shipping</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div>{order?.customerName || "Guest"}</div>
              {customerEmail ? <div>{customerEmail}</div> : null}
              {order?.customerPhone ? <div>{order.customerPhone}</div> : null}
              {order?.customerAddress ? (
                <div>{order.customerAddress}</div>
              ) : (
                <div className="text-xs text-slate-400">No shipping address.</div>
              )}
              {order?.customerNotes ? <div>Notes: {order.customerNotes}</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Summary</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div>Status: {order?.status}</div>
              <div>Total: {currency.format(order?.totalAmount || 0)}</div>
              <div>Payment: {order?.paymentMethod || order?.method || "COD"}</div>
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
      </QueryState>
    </div>
  );
}

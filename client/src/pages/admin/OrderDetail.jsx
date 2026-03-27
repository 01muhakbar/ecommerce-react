import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminOrderByInvoice, updateAdminOrderStatus } from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS } from "../../constants/orderStatus.js";
import QueryState from "../../components/primitives/ui/QueryState.jsx";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import OrderStatusTimeline from "../../components/admin/OrderStatusTimeline.jsx";
import useAdminLocale from "../../hooks/useAdminLocale.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";

const labelize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

const getStatusHelper = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "pending") return "Review payment and prepare the order for processing.";
  if (value === "processing") return "Team is preparing the order before handoff.";
  if (value === "shipping" || value === "shipped") return "Delivery is in progress for this order.";
  if (value === "delivered" || value === "complete") return "Order is complete and can be archived.";
  if (value === "cancel" || value === "cancelled") return "Order has been stopped and needs no further fulfillment.";
  return "Use the status controls to keep fulfillment up to date.";
};

export default function OrderDetail() {
  const { invoiceNo } = useParams();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { formatDateTime, formatMoney } = useAdminLocale();
  const [status, setStatus] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const noticeTimerRef = useRef(null);
  const autoPrintDoneRef = useRef(false);

  const orderQuery = useQuery({
    queryKey: ["admin-order", invoiceNo],
    queryFn: () => fetchAdminOrderByInvoice(invoiceNo),
    enabled: Boolean(invoiceNo),
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, payload }) => updateAdminOrderStatus(orderId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-order", invoiceNo] });
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
  const shouldAutoPrint = searchParams.get("print") === "1";

  useEffect(() => {
    if (!shouldAutoPrint) return;
    document.body.classList.add("order-print-mode");
    return () => {
      document.body.classList.remove("order-print-mode");
    };
  }, [shouldAutoPrint]);

  useEffect(() => {
    autoPrintDoneRef.current = false;
  }, [invoiceNo, shouldAutoPrint]);

  useEffect(() => {
    setStatus(currentStatus || "");
  }, [currentStatus]);
  useEffect(() => () => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!shouldAutoPrint) return;
    if (autoPrintDoneRef.current) return;
    if (orderQuery.isLoading || orderQuery.isError || !order) return;
    autoPrintDoneRef.current = true;
    const timer = setTimeout(() => {
      window.print();
    }, 350);
    return () => clearTimeout(timer);
  }, [shouldAutoPrint, orderQuery.isLoading, orderQuery.isError, order]);

  const invoiceRef =
    order?.invoiceNo || order?.invoice || order?.ref || invoiceNo || "—";
  const createdAtLabel = formatDateTime(order?.createdAt, { includeTime: false });
  const createdAtFull = formatDateTime(order?.createdAt);
  const updatedAtValue = order?.updatedAt || order?.updated_at || order?.updatedAt;
  const customerEmail = order?.customerEmail || order?.customer?.email || null;
  const paymentMethod = order?.method || order?.paymentMethod || "COD";
  const subtotal = Number(order?.subtotal || 0);
  const discount = Number(order?.discount || 0);
  const shipping = Number(order?.shipping || 0);
  const tax = Number(order?.tax || 0);
  const totalAmount = Number(order?.totalAmount || order?.total || 0);
  const customerName = order?.customerName || order?.customer?.name || "Guest";
  const customerPhone = order?.customerPhone || order?.customer?.phone || "—";
  const customerAddress =
    order?.customerAddress ||
    order?.shippingAddress ||
    order?.shipping?.address ||
    order?.customer?.address ||
    "—";
  const orderNote = String(
    order?.customerNote || order?.note || order?.notes || ""
  ).trim();
  const statusHelper = getStatusHelper(order?.status);

  const handleCopy = async (value, label) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(String(value));
      setSuccessMessage(`${label} copied.`);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        noticeTimerRef.current = null;
      }, 2000);
    } catch {
      setErrorMessage("Failed to copy to clipboard.");
    }
  };

  const handlePrint = () => {
    window.print();
  };
  const isEmpty = !orderQuery.isLoading && !orderQuery.isError && !order;
  return (
    <div className="order-print-root mx-auto w-full max-w-7xl space-y-5 px-4 py-6 lg:px-6 lg:py-8">
      <div className="admin-no-print flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/admin" className="hover:text-slate-800">
          Admin
        </Link>
        <span>/</span>
        <Link to="/admin/orders" className="hover:text-slate-800">
          Orders
        </Link>
        <span>/</span>
        <span className="text-slate-700">Details</span>
      </div>

      <QueryState
        isLoading={orderQuery.isLoading}
        isError={orderQuery.isError}
        error={orderQuery.error}
        isEmpty={isEmpty}
        emptyTitle="Order tidak ditemukan"
        emptyHint="Cek kembali link / ref order."
        onRetry={() => orderQuery.refetch()}
      >
        <div className="space-y-3">
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
        </div>

        <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="admin-print-area space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Order Detail
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                      Order #{invoiceRef}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {createdAtLabel}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                        {createdAtFull}
                      </span>
                      <OrderStatusBadge status={order?.status || "-"} />
                      <CheckoutModeBadge mode={order?.checkoutMode} />
                      <PaymentStatusBadge status={order?.paymentStatus} prefix="Parent" />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                        Total {formatMoney(totalAmount)}
                      </span>
                    </div>
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm sm:max-w-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                        Status Guidance
                      </p>
                      <p className="mt-1.5 leading-6">{statusHelper}</p>
                    </div>
                  </div>
                  <div className="admin-no-print flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(invoiceRef, "Order ref")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      Copy Ref
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Customer
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{customerName}</p>
                  {customerEmail ? <p className="mt-1 text-sm text-slate-600">{customerEmail}</p> : null}
                  <p className="mt-1 text-sm text-slate-600">{customerPhone}</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Shipping Address
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{customerAddress}</p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Payment
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{paymentMethod}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CheckoutModeBadge mode={order?.checkoutMode} />
                    <PaymentStatusBadge status={order?.paymentStatus} prefix="Parent" />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Invoice: {invoiceRef}</p>
                  {order?.id && String(order?.checkoutMode || "LEGACY").toUpperCase() !== "LEGACY" ? (
                    <Link
                      to={`/admin/online-store/payment-audit/${order.id}`}
                      className="mt-3 inline-flex text-sm font-semibold text-emerald-700 underline underline-offset-2"
                    >
                      Open split payment audit
                    </Link>
                  ) : null}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Order Summary
                  </p>
                  <div className="mt-3 space-y-2.5 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(subtotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(discount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Shipping</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(shipping)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tax</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatMoney(tax)}
                      </span>
                    </div>
                    <div className="border-t border-dashed border-slate-200 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="text-lg font-bold tabular-nums text-slate-900">
                          {formatMoney(totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            {orderNote ? (
              <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{orderNote}</p>
              </section>
            ) : null}

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Items</h2>
                <p className="text-xs font-medium text-slate-500">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                {items.length === 0 ? (
                  <div className="bg-white p-6 text-sm text-slate-500">
                    No items found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3.5">Item</th>
                          <th className="px-4 py-3.5 text-right">Price</th>
                          <th className="px-4 py-3.5 text-right">Qty</th>
                          <th className="px-4 py-3.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => {
                          const name =
                            item.product?.name || item.name || `Product #${item.productId}`;
                          const qty = item.quantity || item.qty || 0;
                          const price = item.price || item.unitPrice || 0;
                          const amount = item.lineTotal || price * qty;
                          return (
                            <tr
                              key={item.id || `${item.productId}-${index}`}
                              className="border-t border-slate-100 transition hover:bg-slate-50"
                            >
                              <td className="px-4 py-3.5 font-medium text-slate-900">
                                {name}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                                {formatMoney(price)}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                                {qty}
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                                {formatMoney(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="admin-no-print space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Current Status
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order?.status || "-"} />
                <PaymentStatusBadge status={order?.paymentStatus} prefix="Parent" />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {statusHelper}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Last update: {formatDateTime(updatedAtValue || order?.createdAt)}
              </p>
            </section>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Action Panel
                  </div>
                  <div className="text-sm font-semibold text-slate-900">Update Status</div>
                  <p className="text-sm text-slate-500">
                    Apply the next order state without leaving this detail page.
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  <select
                    value={selectedStatus}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
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
                      updateMutation.mutate({
                        orderId: order.id,
                        payload: { status: selectedStatus },
                      })
                    }
                    disabled={updateMutation.isPending || !selectedStatus || isSameStatus}
                    className="h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Status"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(invoiceRef, "Invoice")}
                    className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Copy Invoice No.
                  </button>
                  <Link
                    to={`/order/${encodeURIComponent(invoiceRef)}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Open Customer Invoice
                  </Link>
                </div>
              </div>

              <OrderStatusTimeline
                status={order?.status}
                createdAt={order?.createdAt}
                updatedAt={updatedAtValue}
              />
            </div>
          </aside>
        </div>
      </QueryState>
    </div>
  );
}

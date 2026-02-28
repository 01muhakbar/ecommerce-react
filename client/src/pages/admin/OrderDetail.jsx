import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminOrderByInvoice,
  updateAdminOrderStatus,
} from "../../lib/adminApi.js";
import { ORDER_STATUS_OPTIONS } from "../../constants/orderStatus.js";
import QueryState from "../../components/UI/QueryState.jsx";
import OrderStatusBadge from "../../components/admin/OrderStatusBadge.jsx";
import OrderStatusTimeline from "../../components/admin/OrderStatusTimeline.jsx";
import { formatCurrency } from "../../utils/format.js";

const labelize = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : "";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
};

export default function OrderDetail() {
  const { invoiceNo } = useParams();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
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
  const createdAtLabel = formatDate(order?.createdAt);
  const createdAtFull = formatDateTime(order?.createdAt);
  const updatedAtValue = order?.updatedAt || order?.updated_at || order?.updatedAt;
  const customerEmail = order?.customerEmail || order?.customer?.email || null;
  const paymentMethod = order?.method || order?.paymentMethod || "COD";
  const subtotal = Number(order?.subtotal || 0);
  const discount = Number(order?.discount || 0);
  const shipping = Number(order?.shipping || 0);
  const totalAmount = Number(order?.totalAmount || order?.total || 0);

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
    <div className="order-print-root mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
      <Link
        to="/admin/orders"
        className="admin-no-print text-sm text-slate-500 hover:text-slate-900"
      >
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

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="admin-print-area rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-100/60 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Invoice / Order
                    </div>
                    <h1 className="mt-1 text-2xl font-extrabold tracking-wide text-slate-900">
                      {invoiceRef}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {createdAtLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order?.status || "-"} />
                    <button
                      type="button"
                      onClick={() => handleCopy(invoiceRef, "Order ref")}
                      className="admin-no-print rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                    >
                      Copy Ref
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="admin-no-print rounded-full border border-slate-200 bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Print
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-600 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">Date</div>
                    <div className="mt-1 font-medium text-slate-900">{createdAtLabel}</div>
                    <div className="text-xs text-slate-400">{createdAtFull}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Invoice No.
                    </div>
                    <div className="mt-1 font-medium text-slate-900">{invoiceRef}</div>
                  </div>
                  <div className="md:text-right">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                      Invoice To
                    </div>
                    <div className="mt-1 font-medium text-slate-900">
                      {order?.customerName || "Guest"}
                    </div>
                    {customerEmail ? <div>{customerEmail}</div> : null}
                    {order?.customerPhone ? <div>{order.customerPhone}</div> : null}
                    {order?.customerAddress ? <div>{order.customerAddress}</div> : null}
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                    No items found.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">SR.</th>
                          <th className="px-4 py-3">Product Name</th>
                          <th className="px-4 py-3 text-right">Quantity</th>
                          <th className="px-4 py-3 text-right">Item Price</th>
                          <th className="px-4 py-3 text-right">Amount</th>
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
                              className="border-t border-slate-100 hover:bg-slate-50"
                            >
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {name}
                              </td>
                              <td className="px-4 py-3 text-right">{qty}</td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(price)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {formatCurrency(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-xl bg-emerald-50 px-6 py-5">
                  <div className="grid grid-cols-1 gap-4 text-sm text-slate-700 md:grid-cols-4">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Payment Method
                      </div>
                      <div className="mt-2 font-medium text-slate-900">{paymentMethod}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Shipping Cost
                      </div>
                      <div className="mt-2 font-medium text-slate-900">
                        {formatCurrency(shipping)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Discount
                      </div>
                      <div className="mt-2 font-medium text-slate-900">
                        {formatCurrency(discount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">
                        Total Amount
                      </div>
                      <div className="mt-2 text-3xl font-extrabold text-red-500">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="admin-no-print space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">Update Status</div>
                <div className="mt-3 space-y-3">
                  <select
                    value={selectedStatus}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Status"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(invoiceRef, "Invoice")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Copy Invoice No.
                  </button>
                  <Link
                    to={`/order/${encodeURIComponent(invoiceRef)}`}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
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
          </div>
        </div>
      </QueryState>
    </div>
  );
}

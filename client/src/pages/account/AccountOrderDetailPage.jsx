import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/axios.ts";
import { fetchOrderCheckoutPayment } from "../../api/orderPayments.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
  ProofReviewBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";
import {
  getOrderContractSummary,
  isOrderContractFinal,
} from "../../utils/orderContract.ts";
import {
  getGroupedPaymentReadModel,
  isGroupedPaymentFinal,
} from "../../utils/groupedPaymentReadModel.ts";

const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/store/orders/my/${orderId}`);
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const statusStyles = (status = "") => {
  const s = String(status).toLowerCase();
  if (s.includes("emerald")) return "bg-emerald-100 text-emerald-700";
  if (s.includes("indigo")) return "bg-blue-100 text-blue-700";
  if (s.includes("sky") || s.includes("amber"))
    return "bg-amber-100 text-amber-700";
  if (s.includes("rose") || s.includes("orange")) return "bg-rose-100 text-rose-700";
  if (s.includes("stone")) return "bg-slate-100 text-slate-600";
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

const isGroupOperationallyFinal = (group) => {
  const paymentFinal = isGroupedPaymentFinal(group);
  const fulfillmentFinal = Boolean(group?.fulfillmentStatusMeta?.isFinal);
  return isOrderContractFinal(group?.contract) && paymentFinal && fulfillmentFinal;
};

const shouldPollGroupedOrder = (groupedOrder) => {
  if (!groupedOrder || typeof groupedOrder !== "object") return false;
  if (!isOrderContractFinal(groupedOrder?.contract)) return true;
  const groups = Array.isArray(groupedOrder.groups) ? groupedOrder.groups : [];
  return groups.some((group) => !isGroupOperationallyFinal(group));
};

export default function AccountOrderDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account", "orders", id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const order = query.state.data?.data ?? query.state.data?.data?.data ?? null;
      return !isOrderContractFinal(order?.contract) ? 15000 : false;
    },
  });
  const groupedQuery = useQuery({
    queryKey: ["account", "orders", "grouped", id],
    queryFn: () => fetchOrderCheckoutPayment(id),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      const groupedOrder = query.state.data?.data ?? null;
      return shouldPollGroupedOrder(groupedOrder) ? 15000 : false;
    },
  });

  if (!id) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Invalid order id.{" "}
        <Link to="/user/my-orders" className="font-medium text-slate-700 hover:text-slate-900">
          Back to orders
        </Link>
      </div>
    );
  }

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

  const order = data?.data ?? data?.data?.data ?? null;
  if (!order) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Order not found.{" "}
        <Link to="/user/my-orders" className="font-medium text-slate-700 hover:text-slate-900">
          Back to orders
        </Link>
      </div>
    );
  }

  const orderRef = order.invoiceNo || order.ref || `#${order.id}`;
  const discountValue = order.discount ?? order.discountAmount ?? 0;
  const subtotalValue = order.subtotal ?? 0;
  const groupedOrder = groupedQuery.data?.data ?? null;
  const parentPaymentStatus = groupedOrder?.paymentStatus || order.paymentStatus;
  const parentPaymentMeta = groupedOrder?.paymentStatusMeta || order.paymentStatusMeta || null;
  const paymentEntry = order.paymentEntry || groupedOrder?.paymentEntry || null;
  const statusSummary = getOrderContractSummary(order.contract);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Order</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {orderRef}
          </h2>
          <p className="text-xs text-slate-500">Placed {formatDate(order.createdAt)}</p>
          <div className="mt-2">
            <CheckoutModeBadge mode={order.checkoutMode || groupedOrder?.checkoutMode} />
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles(
            statusSummary?.tone || order.status
          )}`}
        >
          {statusSummary?.label || order.status}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <div>Payment: {order.paymentMethod || "-"}</div>
            <div>
              <PaymentStatusBadge
                status={parentPaymentStatus}
                label={parentPaymentMeta?.label}
                tone={parentPaymentMeta?.tone}
                prefix="Parent"
              />
            </div>
            <div>Total: {money(order.totalAmount || 0)}</div>
            <div>Discount: {money(discountValue)}</div>
            <div>Subtotal: {money(subtotalValue)}</div>
        </div>
        {order.id && paymentEntry?.visible && paymentEntry?.targetPath ? (
          <div className="mt-4">
            <Link
              to={paymentEntry.targetPath}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              {paymentEntry.label || "Order Payment"}
            </Link>
          </div>
        ) : order.id ? (
          <p className="mt-4 text-sm text-slate-500">
            {paymentEntry?.summaryLabel || "Payment is no longer actionable from this page."}
          </p>
        ) : null}
      </div>

      {groupedOrder ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Store Breakdown</h3>
              <p className="mt-1 text-xs text-slate-500">
                Read-only payment lifecycle by store for this order.
              </p>
            </div>
            <PaymentStatusBadge
              status={groupedOrder.paymentStatus}
              label={groupedOrder.paymentStatusMeta?.label}
              tone={groupedOrder.paymentStatusMeta?.tone}
              prefix="Parent"
            />
          </div>
          {groupedOrder.checkoutMode === "LEGACY" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Legacy order. Split payment detail is not available for this order.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {groupedOrder.groups.map((group) => {
                const splitPayment = getGroupedPaymentReadModel(group);
                return (
                  <div
                    key={`${group.suborderId || group.storeId || group.storeName}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{group.storeName}</h4>
                          <PaymentStatusBadge
                            status={group.paymentStatus}
                            label={group.paymentStatusMeta?.label}
                            tone={group.paymentStatusMeta?.tone}
                            prefix="Suborder"
                          />
                          {group.payment?.status || group.paymentReadModel ? (
                            <PaymentStatusBadge
                              status={splitPayment.status}
                              label={splitPayment.statusMeta?.label}
                              tone={splitPayment.statusMeta?.tone}
                              prefix="Payment"
                            />
                          ) : null}
                          {group.payment?.proof?.reviewStatus ? (
                            <ProofReviewBadge
                              status={group.payment.proof.reviewStatus}
                              prefix="Proof"
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.suborderNumber || "Legacy"} • {group.items.length} item
                          {group.items.length === 1 ? "" : "s"}
                        </p>
                        {group.payment?.proof?.reviewNote ? (
                          <p className="mt-2 text-sm text-slate-600">
                            Review note: {group.payment.proof.reviewNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">{money(group.totalAmount)}</p>
                        <p>Fulfillment: {group.fulfillmentStatusMeta?.label || group.fulfillmentStatus}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                        {group.payment?.qrImageUrl ? (
                          <img
                            src={group.payment.qrImageUrl}
                            alt={`QRIS ${group.storeName}`}
                            className="mx-auto h-28 w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-xs text-slate-500">
                            QRIS image unavailable
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-900">Merchant:</span>{" "}
                          {group.payment?.merchantName || group.merchantName || "-"}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-slate-900">Account Label:</span>{" "}
                          {group.payment?.accountName || group.accountName || "-"}
                        </p>
                        <p className="mt-2 leading-6">
                          {group.payment?.instructionText ||
                            group.paymentInstruction ||
                            "Per-store payment instructions are available on the payment page."}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

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

      <Link to="/user/my-orders" className="text-sm font-medium text-slate-700 hover:text-slate-900">
        ← Back to orders
      </Link>
    </div>
  );
}

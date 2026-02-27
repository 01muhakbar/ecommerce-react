import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { fetchStoreOrder } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import { getOrderStatusLabel } from "../../utils/orderStatus.js";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import {
  GENERIC_ERROR,
  ORDER_NOT_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getItemName = (item) =>
  item?.product?.name || item?.name || item?.title || "Item";

const getItemQuantity = (item) => Number(item?.quantity ?? item?.qty ?? item?.amount ?? 0);

const getItemPrice = (item) =>
  Number(item?.price ?? item?.unitPrice ?? item?.product?.price ?? 0);

const normalizeTrackingPayload = (response) =>
  response?.data?.data ??
  response?.data ??
  response?.order ??
  response?.data?.order ??
  response ??
  null;

export default function StoreOrderTrackingPage() {
  const { ref } = useParams();
  const orderRefParam = String(ref || "").trim();
  const hasValidRef = orderRefParam.length > 0;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["store", "tracking", orderRefParam],
    queryFn: () => fetchStoreOrder(orderRefParam),
    enabled: hasValidRef,
    retry: false,
  });

  const order = useMemo(() => normalizeTrackingPayload(data), [data]);
  const statusCode = error?.response?.status;
  const isInitialLoading = hasValidRef && isLoading && !data;
  const isRefetching = hasValidRef && isFetching && !isInitialLoading;
  const isNotFound =
    !hasValidRef ||
    statusCode === 404 ||
    (hasValidRef && !isInitialLoading && !isError && !order);
  const isNetworkOrServerError = hasValidRef && isError && statusCode !== 404;
  const isSuccess =
    hasValidRef &&
    !isInitialLoading &&
    !isNotFound &&
    !isNetworkOrServerError &&
    Boolean(order);

  const handlePrint = () => {
    window.print();
  };

  const invoiceRef = order?.invoiceNo || order?.orderId || order?.ref || ref;
  const createdAt = order?.createdAt || order?.created_at || order?.orderTime || null;
  const customer = order?.customer || order?.user || {};
  const customerName =
    order?.customerName || customer.name || order?.userName || customer.email || "Customer";
  const customerEmail = order?.customerEmail || customer.email || order?.email || "-";
  const customerPhone = order?.customerPhone || customer.phone || order?.phone || "-";
  const customerAddress =
    order?.customerAddress || customer.address || order?.shippingAddress || "-";
  const paymentMethod = order?.paymentMethod || order?.method || "-";
  const items = order?.items || order?.orderItems || order?.products || [];
  const shippingCost = order?.shippingCost ?? order?.shipping?.cost ?? order?.deliveryFee ?? 0;
  const discount = order?.discount ?? order?.discountAmount ?? order?.discountTotal ?? 0;
  const totalAmount = order?.totalAmount ?? order?.total ?? order?.grandTotal ?? 0;
  const statusLabel = getOrderStatusLabel(order?.status);
  const errorMessage =
    error?.response?.data?.message || error?.message || GENERIC_ERROR;

  if (isInitialLoading) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiSkeleton variant="invoice" />
      </section>
    );
  }

  if (isNotFound) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title={ORDER_NOT_FOUND}
          description={
            orderRefParam
              ? `We could not find an order for reference: ${orderRefParam}`
              : "We could not find an order for this reference."
          }
          actions={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Home
            </Link>
          }
        />
      </section>
    );
  }

  if (isNetworkOrServerError) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title={GENERIC_ERROR}
          message={errorMessage}
          onRetry={() => refetch()}
        />
      </section>
    );
  }

  if (!isSuccess) {
    return (
      <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title={ORDER_NOT_FOUND}
          description={
            orderRefParam
              ? `We could not find an order for reference: ${orderRefParam}`
              : "We could not find an order for this reference."
          }
          actions={
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Home
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {isRefetching ? (
        <div className="no-print mb-4 flex justify-end">
          <UiUpdatingBadge label={UPDATING} />
        </div>
      ) : null}

      <div className="no-print mb-6 rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-900 sm:mb-8 sm:px-6 sm:py-4 sm:text-base">
        Thank You <span className="font-semibold text-emerald-700">{customerName}</span>,
        Your order have been received !
      </div>

      <div className="print-area overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="bg-slate-100/60 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide text-slate-900 sm:text-3xl">
                INVOICE
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Status : <span className="font-medium text-slate-900">{statusLabel}</span>
              </p>
              <p className="mt-2 break-all text-xs text-slate-500 sm:text-sm">
                Ref: <span className="font-semibold text-slate-700">#{invoiceRef || "-"}</span>
              </p>
            </div>
            <div className="text-left text-sm text-slate-600 lg:text-right">
              <div className="text-lg font-bold text-emerald-600">KACHA BAZAR</div>
              <div>59 Station Rd, Purls Bridge,</div>
              <div>United Kingdom</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-200 pt-6 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
              <p className="mt-2 text-sm text-slate-900">{formatDate(createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice No.</p>
              <p className="mt-2 break-all text-sm text-slate-900">#{invoiceRef}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice To</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{customerName}</p>
              <p className="text-sm text-slate-600">{customerEmail}</p>
              <p className="text-sm text-slate-600">{customerPhone}</p>
              <p className="text-sm text-slate-600">{customerAddress}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="space-y-3 md:hidden">
            {items.length > 0 ? (
              items.map((item, index) => {
                const quantity = getItemQuantity(item);
                const price = getItemPrice(item);
                const lineTotal = Number(item?.lineTotal ?? item?.total ?? price * quantity);
                return (
                  <div
                    key={`${item?.id ?? item?.productId ?? index}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{getItemName(item)}</p>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>Quantity</span>
                        <span className="font-medium text-slate-900">{quantity}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Item Price</span>
                        <span className="font-medium text-slate-900">{formatCurrency(price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Amount</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(lineTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No items found.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">SR.</th>
                  <th className="px-4 py-3 text-left font-semibold">PRODUCT NAME</th>
                  <th className="px-4 py-3 text-right font-semibold">QUANTITY</th>
                  <th className="px-4 py-3 text-right font-semibold">ITEM PRICE</th>
                  <th className="px-4 py-3 text-right font-semibold">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? (
                  items.map((item, index) => {
                    const quantity = getItemQuantity(item);
                    const price = getItemPrice(item);
                    const lineTotal = Number(item?.lineTotal ?? item?.total ?? price * quantity);
                    return (
                      <tr
                        key={`${item?.id ?? item?.productId ?? index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-slate-700">{getItemName(item)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{quantity}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(price)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(lineTotal)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-emerald-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment Method</p>
              <p className="mt-2 text-sm text-slate-900">{paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Shipping Cost</p>
              <p className="mt-2 text-sm text-slate-900">{formatCurrency(Number(shippingCost || 0))}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Discount</p>
              <p className="mt-2 text-sm text-slate-900">{formatCurrency(Number(discount || 0))}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Amount</p>
              <p className="mt-3 text-3xl font-extrabold text-red-500 sm:text-4xl">
                {formatCurrency(Number(totalAmount || 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-col gap-3 px-4 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-6 lg:px-8">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </button>
        </div>
      </div>
    </section>
  );
}

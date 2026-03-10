import { Link, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, PackageSearch, Truck } from "lucide-react";
import { getSellerSuborderDetail } from "../../api/sellerOrders.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const STATUS_CLASS = {
  UNPAID: "border-stone-200 bg-stone-100 text-stone-700",
  PENDING_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-stone-300 bg-stone-200 text-stone-700",
  CANCELLED: "border-stone-300 bg-stone-200 text-stone-700",
  UNFULFILLED: "border-stone-200 bg-stone-100 text-stone-700",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-700",
  SHIPPED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const getStatusClass = (value) =>
  STATUS_CLASS[String(value || "").toUpperCase()] ||
  "border-stone-200 bg-stone-100 text-stone-700";

const formatMoney = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StatusChip({ value }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
        value
      )}`}
    >
      {String(value || "-")}
    </span>
  );
}

export default function SellerOrderDetailPage() {
  const { storeId, suborderId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const hasOrderPermission = sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW");

  const detailQuery = useQuery({
    queryKey: ["seller", "suborder", "detail", storeId, suborderId],
    queryFn: () => getSellerSuborderDetail(storeId, suborderId),
    enabled: Boolean(storeId) && Boolean(suborderId) && hasOrderPermission,
    retry: false,
  });

  if (!hasOrderPermission) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include order visibility.
        </p>
      </section>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading suborder detail...</p>
      </section>
    );
  }

  if (detailQuery.isError) {
    const status = Number(detailQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {status === 404
            ? "Suborder not found for this store."
            : detailQuery.error?.response?.data?.message ||
              detailQuery.error?.message ||
              "Failed to load suborder detail."}
        </p>
      </section>
    );
  }

  const detail = detailQuery.data;

  if (!detail) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Suborder detail is not available.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={`/seller/stores/${storeId}/orders`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
          <h2 className="mt-3 text-2xl font-semibold text-stone-950">
            {detail.suborderNumber}
          </h2>
          <p className="mt-2 text-sm text-stone-500">Order {detail.order?.orderNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip value={detail.paymentStatus} />
          <StatusChip value={detail.fulfillmentStatus} />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className={cardClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Buyer
          </p>
          <p className="mt-3 text-lg font-semibold text-stone-950">{detail.buyer?.name || "-"}</p>
          <p className="mt-2 text-sm text-stone-600">{detail.buyer?.email || "-"}</p>
          <p className="mt-1 text-sm text-stone-600">{detail.buyer?.phone || "-"}</p>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Shipping
              </p>
              <p className="text-sm text-stone-500">Read-only summary</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-900">
            {detail.shipping?.fullName || "-"}
          </p>
          <p className="mt-1 text-sm text-stone-600">{detail.shipping?.phoneNumber || "-"}</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {detail.shipping?.addressLine || "No shipping address available."}
          </p>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Payment
              </p>
              <p className="text-sm text-stone-500">Latest payment snapshot</p>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-stone-900">
            {detail.paymentSummary?.status || "No payment yet"}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Ref: {detail.paymentSummary?.internalReference || "-"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Paid: {formatDate(detail.paymentSummary?.paidAt)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Proof review: {detail.paymentSummary?.proof?.reviewStatus || "-"}
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <PackageSearch className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Items</h3>
              <p className="text-sm text-stone-500">Suborder item snapshot</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {Array.isArray(detail.items) && detail.items.length > 0 ? (
              detail.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-stone-900">{item.productName}</p>
                      <p className="mt-1 text-sm text-stone-500">Product #{item.productId}</p>
                    </div>
                    <div className="text-sm text-stone-600">
                      Qty {item.qty} • {formatMoney(item.price)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-stone-900">
                    Total {formatMoney(item.totalPrice)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-500">No items found.</p>
            )}
          </div>
        </article>

        <article className={cardClass}>
          <h3 className="text-lg font-semibold text-stone-950">Totals and Status</h3>
          <dl className="mt-5 space-y-3 text-sm text-stone-600">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd className="font-semibold text-stone-900">
                {formatMoney(detail.totals?.subtotalAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Shipping</dt>
              <dd className="font-semibold text-stone-900">
                {formatMoney(detail.totals?.shippingAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Service Fee</dt>
              <dd className="font-semibold text-stone-900">
                {formatMoney(detail.totals?.serviceFeeAmount)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 pt-3">
              <dt>Total</dt>
              <dd className="text-base font-semibold text-stone-950">
                {formatMoney(detail.totals?.totalAmount)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <p>
              Created: <span className="font-semibold text-stone-900">{formatDate(detail.createdAt)}</span>
            </p>
            <p className="mt-2">
              Paid at: <span className="font-semibold text-stone-900">{formatDate(detail.paidAt)}</span>
            </p>
            <p className="mt-2">
              Checkout mode:{" "}
              <span className="font-semibold text-stone-900">
                {detail.order?.checkoutMode || "-"}
              </span>
            </p>
            <p className="mt-2">
              Payment profile:{" "}
              <span className="font-semibold text-stone-900">
                {detail.paymentProfileSummary?.merchantName || "-"}
              </span>
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}

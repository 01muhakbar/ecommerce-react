import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, PackageSearch, Truck } from "lucide-react";
import {
  getSellerSuborderDetail,
  updateSellerSuborderFulfillment,
} from "../../api/sellerOrders.ts";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const PAYMENT_STATUS_CLASS = {
  UNPAID: "border-stone-200 bg-stone-100 text-stone-700",
  PENDING_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-stone-300 bg-stone-200 text-stone-700",
  CANCELLED: "border-stone-300 bg-stone-200 text-stone-700",
  CREATED: "border-sky-200 bg-sky-50 text-sky-700",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
};

const FULFILLMENT_STATUS_CLASS = {
  UNFULFILLED: "border-stone-200 bg-stone-100 text-stone-700",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-700",
  SHIPPED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-stone-200 bg-stone-100 text-stone-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  processing: "border-sky-200 bg-sky-50 text-sky-700",
  shipped: "border-indigo-200 bg-indigo-50 text-indigo-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-stone-300 bg-stone-200 text-stone-700",
};

const CHECKOUT_MODE_CLASS = {
  LEGACY: "border-stone-200 bg-stone-100 text-stone-700",
  SINGLE_STORE: "border-sky-200 bg-sky-50 text-sky-700",
  MULTI_STORE: "border-teal-200 bg-teal-50 text-teal-700",
};

const getStatusClass = (value, map) =>
  map[String(value || "").trim()] || map[String(value || "").toUpperCase()] ||
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

const formatActionList = (items = []) =>
  Array.isArray(items) && items.length > 0
    ? items.map((item) => String(item || "").replaceAll("_", " ").toLowerCase()).join(", ")
    : "-";

const formatTransitionLabel = (status) =>
  String(status || "")
    .replaceAll("_", " ")
    .toLowerCase();

function StatusChip({ value, label, map = PAYMENT_STATUS_CLASS }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(value, map)}`}
    >
      {label || String(value || "-")}
    </span>
  );
}

export default function SellerOrderDetailPage() {
  const { storeId, suborderId } = useParams();
  const queryClient = useQueryClient();
  const { sellerContext } = useOutletContext() || {};
  const [feedback, setFeedback] = useState(null);
  const hasOrderPermission = sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW");
  const numericSuborderId = Number(suborderId);
  const hasValidSuborderId = Number.isInteger(numericSuborderId) && numericSuborderId > 0;

  const detailQuery = useQuery({
    queryKey: ["seller", "suborder", "detail", storeId, suborderId],
    queryFn: () => getSellerSuborderDetail(storeId, suborderId),
    enabled: Boolean(storeId) && hasValidSuborderId && hasOrderPermission,
    retry: false,
  });

  const fulfillmentMutation = useMutation({
    mutationFn: (action) => updateSellerSuborderFulfillment(storeId, suborderId, { action }),
    onMutate: () => {
      setFeedback(null);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Seller fulfillment updated.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "suborders", storeId] });
      await queryClient.invalidateQueries({
        queryKey: ["seller", "suborder", "detail", storeId, suborderId],
      });
    },
    onError: (error) => {
      const code = String(error?.response?.data?.code || "").toUpperCase();
      const message =
        code === "INVALID_FULFILLMENT_TRANSITION"
          ? "This fulfillment step is not valid for the current suborder state."
          : code === "FULFILLMENT_STATUS_ALREADY_SET"
            ? "This suborder is already on the requested fulfillment status."
            : code === "SUBORDER_NOT_FOUND"
              ? "Suborder not found for this store."
              : code === "SELLER_PERMISSION_DENIED"
                ? "Your current seller role cannot run fulfillment actions."
                : error?.response?.data?.message ||
                  error?.message ||
                  "Failed to update seller fulfillment.";

      setFeedback({
        type: "error",
        message,
      });
    },
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

  if (!hasValidSuborderId) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Seller order detail needs a valid suborder id in the URL.
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
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {getSellerRequestErrorMessage(detailQuery.error, {
            notFoundMessage: "Suborder not found for this store.",
            forbiddenMessage: "This account cannot access the selected seller workspace.",
            permissionMessage: "Your current seller access does not include order visibility.",
            fallbackMessage: "Failed to load suborder detail.",
          })}
        </p>
      </section>
    );
  }

  const detail = detailQuery.data;
  const fulfillmentGovernance = detail?.governance?.fulfillment ?? null;

  if (!detail) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Suborder detail is not available.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <section
          className={`rounded-[22px] border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

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
          <p className="mt-2 text-sm text-stone-500">
            Parent order {detail.order?.orderNumber || "-"} · {detail.scope?.relationLabel}
          </p>
          <p className="mt-2 text-sm text-stone-500">
            {fulfillmentGovernance?.actorHasManagePermission
              ? "Seller fulfillment phase 1 is active for direct forward transitions only. Parent order and payment lifecycle remain on separate governance lanes."
              : "Seller fulfillment stays read-only here for this actor. Parent order and payment lifecycle remain on separate governance lanes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip
            value={detail.paymentStatus}
            label={`Suborder ${detail.paymentStatusMeta?.label || detail.paymentStatus}`}
            map={PAYMENT_STATUS_CLASS}
          />
          <StatusChip
            value={detail.fulfillmentStatus}
            label={`Fulfillment ${detail.fulfillmentStatusMeta?.label || detail.fulfillmentStatus}`}
            map={FULFILLMENT_STATUS_CLASS}
          />
          <StatusChip
            value={detail.order?.checkoutMode}
            label={detail.order?.checkoutModeMeta?.label || detail.order?.checkoutMode || "-"}
            map={CHECKOUT_MODE_CLASS}
          />
          {detail.paymentSummary?.status ? (
            <StatusChip
              value={detail.paymentSummary.status}
              label={`Payment ${detail.paymentSummary.statusMeta?.label || detail.paymentSummary.status}`}
              map={PAYMENT_STATUS_CLASS}
            />
          ) : null}
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
          <p className="mt-4 text-sm font-semibold text-stone-900">{detail.shipping?.fullName || "-"}</p>
          <p className="mt-1 text-sm text-stone-600">{detail.shipping?.phoneNumber || "-"}</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {detail.shipping?.addressLine || "No shipping address available."}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            {detail.fulfillmentStatusMeta?.description || "Seller fulfillment snapshot."}
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
            {detail.paymentSummary?.statusMeta?.label || detail.paymentSummary?.status || "No payment yet"}
          </p>
          <p className="mt-2 text-sm text-stone-600">
            Suborder payment: {detail.paymentStatusMeta?.label || detail.paymentStatus}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Payment record: {detail.paymentSummary?.statusMeta?.label || detail.paymentSummary?.status || "-"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Ref: {detail.paymentSummary?.internalReference || "-"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Paid: {formatDate(detail.paymentSummary?.paidAt)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Proof review: {detail.paymentSummary?.proof?.reviewMeta?.label || detail.paymentSummary?.proof?.reviewStatus || "-"}
          </p>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            {detail.paymentSummary?.statusMeta?.description ||
              "No payment record is attached to this suborder yet."}
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

        <div className="space-y-6">
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
                Parent lifecycle:{" "}
                <span className="font-semibold text-stone-900">
                  {detail.order?.statusMeta?.label || detail.order?.status || "-"}
                </span>
              </p>
              <p className="mt-2">
                Parent payment:{" "}
                <span className="font-semibold text-stone-900">
                  {detail.order?.paymentStatusMeta?.label || detail.order?.paymentStatus || "-"}
                </span>
              </p>
              <p className="mt-2">
                Checkout mode:{" "}
                <span className="font-semibold text-stone-900">
                  {detail.order?.checkoutModeMeta?.label || detail.order?.checkoutMode || "-"}
                </span>
              </p>
              <p>
                Created: <span className="font-semibold text-stone-900">{formatDate(detail.createdAt)}</span>
              </p>
              <p className="mt-2">
                Paid at: <span className="font-semibold text-stone-900">{formatDate(detail.paidAt)}</span>
              </p>
              <p className="mt-2">
                Payment profile:{" "}
                <span className="font-semibold text-stone-900">
                  {detail.paymentProfileSummary?.merchantName || "-"}
                </span>
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Parent order lifecycle can move on a different lane from seller fulfillment. Use the
                suborder payment and fulfillment statuses above as the seller-scoped operational truth.
              </p>
            </div>
          </article>

          <article className={cardClass}>
            <h3 className="text-lg font-semibold text-stone-950">Fulfillment Governance</h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {fulfillmentGovernance?.mutationBlockedReason ||
                "Seller fulfillment mutations are still closed in the current workspace phase."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusChip
                value={fulfillmentGovernance?.currentMode || "READ_ONLY"}
                label={fulfillmentGovernance?.currentMode || "READ_ONLY"}
                map={FULFILLMENT_STATUS_CLASS}
              />
              <StatusChip
                value={fulfillmentGovernance?.entity || "SUBORDER"}
                label={fulfillmentGovernance?.entity || "SUBORDER"}
                map={CHECKOUT_MODE_CLASS}
              />
            </div>
            <p className="mt-4 text-sm text-stone-600">
              Scope:{" "}
              <span className="font-semibold text-stone-900">
                {fulfillmentGovernance?.scopeLabel ||
                  "Fulfillment actions must stay scoped to the active store suborder."}
              </span>
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Permission lane:{" "}
              <span className="font-semibold text-stone-900">
                {fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}
              </span>
              {" · "}
              {fulfillmentGovernance?.actorHasManagePermission
                ? "actor can run phase-1 transitions"
                : "view-only actor right now"}
            </p>
            {fulfillmentGovernance?.availableActions?.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {fulfillmentGovernance.availableActions.map((action) => (
                  <button
                    key={action.code}
                    type="button"
                    onClick={() => fulfillmentMutation.mutate(action.code)}
                    disabled={fulfillmentMutation.isPending}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {fulfillmentMutation.isPending
                      ? "Saving..."
                      : `${action.label} -> ${formatTransitionLabel(action.nextStatus)}`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {fulfillmentGovernance?.mutationBlockedReason ||
                  "No fulfillment mutation is available for this suborder."}
              </p>
            )}
            <div className="mt-4 grid gap-3 text-sm text-stone-600">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="font-semibold text-stone-900">Safe later for seller</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.sellerCandidateActions)}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="font-semibold text-stone-900">Read-only now</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.readOnlyActions)}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="font-semibold text-stone-900">Keep under admin governance</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.adminOnlyActions)}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

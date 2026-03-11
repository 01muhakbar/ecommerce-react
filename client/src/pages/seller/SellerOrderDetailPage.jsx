import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, PackageSearch, Truck } from "lucide-react";
import {
  getSellerSuborderDetail,
  updateSellerSuborderFulfillment,
} from "../../api/sellerOrders.ts";
import {
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const PAYMENT_STATUS_TONE = {
  UNPAID: "stone",
  PARTIALLY_PAID: "amber",
  PENDING_CONFIRMATION: "amber",
  PAID: "emerald",
  FAILED: "rose",
  EXPIRED: "stone",
  CANCELLED: "stone",
  CREATED: "sky",
  REJECTED: "rose",
};

const FULFILLMENT_STATUS_TONE = {
  UNFULFILLED: "stone",
  PROCESSING: "sky",
  SHIPPED: "indigo",
  DELIVERED: "emerald",
  pending: "stone",
  paid: "emerald",
  processing: "sky",
  shipped: "indigo",
  delivered: "emerald",
  completed: "emerald",
  cancelled: "stone",
};

const CHECKOUT_MODE_TONE = {
  LEGACY: "stone",
  SINGLE_STORE: "sky",
  MULTI_STORE: "teal",
};

const getTone = (value, map) => map[String(value || "").trim()] || map[String(value || "").toUpperCase()] || "stone";

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

function StatusChip({ value, label, map = PAYMENT_STATUS_TONE }) {
  return <SellerWorkspaceBadge label={label || String(value || "-")} tone={getTone(value, map)} />;
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
          : code === "SUBORDER_PAYMENT_NOT_SETTLED"
            ? "This store split must be paid before seller fulfillment can move forward."
            : code === "PARENT_ORDER_CANCELLED"
              ? "Parent order is cancelled, so seller fulfillment can no longer move forward."
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

  const backButton = (
    <Link
      key="back"
      to={`/seller/stores/${storeId}/orders`}
      className={sellerSecondaryButtonClass}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to orders
    </Link>
  );

  if (!hasOrderPermission) {
    return (
      <SellerWorkspaceSectionCard
        title="Order visibility is unavailable"
        hint="Your current seller access does not include order visibility."
        Icon={Truck}
      />
    );
  }

  if (!hasValidSuborderId) {
    return (
      <SellerWorkspaceSectionCard
        title="Seller order detail needs a valid suborder id"
        hint="Open this page from the seller orders lane with a valid suborder row."
        Icon={Truck}
        actions={backButton}
      />
    );
  }

  if (detailQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading suborder detail"
        hint="Fetching the seller-scoped operational snapshot for this suborder."
        Icon={Truck}
        actions={backButton}
      />
    );
  }

  if (detailQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load suborder detail"
        hint={getSellerRequestErrorMessage(detailQuery.error, {
          notFoundMessage: "Suborder not found for this store.",
          forbiddenMessage: "This account cannot access the selected seller workspace.",
          permissionMessage: "Your current seller access does not include order visibility.",
          fallbackMessage: "Failed to load suborder detail.",
        })}
        Icon={Truck}
        actions={backButton}
      />
    );
  }

  const detail = detailQuery.data;
  const fulfillmentGovernance = detail?.governance?.fulfillment ?? null;

  if (!detail) {
    return (
      <SellerWorkspaceSectionCard
        title="Suborder detail is not available"
        hint="This suborder snapshot is unavailable for the active seller store."
        Icon={Truck}
        actions={backButton}
      />
    );
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <SellerWorkspaceNotice type={feedback.type === "success" ? "success" : "error"}>
          {feedback.message}
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceSectionHeader
        eyebrow="Seller Order Detail"
        title={detail.suborderNumber}
        description={`Parent order ${detail.order?.orderNumber || "-"} · ${detail.scope?.relationLabel}`}
        actions={[
          backButton,
          <StatusChip
            key="payment"
            value={detail.paymentStatus}
            label={`Suborder ${detail.paymentStatusMeta?.label || detail.paymentStatus}`}
            map={PAYMENT_STATUS_TONE}
          />,
          <StatusChip
            key="fulfillment"
            value={detail.fulfillmentStatus}
            label={`Fulfillment ${detail.fulfillmentStatusMeta?.label || detail.fulfillmentStatus}`}
            map={FULFILLMENT_STATUS_TONE}
          />,
          <StatusChip
            key="checkout"
            value={detail.order?.checkoutMode}
            label={detail.order?.checkoutModeMeta?.label || detail.order?.checkoutMode || "-"}
            map={CHECKOUT_MODE_TONE}
          />,
          detail.paymentSummary?.status ? (
            <StatusChip
              key="record"
              value={detail.paymentSummary.status}
              label={`Payment ${detail.paymentSummary.statusMeta?.label || detail.paymentSummary.status}`}
              map={PAYMENT_STATUS_TONE}
            />
          ) : null,
        ].filter(Boolean)}
      >
        <p className="text-sm leading-6 text-slate-500">
          {fulfillmentGovernance?.actorHasManagePermission
            ? "Seller fulfillment phase 1 is active for direct forward transitions only. Parent order and payment lifecycle remain on separate governance lanes."
            : "Seller fulfillment stays read-only here for this actor. Parent order and payment lifecycle remain on separate governance lanes."}
        </p>
      </SellerWorkspaceSectionHeader>

      <section className="grid gap-4 lg:grid-cols-3">
        <SellerWorkspaceSectionCard title="Buyer" hint="Seller-scoped buyer snapshot" Icon={PackageSearch}>
          <p className="text-lg font-semibold text-slate-900">{detail.buyer?.name || "-"}</p>
          <p className="mt-2 text-sm text-slate-600">{detail.buyer?.email || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">{detail.buyer?.phone || "-"}</p>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard title="Shipping" hint="Read-only delivery summary" Icon={Truck}>
          <p className="text-sm font-semibold text-slate-900">{detail.shipping?.fullName || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">{detail.shipping?.phoneNumber || "-"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {detail.shipping?.addressLine || "No shipping address available."}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {detail.fulfillmentStatusMeta?.description || "Seller fulfillment snapshot."}
          </p>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Payment"
          hint="Latest payment snapshot"
          Icon={CreditCard}
        >
          <p className="text-sm font-semibold text-slate-900">
            {detail.paymentSummary?.statusMeta?.label || detail.paymentSummary?.status || "No payment yet"}
          </p>
          <div className="mt-4 grid gap-3">
            <SellerWorkspaceDetailItem
              label="Suborder Payment"
              value={detail.paymentStatusMeta?.label || detail.paymentStatus}
            />
            <SellerWorkspaceDetailItem
              label="Payment Record"
              value={
                detail.paymentSummary?.statusMeta?.label ||
                detail.paymentSummary?.status ||
                "-"
              }
            />
            <SellerWorkspaceDetailItem
              label="Reference"
              value={detail.paymentSummary?.internalReference || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Paid"
              value={formatDate(detail.paymentSummary?.paidAt)}
            />
            <SellerWorkspaceDetailItem
              label="Proof Review"
              value={
                detail.paymentSummary?.proof?.reviewMeta?.label ||
                detail.paymentSummary?.proof?.reviewStatus ||
                "-"
              }
              hint={
                detail.paymentSummary?.statusMeta?.description ||
                "No payment record is attached to this suborder yet."
              }
            />
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SellerWorkspaceSectionCard
          title="Items"
          hint="Suborder item snapshot"
          Icon={PackageSearch}
        >
          <div className="space-y-3">
            {Array.isArray(detail.items) && detail.items.length > 0 ? (
              detail.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="mt-1 text-sm text-slate-500">Product #{item.productId}</p>
                    </div>
                    <div className="text-sm text-slate-600">
                      Qty {item.qty} · {formatMoney(item.price)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Total {formatMoney(item.totalPrice)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No items found.</p>
            )}
          </div>
        </SellerWorkspaceSectionCard>

        <div className="space-y-6">
          <SellerWorkspaceSectionCard
            title="Totals and Status"
            hint="Financial and lifecycle summary for this seller-scoped suborder."
            Icon={CreditCard}
          >
            <div className="grid gap-3">
              <SellerWorkspaceDetailItem
                label="Subtotal"
                value={formatMoney(detail.totals?.subtotalAmount)}
              />
              <SellerWorkspaceDetailItem
                label="Shipping"
                value={formatMoney(detail.totals?.shippingAmount)}
              />
              <SellerWorkspaceDetailItem
                label="Service Fee"
                value={formatMoney(detail.totals?.serviceFeeAmount)}
              />
              <SellerWorkspaceDetailItem
                label="Total"
                value={formatMoney(detail.totals?.totalAmount)}
              />
            </div>

            <div className="mt-4 grid gap-3">
              <SellerWorkspaceDetailItem
                label="Parent Lifecycle"
                value={detail.order?.statusMeta?.label || detail.order?.status || "-"}
              />
              <SellerWorkspaceDetailItem
                label="Parent Payment"
                value={
                  detail.order?.paymentStatusMeta?.label ||
                  detail.order?.paymentStatus ||
                  "-"
                }
              />
              <SellerWorkspaceDetailItem
                label="Checkout Mode"
                value={
                  detail.order?.checkoutModeMeta?.label ||
                  detail.order?.checkoutMode ||
                  "-"
                }
              />
              <SellerWorkspaceDetailItem
                label="Created"
                value={formatDate(detail.createdAt)}
              />
              <SellerWorkspaceDetailItem
                label="Paid At"
                value={formatDate(detail.paidAt)}
              />
              <SellerWorkspaceDetailItem
                label="Payment Profile"
                value={detail.paymentProfileSummary?.merchantName || "-"}
              />
            </div>

            <SellerWorkspaceNotice type="info" className="mt-4">
              Parent order lifecycle can move on a different lane from seller fulfillment. Use the
              suborder payment and fulfillment statuses above as the seller-scoped operational
              truth.
            </SellerWorkspaceNotice>
          </SellerWorkspaceSectionCard>

          <SellerWorkspaceSectionCard
            title="Fulfillment Governance"
            hint="Operational transition lane for the current seller actor."
            Icon={Truck}
            actions={
              fulfillmentGovernance?.actorHasManagePermission ? (
                <SellerWorkspaceBadge
                  label={fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}
                  tone="emerald"
                />
              ) : (
                <SellerWorkspaceBadge label="Read-only actor" tone="stone" />
              )
            }
          >
            <SellerWorkspaceNotice
              type={fulfillmentGovernance?.actorHasManagePermission ? "info" : "warning"}
            >
              {fulfillmentGovernance?.mutationBlockedReason ||
                "Seller fulfillment mutations are still closed in the current workspace phase."}
            </SellerWorkspaceNotice>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusChip
                value={fulfillmentGovernance?.currentMode || "READ_ONLY"}
                label={fulfillmentGovernance?.currentMode || "READ_ONLY"}
                map={FULFILLMENT_STATUS_TONE}
              />
              <StatusChip
                value={fulfillmentGovernance?.entity || "SUBORDER"}
                label={fulfillmentGovernance?.entity || "SUBORDER"}
                map={CHECKOUT_MODE_TONE}
              />
            </div>

            <div className="mt-4 grid gap-3">
              <SellerWorkspaceDetailItem
                label="Scope"
                value={
                  fulfillmentGovernance?.scopeLabel ||
                  "Fulfillment actions must stay scoped to the active store suborder."
                }
              />
              <SellerWorkspaceDetailItem
                label="Permission Lane"
                value={fulfillmentGovernance?.permissionKey || "ORDER_FULFILLMENT_MANAGE"}
                hint={
                  fulfillmentGovernance?.actorHasManagePermission
                    ? "This actor can run phase-1 transitions."
                    : "This actor is currently view-only."
                }
              />
            </div>

            {fulfillmentGovernance?.availableActions?.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {fulfillmentGovernance.availableActions.map((action) => (
                  <button
                    key={action.code}
                    type="button"
                    onClick={() => fulfillmentMutation.mutate(action.code)}
                    disabled={fulfillmentMutation.isPending}
                    className={
                      action.nextStatus === "DELIVERED"
                        ? sellerPrimaryButtonClass
                        : sellerSecondaryButtonClass
                    }
                  >
                    {fulfillmentMutation.isPending
                      ? "Saving..."
                      : `${action.label} -> ${formatTransitionLabel(action.nextStatus)}`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {fulfillmentGovernance?.mutationBlockedReason ||
                  "No fulfillment mutation is available for this suborder."}
              </p>
            )}

            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Safe later for seller</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.sellerCandidateActions)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Read-only now</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.readOnlyActions)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Keep under admin governance</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.adminOnlyActions)}
                </p>
              </div>
            </div>
          </SellerWorkspaceSectionCard>
        </div>
      </section>
    </div>
  );
}

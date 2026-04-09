import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  getOrderContractMeta,
  getOrderContractSummary,
} from "../../utils/orderContract.ts";
import {
  ENABLE_MULTISTORE_SHIPMENT_MVP,
  ENABLE_MULTISTORE_SHIPMENT_MUTATION,
} from "../../config/featureFlags.js";

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

const getSellerStatusMeta = (detail) =>
  getOrderContractSummary(detail?.contract) ||
  detail?.readModel?.primaryStatus ||
  detail?.fulfillmentStatusMeta ||
  null;

const getSellerPaymentMeta = (detail) =>
  getOrderContractMeta(detail?.contract, "paymentStatusMeta") ||
  detail?.readModel?.paymentState ||
  detail?.paymentStatusMeta ||
  null;

const getParentOrderMeta = (detail) =>
  getOrderContractMeta(detail?.contract, "parentOrderStatusMeta") ||
  detail?.readModel?.parentOrder?.statusMeta ||
  detail?.order?.statusMeta ||
  null;

const getParentPaymentMeta = (detail) =>
  getOrderContractMeta(detail?.contract, "parentPaymentStatusMeta") ||
  detail?.readModel?.parentOrder?.paymentStatusMeta ||
  detail?.order?.paymentStatusMeta ||
  null;

export default function SellerOrderDetailPage() {
  const { suborderId } = useParams();
  const queryClient = useQueryClient();
  const { sellerContext, workspaceStoreId: storeId, workspaceRoutes } =
    useSellerWorkspaceRoute();
  const [feedback, setFeedback] = useState(null);
  const [trackingForm, setTrackingForm] = useState({
    courierCode: "",
    courierService: "",
    trackingNumber: "",
  });
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
    mutationFn: (payload) => updateSellerSuborderFulfillment(storeId, suborderId, payload),
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
            : code === "SHIPMENT_MUTATION_DISABLED"
              ? "Shipment mutation is disabled in the current rollout."
              : code === "TRACKING_NUMBER_REQUIRED"
                ? "Tracking number is required before the shipment can be marked as shipped."
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
      to={workspaceRoutes.orders()}
      className={sellerSecondaryButtonClass}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to orders
    </Link>
  );

  const detail = detailQuery.data;
  const fulfillmentGovernance = detail?.governance?.fulfillment ?? null;
  const sellerStatusMeta = getSellerStatusMeta(detail);
  const sellerPaymentMeta = getSellerPaymentMeta(detail);
  const parentOrderMeta = getParentOrderMeta(detail);
  const parentPaymentMeta = getParentPaymentMeta(detail);
  const primaryShipment =
    ENABLE_MULTISTORE_SHIPMENT_MVP && Array.isArray(detail?.shipments) && detail.shipments.length > 0
      ? detail.shipments[0]
      : null;
  const hasPersistedShipment = Boolean(primaryShipment?.shipmentId);
  const shipmentActions = Array.isArray(primaryShipment?.availableShippingActions)
    ? primaryShipment.availableShippingActions
    : [];
  const enabledShipmentActions = new Set(
    shipmentActions.filter((action) => action?.enabled).map((action) => action.code)
  );
  const trackingMutationEnabled =
    hasPersistedShipment && ENABLE_MULTISTORE_SHIPMENT_MUTATION;
  const shipmentActionBlockedReason =
    (!ENABLE_MULTISTORE_SHIPMENT_MUTATION
      ? "Shipment mutation is disabled in the current rollout."
      : shipmentActions.find((action) => action?.enabled === false && action?.reason)?.reason) ||
    primaryShipment?.shipmentStatusMeta?.description ||
    fulfillmentGovernance?.mutationBlockedReason ||
    "Shipment mutation is currently unavailable.";

  useEffect(() => {
    if (!primaryShipment) return;
    setTrackingForm({
      courierCode: primaryShipment.courierCode || "",
      courierService: primaryShipment.courierService || "",
      trackingNumber: primaryShipment.trackingNumber || "",
    });
  }, [
    primaryShipment?.shipmentId,
    primaryShipment?.courierCode,
    primaryShipment?.courierService,
    primaryShipment?.trackingNumber,
  ]);

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
    <div className="space-y-5">
      {feedback ? (
        <SellerWorkspaceNotice type={feedback.type === "success" ? "success" : "error"}>
          {feedback.message}
        </SellerWorkspaceNotice>
      ) : null}

      <SellerWorkspaceSectionHeader
        eyebrow="Seller Order Detail"
        title={detail.suborderNumber}
        description={`Parent order ${detail.order?.orderNumber || "-"} · ${detail.scope?.relationLabel} · items and totals stay scoped to this store split.`}
        actions={[
          backButton,
          <StatusChip
            key="payment"
            value={detail.paymentStatus}
            label={`Store split ${sellerPaymentMeta?.label || detail.paymentStatus}`}
            map={PAYMENT_STATUS_TONE}
          />,
          <StatusChip
            key="fulfillment"
            value={detail.fulfillmentStatus}
            label={`Seller ${sellerStatusMeta?.label || detail.fulfillmentStatus}`}
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
        <p className="text-sm leading-5 text-slate-500">
          {fulfillmentGovernance?.actorHasManagePermission
            ? "Seller shipment operations now follow persisted shipment truth for this store split. Parent order and payment lifecycle remain on separate governance lanes."
            : "Seller shipment stays read-only here for this actor. Parent order and payment lifecycle remain on separate governance lanes."}
        </p>
      </SellerWorkspaceSectionHeader>

      {detail.shippingSetupStatus && !detail.isShippingReady ? (
        <SellerWorkspaceNotice
          type={detail.shippingSetupStatus.code === "DISABLED" ? "info" : "warning"}
        >
          {detail.shippingSetupMeta?.message ||
            detail.shippingSetupStatus.description ||
            "Store shipping setup is not ready yet."}
        </SellerWorkspaceNotice>
      ) : null}

      {ENABLE_MULTISTORE_SHIPMENT_MVP &&
      Array.isArray(detail.shipments) &&
      detail.shipments.length > 0 ? (
        <SellerWorkspaceSectionCard
          title="Shipment Summary"
          hint="Persisted shipment truth for this store split. Seller actions only appear when backend actionability allows them."
          Icon={PackageSearch}
        >
          <div className="grid gap-3">
            {detail.shipments.map((shipment) => (
              <div
                key={shipment.shipmentId || `shipment-${shipment.suborderId || shipment.storeId || shipment.storeName}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {shipment.storeName || detail.suborderNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {shipment.suborderNumber || detail.suborderNumber}
                    </p>
                  </div>
                  <StatusChip
                    value={shipment.shipmentStatus}
                    label={shipment.shipmentStatusMeta?.label || shipment.shipmentStatus}
                    map={{
                      WAITING_PAYMENT: "amber",
                      READY_TO_FULFILL: "sky",
                      PROCESSING: "sky",
                      PACKED: "sky",
                      SHIPPED: "indigo",
                      IN_TRANSIT: "indigo",
                      OUT_FOR_DELIVERY: "indigo",
                      DELIVERED: "emerald",
                      FAILED_DELIVERY: "rose",
                      RETURNED: "stone",
                      CANCELLED: "stone",
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <SellerWorkspaceDetailItem
                    label="Source"
                    value={shipment.usedLegacyFallback ? "Legacy fallback" : "Persisted shipment"}
                  />
                  <SellerWorkspaceDetailItem
                    label="Tracking"
                    value={shipment.trackingNumber || "Not assigned yet"}
                  />
                  <SellerWorkspaceDetailItem
                    label="Courier"
                    value={shipment.courierService || shipment.courierCode || "Pending assignment"}
                  />
                  <SellerWorkspaceDetailItem
                    label="Shipping Fee"
                    value={formatMoney(shipment.shippingFee || 0)}
                  />
                  <SellerWorkspaceDetailItem
                    label="Shipment Items"
                    value={String(shipment.shipmentItems.length)}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {shipment.shipmentStatusMeta?.description ||
                    "Shipment truth is available for this store split."}
                </p>
                {shipment.compatibilityMatchesStorage === false ? (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    Shipment truth is ahead of compatibility storage for this suborder and should be audited.
                  </div>
                ) : null}
                {shipment.incompleteTrackingData ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Courier or tracking detail is incomplete for the current shipment stage.
                  </div>
                ) : null}
                {!detail.isShippingReady && detail.shippingSetupSummary ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Seller shipping setup is not ready for this store. Review Store Profile before continuing shipment operations.
                  </div>
                ) : null}
                {Array.isArray(shipment.trackingEvents) && shipment.trackingEvents.length > 0 ? (
                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Tracking Timeline
                    </p>
                    {shipment.trackingEvents.map((event) => (
                      <div
                        key={event.eventId || `${event.status}-${event.happenedAt || "event"}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {event.statusMeta?.label || event.status || "Update"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(event.happenedAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {event.note || event.statusMeta?.description || "Shipment updated."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SellerWorkspaceSectionCard>
      ) : null}

      <section className="grid gap-3.5 lg:grid-cols-3">
        <SellerWorkspaceSectionCard title="Buyer" hint="Seller-scoped buyer snapshot" Icon={PackageSearch}>
          <p className="text-base font-semibold text-slate-900">{detail.buyer?.name || "-"}</p>
          <p className="mt-1.5 text-sm text-slate-600">{detail.buyer?.email || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">{detail.buyer?.phone || "-"}</p>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard title="Shipping" hint="Read-only delivery summary" Icon={Truck}>
          <p className="text-sm font-semibold text-slate-900">{detail.shipping?.fullName || "-"}</p>
          <p className="mt-1 text-sm text-slate-600">{detail.shipping?.phoneNumber || "-"}</p>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            {detail.shipping?.addressLine || "No shipping address available."}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {sellerStatusMeta?.description || "Seller fulfillment snapshot."}
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
              label="Store Split Payment"
              value={sellerPaymentMeta?.label || detail.paymentStatus}
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

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
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
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5"
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
                  <p className="mt-2.5 text-sm font-semibold text-slate-900">
                    Total {formatMoney(item.totalPrice)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No items found.</p>
            )}
          </div>
        </SellerWorkspaceSectionCard>

        <div className="space-y-5">
          <SellerWorkspaceSectionCard
            title="Totals and Status"
            hint="Financial and lifecycle summary for this seller-scoped suborder."
            Icon={CreditCard}
          >
            <div className="grid gap-3">
              <SellerWorkspaceDetailItem
                label="Seller Status"
                value={sellerStatusMeta?.label || detail.fulfillmentStatus}
                hint={sellerStatusMeta?.description || "Seller fulfillment is the primary operational status for this store split."}
              />
              <SellerWorkspaceDetailItem
                label="Store Scope"
                value={`${detail.readModel?.sellerScope?.itemCount || detail.items?.length || 0} item${(detail.readModel?.sellerScope?.itemCount || detail.items?.length || 0) === 1 ? "" : "s"}`}
                hint={
                  detail.readModel?.sellerScope?.itemScopeLabel ||
                  "Item counts and totals only include this store-owned suborder."
                }
              />
            </div>

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

            <div className="mt-3.5 grid gap-3">
              <SellerWorkspaceDetailItem
                label="Parent Lifecycle"
                value={parentOrderMeta?.label || detail.order?.status || "-"}
                hint={detail.readModel?.parentOrder?.note || undefined}
              />
              <SellerWorkspaceDetailItem
                label="Parent Payment"
                value={parentPaymentMeta?.label || detail.order?.paymentStatus || "-"}
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
              {sellerStatusMeta?.description ||
                detail.readModel?.operationalNote ||
                "Parent order lifecycle can move on a different lane from seller fulfillment. Use the suborder payment and fulfillment statuses above as the seller-scoped operational truth."}
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
              {hasPersistedShipment
                ? shipmentActionBlockedReason
                : fulfillmentGovernance?.mutationBlockedReason ||
                  "Seller fulfillment mutations are still closed in the current workspace phase."}
            </SellerWorkspaceNotice>

            <div className="mt-3.5 flex flex-wrap gap-2">
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

            <div className="mt-3.5 grid gap-3">
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

            {hasPersistedShipment ? (
              <div className="mt-4 space-y-3">
                {trackingMutationEnabled && enabledShipmentActions.has("MARK_PROCESSING") ? (
                  <button
                    type="button"
                    onClick={() => fulfillmentMutation.mutate({ action: "MARK_PROCESSING" })}
                    disabled={fulfillmentMutation.isPending}
                    className={sellerSecondaryButtonClass}
                  >
                    {fulfillmentMutation.isPending ? "Saving..." : "Mark packed"}
                  </button>
                ) : null}

                {trackingMutationEnabled && enabledShipmentActions.has("MARK_SHIPPED") ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <p className="text-sm font-semibold text-slate-900">Courier and Tracking</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Dispatch this shipment only after courier and tracking details are ready.
                    </p>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1.5 text-sm text-slate-600">
                        <span>Courier code</span>
                        <input
                          value={trackingForm.courierCode}
                          onChange={(event) =>
                            setTrackingForm((current) => ({
                              ...current,
                              courierCode: event.target.value,
                            }))
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          placeholder="jne"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-slate-600">
                        <span>Courier service</span>
                        <input
                          value={trackingForm.courierService}
                          onChange={(event) =>
                            setTrackingForm((current) => ({
                              ...current,
                              courierService: event.target.value,
                            }))
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          placeholder="REG"
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm text-slate-600">
                        <span>Tracking number</span>
                        <input
                          value={trackingForm.trackingNumber}
                          onChange={(event) =>
                            setTrackingForm((current) => ({
                              ...current,
                              trackingNumber: event.target.value,
                            }))
                          }
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                          placeholder="Input shipment tracking number"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        fulfillmentMutation.mutate({
                          action: "MARK_SHIPPED",
                          courierCode: trackingForm.courierCode,
                          courierService: trackingForm.courierService,
                          trackingNumber: trackingForm.trackingNumber,
                        })
                      }
                      disabled={fulfillmentMutation.isPending}
                      className={`mt-3 ${sellerPrimaryButtonClass}`}
                    >
                      {fulfillmentMutation.isPending ? "Saving..." : "Mark shipped"}
                    </button>
                  </div>
                ) : null}

                {trackingMutationEnabled && enabledShipmentActions.has("MARK_DELIVERED") ? (
                  <button
                    type="button"
                    onClick={() => fulfillmentMutation.mutate({ action: "MARK_DELIVERED" })}
                    disabled={fulfillmentMutation.isPending}
                    className={sellerPrimaryButtonClass}
                  >
                    {fulfillmentMutation.isPending ? "Saving..." : "Confirm delivered"}
                  </button>
                ) : null}

                {!trackingMutationEnabled || shipmentActions.every((action) => !action?.enabled) ? (
                  <p className="text-sm leading-5 text-slate-600">
                    {shipmentActionBlockedReason}
                  </p>
                ) : null}
              </div>
            ) : fulfillmentGovernance?.availableActions?.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {fulfillmentGovernance.availableActions.map((action) => (
                  <button
                    key={action.code}
                    type="button"
                    onClick={() => fulfillmentMutation.mutate({ action: action.code })}
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
              <p className="mt-3.5 text-sm leading-5 text-slate-600">
                {fulfillmentGovernance?.mutationBlockedReason ||
                  "No fulfillment mutation is available for this suborder."}
              </p>
            )}

            <div className="mt-3.5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="font-semibold text-slate-900">Safe later for seller</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.sellerCandidateActions)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                <p className="font-semibold text-slate-900">Read-only now</p>
                <p className="mt-2 leading-6">
                  {formatActionList(fulfillmentGovernance?.readOnlyActions)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5">
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

import { buildFulfillmentStatusMeta } from "./orderLifecycleContract.service.js";
import {
  isMultistoreShipmentMvpEnabled,
  isMultistoreShipmentMutationEnabled,
} from "./featureFlags.service.js";
import { buildStoreShippingSetupReadiness } from "./sellerShippingSetup.service.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const SHIPMENT_STATUSES = new Set([
  "WAITING_PAYMENT",
  "READY_TO_FULFILL",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
]);

const ACTIVE_SHIPMENT_STATUSES = new Set([
  "WAITING_PAYMENT",
  "READY_TO_FULFILL",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "FAILED_DELIVERY",
]);
const SHIPPED_LIKE_STATUSES = new Set(["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY"]);
const PROCESSING_LIKE_STATUSES = new Set(["PROCESSING", "PACKED"]);
const EXCEPTION_ACTIVE_STATUSES = new Set(["FAILED_DELIVERY"]);
const EXCEPTION_FINAL_STATUSES = new Set(["RETURNED", "CANCELLED"]);
const OPERATIONAL_TIMELINE_EXPECTED_STATUSES = new Set([
  "PACKED",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED",
  "CANCELLED",
]);
const SHIPMENT_STATUS_PRIORITY: Record<string, number> = {
  WAITING_PAYMENT: 10,
  READY_TO_FULFILL: 20,
  PROCESSING: 30,
  PACKED: 40,
  SHIPPED: 50,
  IN_TRANSIT: 60,
  OUT_FOR_DELIVERY: 70,
  FAILED_DELIVERY: 75,
  DELIVERED: 80,
  RETURNED: 90,
  CANCELLED: 90,
};

export const normalizeShipmentStatus = (value: unknown, fallback = "WAITING_PAYMENT") => {
  const status = toUpper(value, fallback) || fallback;
  return SHIPMENT_STATUSES.has(status) ? status : fallback;
};

const buildShipmentActionability = (input: {
  featureEnabled: boolean;
  hasPersistedShipment: boolean;
  shipmentStatus: string;
  paymentStatus: string;
  orderStatus: string;
  hasTrackingNumber: boolean;
  shippingSetupBlockedReason?: string | null;
}) => {
  const mutationEnabled = input.featureEnabled && isMultistoreShipmentMutationEnabled();
  const finalStatus = new Set(["DELIVERED", ...EXCEPTION_FINAL_STATUSES]).has(
    input.shipmentStatus
  );

  const disabledByFlagReason = "Shipment mutation is disabled for the current rollout.";
  const legacyOnlyReason =
    "This order still uses legacy fulfillment fallback and has no persisted shipment record.";
  const paymentBlockedReason =
    "Shipment remains blocked until this store split payment is settled.";
  const parentBlockedReason =
    "Parent order is no longer in an operational state for seller shipment mutation.";

  const resolveBaseReason = () => {
    if (!input.featureEnabled || !mutationEnabled) return disabledByFlagReason;
    if (!input.hasPersistedShipment) return legacyOnlyReason;
    if (input.orderStatus === "cancelled" || input.orderStatus === "delivered" || input.orderStatus === "completed") {
      return parentBlockedReason;
    }
    if (input.paymentStatus !== "PAID") return paymentBlockedReason;
    if (String(input.shippingSetupBlockedReason || "").trim()) {
      return String(input.shippingSetupBlockedReason || "").trim();
    }
    if (finalStatus) return "Shipment is already in a final state.";
    return null;
  };

  const baseReason = resolveBaseReason();
  const canOperate = !baseReason;
  const canMarkPacked = canOperate && input.shipmentStatus === "READY_TO_FULFILL";
  const canMarkShipped = canOperate && input.shipmentStatus === "PACKED";
  const canUploadTracking = canMarkShipped;
  const canConfirmDelivery =
    canOperate &&
    (input.shipmentStatus === "SHIPPED" ||
      input.shipmentStatus === "IN_TRANSIT" ||
      input.shipmentStatus === "OUT_FOR_DELIVERY");
  const canMarkFailedDelivery =
    canOperate &&
    (input.shipmentStatus === "SHIPPED" ||
      input.shipmentStatus === "IN_TRANSIT" ||
      input.shipmentStatus === "OUT_FOR_DELIVERY");
  const canMarkReturned = canOperate && input.shipmentStatus === "FAILED_DELIVERY";
  const canCancelShipment =
    canOperate &&
    (input.shipmentStatus === "READY_TO_FULFILL" || input.shipmentStatus === "PACKED");

  return {
    canUploadTracking,
    canMarkPacked,
    canMarkShipped,
    canCancelShipment: false,
    canConfirmDelivery,
    availableShippingActions: [
      {
        code: "MARK_PROCESSING",
        label: "Mark packed",
        enabled: canMarkPacked,
        reason:
          baseReason ||
          (input.shipmentStatus === "PACKED"
            ? "Shipment is already packed."
            : input.shipmentStatus === "SHIPPED" || input.shipmentStatus === "IN_TRANSIT"
              ? "Shipment is already beyond the packing stage."
              : "Seller can pack this shipment after payment is settled and before dispatch."),
      },
      {
        code: "MARK_SHIPPED",
        label: "Mark shipped",
        enabled: canMarkShipped,
        reason:
          baseReason ||
          (input.shipmentStatus === "READY_TO_FULFILL"
            ? "Pack the shipment before dispatch and add tracking details."
            : input.shipmentStatus === "SHIPPED" || input.shipmentStatus === "IN_TRANSIT"
              ? "Shipment is already dispatched."
              : !input.hasTrackingNumber && input.shipmentStatus === "PACKED"
                ? "Provide courier and tracking details before dispatch."
                : "Shipment can be dispatched after it is packed."),
      },
      {
        code: "MARK_DELIVERED",
        label: "Confirm delivered",
        enabled: canConfirmDelivery,
        reason:
          baseReason ||
          (input.shipmentStatus === "PACKED" || input.shipmentStatus === "READY_TO_FULFILL"
            ? "Dispatch the shipment before confirming delivery."
            : input.shipmentStatus === "DELIVERED"
              ? "Shipment is already delivered."
              : "Delivery can be confirmed after shipment dispatch."),
      },
      {
        code: "MARK_FAILED_DELIVERY",
        label: "Mark delivery failed",
        enabled: canMarkFailedDelivery,
        reason:
          baseReason ||
          (input.shipmentStatus === "FAILED_DELIVERY"
            ? "Shipment is already marked as failed delivery."
            : input.shipmentStatus === "RETURNED" || input.shipmentStatus === "CANCELLED"
              ? "Shipment is already closed in an exception state."
              : "Delivery failure can be recorded after dispatch."),
      },
      {
        code: "MARK_RETURNED",
        label: "Mark returned",
        enabled: canMarkReturned,
        reason:
          baseReason ||
          (input.shipmentStatus === "FAILED_DELIVERY"
            ? "Returned shipment can be recorded after failed delivery follow-up."
            : "Return can be recorded only after a failed delivery exception."),
      },
      {
        code: "CANCEL_SHIPMENT",
        label: "Cancel shipment",
        enabled: canCancelShipment,
        reason:
          baseReason ||
          (input.shipmentStatus === "READY_TO_FULFILL" || input.shipmentStatus === "PACKED"
            ? "Shipment can be cancelled before dispatch."
            : "Shipment cancellation is only available before dispatch."),
      },
    ],
  };
};

export const buildShipmentStatusMeta = (value: unknown) => {
  const status = normalizeShipmentStatus(value);
  if (status === "READY_TO_FULFILL") {
    return {
      code: status,
      label: "Ready to Fulfill",
      tone: "sky",
      description: "Payment is settled and shipment can move into seller fulfillment.",
      isFinal: false,
    };
  }
  if (status === "PROCESSING" || status === "PACKED") {
    return {
      code: status,
      label: status === "PACKED" ? "Packed" : "Processing",
      tone: "sky",
      description: "Shipment is being prepared by the seller.",
      isFinal: false,
    };
  }
  if (status === "SHIPPED") {
    return {
      code: status,
      label: "Shipped",
      tone: "indigo",
      description: "Shipment was dispatched from the seller.",
      isFinal: false,
    };
  }
  if (status === "IN_TRANSIT") {
    return {
      code: status,
      label: "In Transit",
      tone: "indigo",
      description: "Shipment is in transit to the buyer.",
      isFinal: false,
    };
  }
  if (status === "OUT_FOR_DELIVERY") {
    return {
      code: status,
      label: "Out for Delivery",
      tone: "indigo",
      description: "Courier is attempting final delivery.",
      isFinal: false,
    };
  }
  if (status === "DELIVERED") {
    return {
      code: status,
      label: "Delivered",
      tone: "emerald",
      description: "Shipment reached the buyer.",
      isFinal: true,
    };
  }
  if (status === "FAILED_DELIVERY") {
    return {
      code: status,
      label: "Delivery Failed",
      tone: "rose",
      description: "Delivery attempt failed and needs follow-up.",
      isFinal: false,
    };
  }
  if (status === "RETURNED") {
    return {
      code: status,
      label: "Returned",
      tone: "stone",
      description: "Shipment was returned and is now final.",
      isFinal: true,
    };
  }
  if (status === "CANCELLED") {
    return {
      code: status,
      label: "Cancelled",
      tone: "stone",
      description: "Shipment was cancelled before completion.",
      isFinal: true,
    };
  }
  return {
    code: "WAITING_PAYMENT",
    label: "Waiting Payment",
    tone: "amber",
    description: "Shipment exists but seller fulfillment stays blocked until payment is ready.",
    isFinal: false,
  };
};

const normalizeTrackingEvent = (event: any) => {
  if (!event || typeof event !== "object") return null;
  const status = normalizeShipmentStatus(
    (event as any).status ?? (event as any).eventType,
    "PROCESSING"
  );
  return {
    eventId: toNumber((event as any).eventId ?? (event as any).id, 0) || null,
    status,
    statusMeta: buildShipmentStatusMeta(status),
    note:
      String(
        (event as any).note ??
          (event as any).eventDescription ??
          (event as any).eventLabel ??
          ""
      ).trim() || null,
    happenedAt:
      (event as any).happenedAt ??
      (event as any).occurredAt ??
      (event as any).createdAt ??
      null,
  };
};

const sortTrackingEvents = (events: any[]) =>
  [...events].sort((left: any, right: any) => {
    const leftTime = new Date(left?.happenedAt || 0).getTime();
    const rightTime = new Date(right?.happenedAt || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return toNumber(right?.eventId, 0) - toNumber(left?.eventId, 0);
  });

const toShipmentItem = (item: any) => ({
  id: toNumber(getAttr(item, "id"), 0) || null,
  productId: toNumber(getAttr(item, "productId"), 0) || null,
  productName: String(
    getAttr(item, "productNameSnapshot") ||
      getAttr(item?.product, "name") ||
      `Product #${getAttr(item, "productId") || "-"}`
  ),
  qty: toNumber(getAttr(item, "qty") ?? getAttr(item, "quantity"), 0),
  price: toNumber(getAttr(item, "priceSnapshot") ?? getAttr(item, "price"), 0),
  lineTotal: toNumber(
    getAttr(item, "totalPrice") ??
      toNumber(getAttr(item, "priceSnapshot") ?? getAttr(item, "price"), 0) *
        toNumber(getAttr(item, "qty") ?? getAttr(item, "quantity"), 0),
    0
  ),
});

export const mapShipmentStatusToCompatibilityFulfillment = (value: unknown) => {
  const status = normalizeShipmentStatus(value);
  if (status === "DELIVERED") return "DELIVERED";
  if (status === "CANCELLED") return "CANCELLED";
  if (EXCEPTION_ACTIVE_STATUSES.has(status) || status === "RETURNED") return "SHIPPED";
  if (PROCESSING_LIKE_STATUSES.has(status)) return "PROCESSING";
  if (SHIPPED_LIKE_STATUSES.has(status)) return "SHIPPED";
  return "UNFULFILLED";
};

const normalizeStoredFulfillmentStatus = (value: unknown) =>
  toUpper(value, "UNFULFILLED") || "UNFULFILLED";

const deriveLegacyShipmentStatus = (input: {
  paymentStatus?: unknown;
  fulfillmentStatus?: unknown;
}) => {
  const fulfillmentStatus = toUpper(input.fulfillmentStatus, "UNFULFILLED") || "UNFULFILLED";
  if (fulfillmentStatus === "CANCELLED") return "CANCELLED";
  if (fulfillmentStatus === "DELIVERED") return "DELIVERED";
  if (fulfillmentStatus === "SHIPPED") return "SHIPPED";
  if (fulfillmentStatus === "PROCESSING") return "PACKED";

  const paymentStatus = toUpper(input.paymentStatus, "UNPAID") || "UNPAID";
  if (paymentStatus === "PAID") return "READY_TO_FULFILL";
  return "WAITING_PAYMENT";
};

const getShipmentPriority = (status: string) =>
  SHIPMENT_STATUS_PRIORITY[normalizeShipmentStatus(status)] ?? 0;

const resolveEffectiveShipmentStatus = (persistedStatus: string, suborder: any) => {
  const normalizedPersisted = normalizeShipmentStatus(persistedStatus, "WAITING_PAYMENT");
  const legacyStatus = deriveLegacyShipmentStatus({
    paymentStatus: getAttr(suborder, "paymentStatus"),
    fulfillmentStatus: getAttr(suborder, "fulfillmentStatus"),
  });

  if (legacyStatus === "CANCELLED") return "CANCELLED";
  if (normalizedPersisted === "RETURNED") return "RETURNED";
  if (normalizedPersisted === "CANCELLED") return "CANCELLED";
  if (normalizedPersisted === "FAILED_DELIVERY") return "FAILED_DELIVERY";

  return getShipmentPriority(legacyStatus) > getShipmentPriority(normalizedPersisted)
    ? legacyStatus
    : normalizedPersisted;
};

const resolveLatestTrackingEvent = (shipments: any[]) => {
  const events = (Array.isArray(shipments) ? shipments : [])
    .flatMap((shipment) =>
      Array.isArray(shipment?.trackingEvents)
        ? shipment.trackingEvents.map(normalizeTrackingEvent)
        : []
    )
    .filter(Boolean);

  if (events.length === 0) return null;
  return [...events].sort((left: any, right: any) => {
    const leftTime = new Date(left?.happenedAt || 0).getTime();
    const rightTime = new Date(right?.happenedAt || 0).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return toNumber(right?.eventId, 0) - toNumber(left?.eventId, 0);
  })[0];
};

const buildShipmentAuditFields = (input: {
  shipmentStatus: string;
  usedLegacyFallback: boolean;
  trackingEvents: any[];
  trackingNumber?: string | null;
  courierCode?: string | null;
  courierService?: string | null;
  storedFulfillmentStatus?: unknown;
}) => {
  const storedFulfillmentStatus = normalizeStoredFulfillmentStatus(
    input.storedFulfillmentStatus
  );
  const compatibilityFulfillmentStatus =
    mapShipmentStatusToCompatibilityFulfillment(input.shipmentStatus);
  const compatibilityMatchesStorage =
    compatibilityFulfillmentStatus === storedFulfillmentStatus;
  const trackingEventCount = Array.isArray(input.trackingEvents)
    ? input.trackingEvents.length
    : 0;
  const missingTrackingTimeline =
    !input.usedLegacyFallback &&
    OPERATIONAL_TIMELINE_EXPECTED_STATUSES.has(input.shipmentStatus) &&
    trackingEventCount === 0;
  const incompleteTrackingData =
    !input.usedLegacyFallback &&
    SHIPPED_LIKE_STATUSES.has(input.shipmentStatus) &&
    (!String(input.trackingNumber || "").trim() ||
      (!String(input.courierCode || "").trim() &&
        !String(input.courierService || "").trim()));

  return {
    usedLegacyFallback: Boolean(input.usedLegacyFallback),
    persistenceState: input.usedLegacyFallback ? "LEGACY_FALLBACK" : "PERSISTED",
    compatibilityFulfillmentStatus,
    compatibilityFulfillmentStatusMeta: buildFulfillmentStatusMeta(
      compatibilityFulfillmentStatus
    ),
    storedFulfillmentStatus,
    storedFulfillmentStatusMeta: buildFulfillmentStatusMeta(storedFulfillmentStatus),
    compatibilityMatchesStorage,
    trackingEventCount,
    missingTrackingTimeline,
    incompleteTrackingData,
  };
};

const finalizeSuborderShippingReadModel = (input: {
  featureEnabled: boolean;
  aggregateShipment: any;
  suborder?: any;
}) => {
  const aggregateShipment = input.aggregateShipment;
  const aggregate = buildShippingAggregate(
    aggregateShipment ? [aggregateShipment] : [],
    aggregateShipment?.shipmentStatus ?? "WAITING_PAYMENT"
  );
  const storedFulfillmentStatus = normalizeStoredFulfillmentStatus(
    getAttr(input.suborder, "fulfillmentStatus")
  );
  const compatibilityFulfillmentStatus =
    aggregateShipment?.compatibilityFulfillmentStatus ??
    mapShipmentStatusToCompatibilityFulfillment(
      aggregateShipment?.shipmentStatus ?? "WAITING_PAYMENT"
    );
  const compatibilityMatchesStorage =
    aggregateShipment?.compatibilityMatchesStorage ??
    compatibilityFulfillmentStatus === storedFulfillmentStatus;
  return {
    shipmentCount: input.featureEnabled ? aggregate.shipmentCount : 0,
    shippingStatus: aggregate.shippingStatus,
    shippingStatusMeta: aggregate.shippingStatusMeta,
    latestTrackingEvent: input.featureEnabled ? aggregate.latestTrackingEvent : null,
    hasActiveShipment: input.featureEnabled ? aggregate.hasActiveShipment : false,
    hasTrackingNumber: input.featureEnabled ? aggregate.hasTrackingNumber : false,
    shipments: input.featureEnabled && aggregateShipment ? [aggregateShipment] : [],
    usedLegacyFallback: Boolean(aggregateShipment?.usedLegacyFallback),
    hasPersistedShipment: Boolean(aggregateShipment?.shipmentId),
    compatibilityFulfillmentStatus,
    compatibilityFulfillmentStatusMeta: buildFulfillmentStatusMeta(
      compatibilityFulfillmentStatus
    ),
    storedFulfillmentStatus,
    storedFulfillmentStatusMeta: buildFulfillmentStatusMeta(storedFulfillmentStatus),
    compatibilityMatchesStorage,
    trackingEventCount: toNumber(aggregateShipment?.trackingEventCount, 0),
    missingTrackingTimeline: Boolean(aggregateShipment?.missingTrackingTimeline),
    incompleteTrackingData: Boolean(aggregateShipment?.incompleteTrackingData),
    _aggregateShipment: aggregateShipment,
  };
};

export const buildShipmentReadModelFromSuborder = (
  suborder: any,
  options?: {
    featureEnabled?: boolean;
    enforceStoreShippingSetup?: boolean;
  }
) => {
  const featureEnabled = options?.featureEnabled ?? isMultistoreShipmentMvpEnabled();
  const shipmentStatus = deriveLegacyShipmentStatus({
    paymentStatus: getAttr(suborder, "paymentStatus"),
    fulfillmentStatus: getAttr(suborder, "fulfillmentStatus"),
  });
  const statusMeta = buildShipmentStatusMeta(shipmentStatus);
  const store = suborder?.store ?? suborder?.get?.("store") ?? null;
  const storeShippingSetup = options?.enforceStoreShippingSetup
    ? buildStoreShippingSetupReadiness(store)
    : null;
  const items = Array.isArray(suborder?.items) ? suborder.items.map(toShipmentItem) : [];
  const actionability = buildShipmentActionability({
    featureEnabled,
    hasPersistedShipment: false,
    shipmentStatus,
    paymentStatus: toUpper(getAttr(suborder, "paymentStatus"), "UNPAID"),
    orderStatus: toUpper(getAttr(suborder?.order, "status"), "PENDING").toLowerCase(),
    hasTrackingNumber: false,
    shippingSetupBlockedReason:
      options?.enforceStoreShippingSetup && storeShippingSetup && !storeShippingSetup.isShippingReady
        ? String(storeShippingSetup.shippingSetupMeta?.message || "").trim() ||
          String(storeShippingSetup.shippingSetupStatus?.description || "").trim() ||
          "Store shipping setup is not ready."
        : null,
  });
  const auditFields = buildShipmentAuditFields({
    shipmentStatus,
    usedLegacyFallback: true,
    trackingEvents: [],
    trackingNumber: null,
    courierCode: null,
    courierService: null,
    storedFulfillmentStatus: getAttr(suborder, "fulfillmentStatus"),
  });

  return {
    shipmentId: null,
    suborderId: toNumber(getAttr(suborder, "id"), 0) || null,
    suborderNumber: String(getAttr(suborder, "suborderNumber") || "").trim() || null,
    storeId: toNumber(getAttr(suborder, "storeId"), 0) || null,
    storeName: String(getAttr(store, "name") || `Store #${getAttr(suborder, "storeId") || "-"}`),
    storeSlug: String(getAttr(store, "slug") || "").trim() || null,
    shipmentStatus,
    shipmentStatusMeta: statusMeta,
    courierCode: null,
    courierService: null,
    trackingNumber: null,
    estimatedDelivery: null,
    shippingFee: toNumber(getAttr(suborder, "shippingAmount"), 0),
    shipmentItems: items,
    trackingEvents: [],
    latestTrackingEvent: null,
    hasTrackingNumber: false,
    hasActiveShipment: ACTIVE_SHIPMENT_STATUSES.has(shipmentStatus),
    ...auditFields,
    ...actionability,
  };
};

const getPersistedShipmentFromSuborder = (suborder: any) =>
  suborder?.shipment ??
  suborder?.get?.("shipment") ??
  (Array.isArray(suborder?.shipments) ? suborder.shipments[0] : null) ??
  null;

const buildShipmentReadModelFromPersistedRecord = (
  shipment: any,
  suborder: any,
  options?: {
    featureEnabled?: boolean;
    enforceStoreShippingSetup?: boolean;
  }
) => {
  const featureEnabled = options?.featureEnabled ?? isMultistoreShipmentMvpEnabled();
  const store =
    shipment?.store ??
    shipment?.get?.("store") ??
    suborder?.store ??
    suborder?.get?.("store") ??
    null;
  const storeShippingSetup = options?.enforceStoreShippingSetup
    ? buildStoreShippingSetupReadiness(store)
    : null;
  const items = Array.isArray(suborder?.items) ? suborder.items.map(toShipmentItem) : [];
  const trackingEvents = sortTrackingEvents(
    Array.isArray(shipment?.trackingEvents)
    ? shipment.trackingEvents.map(normalizeTrackingEvent).filter(Boolean)
    : []
  );
  const effectiveStatus = resolveEffectiveShipmentStatus(
    String(getAttr(shipment, "status") || "WAITING_PAYMENT"),
    suborder
  );
  const statusMeta = buildShipmentStatusMeta(effectiveStatus);
  const hasTrackingNumber = Boolean(String(getAttr(shipment, "trackingNumber") || "").trim());
  const actionability = buildShipmentActionability({
    featureEnabled,
    hasPersistedShipment: true,
    shipmentStatus: effectiveStatus,
    paymentStatus: toUpper(getAttr(suborder, "paymentStatus"), "UNPAID"),
    orderStatus: toUpper(getAttr(suborder?.order, "status"), "PENDING").toLowerCase(),
    hasTrackingNumber,
    shippingSetupBlockedReason:
      options?.enforceStoreShippingSetup && storeShippingSetup && !storeShippingSetup.isShippingReady
        ? String(storeShippingSetup.shippingSetupMeta?.message || "").trim() ||
          String(storeShippingSetup.shippingSetupStatus?.description || "").trim() ||
          "Store shipping setup is not ready."
        : null,
  });
  const auditFields = buildShipmentAuditFields({
    shipmentStatus: effectiveStatus,
    usedLegacyFallback: false,
    trackingEvents,
    trackingNumber: String(getAttr(shipment, "trackingNumber") || "").trim() || null,
    courierCode: String(getAttr(shipment, "courierCode") || "").trim() || null,
    courierService: String(getAttr(shipment, "courierService") || "").trim() || null,
    storedFulfillmentStatus: getAttr(suborder, "fulfillmentStatus"),
  });

  return {
    shipmentId: toNumber(getAttr(shipment, "id"), 0) || null,
    suborderId: toNumber(getAttr(shipment, "suborderId") ?? getAttr(suborder, "id"), 0) || null,
    suborderNumber: String(getAttr(suborder, "suborderNumber") || "").trim() || null,
    storeId: toNumber(getAttr(shipment, "storeId") ?? getAttr(suborder, "storeId"), 0) || null,
    storeName: String(
      getAttr(store, "name") ||
        `Store #${getAttr(shipment, "storeId") || getAttr(suborder, "storeId") || "-"}`
    ),
    storeSlug: String(getAttr(store, "slug") || "").trim() || null,
    shipmentStatus: effectiveStatus,
    shipmentStatusMeta: statusMeta,
    courierCode: String(getAttr(shipment, "courierCode") || "").trim() || null,
    courierService: String(getAttr(shipment, "courierService") || "").trim() || null,
    trackingNumber: String(getAttr(shipment, "trackingNumber") || "").trim() || null,
    estimatedDelivery: getAttr(shipment, "estimatedDelivery") || null,
    shippingFee: toNumber(
      getAttr(shipment, "shippingFee") ?? getAttr(suborder, "shippingAmount"),
      0
    ),
    shipmentItems: items,
    trackingEvents,
    latestTrackingEvent: trackingEvents.length > 0 ? resolveLatestTrackingEvent([{ trackingEvents }]) : null,
    hasTrackingNumber,
    hasActiveShipment: ACTIVE_SHIPMENT_STATUSES.has(effectiveStatus),
    ...auditFields,
    ...actionability,
  };
};

export const buildShippingAggregate = (shipments: any[], fallbackStatus = "WAITING_PAYMENT") => {
  const statuses = (Array.isArray(shipments) ? shipments : [])
    .map((shipment) => normalizeShipmentStatus(shipment?.shipmentStatus, fallbackStatus))
    .filter(Boolean);

  let aggregateStatus = normalizeShipmentStatus(fallbackStatus, "WAITING_PAYMENT");
  if (statuses.length > 0) {
    const active = statuses.filter((status) => status !== "CANCELLED");
    if (active.length === 0) {
      aggregateStatus = "CANCELLED";
    } else if (active.some((status) => status === "RETURNED")) {
      aggregateStatus = "RETURNED";
    } else if (active.some((status) => status === "FAILED_DELIVERY")) {
      aggregateStatus = "FAILED_DELIVERY";
    } else if (active.every((status) => status === "DELIVERED")) {
      aggregateStatus = "DELIVERED";
    } else if (active.some((status) => SHIPPED_LIKE_STATUSES.has(status))) {
      aggregateStatus = "SHIPPED";
    } else if (active.some((status) => PROCESSING_LIKE_STATUSES.has(status))) {
      aggregateStatus = "PROCESSING";
    } else if (active.some((status) => status === "READY_TO_FULFILL")) {
      aggregateStatus = "READY_TO_FULFILL";
    }
  }

  return {
    shipmentCount: Array.isArray(shipments) ? shipments.length : 0,
    shippingStatus: aggregateStatus,
    shippingStatusMeta: buildShipmentStatusMeta(aggregateStatus),
    latestTrackingEvent: resolveLatestTrackingEvent(shipments),
    hasActiveShipment: Array.isArray(shipments)
      ? shipments.some((shipment) =>
          ACTIVE_SHIPMENT_STATUSES.has(
            normalizeShipmentStatus(shipment?.shipmentStatus, aggregateStatus)
          )
        )
      : false,
    hasTrackingNumber: Array.isArray(shipments)
      ? shipments.some((shipment) => Boolean(String(shipment?.trackingNumber || "").trim()))
      : false,
  };
};

export const buildSuborderShippingReadModel = (
  suborder: any,
  options?: {
    featureEnabled?: boolean;
    enforceStoreShippingSetup?: boolean;
  }
) => {
  const featureEnabled = options?.featureEnabled ?? isMultistoreShipmentMvpEnabled();
  const persistedShipment = getPersistedShipmentFromSuborder(suborder);
  const aggregateShipment = persistedShipment
    ? buildShipmentReadModelFromPersistedRecord(persistedShipment, suborder, {
        featureEnabled,
        enforceStoreShippingSetup: options?.enforceStoreShippingSetup,
      })
    : buildShipmentReadModelFromSuborder(suborder, {
        featureEnabled,
        enforceStoreShippingSetup: options?.enforceStoreShippingSetup,
      });

  return finalizeSuborderShippingReadModel({
    featureEnabled,
    aggregateShipment,
    suborder,
  });
};

const buildOrderShipmentAuditMeta = (suborderShipping: any[]) => {
  const entries = Array.isArray(suborderShipping) ? suborderShipping : [];
  const totalSuborders = entries.length;
  const persistedShipmentCount = entries.filter((entry) => Boolean(entry?.hasPersistedShipment)).length;
  const legacyFallbackSuborderCount = entries.filter((entry) => Boolean(entry?.usedLegacyFallback)).length;
  const compatibilityMismatchCount = entries.filter(
    (entry) => entry?.compatibilityMatchesStorage === false
  ).length;
  const missingTrackingTimelineCount = entries.filter((entry) =>
    Boolean(entry?.missingTrackingTimeline)
  ).length;
  const incompleteTrackingDataCount = entries.filter((entry) =>
    Boolean(entry?.incompleteTrackingData)
  ).length;

  let persistedCoverage = "NO_SUBORDERS";
  if (totalSuborders > 0 && persistedShipmentCount === totalSuborders) {
    persistedCoverage = "ALL_PERSISTED";
  } else if (persistedShipmentCount > 0) {
    persistedCoverage = "PARTIAL_PERSISTED";
  } else if (legacyFallbackSuborderCount > 0) {
    persistedCoverage = "LEGACY_ONLY";
  }

  return {
    totalSuborders,
    persistedShipmentCount,
    legacyFallbackSuborderCount,
    compatibilityMismatchCount,
    missingTrackingTimelineCount,
    incompleteTrackingDataCount,
    usedLegacyFallback: legacyFallbackSuborderCount > 0,
    persistedCoverage,
  };
};

export const buildOrderShippingReadModel = (
  suborders: any[],
  options?: {
    featureEnabled?: boolean;
  }
) => {
  const featureEnabled = options?.featureEnabled ?? isMultistoreShipmentMvpEnabled();
  const suborderShipping = (Array.isArray(suborders) ? suborders : []).map((suborder) => {
    const model = buildSuborderShippingReadModel(suborder, { featureEnabled });
    const store = suborder?.store ?? suborder?.get?.("store") ?? null;
    return {
      suborderId: toNumber(getAttr(suborder, "id"), 0) || null,
      suborderNumber: String(getAttr(suborder, "suborderNumber") || "").trim() || null,
      storeId: toNumber(getAttr(suborder, "storeId"), 0) || null,
      storeName: String(
        getAttr(store, "name") || `Store #${getAttr(suborder, "storeId") || "-"}`
      ),
      storeSlug: String(getAttr(store, "slug") || "").trim() || null,
      ...model,
    };
  });

  const aggregateShipments = suborderShipping
    .map((entry: any) => entry._aggregateShipment)
    .filter(Boolean);
  const aggregate = buildShippingAggregate(aggregateShipments, "WAITING_PAYMENT");
  const shipmentAuditMeta = buildOrderShipmentAuditMeta(suborderShipping);
  const suborderShipmentSummary = suborderShipping.map((entry: any) => {
    const { _aggregateShipment: _ignored, ...publicEntry } = entry;
    return publicEntry;
  });

  return {
    shipmentCount: featureEnabled ? aggregate.shipmentCount : 0,
    shippingStatus: aggregate.shippingStatus,
    shippingStatusMeta: aggregate.shippingStatusMeta,
    latestTrackingEvent: featureEnabled ? aggregate.latestTrackingEvent : null,
    hasActiveShipment: featureEnabled ? aggregate.hasActiveShipment : false,
    hasTrackingNumber: featureEnabled ? aggregate.hasTrackingNumber : false,
    shipments: featureEnabled ? aggregateShipments : [],
    usedLegacyFallback: featureEnabled ? shipmentAuditMeta.usedLegacyFallback : false,
    shipmentAuditMeta,
    suborderShipmentSummary,
    suborders: new Map<number, any>(
      suborderShipping
        .filter((entry) => Number.isFinite(Number(entry.suborderId)) && Number(entry.suborderId) > 0)
        .map((entry) => {
          const { _aggregateShipment: _ignored, ...publicEntry } = entry;
          return [Number(entry.suborderId), publicEntry];
        })
    ),
  };
};

export const buildCompatibilityShippingStatusMeta = (fulfillmentStatus: unknown) =>
  buildFulfillmentStatusMeta(fulfillmentStatus);

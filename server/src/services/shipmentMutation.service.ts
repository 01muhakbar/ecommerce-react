import { Shipment, Store, TrackingEvent } from "../models/index.js";
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

const normalizeText = (value: unknown) => String(value || "").trim();

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
  return SHIPMENT_STATUS_PRIORITY[status] ? status : fallback;
};

const deriveLegacyShipmentStatus = (input: {
  paymentStatus?: unknown;
  fulfillmentStatus?: unknown;
}) => {
  const fulfillmentStatus = toUpper(input.fulfillmentStatus, "UNFULFILLED") || "UNFULFILLED";
  if (fulfillmentStatus === "CANCELLED") return "CANCELLED";
  if (fulfillmentStatus === "DELIVERED") return "DELIVERED";
  if (fulfillmentStatus === "SHIPPED") return "SHIPPED";
  if (fulfillmentStatus === "PROCESSING") return "PROCESSING";

  const paymentStatus = toUpper(input.paymentStatus, "UNPAID") || "UNPAID";
  if (paymentStatus === "PAID") return "READY_TO_FULFILL";
  return "WAITING_PAYMENT";
};

const resolveEffectiveShipmentStatus = (shipment: any, suborder: any) => {
  const persistedStatus = normalizeShipmentStatus(getAttr(shipment, "status"), "WAITING_PAYMENT");
  const legacyStatus = deriveLegacyShipmentStatus({
    paymentStatus: getAttr(suborder, "paymentStatus"),
    fulfillmentStatus: getAttr(suborder, "fulfillmentStatus"),
  });

  if (legacyStatus === "CANCELLED") return "CANCELLED";
  if (persistedStatus === "RETURNED") return "RETURNED";
  if (persistedStatus === "CANCELLED") return "CANCELLED";
  if (persistedStatus === "FAILED_DELIVERY") return "FAILED_DELIVERY";

  return (SHIPMENT_STATUS_PRIORITY[legacyStatus] || 0) >
    (SHIPMENT_STATUS_PRIORITY[persistedStatus] || 0)
    ? legacyStatus
    : persistedStatus;
};

const createShipmentMutationError = (
  code: string,
  message: string,
  statusCode = 409
) => {
  const error = new Error(message) as Error & {
    code: string;
    statusCode: number;
  };
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const SELLER_ACTION_SHIPMENT_STATUS: Record<
  string,
  {
    shipmentStatus: string;
    compatibilityFulfillmentStatus: string;
    eventType: string;
    eventLabel: string;
    eventDescription: string;
  }
> = {
  MARK_PROCESSING: {
    shipmentStatus: "PACKED",
    compatibilityFulfillmentStatus: "PROCESSING",
    eventType: "PACKED",
    eventLabel: "Packed",
    eventDescription: "Seller packed the shipment and it is ready for dispatch.",
  },
  MARK_SHIPPED: {
    shipmentStatus: "SHIPPED",
    compatibilityFulfillmentStatus: "SHIPPED",
    eventType: "SHIPPED",
    eventLabel: "Shipped",
    eventDescription: "Seller dispatched the shipment and provided tracking details.",
  },
  MARK_DELIVERED: {
    shipmentStatus: "DELIVERED",
    compatibilityFulfillmentStatus: "DELIVERED",
    eventType: "DELIVERED",
    eventLabel: "Delivered",
    eventDescription: "Seller confirmed the shipment reached the buyer.",
  },
};

const appendTrackingEvent = async (input: {
  shipmentId: number;
  eventType: string;
  eventLabel: string;
  eventDescription: string;
  source: "SYSTEM" | "SELLER" | "ADMIN";
  actorType: "SYSTEM" | "USER" | "ADMIN";
  actorId?: number | null;
  metadata?: Record<string, unknown> | null;
  transaction?: any;
}) =>
  TrackingEvent.create(
    {
      shipmentId: input.shipmentId,
      eventType: input.eventType,
      eventLabel: input.eventLabel,
      eventDescription: input.eventDescription,
      occurredAt: new Date(),
      source: input.source,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? null,
    } as any,
    { transaction: input.transaction }
  );

const ensureReadyToFulfillSync = async (input: {
  shipment: any;
  suborder: any;
  transaction?: any;
}) => {
  const paymentStatus = toUpper(getAttr(input.suborder, "paymentStatus"), "UNPAID");
  if (paymentStatus !== "PAID") {
    return {
      shipmentStatus: resolveEffectiveShipmentStatus(input.shipment, input.suborder),
      changed: false,
    };
  }

  const rawStatus = normalizeShipmentStatus(getAttr(input.shipment, "status"), "WAITING_PAYMENT");
  if (rawStatus !== "WAITING_PAYMENT") {
    return {
      shipmentStatus: resolveEffectiveShipmentStatus(input.shipment, input.suborder),
      changed: false,
    };
  }

  const existingReadyEvent = Array.isArray(input.shipment?.trackingEvents)
    ? input.shipment.trackingEvents.some(
        (event: any) => toUpper(getAttr(event, "eventType"), "") === "READY_TO_FULFILL"
      )
    : false;

  await input.shipment.update(
    {
      status: "READY_TO_FULFILL",
    },
    { transaction: input.transaction }
  );

  if (!existingReadyEvent) {
    await appendTrackingEvent({
      shipmentId: toNumber(getAttr(input.shipment, "id"), 0),
      eventType: "READY_TO_FULFILL",
      eventLabel: "Ready to Fulfill",
      eventDescription:
        "Payment is settled. Seller can now pack and dispatch this shipment.",
      source: "SYSTEM",
      actorType: "SYSTEM",
      actorId: null,
      metadata: {
        reason: "PAYMENT_READY",
        suborderId: toNumber(getAttr(input.suborder, "id"), 0) || null,
      },
      transaction: input.transaction,
    });
  }

  return {
    shipmentStatus: "READY_TO_FULFILL",
    changed: true,
  };
};

export const applySellerShipmentFulfillment = async (input: {
  suborder: any;
  actionCode: string;
  actorUserId?: number | null;
  transaction?: any;
  payload?: {
    courierCode?: unknown;
    courierService?: unknown;
    trackingNumber?: unknown;
  };
}) => {
  const action = SELLER_ACTION_SHIPMENT_STATUS[input.actionCode];
  if (!action) {
    throw createShipmentMutationError(
      "INVALID_SHIPMENT_ACTION",
      "Shipment action is not supported."
    );
  }

  const mvpEnabled = isMultistoreShipmentMvpEnabled();
  if (!mvpEnabled) {
    return {
      shipment: null,
      usedLegacyFallback: true,
      compatibilityFulfillmentStatus: action.compatibilityFulfillmentStatus,
    };
  }

  const shipment =
    input.suborder?.shipment ??
    input.suborder?.get?.("shipment") ??
    (await Shipment.findOne({
      where: {
        suborderId: toNumber(getAttr(input.suborder, "id"), 0),
      },
      include: [
        {
          model: TrackingEvent,
          as: "trackingEvents",
          required: false,
        },
      ],
      transaction: input.transaction,
      lock: input.transaction?.LOCK?.UPDATE ? input.transaction.LOCK.UPDATE : undefined,
    }));

  if (!shipment) {
    return {
      shipment: null,
      usedLegacyFallback: true,
      compatibilityFulfillmentStatus: action.compatibilityFulfillmentStatus,
    };
  }

  if (!isMultistoreShipmentMutationEnabled()) {
    throw createShipmentMutationError(
      "SHIPMENT_MUTATION_DISABLED",
      "Shipment mutation is disabled for the current rollout."
    );
  }

  const storeScope =
    input.suborder?.store ??
    input.suborder?.get?.("store") ??
    (await Store.findByPk(toNumber(getAttr(input.suborder, "storeId"), 0), {
      attributes: [
        "id",
        "name",
        "phone",
        "whatsapp",
        "addressLine1",
        "addressLine2",
        "city",
        "province",
        "postalCode",
        "country",
        "shippingSetup",
      ],
      transaction: input.transaction,
    }));
  const shippingSetupReadiness = buildStoreShippingSetupReadiness(storeScope);
  if (!shippingSetupReadiness.isShippingReady) {
    throw createShipmentMutationError(
      "STORE_SHIPPING_SETUP_INCOMPLETE",
      String(shippingSetupReadiness.shippingSetupMeta?.message || "").trim() ||
        "Store shipping setup is not ready for seller shipment operations."
    );
  }

  await ensureReadyToFulfillSync({
    shipment,
    suborder: input.suborder,
    transaction: input.transaction,
  });

  if (action.shipmentStatus === "SHIPPED") {
    const trackingNumber = normalizeText(input.payload?.trackingNumber);
    if (!trackingNumber) {
      throw createShipmentMutationError(
        "TRACKING_NUMBER_REQUIRED",
        "Tracking number is required before the shipment can be marked as shipped."
      );
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: action.shipmentStatus,
  };
  if (action.shipmentStatus === "SHIPPED") {
    updatePayload.courierCode = normalizeText(input.payload?.courierCode) || null;
    updatePayload.courierService = normalizeText(input.payload?.courierService) || null;
    updatePayload.trackingNumber = normalizeText(input.payload?.trackingNumber) || null;
  }

  await shipment.update(updatePayload as any, { transaction: input.transaction });

  await appendTrackingEvent({
    shipmentId: toNumber(getAttr(shipment, "id"), 0),
    eventType: action.eventType,
    eventLabel: action.eventLabel,
    eventDescription: action.eventDescription,
    source: "SELLER",
    actorType: "USER",
    actorId: input.actorUserId ?? null,
    metadata: {
      actionCode: input.actionCode,
      suborderId: toNumber(getAttr(input.suborder, "id"), 0) || null,
      courierCode: action.shipmentStatus === "SHIPPED" ? normalizeText(input.payload?.courierCode) || null : null,
      courierService:
        action.shipmentStatus === "SHIPPED"
          ? normalizeText(input.payload?.courierService) || null
          : null,
      trackingNumber:
        action.shipmentStatus === "SHIPPED"
          ? normalizeText(input.payload?.trackingNumber) || null
          : null,
    },
    transaction: input.transaction,
  });

  const refreshedShipment = await Shipment.findOne({
    where: { id: toNumber(getAttr(shipment, "id"), 0) },
    include: [
      {
        model: TrackingEvent,
        as: "trackingEvents",
        required: false,
      },
    ],
    transaction: input.transaction,
  });

  return {
    shipment: refreshedShipment ?? shipment,
    usedLegacyFallback: false,
    compatibilityFulfillmentStatus: action.compatibilityFulfillmentStatus,
  };
};

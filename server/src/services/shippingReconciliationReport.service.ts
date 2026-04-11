import { Op } from "sequelize";
import { Order, Shipment, Store, Suborder, TrackingEvent } from "../models/index.js";
import { buildOrderShippingReadModel } from "./orderShippingReadModel.service.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SCAN_LIMIT = 500;

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key] ?? undefined;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const normalizeText = (value: unknown) => String(value || "").trim();

const parsePage = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

const parsePageSize = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
};

const readTrackingMetadata = (event: any) => {
  const raw = getAttr(event, "metadata");
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

const hasAdminCorrectionEvent = (events: any[]) =>
  (Array.isArray(events) ? events : []).some((event: any) => {
    const source = toUpper(getAttr(event, "source"), "");
    const actorType = toUpper(getAttr(event, "actorType"), "");
    const metadata = readTrackingMetadata(event);
    return (
      source === "ADMIN" ||
      actorType === "ADMIN" ||
      metadata?.correction === true ||
      String(metadata?.source || "").toUpperCase() === "ADMIN_SHIPPING_EXCEPTION_CORRECTION"
    );
  });

const getLatestTrackingTime = (events: any[]) => {
  const times = (Array.isArray(events) ? events : [])
    .map((event: any) => new Date(getAttr(event, "occurredAt") || getAttr(event, "createdAt") || 0).getTime())
    .filter((time: number) => Number.isFinite(time) && time > 0);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
};

const CATEGORY_LABELS: Record<string, string> = {
  compatibilityMismatch: "Compatibility mismatch",
  mixedShipmentOutcome: "Mixed shipment outcome",
  activeShippingException: "Active shipping exception",
  finalShippingException: "Final shipping exception",
  trackingDataIncomplete: "Tracking data incomplete",
  adminCorrectedRecent: "Admin corrected",
};

const buildCategory = (code: string, detail?: string | null) => ({
  code,
  label: CATEGORY_LABELS[code] || code,
  detail: detail || null,
});

const getSuborderTrackingEvents = (suborder: any) => {
  const shipment = suborder?.shipment ?? suborder?.get?.("shipment") ?? null;
  return Array.isArray(shipment?.trackingEvents) ? shipment.trackingEvents : [];
};

const buildMixedOutcomeSummary = (suborderSummaries: any[]) => {
  const statuses = (Array.isArray(suborderSummaries) ? suborderSummaries : [])
    .map((entry: any) => toUpper(entry?.shippingStatus, ""))
    .filter(Boolean);
  const distinct = Array.from(new Set(statuses));
  const hasException = distinct.some((status) =>
    ["FAILED_DELIVERY", "RETURNED", "CANCELLED"].includes(status)
  );
  const hasDelivered = distinct.includes("DELIVERED");
  const isMixed = distinct.length > 1 && (hasException || hasDelivered);
  return {
    isMixed,
    statuses: distinct,
    summary: distinct.length > 0 ? distinct.join(", ") : null,
  };
};

const buildReconciliationItem = (input: {
  order: any;
  suborder: any;
  suborderSummary: any;
  mixedOutcome: { isMixed: boolean; statuses: string[]; summary: string | null };
}) => {
  const { order, suborder, suborderSummary, mixedOutcome } = input;
  const shipmentStatus = toUpper(suborderSummary?.shippingStatus, "WAITING_PAYMENT");
  const trackingEvents = getSuborderTrackingEvents(suborder);
  const categories: any[] = [];

  if (suborderSummary?.compatibilityMatchesStorage === false) {
    categories.push(
      buildCategory(
        "compatibilityMismatch",
        "Canonical shipment status and stored compatibility fulfillment differ."
      )
    );
  }

  if (mixedOutcome.isMixed) {
    categories.push(
      buildCategory(
        "mixedShipmentOutcome",
        `Parent split statuses: ${mixedOutcome.summary || "mixed"}.`
      )
    );
  }

  if (shipmentStatus === "FAILED_DELIVERY") {
    categories.push(
      buildCategory(
        "activeShippingException",
        "Shipment is in failed delivery and still needs operational follow-up."
      )
    );
  }

  if (shipmentStatus === "RETURNED" || shipmentStatus === "CANCELLED") {
    categories.push(
      buildCategory(
        "finalShippingException",
        "Shipment is closed in an exception lane."
      )
    );
  }

  if (suborderSummary?.missingTrackingTimeline || suborderSummary?.incompleteTrackingData) {
    categories.push(
      buildCategory(
        "trackingDataIncomplete",
        suborderSummary?.missingTrackingTimeline
          ? "Shipment has an operational status but missing timeline."
          : "Shipment is missing courier or tracking data."
      )
    );
  }

  const hasAdminCorrection = hasAdminCorrectionEvent(trackingEvents);
  if (hasAdminCorrection) {
    categories.push(
      buildCategory(
        "adminCorrectedRecent",
        "Shipment timeline includes an admin correction event."
      )
    );
  }

  if (categories.length === 0) return null;

  const invoiceNo = normalizeText(getAttr(order, "invoiceNo"));
  return {
    orderId: toNumber(getAttr(order, "id"), 0) || null,
    invoiceNo,
    orderStatus: normalizeText(getAttr(order, "status")) || null,
    orderPaymentStatus: toUpper(getAttr(order, "paymentStatus"), "UNPAID"),
    checkoutMode: toUpper(getAttr(order, "checkoutMode"), "LEGACY"),
    orderUpdatedAt: getAttr(order, "updatedAt") || null,
    orderDetailHref: invoiceNo ? `/admin/orders/${encodeURIComponent(invoiceNo)}` : null,
    suborderId: toNumber(getAttr(suborder, "id"), 0) || null,
    suborderNumber: normalizeText(getAttr(suborder, "suborderNumber")) || null,
    store: {
      id: toNumber(getAttr(suborder, "storeId"), 0) || null,
      name: normalizeText(suborderSummary?.storeName) || null,
      slug: normalizeText(suborderSummary?.storeSlug) || null,
    },
    canonicalShipmentStatus: shipmentStatus,
    canonicalShipmentStatusMeta: suborderSummary?.shippingStatusMeta || null,
    compatibilityFulfillmentStatus: suborderSummary?.compatibilityFulfillmentStatus || null,
    compatibilityFulfillmentStatusMeta:
      suborderSummary?.compatibilityFulfillmentStatusMeta || null,
    storedFulfillmentStatus: suborderSummary?.storedFulfillmentStatus || null,
    storedFulfillmentStatusMeta: suborderSummary?.storedFulfillmentStatusMeta || null,
    compatibilityMatchesStorage:
      typeof suborderSummary?.compatibilityMatchesStorage === "boolean"
        ? suborderSummary.compatibilityMatchesStorage
        : null,
    usedLegacyFallback: Boolean(suborderSummary?.usedLegacyFallback),
    hasPersistedShipment: Boolean(suborderSummary?.hasPersistedShipment),
    tracking: {
      latestEvent: suborderSummary?.latestTrackingEvent || null,
      eventCount: toNumber(suborderSummary?.trackingEventCount, 0),
      missingTimeline: Boolean(suborderSummary?.missingTrackingTimeline),
      incompleteData: Boolean(suborderSummary?.incompleteTrackingData),
      lastTransitionAt: getLatestTrackingTime(trackingEvents),
      hasAdminCorrection,
    },
    mixedOutcome: {
      isMixed: mixedOutcome.isMixed,
      statuses: mixedOutcome.statuses,
      summary: mixedOutcome.summary,
    },
    categories,
    primaryCategory: categories[0] || null,
  };
};

export const listAdminShippingReconciliationReport = async (query: any) => {
  const page = parsePage(query?.page);
  const pageSize = parsePageSize(query?.pageSize ?? query?.limit);
  const category = normalizeText(query?.category);
  const shipmentStatus = toUpper(query?.shipmentStatus, "");
  const search = normalizeText(query?.search);
  const storeId = toNumber(query?.storeId, 0);

  const orderWhere: Record<string, any> = {};
  if (search) {
    orderWhere[Op.or as any] = [
      { invoiceNo: { [Op.like]: `%${search}%` } },
    ];
  }

  const suborderWhere: Record<string, any> = {};
  if (storeId > 0) {
    suborderWhere.storeId = storeId;
  }

  const orders = await Order.findAll({
    where: orderWhere,
    attributes: ["id", "invoiceNo", "checkoutMode", "status", "paymentStatus", "updatedAt"],
    include: [
      {
        model: Suborder,
        as: "suborders",
        attributes: [
          "id",
          "orderId",
          "suborderNumber",
          "storeId",
          "paymentStatus",
          "fulfillmentStatus",
          "updatedAt",
        ],
        where: Object.keys(suborderWhere).length > 0 ? suborderWhere : undefined,
        required: true,
        include: [
          {
            model: Store,
            as: "store",
            attributes: ["id", "name", "slug"],
            required: false,
          },
          {
            model: Shipment,
            as: "shipment",
            required: false,
            include: [
              {
                model: TrackingEvent,
                as: "trackingEvents",
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [["updatedAt", "DESC"]],
    limit: MAX_SCAN_LIMIT,
  });

  const items = [];
  const categoryCounts = new Map<string, number>();

  for (const order of orders as any[]) {
    const suborders = Array.isArray(order?.suborders) ? order.suborders : [];
    const readModel = buildOrderShippingReadModel(suborders);
    const suborderSummaries = Array.isArray(readModel?.suborderShipmentSummary)
      ? readModel.suborderShipmentSummary
      : [];
    const mixedOutcome = buildMixedOutcomeSummary(suborderSummaries);

    for (const suborder of suborders) {
      const suborderId = toNumber(getAttr(suborder, "id"), 0);
      const summary = suborderSummaries.find(
        (entry: any) => toNumber(entry?.suborderId, 0) === suborderId
      );
      if (!summary) continue;
      const item = buildReconciliationItem({
        order,
        suborder,
        suborderSummary: summary,
        mixedOutcome,
      });
      if (!item) continue;

      for (const entry of item.categories) {
        categoryCounts.set(entry.code, (categoryCounts.get(entry.code) || 0) + 1);
      }

      if (
        category &&
        !item.categories.some((entry: any) => entry.code === category)
      ) {
        continue;
      }
      if (shipmentStatus && item.canonicalShipmentStatus !== shipmentStatus) {
        continue;
      }
      items.push(item);
    }
  }

  const start = (page - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  return {
    items: pagedItems,
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages,
      scannedOrders: orders.length,
      maxScanLimit: MAX_SCAN_LIMIT,
      filters: {
        category: category || null,
        shipmentStatus: shipmentStatus || null,
        search: search || null,
        storeId: storeId > 0 ? storeId : null,
      },
      categoryCounts: Object.fromEntries(categoryCounts),
    },
  };
};

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeShippingAction = (value: any) => {
  if (!value || typeof value !== "object") return null;
  return {
    code: normalizeText(value.code).toUpperCase() || null,
    label: normalizeText(value.label) || null,
    enabled: value.enabled !== false,
    reason: normalizeText(value.reason) || null,
  };
};

export const normalizeTrackingEvent = (value: any) => {
  if (!value || typeof value !== "object") return null;
  return {
    eventId: asNumber(value.eventId ?? value.id, 0) || null,
    status: normalizeText(value.status).toUpperCase() || null,
    statusMeta:
      value.statusMeta && typeof value.statusMeta === "object" ? value.statusMeta : null,
    note: normalizeText(value.note) || null,
    happenedAt: value.happenedAt || value.createdAt || null,
  };
};

export const normalizeShipment = (value: any) => {
  if (!value || typeof value !== "object") return null;
  return {
    shipmentId: asNumber(value.shipmentId, 0) || null,
    suborderId: asNumber(value.suborderId, 0) || null,
    suborderNumber: normalizeText(value.suborderNumber) || null,
    storeId: asNumber(value.storeId, 0) || null,
    storeName: normalizeText(value.storeName) || null,
    storeSlug: normalizeText(value.storeSlug) || null,
    shipmentStatus: normalizeText(value.shipmentStatus).toUpperCase() || "WAITING_PAYMENT",
    shipmentStatusMeta:
      value.shipmentStatusMeta && typeof value.shipmentStatusMeta === "object"
        ? value.shipmentStatusMeta
        : null,
    courierCode: normalizeText(value.courierCode) || null,
    courierService: normalizeText(value.courierService) || null,
    trackingNumber: normalizeText(value.trackingNumber) || null,
    estimatedDelivery: value.estimatedDelivery || null,
    shippingFee: asNumber(value.shippingFee, 0),
    shipmentItems: Array.isArray(value.shipmentItems)
      ? value.shipmentItems.map((item: any) => ({
          id: asNumber(item?.id, 0) || null,
          productId: asNumber(item?.productId, 0) || null,
          productName: normalizeText(item?.productName) || "Item",
          qty: asNumber(item?.qty, 0),
          price: asNumber(item?.price, 0),
          lineTotal: asNumber(item?.lineTotal, 0),
        }))
      : [],
    trackingEvents: Array.isArray(value.trackingEvents)
      ? value.trackingEvents.map(normalizeTrackingEvent).filter(Boolean)
      : [],
    latestTrackingEvent: normalizeTrackingEvent(value.latestTrackingEvent),
    hasTrackingNumber: Boolean(value.hasTrackingNumber),
    hasActiveShipment: Boolean(value.hasActiveShipment),
    usedLegacyFallback: Boolean(value.usedLegacyFallback),
    persistenceState: normalizeText(value.persistenceState).toUpperCase() || null,
    compatibilityFulfillmentStatus:
      normalizeText(value.compatibilityFulfillmentStatus).toUpperCase() || null,
    compatibilityFulfillmentStatusMeta:
      value.compatibilityFulfillmentStatusMeta &&
      typeof value.compatibilityFulfillmentStatusMeta === "object"
        ? value.compatibilityFulfillmentStatusMeta
        : null,
    storedFulfillmentStatus: normalizeText(value.storedFulfillmentStatus).toUpperCase() || null,
    storedFulfillmentStatusMeta:
      value.storedFulfillmentStatusMeta && typeof value.storedFulfillmentStatusMeta === "object"
        ? value.storedFulfillmentStatusMeta
        : null,
    compatibilityMatchesStorage:
      typeof value.compatibilityMatchesStorage === "boolean"
        ? value.compatibilityMatchesStorage
        : null,
    trackingEventCount: asNumber(value.trackingEventCount, 0),
    missingTrackingTimeline: Boolean(value.missingTrackingTimeline),
    incompleteTrackingData: Boolean(value.incompleteTrackingData),
    canUploadTracking: Boolean(value.canUploadTracking),
    canMarkPacked: Boolean(value.canMarkPacked),
    canMarkShipped: Boolean(value.canMarkShipped),
    canCancelShipment: Boolean(value.canCancelShipment),
    canConfirmDelivery: Boolean(value.canConfirmDelivery),
    availableShippingActions: Array.isArray(value.availableShippingActions)
      ? value.availableShippingActions.map(normalizeShippingAction).filter(Boolean)
      : [],
  };
};

export const normalizeShipmentList = (value: any) =>
  Array.isArray(value) ? value.map(normalizeShipment).filter(Boolean) : [];

const toText = (value) => String(value ?? "").trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMethodLabel = (raw) => {
  const value = toText(raw).toLowerCase();
  if (!value) return "-";
  if (value.includes("cod") || value.includes("cash")) return "Cash";
  if (value.includes("credit card") || value.includes("card") || value.includes("debit")) {
    return "Card";
  }
  if (value.includes("credit") || value.includes("paylater") || value.includes("installment")) {
    return "Credit";
  }
  if (value.includes("bank")) return "Bank";
  return toText(raw);
};

const normalizeCustomerType = (rawName, rawEmail, rawUserId) => {
  if (rawUserId) return "member";
  if (toText(rawEmail)) return "member";
  if (!toText(rawName) || toText(rawName).toLowerCase() === "guest") return "guest";
  return "member";
};

const getSellerPrimaryShipment = (raw) => {
  const shipments = Array.isArray(raw?.shipments) ? raw.shipments : [];
  return shipments[0] || null;
};

export const normalizeAdminOrder = (raw) => {
  const invoiceNo =
    toText(raw?.invoiceNo || raw?.invoice || raw?.ref || raw?.id) || "-";
  const customerName =
    toText(raw?.customerName || raw?.customer?.name || raw?.customer?.email) || "Guest";
  const customerEmail = toText(raw?.customerEmail || raw?.customer?.email) || null;
  const shipmentSummary = Array.isArray(raw?.suborderShipmentSummary)
    ? raw.suborderShipmentSummary[0] || null
    : null;
  const deliveryName =
    toText(raw?.shippingStatusMeta?.label) ||
    toText(shipmentSummary?.shippingStatusMeta?.label) ||
    null;

  return {
    id: raw?.id || raw?.orderId || invoiceNo,
    invoiceNo,
    orderTime: raw?.createdAt || raw?.created_at || null,
    customerName,
    customerType: normalizeCustomerType(customerName, customerEmail, raw?.userId),
    method: normalizeMethodLabel(raw?.paymentMethod || raw?.method),
    amount: toNumber(raw?.totalAmount || raw?.amount || raw?.total || raw?.total_amount, 0),
    status: toText(raw?.rawStatus || raw?.status || "pending") || "pending",
    deliveryName,
    deliveryCode: null,
    deliveryAssigned: Boolean(raw?.hasActiveShipment || raw?.hasTrackingNumber),
    invoiceUrl: invoiceNo ? `/admin/orders/${encodeURIComponent(invoiceNo)}` : null,
  };
};

export const normalizeSellerOrder = (raw, options = {}) => {
  const shipment = getSellerPrimaryShipment(raw);
  const customerName = toText(raw?.buyer?.name) || "Customer";
  const customerEmail = toText(raw?.buyer?.email) || null;
  const invoiceNo = toText(raw?.suborderNumber || raw?.order?.orderNumber || raw?.orderNumber) || "-";
  const deliveryName =
    toText(shipment?.courierService) ||
    toText(shipment?.shipmentStatusMeta?.label) ||
    null;
  const deliveryCode =
    toText(shipment?.courierCode) ||
    toText(shipment?.trackingNumber) ||
    null;

  return {
    id: raw?.suborderId || raw?.id || invoiceNo,
    invoiceNo,
    orderTime: raw?.createdAt || null,
    customerName,
    customerType: normalizeCustomerType(customerName, customerEmail, raw?.buyer?.userId),
    method: normalizeMethodLabel(
      raw?.paymentSummary?.paymentType ||
        raw?.paymentSummary?.paymentChannel ||
        raw?.order?.checkoutModeMeta?.label ||
        raw?.order?.checkoutMode
    ),
    amount: toNumber(raw?.totalAmount, 0),
    status:
      toText(
        raw?.readModel?.primaryStatus?.label ||
          raw?.fulfillmentStatusMeta?.label ||
          raw?.fulfillmentStatus
      ) || "UNFULFILLED",
    deliveryName,
    deliveryCode,
    deliveryAssigned: Boolean(
      shipment?.courierCode ||
        shipment?.courierService ||
        shipment?.trackingNumber ||
        raw?.hasPersistedShipment
    ),
    invoiceUrl: options?.detailUrl || null,
  };
};

import { getOrderContractSummary } from "./orderContract.ts";
import { getOrderStatusLabel, normalizeOrderStatus } from "./orderStatus.js";

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const PENDING_CODES = new Set([
  "ACTION_REQUIRED",
  "UNDER_REVIEW",
  "AWAITING_PAYMENT",
  "BLOCKED_BY_PAYMENT",
]);

const PROCESSING_CODES = new Set(["READY", "PROCESSING", "IN_PROGRESS"]);
const SHIPPING_CODES = new Set(["IN_DELIVERY", "SHIPPED", "SHIPPING"]);
const COMPLETE_CODES = new Set(["FINAL", "DELIVERED"]);
const CLOSED_CODES = new Set(["CANCELLED", "FAILED", "EXPIRED"]);

export const getOrderTruthStatus = (order) => {
  const summary = getOrderContractSummary(order?.contract ?? order);
  const fallbackStatus = order?.rawStatus ?? order?.status;
  const fallbackBucket = normalizeOrderStatus(fallbackStatus);
  const code = normalizeCode(summary?.code);

  let bucket = fallbackBucket;
  if (code) {
    if (CLOSED_CODES.has(code)) {
      bucket = "cancelled";
    } else if (COMPLETE_CODES.has(code)) {
      bucket = "complete";
    } else if (SHIPPING_CODES.has(code)) {
      bucket = "shipping";
    } else if (PROCESSING_CODES.has(code)) {
      bucket = "processing";
    } else if (PENDING_CODES.has(code)) {
      bucket = "pending";
    } else if (summary?.isFinal && String(summary?.tone || "").trim() === "emerald") {
      bucket = "complete";
    }
  }

  if (bucket === "unknown") {
    bucket = code ? "pending" : "unknown";
  }

  return {
    bucket,
    code,
    isFinal: Boolean(summary?.isFinal),
    label: summary?.label || getOrderStatusLabel(fallbackStatus),
    summary,
    tone: String(summary?.tone || "").trim(),
  };
};

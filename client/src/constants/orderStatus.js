export const ORDER_STATUS_OPTIONS = [
  "pending",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];

export const toBackendStatus = (status) =>
  status === "completed" ? "delivered" : status;

export const toUIStatus = (status) =>
  status === "delivered" ? "completed" : status;

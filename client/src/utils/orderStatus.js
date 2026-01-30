export const toBackendStatus = (status) =>
  status === "completed" ? "delivered" : status;

export const toUIStatus = (status) =>
  status === "delivered" ? "completed" : status;

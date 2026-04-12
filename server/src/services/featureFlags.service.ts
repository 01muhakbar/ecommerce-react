const normalizeBoolean = (value: unknown, fallback: boolean) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const nonProductionDefault = process.env.NODE_ENV !== "production";

export const isMultistoreShipmentMvpEnabled = () =>
  normalizeBoolean(process.env.ENABLE_MULTISTORE_SHIPMENT_MVP, nonProductionDefault);

export const isMultistoreShipmentMutationEnabled = () =>
  normalizeBoolean(process.env.ENABLE_MULTISTORE_SHIPMENT_MUTATION, nonProductionDefault);

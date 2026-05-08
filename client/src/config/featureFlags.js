const normalizeBoolean = (value, fallback) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const nonProductionDefault = import.meta.env.DEV;

export const ENABLE_MULTISTORE_SHIPMENT_MVP = normalizeBoolean(
  import.meta.env.VITE_ENABLE_MULTISTORE_SHIPMENT_MVP,
  nonProductionDefault
);

export const ENABLE_MULTISTORE_SHIPMENT_MUTATION = normalizeBoolean(
  import.meta.env.VITE_ENABLE_MULTISTORE_SHIPMENT_MUTATION,
  nonProductionDefault
);

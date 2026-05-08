const PUBLIC_ORDER_REFERENCE_PATTERN = /^(?=.{8,120}$)(?=.*[A-Z])[A-Z0-9][A-Z0-9_-]*$/;

export const normalizePublicOrderReference = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return "";
  if (!PUBLIC_ORDER_REFERENCE_PATTERN.test(normalized)) return "";
  return normalized;
};

export const resolvePublicOrderReference = (...values) => {
  for (const value of values) {
    const normalized = normalizePublicOrderReference(value);
    if (normalized) return normalized;
  }
  return "";
};

export const isPublicOrderReference = (value) =>
  normalizePublicOrderReference(value).length > 0;

export const buildPublicOrderTrackingPath = (value) => {
  const reference = normalizePublicOrderReference(value);
  return reference ? `/order/${encodeURIComponent(reference)}` : null;
};

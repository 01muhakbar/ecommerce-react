const normalizeCode = (value) => String(value || "").trim().toUpperCase();

const resolveMeta = (source) =>
  source?.meta ||
  source?.data?.meta ||
  source?.response?.data?.meta ||
  null;

export const getVariantCheckoutErrorCode = (source) =>
  normalizeCode(
    source?.code ||
      source?.reason ||
      source?.response?.data?.code ||
      source?.data?.code
  );

export const resolveVariantCheckoutMessage = (source, fallbackMessage = "") => {
  const explicitMessage =
    typeof source?.message === "string" && source.message.trim()
      ? source.message.trim()
      : typeof source?.response?.data?.message === "string" &&
          source.response.data.message.trim()
        ? source.response.data.message.trim()
        : "";
  if (explicitMessage) return explicitMessage;

  const code = getVariantCheckoutErrorCode(source);
  const meta = resolveMeta(source) || {};
  const availableStock = Number(
    meta?.availableStock ?? meta?.available ?? source?.available
  );

  switch (code) {
    case "PRODUCT_VARIANT_REQUIRED":
      return "Choose a variant before continuing.";
    case "PRODUCT_VARIANT_MISSING":
      return "This cart line has lost its variant selection. Remove it and choose the variant again.";
    case "VARIANT_NOT_AVAILABLE":
      return "This variant is no longer available. Remove it or choose another variant.";
    case "PRODUCT_OUT_OF_STOCK":
      return "This product is currently out of stock.";
    case "PRODUCT_STOCK_REDUCED":
      if (Number.isFinite(availableStock)) {
        return `Stock changed. Reduce the quantity to ${Math.max(0, availableStock)} and try again.`;
      }
      return "Stock changed before checkout. Reduce the quantity and try again.";
    case "PRODUCT_NOT_PUBLIC":
    case "PRODUCT_NOT_AVAILABLE":
      return "This item is no longer available for checkout.";
    default:
      return fallbackMessage || "There was a temporary issue. Please try again.";
  }
};

export const findInvalidVariantCheckoutItem = (invalidItems, target) => {
  const normalizedItems = Array.isArray(invalidItems) ? invalidItems : [];
  const targetLineId = String(target?.lineId || "").trim();
  const targetCartItemId = Number(target?.cartItemId || 0);
  const targetProductId = Number(target?.productId || target?.id || 0);
  const targetVariantKey = String(target?.variantKey || "").trim().toLowerCase();

  return (
    normalizedItems.find((item) => String(item?.lineId || "").trim() === targetLineId) ||
    normalizedItems.find((item) => Number(item?.cartItemId || 0) === targetCartItemId) ||
    normalizedItems.find((item) => {
      const itemProductId = Number(item?.productId || 0);
      const itemVariantKey = String(item?.variantKey || "").trim().toLowerCase();
      if (itemProductId <= 0 || targetProductId <= 0) return false;
      return itemProductId === targetProductId && itemVariantKey === targetVariantKey;
    }) ||
    null
  );
};

const defaultVariationState = {
  hasVariants: false,
  selectedAttributes: [],
  selectedAttributeValues: [],
  variants: [],
};

const normalizeVariantNumber = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeVariantQuantity = (value) => {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
};

const buildVariantCombination = (selections) =>
  selections.map((entry) => entry.value).filter(Boolean).join(" / ");

const buildVariantCombinationKey = (selections) =>
  selections
    .map((entry) => `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`)
    .join("|");

export const normalizeAdminProductVariationState = (value) => {
  if (!value) return defaultVariationState;

  if (typeof value === "string") {
    try {
      return normalizeAdminProductVariationState(JSON.parse(value));
    } catch {
      return defaultVariationState;
    }
  }

  const raw =
    Array.isArray(value) ? { hasVariants: value.length > 0, variants: value } : value;
  const selectedAttributesMap = new Map();

  (Array.isArray(raw?.selectedAttributes) ? raw.selectedAttributes : []).forEach((entry) => {
    const id = Number(entry?.id);
    const name = String(entry?.name || "").trim();
    if (Number.isInteger(id) && id > 0 && name) {
      selectedAttributesMap.set(id, { id, name });
    }
  });

  const selectedAttributeValuesMap = new Map();
  (Array.isArray(raw?.selectedAttributeValues) ? raw.selectedAttributeValues : []).forEach(
    (entry) => {
      const attributeId = Number(entry?.attributeId);
      if (!Number.isInteger(attributeId) || attributeId <= 0) return;
      const values = Array.isArray(entry?.values)
        ? entry.values
            .map((item) => {
              const idValue = item?.id ?? null;
              const valueText = String(item?.value ?? item?.label ?? "").trim();
              if (!valueText) return null;
              return {
                id: idValue,
                label: String(item?.label ?? valueText).trim(),
                value: valueText,
              };
            })
            .filter(Boolean)
        : [];
      selectedAttributeValuesMap.set(attributeId, { attributeId, values });
    }
  );

  const variants = (Array.isArray(raw?.variants) ? raw.variants : [])
    .map((entry, index) => {
      const selections = Array.isArray(entry?.selections)
        ? entry.selections
            .map((selection) => {
              const attributeId = Number(selection?.attributeId);
              const attributeName = String(selection?.attributeName || "").trim();
              const value = String(selection?.value || "").trim();
              if (!Number.isInteger(attributeId) || attributeId <= 0 || !attributeName || !value) {
                return null;
              }
              const valueId = selection?.valueId ?? null;
              selectedAttributesMap.set(attributeId, { id: attributeId, name: attributeName });
              const existing = selectedAttributeValuesMap.get(attributeId) || {
                attributeId,
                values: [],
              };
              const dedupeKey = String(valueId ?? value).toLowerCase();
              if (
                !existing.values.some(
                  (item) => String(item.id ?? item.value).toLowerCase() === dedupeKey
                )
              ) {
                existing.values.push({
                  id: valueId,
                  label: value,
                  value,
                });
              }
              selectedAttributeValuesMap.set(attributeId, existing);
              return {
                attributeId,
                attributeName,
                valueId,
                value,
              };
            })
            .filter(Boolean)
        : [];

      const combination = String(entry?.combination || buildVariantCombination(selections)).trim();
      const combinationKey = String(
        entry?.combinationKey || buildVariantCombinationKey(selections)
      ).trim();
      if (!combination || !combinationKey) return null;

      return {
        id: String(entry?.id || `variant-${index + 1}`),
        combination,
        combinationKey,
        selections,
        sku: String(entry?.sku || "").trim(),
        barcode: String(entry?.barcode || "").trim(),
        price: normalizeVariantNumber(entry?.price),
        salePrice: normalizeVariantNumber(entry?.salePrice),
        quantity: normalizeVariantQuantity(entry?.quantity),
        image: entry?.image ? String(entry.image) : null,
      };
    })
    .filter(Boolean);

  return {
    hasVariants: Boolean(raw?.hasVariants) || variants.length > 0,
    selectedAttributes: Array.from(selectedAttributesMap.values()),
    selectedAttributeValues: Array.from(selectedAttributeValuesMap.values()),
    variants,
  };
};

export const buildAdminProductVariantRows = (product, fallbackImageUrl = "") => {
  const variationState = normalizeAdminProductVariationState(product?.variations);
  const productPrice = Number(product?.price || 0);
  const productSalePrice = Number(product?.salePrice || 0);
  const resolvedProductSalePrice = productSalePrice > 0 ? productSalePrice : productPrice;
  const productQuantity = Number(product?.stock || 0);
  const productSku = String(product?.sku || "").trim();
  const productBarcode = String(product?.barcode || "").trim();

  return variationState.variants.map((variant, index) => ({
    id: variant.id || `variant-row-${index + 1}`,
    sr: index + 1,
    imageUrl: variant.image || fallbackImageUrl,
    combination: variant.combination,
    sku: variant.sku || productSku || "-",
    barcode: variant.barcode || productBarcode || "-",
    originalPrice: variant.price != null ? Number(variant.price) : productPrice,
    salePrice:
      variant.salePrice != null
        ? Number(variant.salePrice)
        : variant.price != null
          ? Number(variant.price)
          : resolvedProductSalePrice,
    quantity: variant.quantity != null ? Number(variant.quantity) : productQuantity,
  }));
};

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

const normalizeSelectionKey = (selection) =>
  `${Number(selection?.attributeId) || 0}:${String(selection?.valueId ?? selection?.value ?? "")
    .trim()
    .toLowerCase()}`;

export const buildProductVariantCombinationKey = (selections) =>
  (Array.isArray(selections) ? selections : []).map(normalizeSelectionKey).join("|");

export const normalizePublicProductVariationState = (value) => {
  if (!value) return defaultVariationState;

  if (typeof value === "string") {
    try {
      return normalizePublicProductVariationState(JSON.parse(value));
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

      const combination = String(entry?.combination || "").trim();
      const combinationKey = String(
        entry?.combinationKey || buildProductVariantCombinationKey(selections)
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

export const buildPublicProductVariationGroups = (value) => {
  const state = normalizePublicProductVariationState(value);
  return state.selectedAttributes
    .map((attribute, index) => {
      const valuesEntry = state.selectedAttributeValues.find(
        (entry) => Number(entry?.attributeId) === Number(attribute.id)
      );
      const options = (Array.isArray(valuesEntry?.values) ? valuesEntry.values : [])
        .map((entry, optionIndex) => {
          const value = String(entry?.value ?? entry?.label ?? "").trim();
          if (!value) return null;
          const valueId = entry?.id ?? null;
          return {
            id: `${attribute.id}-${optionIndex}-${value}`.toLowerCase(),
            value,
            valueId,
            selectionKey: `${attribute.id}:${String(valueId ?? value).trim().toLowerCase()}`,
          };
        })
        .filter(Boolean);
      if (options.length === 0) return null;
      return {
        id: String(attribute.id),
        attributeId: Number(attribute.id),
        label: String(attribute.name || `Option ${index + 1}`).trim(),
        options,
      };
    })
    .filter(Boolean);
};

export const resolvePublicSelectedVariant = (value, selectedOptions) => {
  const state = normalizePublicProductVariationState(value);
  if (!state.hasVariants || state.variants.length === 0) return null;

  const selectedEntries = state.selectedAttributes.map((attribute) => {
    const rawKey = selectedOptions?.[String(attribute.id)] ?? selectedOptions?.[attribute.id];
    const normalizedKey = String(rawKey || "").trim().toLowerCase();
    if (!normalizedKey) return null;
    return [String(attribute.id), normalizedKey];
  });

  if (selectedEntries.some((entry) => entry === null)) return null;
  const selectedMap = new Map(selectedEntries);

  return (
    state.variants.find((variant) =>
      variant.selections.every(
        (selection) =>
          selectedMap.get(String(selection.attributeId)) === normalizeSelectionKey(selection)
      )
    ) || null
  );
};

export const productHasVariantSelections = (value) =>
  normalizePublicProductVariationState(value).hasVariants;

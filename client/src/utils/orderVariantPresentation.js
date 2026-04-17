const normalizeVariantSelections = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const attributeName = String(entry.attributeName || "").trim();
          const valueLabel = String(entry.value || "").trim();
          if (!attributeName && !valueLabel) return null;
          return {
            attributeName,
            value: valueLabel,
          };
        })
        .filter(Boolean)
    : [];

export const getOrderItemVariantLabel = (item) => {
  const label = String(item?.variantLabel || "").trim();
  return label || null;
};

export const getOrderItemVariantSelections = (item) =>
  normalizeVariantSelections(item?.variantSelections);

export const formatOrderItemVariantSelections = (item) => {
  const selections = getOrderItemVariantSelections(item);
  if (!selections.length) return null;
  return selections
    .map((selection) =>
      selection.attributeName
        ? `${selection.attributeName}: ${selection.value}`
        : selection.value
    )
    .join(" • ");
};

export const getOrderItemVariantLines = (item) => {
  const lines = [];
  const variantLabel = getOrderItemVariantLabel(item);
  const variantSelections = formatOrderItemVariantSelections(item);
  if (variantLabel) {
    lines.push(`Variant: ${variantLabel}`);
  }
  if (
    variantSelections &&
    (!variantLabel ||
      variantSelections.toLowerCase() !== variantLabel.toLowerCase())
  ) {
    lines.push(variantSelections);
  }
  return lines;
};


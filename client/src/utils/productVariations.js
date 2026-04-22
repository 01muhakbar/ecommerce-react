const normalizeText = (value) => String(value ?? "").trim();

const normalizePlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const normalizeStructuredValue = (value) => {
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    try {
      return JSON.parse(normalized);
    } catch {
      return null;
    }
  }

  return value;
};

const normalizeFiniteNumber = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createAttributeBucket = (key, name = "") => ({
  key,
  name: normalizeText(name) || "Attribute",
  values: new Map(),
});

const resolveAttributeKey = (value, fallback) => {
  const normalized = normalizeText(value);
  return normalized || fallback;
};

const resolveAttributeName = (value, fallback = "Attribute") => {
  const normalized = normalizeText(value);
  return normalized || fallback;
};

const normalizeAttributeValueLabel = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAttributeValueLabel(entry))
      .filter(Boolean)
      .join(", ");
  }

  const plain = normalizePlainObject(value);
  if (plain) {
    return (
      normalizeText(plain.valueLabel) ||
      normalizeText(plain.label) ||
      normalizeText(plain.value) ||
      normalizeText(plain.name) ||
      ""
    );
  }

  return normalizeText(value);
};

const normalizeSelectionEntry = (value, index = 0) => {
  const plain = normalizePlainObject(value);
  if (!plain) return null;

  const attributeId = normalizeText(plain.attributeId ?? plain.attribute?.id);
  const attributeName =
    normalizeText(plain.attributeName) ||
    normalizeText(plain.attribute?.name) ||
    normalizeText(plain.name);
  const valueLabel =
    normalizeText(plain.valueLabel) ||
    normalizeText(plain.optionLabel) ||
    normalizeText(plain.label) ||
    normalizeText(plain.value) ||
    normalizeText(plain.option?.value) ||
    normalizeText(plain.option?.label) ||
    normalizeText(plain.option?.name);

  if (!attributeId && !attributeName && !valueLabel) return null;

  return {
    key: resolveAttributeKey(attributeId, `selection-${index}`),
    name: resolveAttributeName(attributeName, `Attribute ${index + 1}`),
    value: valueLabel || "Value",
  };
};

const buildVariantLabel = (variant, selections) => {
  const directLabel =
    normalizeText(variant?.combination) ||
    normalizeText(variant?.variantLabel) ||
    normalizeText(variant?.label) ||
    normalizeText(variant?.name);

  if (directLabel) return directLabel;
  if (selections.length > 0) {
    return selections.map((entry) => `${entry.name}: ${entry.value}`).join(" / ");
  }

  return "Variant";
};

export const summarizeProductVariations = (rawValue) => {
  const normalizedRootValue = normalizeStructuredValue(rawValue);
  const rootObject = normalizePlainObject(normalizedRootValue);
  const rootVariants = Array.isArray(normalizedRootValue)
    ? normalizedRootValue
    : Array.isArray(rootObject?.variants)
      ? rootObject.variants
      : [];
  const rootSelectedAttributes = Array.isArray(rootObject?.selectedAttributes)
    ? rootObject.selectedAttributes
    : Array.isArray(rootObject?.attributes)
      ? rootObject.attributes
      : [];
  const rootSelectedAttributeValues = Array.isArray(rootObject?.selectedAttributeValues)
    ? rootObject.selectedAttributeValues
    : [];

  const attributeMap = new Map();
  const getAttributeBucket = (key, name) => {
    const normalizedKey = resolveAttributeKey(key, `attribute-${attributeMap.size + 1}`);
    const existing = attributeMap.get(normalizedKey);
    if (existing) {
      if (!existing.name || existing.name === "Attribute") {
        existing.name = resolveAttributeName(name, existing.name);
      }
      return existing;
    }

    const bucket = createAttributeBucket(normalizedKey, name);
    attributeMap.set(normalizedKey, bucket);
    return bucket;
  };

  rootSelectedAttributes.forEach((entry, index) => {
    const plain = normalizePlainObject(entry);
    if (!plain) return;
    const key = resolveAttributeKey(plain.id ?? plain.attributeId, `attribute-${index + 1}`);
    getAttributeBucket(
      key,
      plain.displayName || plain.attributeName || plain.display_name || plain.name
    );
  });

  rootSelectedAttributeValues.forEach((entry, index) => {
    const plain = normalizePlainObject(entry);
    if (!plain) return;
    const key = resolveAttributeKey(plain.attributeId, `attribute-values-${index + 1}`);
    const bucket = getAttributeBucket(key, plain.attributeName || plain.name);
    const values = Array.isArray(plain.values) ? plain.values : [];
    values.forEach((item, valueIndex) => {
      const label = normalizeAttributeValueLabel(item);
      if (!label) return;
      bucket.values.set(
        resolveAttributeKey(
          normalizeText(item?.id ?? item?.value ?? item?.label),
          `${bucket.key}-value-${valueIndex + 1}`
        ),
        label
      );
    });
  });

  const variants = rootVariants.reduce((accumulator, entry, index) => {
    const plain = normalizePlainObject(entry);
    if (!plain) return accumulator;

    const rawSelections = Array.isArray(plain.selections)
      ? plain.selections
      : Array.isArray(plain.variantSelections)
        ? plain.variantSelections
        : Array.isArray(plain.options)
          ? plain.options
          : [];
    const selections = rawSelections
      .map((item, selectionIndex) => normalizeSelectionEntry(item, selectionIndex))
      .filter(Boolean);

    selections.forEach((selection) => {
      const bucket = getAttributeBucket(selection.key, selection.name);
      bucket.values.set(selection.value.toLowerCase(), selection.value);
    });

    accumulator.push({
      id:
        normalizeText(plain.id) ||
        normalizeText(plain.variantKey) ||
        normalizeText(plain.combinationKey) ||
        `variant-${index + 1}`,
      label: buildVariantLabel(plain, selections),
      selections,
      sku: normalizeText(plain.sku) || null,
      barcode: normalizeText(plain.barcode) || null,
      price: normalizeFiniteNumber(plain.price),
      salePrice: normalizeFiniteNumber(plain.salePrice),
      quantity: normalizeFiniteNumber(plain.quantity ?? plain.stock),
      image: normalizeText(plain.image) || null,
    });

    return accumulator;
  }, []);

  const attributes = Array.from(attributeMap.values()).map((bucket) => ({
    key: bucket.key,
    name: bucket.name,
    values: Array.from(bucket.values.values()),
  }));

  const totalOptionCount = attributes.reduce(
    (total, attribute) => total + attribute.values.length,
    0
  );
  const hasStructuredData = Array.isArray(normalizedRootValue)
    ? normalizedRootValue.length > 0
    : Boolean(
        rootObject &&
          (rootVariants.length > 0 ||
            rootSelectedAttributes.length > 0 ||
            rootSelectedAttributeValues.length > 0 ||
            Object.keys(rootObject).length > 0)
      );

  return {
    hasStructuredData,
    attributeCount: attributes.length,
    totalOptionCount,
    variantCount: variants.length,
    attributes,
    variants,
  };
};

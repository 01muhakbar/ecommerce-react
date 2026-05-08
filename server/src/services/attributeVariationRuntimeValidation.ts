import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

type RuntimeAttributeValueRow = {
  valueId: number;
  attributeId: number;
  valueLabel: string;
  valueStatus: string;
  attributeStatus: string;
  published: number | boolean;
  scope: string;
  storeId: number | null;
};

type VariationSelectionRef = {
  attributeId: number;
  valueId: number | null;
  value: string;
  path: string;
};

export type AttributeVariationRuntimeIssue = {
  code: string;
  message: string;
  attributeId?: number;
  valueId?: number | null;
  path?: string;
};

const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeJsonValue = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const cloneJson = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
};

const buildSqlInClause = (ids: readonly number[]) => ids.map(() => "?").join(", ");

const getVariationRoot = (variations: unknown) => {
  const normalized = normalizeJsonValue(variations);
  if (!normalized || typeof normalized !== "object") return null;
  return Array.isArray(normalized)
    ? { hasVariants: normalized.length > 0, variants: normalized }
    : (normalized as Record<string, any>);
};

const collectVariantSelectionRefs = (variations: unknown) => {
  const root = getVariationRoot(variations);
  const refs: VariationSelectionRef[] = [];
  if (!root) return refs;

  const variants = Array.isArray(root.variants) ? root.variants : [];
  variants.forEach((variant: any, variantIndex: number) => {
    const selections = Array.isArray(variant?.selections) ? variant.selections : [];
    selections.forEach((selection: any, selectionIndex: number) => {
      const attributeId = parsePositiveInt(selection?.attributeId);
      const valueId = parsePositiveInt(selection?.valueId);
      const value = normalizeText(selection?.value);
      if (!attributeId) return;
      refs.push({
        attributeId,
        valueId,
        value,
        path: `variations.variants[${variantIndex}].selections[${selectionIndex}]`,
      });
    });
  });

  return refs;
};

const loadRuntimeAttributeValues = async (valueIds: readonly number[], transaction?: any) => {
  const normalizedIds = Array.from(
    new Set(valueIds.map((value) => parsePositiveInt(value)).filter((value): value is number => value !== null))
  );
  const rowsByValueId = new Map<number, RuntimeAttributeValueRow>();
  if (!normalizedIds.length) return rowsByValueId;

  const rows = await sequelize.query<RuntimeAttributeValueRow>(
    `
      SELECT
        av.id AS valueId,
        av.attribute_id AS attributeId,
        av.value AS valueLabel,
        COALESCE(av.status, 'active') AS valueStatus,
        COALESCE(a.status, 'active') AS attributeStatus,
        COALESCE(a.published, 1) AS published,
        COALESCE(a.scope, 'global') AS scope,
        a.store_id AS storeId
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE av.id IN (${buildSqlInClause(normalizedIds)})
    `,
    {
      replacements: normalizedIds,
      transaction,
      type: QueryTypes.SELECT,
    }
  );

  rows.forEach((row) => {
    const valueId = parsePositiveInt(row.valueId);
    const attributeId = parsePositiveInt(row.attributeId);
    if (!valueId || !attributeId) return;
    rowsByValueId.set(valueId, {
      ...row,
      valueId,
      attributeId,
      storeId: parsePositiveInt(row.storeId),
    });
  });

  return rowsByValueId;
};

const isPublished = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  return ["1", "true", "yes"].includes(normalized);
};

const buildRuntimeIssue = (
  ref: VariationSelectionRef,
  code: string,
  message: string
): AttributeVariationRuntimeIssue => ({
  code,
  message,
  attributeId: ref.attributeId,
  valueId: ref.valueId,
  path: ref.path,
});

const resolveRefIssue = (
  ref: VariationSelectionRef,
  rowsByValueId: Map<number, RuntimeAttributeValueRow>,
  storeId: number | null
) => {
  if (!ref.valueId) {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_VALUE_ID_REQUIRED",
      "Every variant selection must include a valid attribute value id."
    );
  }

  const row = rowsByValueId.get(ref.valueId);
  if (!row) {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_VALUE_NOT_FOUND",
      "Variant selection references an attribute value that no longer exists."
    );
  }

  if (row.attributeId !== ref.attributeId) {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_VALUE_MISMATCH",
      "Variant selection value does not belong to the selected attribute."
    );
  }

  if (normalizeText(row.attributeStatus).toLowerCase() !== "active") {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_INACTIVE",
      "Variant selection uses an inactive attribute."
    );
  }

  if (normalizeText(row.valueStatus).toLowerCase() !== "active") {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_VALUE_INACTIVE",
      "Variant selection uses an inactive attribute value."
    );
  }

  if (!isPublished(row.published)) {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_UNPUBLISHED",
      "Variant selection uses an unpublished attribute."
    );
  }

  const scope = normalizeText(row.scope).toLowerCase() || "global";
  if (scope === "store" && (!storeId || row.storeId !== storeId)) {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_STORE_SCOPE_MISMATCH",
      "Variant selection uses an attribute value outside this store scope."
    );
  }

  if (scope !== "global" && scope !== "store") {
    return buildRuntimeIssue(
      ref,
      "ATTRIBUTE_SCOPE_INVALID",
      "Variant selection uses an unsupported attribute scope."
    );
  }

  return null;
};

export const resolveAttributeVariationRuntimeIssues = async (
  variations: unknown,
  options: { storeId?: number | null; transaction?: any } = {}
) => {
  const refs = collectVariantSelectionRefs(variations);
  if (!refs.length) return [] as AttributeVariationRuntimeIssue[];

  const rowsByValueId = await loadRuntimeAttributeValues(
    refs.map((ref) => ref.valueId).filter((value): value is number => value !== null),
    options.transaction
  );
  const storeId = parsePositiveInt(options.storeId) ?? null;

  return refs
    .map((ref) => resolveRefIssue(ref, rowsByValueId, storeId))
    .filter((issue): issue is AttributeVariationRuntimeIssue => issue !== null);
};

export const assertSellerVariationRuntimeValid = async (
  variations: unknown,
  options: { storeId?: number | null; transaction?: any } = {}
) => {
  const issues = await resolveAttributeVariationRuntimeIssues(variations, options);
  if (!issues.length) return;

  const first = issues[0];
  const error = new Error(first.message);
  (error as any).status = 400;
  (error as any).code = first.code || "SELLER_PRODUCT_VARIATION_ATTRIBUTE_INVALID";
  (error as any).issues = issues;
  throw error;
};

const isSelectionRuntimeValid = (
  selection: any,
  rowsByValueId: Map<number, RuntimeAttributeValueRow>,
  storeId: number | null
) => {
  const attributeId = parsePositiveInt(selection?.attributeId);
  if (!attributeId) return false;
  const ref: VariationSelectionRef = {
    attributeId,
    valueId: parsePositiveInt(selection?.valueId),
    value: normalizeText(selection?.value),
    path: "selection",
  };
  return resolveRefIssue(ref, rowsByValueId, storeId) === null;
};

export const sanitizeVariationsForRuntime = async (
  variations: unknown,
  options: { storeId?: number | null; transaction?: any } = {}
) => {
  const root = getVariationRoot(variations);
  if (!root) return variations;

  const refs = collectVariantSelectionRefs(root);
  if (!refs.length) return cloneJson(root);

  const rowsByValueId = await loadRuntimeAttributeValues(
    refs.map((ref) => ref.valueId).filter((value): value is number => value !== null),
    options.transaction
  );
  const storeId = parsePositiveInt(options.storeId) ?? null;
  const selectedAttributes = new Map<number, { id: number; name: string }>();
  const selectedAttributeValues = new Map<
    number,
    { attributeId: number; values: Array<{ id: number | null; label: string; value: string }> }
  >();

  const validVariants = (Array.isArray(root.variants) ? root.variants : [])
    .map((variant: any) => cloneJson(variant))
    .filter((variant: any) => {
      const selections = Array.isArray(variant?.selections) ? variant.selections : [];
      if (!selections.length) return false;
      return selections.every((selection: any) =>
        isSelectionRuntimeValid(selection, rowsByValueId, storeId)
      );
    });

  validVariants.forEach((variant: any) => {
    (Array.isArray(variant?.selections) ? variant.selections : []).forEach((selection: any) => {
      const attributeId = parsePositiveInt(selection?.attributeId);
      const valueId = parsePositiveInt(selection?.valueId);
      const value = normalizeText(selection?.value);
      if (!attributeId || !value) return;
      const attributeName = normalizeText(selection?.attributeName) || `Attribute ${attributeId}`;
      selectedAttributes.set(attributeId, { id: attributeId, name: attributeName });
      const bucket = selectedAttributeValues.get(attributeId) || {
        attributeId,
        values: [],
      };
      if (!bucket.values.some((entry) => entry.id === valueId || entry.value === value)) {
        bucket.values.push({
          id: valueId,
          label: value,
          value,
        });
      }
      selectedAttributeValues.set(attributeId, bucket);
    });
  });

  return {
    ...cloneJson(root),
    hasVariants: Boolean(root.hasVariants) || validVariants.length > 0,
    selectedAttributes: Array.from(selectedAttributes.values()),
    selectedAttributeValues: Array.from(selectedAttributeValues.values()),
    variants: validVariants,
  };
};

export const applyRuntimeVariationSanitizerToProduct = async (
  product: any,
  options: { transaction?: any } = {}
) => {
  if (!product) return product;
  const getValue = (key: string) =>
    product?.getDataValue?.(key) ?? product?.get?.(key) ?? product?.dataValues?.[key] ?? product?.[key];
  const variations = getValue("variations");
  if (!variations) return product;
  const sanitized = await sanitizeVariationsForRuntime(variations, {
    storeId: parsePositiveInt(getValue("storeId")),
    transaction: options.transaction,
  });
  product.setDataValue?.("variations", sanitized);
  product.variations = sanitized;
  if (product.dataValues) product.dataValues.variations = sanitized;
  return product;
};

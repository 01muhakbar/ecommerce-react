import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

export type ProductAttributeOwnershipWarning = {
  code: "ATTRIBUTE_STORE_SCOPE_MISMATCH";
  attributeId: number;
  attributeName: string;
  attributeScope: "global" | "store";
  attributeStoreId: number | null;
  productStoreId: number | null;
  message: string;
};

type AttributeOwnershipRow = {
  id: number;
  name: string;
  displayName: string | null;
  scope: "global" | "store";
  storeId: number | null;
};

const parsePositiveId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildSqlInClause = (ids: readonly number[]) => ids.map(() => "?").join(", ");

const normalizeScope = (value: unknown): "global" | "store" =>
  String(value || "").trim().toLowerCase() === "store" ? "store" : "global";

const collectVariationAttributeIds = (variations: unknown) => {
  const attributeIds = new Set<number>();
  let source = variations;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return [];
  }

  const plain = source as Record<string, any>;
  const selectedAttributes = Array.isArray(plain.selectedAttributes) ? plain.selectedAttributes : [];
  selectedAttributes.forEach((entry) => {
    const attributeId = parsePositiveId(entry?.id ?? entry?.attributeId);
    if (attributeId) attributeIds.add(attributeId);
  });

  const selectedAttributeValues = Array.isArray(plain.selectedAttributeValues)
    ? plain.selectedAttributeValues
    : [];
  selectedAttributeValues.forEach((entry) => {
    const attributeId = parsePositiveId(entry?.attributeId);
    if (attributeId) attributeIds.add(attributeId);
  });

  const variants = Array.isArray(plain.variants) ? plain.variants : [];
  variants.forEach((entry) => {
    const selections = Array.isArray(entry?.selections) ? entry.selections : [];
    selections.forEach((selection: any) => {
      const attributeId = parsePositiveId(selection?.attributeId);
      if (attributeId) attributeIds.add(attributeId);
    });
  });

  return Array.from(attributeIds);
};

const loadLegacyProductAttributeIds = async (productId: number) => {
  if (!Number.isInteger(productId) || productId <= 0) return [];

  try {
    const rows = await sequelize.query<{ attributeId: number }>(
      `
        SELECT DISTINCT attribute_id AS attributeId
        FROM product_attribute_values
        WHERE product_id = ?
      `,
      {
        replacements: [productId],
        type: QueryTypes.SELECT,
      }
    );

    return Array.from(
      new Set(
        rows
          .map((row) => parsePositiveId(row?.attributeId))
          .filter((value): value is number => value !== null)
      )
    );
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return [];
    }
    throw error;
  }
};

const loadAttributeOwnershipRows = async (attributeIds: readonly number[]) => {
  const normalizedIds = Array.from(
    new Set(
      attributeIds
        .map((value) => parsePositiveId(value))
        .filter((value): value is number => value !== null)
    )
  );

  if (!normalizedIds.length) return [];

  const rows = await sequelize.query<AttributeOwnershipRow>(
    `
      SELECT
        id,
        name,
        display_name AS displayName,
        scope,
        store_id AS storeId
      FROM attributes
      WHERE id IN (${buildSqlInClause(normalizedIds)})
    `,
    {
      replacements: normalizedIds,
      type: QueryTypes.SELECT,
    }
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.displayName || row.name || "").trim() || `#${Number(row.id)}`,
    displayName: row.displayName ? String(row.displayName).trim() : null,
    scope: normalizeScope(row.scope),
    storeId: parsePositiveId(row.storeId),
  }));
};

export const buildProductAttributeOwnershipWarnings = async (input: {
  productId?: number | null;
  productStoreId?: number | null;
  attributeIds?: number[];
  variations?: unknown;
}) => {
  const attributeIds = new Set<number>();

  (Array.isArray(input.attributeIds) ? input.attributeIds : []).forEach((value) => {
    const attributeId = parsePositiveId(value);
    if (attributeId) attributeIds.add(attributeId);
  });

  collectVariationAttributeIds(input.variations).forEach((attributeId) => {
    attributeIds.add(attributeId);
  });

  if (Number.isInteger(Number(input.productId)) && Number(input.productId) > 0) {
    const legacyAttributeIds = await loadLegacyProductAttributeIds(Number(input.productId));
    legacyAttributeIds.forEach((attributeId) => attributeIds.add(attributeId));
  }

  const productStoreId = parsePositiveId(input.productStoreId);
  const ownershipRows = await loadAttributeOwnershipRows(Array.from(attributeIds));

  return ownershipRows.reduce<ProductAttributeOwnershipWarning[]>((warnings, row) => {
    if (row.scope !== "store") return warnings;
    if (productStoreId && row.storeId === productStoreId) return warnings;

    warnings.push({
      code: "ATTRIBUTE_STORE_SCOPE_MISMATCH",
      attributeId: row.id,
      attributeName: row.name,
      attributeScope: row.scope,
      attributeStoreId: row.storeId,
      productStoreId,
      message: productStoreId
        ? `Attribute "${row.name}" belongs to store ${row.storeId || "unknown"}, but product belongs to store ${productStoreId}.`
        : `Attribute "${row.name}" is store-scoped, but the product does not have a valid storeId.`,
    });

    return warnings;
  }, []);
};

export const logProductAttributeOwnershipWarnings = (
  source: string,
  warnings: ProductAttributeOwnershipWarning[],
  context: Record<string, unknown> = {}
) => {
  if (!Array.isArray(warnings) || warnings.length === 0) return;
  console.warn(`[product-attribute-ownership][${source}]`, {
    ...context,
    warnings: warnings.map((warning) => ({
      code: warning.code,
      attributeId: warning.attributeId,
      attributeName: warning.attributeName,
      attributeScope: warning.attributeScope,
      attributeStoreId: warning.attributeStoreId,
      productStoreId: warning.productStoreId,
      message: warning.message,
    })),
  });
};

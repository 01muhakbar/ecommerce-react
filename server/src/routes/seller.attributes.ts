import { Router } from "express";
import multer from "multer";
import { Op, QueryTypes, Transaction } from "sequelize";
import { z } from "zod";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Attribute, Product, sequelize } from "../models/index.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

const ATTRIBUTE_TYPES = ["dropdown", "radio", "checkbox"] as const;
type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
type AttributeScope = "global" | "store";
type AttributeStatus = "active" | "archived";

type AttributeRow = {
  id: number;
  name: string;
  displayName: string | null;
  type: AttributeType;
  published: boolean;
  scope: AttributeScope;
  storeId: number | null;
  createdByRole: "admin" | "seller";
  createdByUserId: number | null;
  status: AttributeStatus;
  storeName: string | null;
  storeSlug: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AttributeValueRow = {
  id: number;
  attributeId: number;
  value: string;
  status: AttributeStatus;
};

type AttributeReadModel = AttributeRow & {
  values: string[];
  valueCount: number;
  managedByAdmin: boolean;
  editable: boolean;
  isUsed: boolean;
  usageCount: number;
};

type AttributeInput = {
  nameProvided: boolean;
  name?: string;
  displayNameProvided: boolean;
  displayName: string | null;
  typeProvided: boolean;
  type?: AttributeType;
  publishedProvided: boolean;
  published?: boolean;
  valuesProvided: boolean;
  values: string[];
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MANAGED_BY_ADMIN_MESSAGE = "Managed by Admin";

const bulkActionSchema = z.object({
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.number().int().positive()).nonempty(),
});

const toTrimmedText = (value: unknown) => String(value ?? "").trim();

const createHttpError = (statusCode: number, message: string, extras: Record<string, unknown> = {}) =>
  Object.assign(new Error(message), { statusCode, ...extras });

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const hasOwn = (input: unknown, key: string) =>
  Boolean(input && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, key));

const normalizeAttributeType = (
  value: unknown,
  fallback?: AttributeType
): AttributeType | undefined => {
  const normalized = toTrimmedText(value).toLowerCase();
  if (!normalized) return fallback;
  if ((ATTRIBUTE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as AttributeType;
  }
  throw createHttpError(400, `Type must be one of: ${ATTRIBUTE_TYPES.join(", ")}.`);
};

const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return undefined;
};

const parseAttributeValuesInput = (value: unknown) => {
  if (typeof value === "undefined") {
    return { provided: false, values: [] as string[] };
  }
  if (value === null) {
    return { provided: true, values: [] as string[] };
  }
  if (!Array.isArray(value)) {
    throw createHttpError(400, "Values must be an array.");
  }

  const seen = new Set<string>();
  const values: string[] = [];

  value.forEach((entry, index) => {
    const raw =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? (entry as any).value
          : "";
    const text = toTrimmedText(raw);
    if (!text) {
      throw createHttpError(400, `Values[${index}] is required.`);
    }
    if (text.length > 120) {
      throw createHttpError(400, `Values[${index}] must be 120 characters or fewer.`);
    }
    const dedupeKey = text.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    values.push(text);
  });

  return { provided: true, values };
};

const parseAttributeInput = (
  body: unknown,
  options: { requireName?: boolean; requireDisplayName?: boolean; requireValues?: boolean } = {}
): AttributeInput => {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const nameProvided = hasOwn(payload, "name");
  const rawName = nameProvided ? toTrimmedText(payload.name) : "";
  if (options.requireName && !rawName) {
    throw createHttpError(400, "Name is required.");
  }
  if (nameProvided && !rawName) {
    throw createHttpError(400, "Name is required.");
  }
  if (rawName && (rawName.length < 2 || rawName.length > 120)) {
    throw createHttpError(400, "Name must be 2-120 characters.");
  }

  const displayNameProvided = hasOwn(payload, "displayName") || hasOwn(payload, "display_name");
  const rawDisplayName = hasOwn(payload, "displayName")
    ? payload.displayName
    : payload.display_name;
  const displayName = displayNameProvided ? toTrimmedText(rawDisplayName) || null : null;
  if (options.requireDisplayName && !displayName) {
    throw createHttpError(400, "Display name is required.");
  }
  if (displayName && displayName.length > 255) {
    throw createHttpError(400, "Display name must be 255 characters or fewer.");
  }

  const typeProvided = hasOwn(payload, "type");
  const type = typeProvided ? normalizeAttributeType(payload.type) : undefined;

  const publishedProvided = hasOwn(payload, "published");
  const published = publishedProvided ? parseOptionalBoolean(payload.published) : undefined;
  if (publishedProvided && typeof published !== "boolean") {
    throw createHttpError(400, "Published must be a boolean.");
  }

  const valuesInput = parseAttributeValuesInput(payload.values);
  if (options.requireValues && valuesInput.values.length === 0) {
    throw createHttpError(400, "Add at least one attribute value.");
  }

  return {
    nameProvided,
    name: rawName || undefined,
    displayNameProvided,
    displayName,
    typeProvided,
    type,
    publishedProvided,
    published,
    valuesProvided: valuesInput.provided,
    values: valuesInput.values,
  };
};

const parseImportPayload = (req: any) => {
  if (req.file?.buffer) {
    try {
      const parsed = JSON.parse(req.file.buffer.toString("utf8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.data)) return parsed.data;
      if (Array.isArray(parsed?.items)) return parsed.items;
      return parsed;
    } catch {
      throw createHttpError(400, "Invalid JSON file.");
    }
  }
  if (Array.isArray(req.body)) return req.body;
  if (Array.isArray(req.body?.data)) return req.body.data;
  if (Array.isArray(req.body?.items)) return req.body.items;
  return req.body;
};

const buildSqlInClause = (ids: readonly number[]) => ids.map(() => "?").join(", ");

const normalizeAttributeRow = (row: any): AttributeRow => ({
  id: Number(row?.id),
  name: String(row?.name || "").trim(),
  displayName: toTrimmedText(row?.displayName) || null,
  type: normalizeAttributeType(row?.type, "dropdown") || "dropdown",
  published: Boolean(row?.published),
  scope: String(row?.scope || "global").trim().toLowerCase() === "store" ? "store" : "global",
  storeId: parseId(row?.storeId) ?? null,
  createdByRole:
    String(row?.createdByRole || "admin").trim().toLowerCase() === "seller" ? "seller" : "admin",
  createdByUserId: parseId(row?.createdByUserId) ?? null,
  status: String(row?.status || "active").trim().toLowerCase() === "archived" ? "archived" : "active",
  storeName: toTrimmedText(row?.storeName) || null,
  storeSlug: toTrimmedText(row?.storeSlug) || null,
  createdAt: row?.createdAt ?? null,
  updatedAt: row?.updatedAt ?? null,
});

const normalizeAttributeValueRow = (row: any): AttributeValueRow => ({
  id: Number(row?.id),
  attributeId: Number(row?.attributeId),
  value: toTrimmedText(row?.value),
  status: String(row?.status || "active").trim().toLowerCase() === "archived" ? "archived" : "active",
});

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (/[\",\\n]/.test(text)) {
    return `\"${text.replace(/\"/g, "\"\"")}\"`;
  }
  return text;
};

const csvRow = (values: unknown[]) => values.map((value) => csvEscape(value)).join(",");

const parseListOptions = (query: Record<string, unknown>) => {
  const keyword = toTrimmedText(query.keyword || query.q);
  const optionType = toTrimmedText(query.optionType || query.type).toLowerCase();
  const scope = toTrimmedText(query.scope).toLowerCase();
  const status = toTrimmedText(query.status).toLowerCase();
  const publishedValue = parseOptionalBoolean(query.published);

  if (optionType && !(ATTRIBUTE_TYPES as readonly string[]).includes(optionType)) {
    throw createHttpError(400, `Option type must be one of: ${ATTRIBUTE_TYPES.join(", ")}.`);
  }
  if (scope && !["global", "store"].includes(scope)) {
    throw createHttpError(400, "Scope must be either global or store.");
  }
  if (status && !["active", "archived"].includes(status)) {
    throw createHttpError(400, "Status must be either active or archived.");
  }
  if (hasOwn(query, "published") && typeof publishedValue !== "boolean") {
    throw createHttpError(400, "Published filter must be a boolean.");
  }

  const pageInput = Number(query.page);
  const limitInput = Number(query.limit);
  const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
  const limit = Math.min(MAX_LIMIT, Number.isInteger(limitInput) && limitInput > 0 ? limitInput : DEFAULT_LIMIT);

  return {
    keyword,
    optionType: (optionType || null) as AttributeType | null,
    scope: (scope || null) as AttributeScope | null,
    status: (status || null) as AttributeStatus | null,
    published: typeof publishedValue === "boolean" ? publishedValue : null,
    page,
    limit,
  };
};

const loadAttributeValuesByIds = async (
  attributeIds: readonly number[],
  options: { includeArchived?: boolean; transaction?: Transaction } = {}
) => {
  const map = new Map<number, AttributeValueRow[]>();
  if (!attributeIds.length) return map;

  const rows = await sequelize.query(
    `
      SELECT id, attribute_id AS attributeId, value, status
      FROM attribute_values
      WHERE attribute_id IN (${buildSqlInClause(attributeIds)})
      ${options.includeArchived ? "" : "AND status = 'active'"}
      ORDER BY value ASC
    `,
    {
      replacements: [...attributeIds],
      type: QueryTypes.SELECT,
      transaction: options.transaction,
    }
  );

  rows.forEach((row) => {
    const normalized = normalizeAttributeValueRow(row);
    const current = map.get(normalized.attributeId) || [];
    current.push(normalized);
    map.set(normalized.attributeId, current);
  });

  return map;
};

const buildAttributeReadModels = async (
  rows: AttributeRow[],
  options: { transaction?: Transaction } = {}
): Promise<AttributeReadModel[]> => {
  const ids = rows.map((row) => row.id);
  const [valuesById, usageById] = await Promise.all([
    loadAttributeValuesByIds(ids, { transaction: options.transaction }),
    resolveAttributeUsage(ids),
  ]);
  return rows.map((row) => {
    const values = (valuesById.get(row.id) || [])
      .filter((entry) => entry.status === "active")
      .map((entry) => entry.value);
    const usageCount = usageById.get(row.id)?.size || 0;
    return {
      ...row,
      values,
      valueCount: values.length,
      managedByAdmin: row.scope === "global",
      editable: row.scope === "store",
      isUsed: usageCount > 0,
      usageCount,
    };
  });
};

const loadAttributeRowById = async (
  id: number,
  options: { transaction?: Transaction; storeId?: number | null } = {}
) => {
  const rows = await sequelize.query(
    `
      SELECT
        a.id,
        a.name,
        a.display_name AS displayName,
        a.type,
        a.published,
        a.scope,
        a.store_id AS storeId,
        a.created_by_role AS createdByRole,
        a.created_by_user_id AS createdByUserId,
        a.status,
        s.name AS storeName,
        s.slug AS storeSlug,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt
      FROM attributes a
      LEFT JOIN stores s ON s.id = a.store_id
      WHERE a.id = ?
      ${
        Number.isInteger(options.storeId) && (options.storeId || 0) > 0
          ? "AND ((a.scope = 'global' AND a.published = 1 AND a.status = 'active') OR (a.scope = 'store' AND a.store_id = ?))"
          : ""
      }
      LIMIT 1
    `,
    {
      replacements:
        Number.isInteger(options.storeId) && (options.storeId || 0) > 0
          ? [id, options.storeId]
          : [id],
      type: QueryTypes.SELECT,
      transaction: options.transaction,
    }
  );

  return rows[0] ? normalizeAttributeRow(rows[0]) : null;
};

const loadAttributeReadModelById = async (
  id: number,
  options: { transaction?: Transaction; storeId?: number | null } = {}
) => {
  const row = await loadAttributeRowById(id, options);
  if (!row) return null;
  const [item] = await buildAttributeReadModels([row], { transaction: options.transaction });
  return item || null;
};

const loadStoreAttributeValuesOrThrow = async (
  storeId: number,
  attributeId: number,
  transaction?: Transaction
) => {
  const attribute = await loadStoreAttributeOrThrow(attributeId, storeId, transaction);
  const valuesById = await loadAttributeValuesByIds([attributeId], {
    includeArchived: true,
    transaction,
  });
  const values = valuesById.get(attributeId) || [];
  const usage = await resolveAttributeValueUsage(values.map((entry) => entry.id));

  return {
    attribute: normalizeAttributeRow({
      ...(attribute.get?.() || attribute),
      displayName: attribute.get?.("displayName") ?? attribute.getDataValue("displayName"),
      storeId: attribute.get?.("storeId") ?? attribute.getDataValue("storeId"),
      createdByRole: attribute.get?.("createdByRole") ?? attribute.getDataValue("createdByRole"),
      createdByUserId:
        attribute.get?.("createdByUserId") ?? attribute.getDataValue("createdByUserId"),
      storeName: null,
      storeSlug: null,
      createdAt: (attribute as any).createdAt ?? null,
      updatedAt: (attribute as any).updatedAt ?? null,
    }),
    values: values.map((entry) => ({
      ...entry,
      isUsed: (usage.get(entry.id)?.size || 0) > 0,
      usageCount: usage.get(entry.id)?.size || 0,
    })),
  };
};

const listSellerAttributeReadModels = async (
  storeId: number,
  query: Record<string, unknown>,
  transaction?: Transaction
) => {
  const options = parseListOptions(query);
  const whereClauses = [
    `(
      (a.scope = 'global' AND a.published = 1)
      OR
      (a.scope = 'store' AND a.store_id = ?)
    )`,
  ];
  const replacements: unknown[] = [storeId];

  if (options.keyword) {
    whereClauses.push("(a.name LIKE ? OR a.display_name LIKE ?)");
    const keyword = `%${options.keyword}%`;
    replacements.push(keyword, keyword);
  }
  if (options.optionType) {
    whereClauses.push("a.type = ?");
    replacements.push(options.optionType);
  }
  if (typeof options.published === "boolean") {
    whereClauses.push("a.published = ?");
    replacements.push(options.published ? 1 : 0);
  }
  if (options.scope) {
    whereClauses.push("a.scope = ?");
    replacements.push(options.scope);
  }
  if (options.status) {
    whereClauses.push("a.status = ?");
    replacements.push(options.status);
  } else {
    whereClauses.push("a.status = 'active'");
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
  const [countRows, listRows] = await Promise.all([
    sequelize.query<{ total: number }>(
      `
        SELECT COUNT(*) AS total
        FROM attributes a
        ${whereSql}
      `,
      {
        replacements: [...replacements],
        type: QueryTypes.SELECT,
        transaction,
      }
    ),
    sequelize.query(
      `
        SELECT
          a.id,
          a.name,
          a.display_name AS displayName,
          a.type,
          a.published,
          a.scope,
          a.store_id AS storeId,
          a.created_by_role AS createdByRole,
          a.created_by_user_id AS createdByUserId,
          a.status,
          s.name AS storeName,
          s.slug AS storeSlug,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM attributes a
        LEFT JOIN stores s ON s.id = a.store_id
        ${whereSql}
        ORDER BY
          CASE WHEN a.scope = 'store' THEN 0 ELSE 1 END ASC,
          a.name ASC,
          a.id ASC
        LIMIT ? OFFSET ?
      `,
      {
        replacements: [...replacements, options.limit, (options.page - 1) * options.limit],
        type: QueryTypes.SELECT,
        transaction,
      }
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const rows = listRows.map((row) => normalizeAttributeRow(row));
  const data = await buildAttributeReadModels(rows, { transaction });

  return {
    data,
    meta: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    },
  };
};

const loadLegacyUsageMap = async (
  column: "attribute_id" | "attribute_value_id",
  ids: readonly number[]
) => {
  const usage = new Map<number, Set<number>>();
  if (!ids.length) return usage;

  try {
    const rows = await sequelize.query<{ targetId: number; productId: number }>(
      `
        SELECT DISTINCT ${column} AS targetId, product_id AS productId
        FROM product_attribute_values
        WHERE ${column} IN (${buildSqlInClause(ids)})
      `,
      {
        replacements: [...ids],
        type: QueryTypes.SELECT,
      }
    );

    rows.forEach((row) => {
      const targetId = Number(row.targetId);
      const productId = Number(row.productId);
      if (!targetId || !productId) return;
      const current = usage.get(targetId) || new Set<number>();
      current.add(productId);
      usage.set(targetId, current);
    });
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code !== "ER_NO_SUCH_TABLE") {
      throw error;
    }
  }

  return usage;
};

const collectVariationReferenceIds = (variations: unknown) => {
  const attributeIds = new Set<number>();
  const valueIds = new Set<number>();
  let source = variations;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { attributeIds, valueIds };
  }

  const plain = source as Record<string, any>;
  const selectedAttributes = Array.isArray(plain.selectedAttributes) ? plain.selectedAttributes : [];
  selectedAttributes.forEach((entry) => {
    const attributeId = parseId(entry?.id ?? entry?.attributeId);
    if (attributeId) attributeIds.add(attributeId);
  });

  const selectedAttributeValues = Array.isArray(plain.selectedAttributeValues)
    ? plain.selectedAttributeValues
    : [];
  selectedAttributeValues.forEach((entry) => {
    const attributeId = parseId(entry?.attributeId);
    if (attributeId) attributeIds.add(attributeId);
    const values = Array.isArray(entry?.values) ? entry.values : [];
    values.forEach((valueEntry: any) => {
      const valueId = parseId(valueEntry?.id ?? valueEntry?.valueId);
      if (valueId) valueIds.add(valueId);
    });
  });

  const variants = Array.isArray(plain.variants) ? plain.variants : [];
  variants.forEach((entry) => {
    const selections = Array.isArray(entry?.selections) ? entry.selections : [];
    selections.forEach((selection: any) => {
      const attributeId = parseId(selection?.attributeId);
      const valueId = parseId(selection?.valueId);
      if (attributeId) attributeIds.add(attributeId);
      if (valueId) valueIds.add(valueId);
    });
  });

  return { attributeIds, valueIds };
};

const loadVariationUsageMaps = async () => {
  const attributeUsage = new Map<number, Set<number>>();
  const valueUsage = new Map<number, Set<number>>();
  const products = await Product.findAll({
    attributes: ["id", "variations"],
    where: {
      variations: {
        [Op.ne]: null,
      },
    } as any,
  });

  products.forEach((product) => {
    const productId = Number((product as any).get?.("id") ?? (product as any).id ?? 0);
    if (!productId) return;
    const variations = (product as any).get?.("variations") ?? (product as any).variations;
    const refs = collectVariationReferenceIds(variations);

    refs.attributeIds.forEach((attributeId) => {
      const current = attributeUsage.get(attributeId) || new Set<number>();
      current.add(productId);
      attributeUsage.set(attributeId, current);
    });
    refs.valueIds.forEach((valueId) => {
      const current = valueUsage.get(valueId) || new Set<number>();
      current.add(productId);
      valueUsage.set(valueId, current);
    });
  });

  return { attributeUsage, valueUsage };
};

const resolveAttributeUsage = async (attributeIds: readonly number[]) => {
  const [legacyUsage, variationUsageMaps] = await Promise.all([
    loadLegacyUsageMap("attribute_id", attributeIds),
    loadVariationUsageMaps(),
  ]);

  const usage = new Map<number, Set<number>>();
  attributeIds.forEach((attributeId) => {
    const merged = new Set<number>();
    (legacyUsage.get(attributeId) || []).forEach((productId) => merged.add(productId));
    (variationUsageMaps.attributeUsage.get(attributeId) || []).forEach((productId) => merged.add(productId));
    usage.set(attributeId, merged);
  });
  return usage;
};

const resolveAttributeValueUsage = async (valueIds: readonly number[]) => {
  const [legacyUsage, variationUsageMaps] = await Promise.all([
    loadLegacyUsageMap("attribute_value_id", valueIds),
    loadVariationUsageMaps(),
  ]);

  const usage = new Map<number, Set<number>>();
  valueIds.forEach((valueId) => {
    const merged = new Set<number>();
    (legacyUsage.get(valueId) || []).forEach((productId) => merged.add(productId));
    (variationUsageMaps.valueUsage.get(valueId) || []).forEach((productId) => merged.add(productId));
    usage.set(valueId, merged);
  });
  return usage;
};

const loadStoreAttributeOrThrow = async (
  attributeId: number,
  storeId: number,
  transaction?: Transaction
) => {
  const attribute = await Attribute.findOne({
    where: {
      id: attributeId,
      scope: "store",
      storeId,
    } as any,
    transaction,
  });

  if (!attribute) {
    const fallback = await Attribute.findByPk(attributeId, { transaction });
    if (fallback) {
      const fallbackScope = String((fallback as any).get?.("scope") ?? fallback.getDataValue("scope") ?? "global")
        .trim()
        .toLowerCase();
      if (fallbackScope === "global") {
        throw createHttpError(403, MANAGED_BY_ADMIN_MESSAGE);
      }
    }
    throw createHttpError(404, "Attribute not found.");
  }

  return attribute;
};

const loadAttributeValueWithOwner = async (valueId: number, transaction?: Transaction) => {
  const rows = await sequelize.query(
    `
      SELECT
        av.id,
        av.attribute_id AS attributeId,
        av.value,
        av.status,
        a.scope,
        a.store_id AS storeId
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE av.id = ?
      LIMIT 1
    `,
    {
      replacements: [valueId],
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const row = rows[0] as any;
  if (!row) return null;
  return {
    ...normalizeAttributeValueRow(row),
    scope: String(row.scope || "global").trim().toLowerCase() === "store" ? "store" : "global",
    storeId: parseId(row.storeId) ?? null,
  };
};

const findExistingStoreAttributeByName = async (
  storeId: number,
  name: string,
  options: { excludeId?: number; transaction?: Transaction } = {}
) => {
  const rows = await sequelize.query(
    `
      SELECT id
      FROM attributes
      WHERE scope = 'store'
        AND store_id = ?
        AND LOWER(name) = LOWER(?)
        ${options.excludeId ? "AND id <> ?" : ""}
      LIMIT 1
    `,
    {
      replacements: options.excludeId ? [storeId, name, options.excludeId] : [storeId, name],
      type: QueryTypes.SELECT,
      transaction: options.transaction,
    }
  );
  return rows[0] ? Number((rows[0] as any).id || 0) : null;
};

const syncStoreAttributeValues = async (
  attributeId: number,
  nextValues: string[],
  transaction: Transaction
) => {
  const existingMap = await loadAttributeValuesByIds([attributeId], {
    includeArchived: true,
    transaction,
  });
  const current = existingMap.get(attributeId) || [];
  const currentByKey = new Map(current.map((entry) => [entry.value.toLowerCase(), entry]));
  const nextKeys = new Set(nextValues.map((value) => value.toLowerCase()));

  for (const value of nextValues) {
    const key = value.toLowerCase();
    const existing = currentByKey.get(key);
    if (!existing) {
      await sequelize.query(
        `
          INSERT INTO attribute_values (attribute_id, value, status, created_at, updated_at)
          VALUES (?, ?, 'active', NOW(), NOW())
        `,
        {
          replacements: [attributeId, value],
          transaction,
        }
      );
      continue;
    }

    if (existing.status === "archived") {
      await sequelize.query(
        `
          UPDATE attribute_values
          SET status = 'active', updated_at = NOW()
          WHERE id = ?
        `,
        {
          replacements: [existing.id],
          transaction,
        }
      );
    }
  }

  const toRemove = current.filter(
    (entry) => entry.status === "active" && !nextKeys.has(entry.value.toLowerCase())
  );
  if (!toRemove.length) return;

  const usage = await resolveAttributeValueUsage(toRemove.map((entry) => entry.id));
  const toArchive = toRemove.filter((entry) => (usage.get(entry.id)?.size || 0) > 0);
  const toDelete = toRemove.filter((entry) => (usage.get(entry.id)?.size || 0) === 0);

  if (toArchive.length > 0) {
    await sequelize.query(
      `
        UPDATE attribute_values
        SET status = 'archived', updated_at = NOW()
        WHERE id IN (${buildSqlInClause(toArchive.map((entry) => entry.id))})
      `,
      {
        replacements: toArchive.map((entry) => entry.id),
        transaction,
      }
    );
  }

  if (toDelete.length > 0) {
    await sequelize.query(
      `
        DELETE FROM attribute_values
        WHERE id IN (${buildSqlInClause(toDelete.map((entry) => entry.id))})
      `,
      {
        replacements: toDelete.map((entry) => entry.id),
        transaction,
      }
    );
  }
};

const upsertImportedStoreAttribute = async (
  storeId: number,
  actorId: number | null,
  rowInput: unknown,
  transaction: Transaction
) => {
  const parsed = parseAttributeInput(rowInput, {
    requireName: true,
    requireValues: true,
  });

  const existingId = await findExistingStoreAttributeByName(storeId, parsed.name!, {
    transaction,
  });

  if (!existingId) {
    const created = await Attribute.create(
      {
        name: parsed.name!,
        displayName: parsed.displayNameProvided ? parsed.displayName : parsed.name!,
        type: parsed.type || "dropdown",
        published: parsed.publishedProvided ? Boolean(parsed.published) : true,
        scope: "store",
        storeId,
        createdByRole: "seller",
        createdByUserId: actorId,
        status: "active",
      } as any,
      { transaction }
    );

    await syncStoreAttributeValues(Number(created.get("id")), parsed.values, transaction);
    return { created: 1, updated: 0 };
  }

  const existing = await loadStoreAttributeOrThrow(existingId, storeId, transaction);
  const patch: Record<string, unknown> = {
    status: "active",
  };

  if (parsed.displayNameProvided) patch.displayName = parsed.displayName;
  if (!parsed.displayNameProvided) patch.displayName = parsed.name;
  if (parsed.typeProvided) patch.type = parsed.type;
  if (parsed.publishedProvided) patch.published = parsed.published;
  if (!parsed.publishedProvided) patch.published = true;

  await existing.update(patch as any, { transaction });
  await syncStoreAttributeValues(existingId, parsed.values, transaction);

  return { created: 0, updated: 1 };
};

router.get(
  "/stores/:storeId/attributes",
  requireSellerStoreAccess(["ATTRIBUTE_VIEW"]),
  async (req, res, next) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) {
        return res.status(400).json({ success: false, message: "Invalid store id." });
      }

      const result = await listSellerAttributeReadModels(storeId, req.query as Record<string, unknown>);
      return res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error: any) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.get(
  "/stores/:storeId/attributes/:attributeId/values",
  requireSellerStoreAccess(["ATTRIBUTE_VIEW"]),
  async (req, res, next) => {
    try {
      const storeId = parseId(req.params.storeId);
      const attributeId = parseId(req.params.attributeId);
      if (!storeId || !attributeId) {
        return res.status(400).json({ success: false, message: "Invalid attribute id." });
      }

      const result = await loadStoreAttributeValuesOrThrow(storeId, attributeId);
      return res.json({
        success: true,
        data: result.values,
        attribute: {
          id: result.attribute.id,
          name: result.attribute.name,
          displayName: result.attribute.displayName,
          type: result.attribute.type,
          published: result.attribute.published,
          scope: result.attribute.scope,
          status: result.attribute.status,
          editable: true,
        },
      });
    } catch (error: any) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.get(
  "/stores/:storeId/attributes/export",
  requireSellerStoreAccess(["ATTRIBUTE_VIEW"]),
  async (req, res, next) => {
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) {
        return res.status(400).json({ success: false, message: "Invalid store id." });
      }

      const format = String(req.query.format || "csv").trim().toLowerCase() === "json" ? "json" : "csv";
      const result = await listSellerAttributeReadModels(storeId, {
        ...(req.query as Record<string, unknown>),
        page: 1,
        limit: 5000,
      });
      const rows = result.data;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      if (format === "csv") {
        const header = csvRow([
          "id",
          "scope",
          "storeId",
          "name",
          "displayName",
          "type",
          "published",
          "valueCount",
          "values",
        ]);
        const body = rows.map((row) =>
          csvRow([
            row.id,
            row.scope,
            row.storeId ?? "",
            row.name,
            row.displayName || "",
            row.type,
            row.published ? "true" : "false",
            row.valueCount,
            row.values.join("|"),
          ])
        );
        const csv = `\uFEFF${[header, ...body].join("\n")}`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename=\"seller-attributes-${timestamp}.csv\"`);
        return res.status(200).send(csv);
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"seller-attributes-${timestamp}.json\"`);
      return res.status(200).send(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            scope: "seller-hybrid-attributes",
            total: rows.length,
            data: rows,
          },
          null,
          2
        )
      );
    } catch (error: any) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.post(
  "/stores/:storeId/attributes/import",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  upload.single("file"),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const actorId = parseId((req as any).user?.id);
      if (!storeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid store id." });
      }

      const payload = parseImportPayload(req);
      if (!Array.isArray(payload) || payload.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Import payload must be a non-empty array.",
        });
      }

      let created = 0;
      let updated = 0;
      for (const entry of payload) {
        const result = await upsertImportedStoreAttribute(storeId, actorId, entry, transaction);
        created += result.created;
        updated += result.updated;
      }

      await transaction.commit();
      return res.json({
        success: true,
        data: {
          imported: payload.length,
          created,
          updated,
        },
      });
    } catch (error: any) {
      await transaction.rollback();
      if ((error as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({
          success: false,
          message: "Attribute name already exists in this store.",
        });
      }
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.post(
  "/stores/:storeId/attributes",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const actorId = parseId((req as any).user?.id);
      if (!storeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid store id." });
      }

      const parsed = parseAttributeInput(req.body, {
        requireName: true,
        requireDisplayName: true,
        requireValues: true,
      });

      const duplicateId = await findExistingStoreAttributeByName(storeId, parsed.name!, {
        transaction,
      });
      if (duplicateId) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: "Attribute name already exists in this store." });
      }

      const created = await Attribute.create(
        {
          name: parsed.name!,
          displayName: parsed.displayName,
          type: parsed.type || "dropdown",
          published: parsed.publishedProvided ? Boolean(parsed.published) : true,
          scope: "store",
          storeId,
          createdByRole: "seller",
          createdByUserId: actorId,
          status: "active",
        } as any,
        { transaction }
      );

      await syncStoreAttributeValues(Number(created.get("id")), parsed.values, transaction);
      const response = await loadAttributeReadModelById(Number(created.get("id")), {
        transaction,
        storeId,
      });
      await transaction.commit();
      return res.json({ success: true, data: response });
    } catch (error: any) {
      await transaction.rollback();
      if ((error as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Attribute name already exists in this store." });
      }
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.patch(
  "/stores/:storeId/attributes/:attributeId",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const attributeId = parseId(req.params.attributeId);
      if (!storeId || !attributeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid attribute id." });
      }

      const attribute = await loadStoreAttributeOrThrow(attributeId, storeId, transaction);
      const parsed = parseAttributeInput(req.body);
      const patch: Record<string, unknown> = {};

      if (parsed.nameProvided) {
        const duplicateId = await findExistingStoreAttributeByName(storeId, parsed.name!, {
          excludeId: attributeId,
          transaction,
        });
        if (duplicateId) {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: "Attribute name already exists in this store." });
        }
        patch.name = parsed.name;
      }
      if (parsed.displayNameProvided) patch.displayName = parsed.displayName;
      if (parsed.typeProvided) patch.type = parsed.type;
      if (parsed.publishedProvided) patch.published = parsed.published;

      if (Object.keys(patch).length === 0 && !parsed.valuesProvided) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "No fields to update." });
      }

      if (Object.keys(patch).length > 0) {
        await attribute.update(patch as any, { transaction });
      }
      if (parsed.valuesProvided) {
        if (parsed.values.length === 0) {
          await transaction.rollback();
          return res.status(400).json({ success: false, message: "Add at least one attribute value." });
        }
        await syncStoreAttributeValues(attributeId, parsed.values, transaction);
      }

      const response = await loadAttributeReadModelById(attributeId, {
        transaction,
        storeId,
      });
      await transaction.commit();
      return res.json({ success: true, data: response });
    } catch (error: any) {
      await transaction.rollback();
      if ((error as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Attribute name already exists in this store." });
      }
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.patch(
  "/stores/:storeId/attributes/:attributeId/published",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const attributeId = parseId(req.params.attributeId);
      if (!storeId || !attributeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid attribute id." });
      }

      const published = parseOptionalBoolean(req.body?.published);
      if (typeof published !== "boolean") {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Published must be a boolean." });
      }

      const attribute = await loadStoreAttributeOrThrow(attributeId, storeId, transaction);
      await attribute.update({ published } as any, { transaction });
      const response = await loadAttributeReadModelById(attributeId, {
        transaction,
        storeId,
      });
      await transaction.commit();
      return res.json({ success: true, data: response });
    } catch (error: any) {
      await transaction.rollback();
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.post(
  "/stores/:storeId/attributes/bulk",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      if (!storeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid store id." });
      }

      const { action, ids } = bulkActionSchema.parse(req.body || {});
      const uniqueIds = Array.from(
        new Set(ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))
      );

      const attributes = await Attribute.findAll({
        where: {
          id: {
            [Op.in]: uniqueIds,
          },
          scope: "store",
          storeId,
        } as any,
        transaction,
      });

      if (attributes.length !== uniqueIds.length) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "One or more attributes were not found." });
      }

      if (action === "publish" || action === "unpublish") {
        const [affected] = await Attribute.update(
          { published: action === "publish" } as any,
          {
            where: {
              id: {
                [Op.in]: uniqueIds,
              },
              scope: "store",
              storeId,
            } as any,
            transaction,
          }
        );
        await transaction.commit();
        return res.json({ success: true, affected: Number(affected || 0) });
      }

      const usage = await resolveAttributeUsage(uniqueIds);
      const archiveIds = uniqueIds.filter((id) => (usage.get(id)?.size || 0) > 0);
      const deleteIds = uniqueIds.filter((id) => (usage.get(id)?.size || 0) === 0);

      if (archiveIds.length > 0) {
        await Attribute.update(
          { status: "archived", published: false } as any,
          {
            where: {
              id: {
                [Op.in]: archiveIds,
              },
              scope: "store",
              storeId,
            } as any,
            transaction,
          }
        );
        await sequelize.query(
          `
            UPDATE attribute_values
            SET status = 'archived', updated_at = NOW()
            WHERE attribute_id IN (${buildSqlInClause(archiveIds)})
          `,
          {
            replacements: archiveIds,
            transaction,
          }
        );
      }

      if (deleteIds.length > 0) {
        await sequelize.query(
          `
            DELETE FROM attribute_values
            WHERE attribute_id IN (${buildSqlInClause(deleteIds)})
          `,
          {
            replacements: deleteIds,
            transaction,
          }
        );
        await Attribute.destroy({
          where: {
            id: {
              [Op.in]: deleteIds,
            },
            scope: "store",
            storeId,
          } as any,
          transaction,
        });
      }

      await transaction.commit();
      return res.json({
        success: true,
        affected: uniqueIds.length,
        archivedIds: archiveIds,
        deletedIds: deleteIds,
      });
    } catch (error: any) {
      await transaction.rollback();
      if ((error as any)?.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: (error as any)?.issues?.[0]?.message || "Invalid bulk action payload.",
        });
      }
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.delete(
  "/stores/:storeId/attributes/:attributeId",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const attributeId = parseId(req.params.attributeId);
      if (!storeId || !attributeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid attribute id." });
      }

      const attribute = await loadStoreAttributeOrThrow(attributeId, storeId, transaction);
      const usage = await resolveAttributeUsage([attributeId]);
      const isUsed = (usage.get(attributeId)?.size || 0) > 0;

      if (isUsed) {
        await attribute.update({ status: "archived", published: false } as any, { transaction });
        await sequelize.query(
          `
            UPDATE attribute_values
            SET status = 'archived', updated_at = NOW()
            WHERE attribute_id = ?
          `,
          {
            replacements: [attributeId],
            transaction,
          }
        );
        await transaction.commit();
        return res.json({ success: true, archived: true });
      }

      await sequelize.query(`DELETE FROM attribute_values WHERE attribute_id = ?`, {
        replacements: [attributeId],
        transaction,
      });
      await attribute.destroy({ transaction });
      await transaction.commit();
      return res.json({ success: true, archived: false });
    } catch (error: any) {
      await transaction.rollback();
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.post(
  "/stores/:storeId/attributes/:attributeId/values",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const attributeId = parseId(req.params.attributeId);
      if (!storeId || !attributeId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid attribute id." });
      }

      await loadStoreAttributeOrThrow(attributeId, storeId, transaction);
      const value = toTrimmedText(req.body?.value);
      if (!value || value.length > 120) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Value must be 1-120 characters." });
      }

      const existingValues = await loadAttributeValuesByIds([attributeId], {
        includeArchived: true,
        transaction,
      });
      const existing = (existingValues.get(attributeId) || []).find(
        (entry) => entry.value.toLowerCase() === value.toLowerCase()
      );

      if (existing) {
        if (existing.status === "archived") {
          await sequelize.query(
            `
              UPDATE attribute_values
              SET status = 'active', updated_at = NOW()
              WHERE id = ?
            `,
            {
              replacements: [existing.id],
              transaction,
            }
          );
          await transaction.commit();
          return res.json({
            success: true,
            data: {
              id: existing.id,
              attributeId,
              value,
              status: "active",
            },
          });
        }

        await transaction.rollback();
        return res.status(409).json({ success: false, message: "Value already exists." });
      }

      const [_rows, meta] = await sequelize.query(
        `
          INSERT INTO attribute_values (attribute_id, value, status, created_at, updated_at)
          VALUES (?, ?, 'active', NOW(), NOW())
        `,
        {
          replacements: [attributeId, value],
          transaction,
        }
      );
      await transaction.commit();
      return res.json({
        success: true,
        data: {
          id: Number((meta as any)?.insertId || 0) || null,
          attributeId,
          value,
          status: "active",
        },
      });
    } catch (error: any) {
      await transaction.rollback();
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.patch(
  "/stores/:storeId/attributes/values/:valueId",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const valueId = parseId(req.params.valueId);
      if (!storeId || !valueId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid value id." });
      }

      const current = await loadAttributeValueWithOwner(valueId, transaction);
      if (!current) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Value not found." });
      }
      if (current.scope !== "store" || current.storeId !== storeId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: MANAGED_BY_ADMIN_MESSAGE });
      }

      const value = toTrimmedText(req.body?.value);
      if (!value || value.length > 120) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Value must be 1-120 characters." });
      }

      if (value.toLowerCase() !== current.value.toLowerCase()) {
        const usage = await resolveAttributeValueUsage([valueId]);
        if ((usage.get(valueId)?.size || 0) > 0) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            message: "Used attribute values cannot be renamed. Archive the value instead.",
          });
        }
      }

      await sequelize.query(
        `
          UPDATE attribute_values
          SET value = ?, updated_at = NOW()
          WHERE id = ?
        `,
        {
          replacements: [value, valueId],
          transaction,
        }
      );

      await transaction.commit();
      return res.json({
        success: true,
        data: {
          id: valueId,
          attributeId: current.attributeId,
          value,
          status: current.status,
        },
      });
    } catch (error: any) {
      await transaction.rollback();
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

router.delete(
  "/stores/:storeId/attributes/values/:valueId",
  requireSellerStoreAccess(["ATTRIBUTE_MANAGE"]),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const storeId = parseId(req.params.storeId);
      const valueId = parseId(req.params.valueId);
      if (!storeId || !valueId) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: "Invalid value id." });
      }

      const current = await loadAttributeValueWithOwner(valueId, transaction);
      if (!current) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: "Value not found." });
      }
      if (current.scope !== "store" || current.storeId !== storeId) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: MANAGED_BY_ADMIN_MESSAGE });
      }

      const usage = await resolveAttributeValueUsage([valueId]);
      if ((usage.get(valueId)?.size || 0) > 0) {
        await sequelize.query(
          `
            UPDATE attribute_values
            SET status = 'archived', updated_at = NOW()
            WHERE id = ?
          `,
          {
            replacements: [valueId],
            transaction,
          }
        );
        await transaction.commit();
        return res.json({ success: true, archived: true });
      }

      await sequelize.query(`DELETE FROM attribute_values WHERE id = ?`, {
        replacements: [valueId],
        transaction,
      });
      await transaction.commit();
      return res.json({ success: true, archived: false });
    } catch (error: any) {
      await transaction.rollback();
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      return next(error);
    }
  }
);

export default router;

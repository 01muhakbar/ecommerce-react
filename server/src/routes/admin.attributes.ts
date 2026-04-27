import { Request, Router } from "express";
import multer from "multer";
import { Op, QueryTypes, Transaction } from "sequelize";
import { z } from "zod";
import { Attribute, Product, sequelize } from "../models/index.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

const ATTRIBUTE_TYPES = ["dropdown", "radio", "checkbox"] as const;
type AttributeType = (typeof ATTRIBUTE_TYPES)[number];

type AttributeRow = {
  id: number;
  name: string;
  displayName: string | null;
  type: AttributeType;
  published: boolean;
  scope: "global" | "store";
  storeId: number | null;
  createdByRole: "admin" | "seller";
  createdByUserId: number | null;
  status: "active" | "archived";
  storeName: string | null;
  storeSlug: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AttributeValueRow = {
  id: number;
  attributeId: number;
  value: string;
};

type AttributeReadModel = AttributeRow & {
  values: string[];
  valueCount: number;
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

const bulkActionSchema = z.object({
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.number().int().positive()).nonempty(),
});

const toTrimmedText = (value: unknown) => String(value ?? "").trim();

const createHttpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

const isSuperAdminRequest = (req: Request) => {
  const normalized = String((req as any).user?.role || "")
    .trim()
    .toLowerCase();
  return ["super_admin", "superadmin", "super-admin", "super admin"].includes(normalized);
};

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
  throw createHttpError(
    400,
    `Type must be one of: ${ATTRIBUTE_TYPES.join(", ")}.`
  );
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

const parseAttributeInput = (body: unknown, options: { requireName?: boolean } = {}): AttributeInput => {
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
  if (displayName && displayName.length > 255) {
    throw createHttpError(400, "Display name must be 255 characters or fewer.");
  }

  const typeProvided = hasOwn(payload, "type");
  const type = typeProvided
    ? normalizeAttributeType(payload.type)
    : undefined;

  const publishedProvided = hasOwn(payload, "published");
  const published = publishedProvided ? parseOptionalBoolean(payload.published) : undefined;
  if (publishedProvided && typeof published !== "boolean") {
    throw createHttpError(400, "Published must be a boolean.");
  }

  const valuesInput = parseAttributeValuesInput(payload.values);

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

const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const csvRow = (values: unknown[]) => values.map((value) => csvEscape(value)).join(",");

const parseListOptions = (query: Record<string, unknown>) => {
  const q = toTrimmedText(query.q);
  const type = toTrimmedText(query.type).toLowerCase();
  const scope = toTrimmedText(query.scope).toLowerCase();
  const status = toTrimmedText(query.status).toLowerCase();
  const createdByRole = toTrimmedText(query.createdByRole).toLowerCase();
  const storeId = parseId(query.storeId);
  const publishedValue = parseOptionalBoolean(query.published);

  if (type && !(ATTRIBUTE_TYPES as readonly string[]).includes(type)) {
    throw createHttpError(400, `Type filter must be one of: ${ATTRIBUTE_TYPES.join(", ")}.`);
  }
  if (scope && !["global", "store"].includes(scope)) {
    throw createHttpError(400, "Scope filter must be global or store.");
  }
  if (status && !["active", "archived"].includes(status)) {
    throw createHttpError(400, "Status filter must be active or archived.");
  }
  if (createdByRole && !["admin", "seller"].includes(createdByRole)) {
    throw createHttpError(400, "Created by filter must be admin or seller.");
  }
  if (hasOwn(query, "published") && typeof publishedValue !== "boolean") {
    throw createHttpError(400, "Published filter must be a boolean.");
  }

  const pageInput = Number(query.page);
  const limitInput = Number(query.limit);
  const paginate =
    Number.isInteger(pageInput) && pageInput > 0 || Number.isInteger(limitInput) && limitInput > 0;
  const page = paginate && Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
  const limit = paginate
    ? Math.min(
        MAX_LIMIT,
        Number.isInteger(limitInput) && limitInput > 0 ? limitInput : DEFAULT_LIMIT
      )
    : 0;

  const rawSort = toTrimmedText(query.sort);
  let sortKey = "name";
  let direction: "ASC" | "DESC" = "ASC";
  if (rawSort) {
    if (rawSort.startsWith("-")) {
      sortKey = rawSort.slice(1);
      direction = "DESC";
    } else {
      const [column, dir] = rawSort.split(":");
      sortKey = toTrimmedText(column) || "name";
      direction = String(dir || "").trim().toLowerCase() === "desc" ? "DESC" : "ASC";
    }
  }

  const sortMap: Record<string, string> = {
    id: "a.id",
    name: "a.name",
    displayname: "a.display_name",
    type: "a.type",
    published: "a.published",
    createdat: "a.created_at",
    updatedat: "a.updated_at",
  };
  const normalizedSortKey = sortKey.replace(/[^a-z]/gi, "").toLowerCase();
  const sortColumn = sortMap[normalizedSortKey] || "a.name";

  return {
    q,
    type: (type || null) as AttributeType | null,
    scope: (scope || null) as "global" | "store" | null,
    status: (status || null) as "active" | "archived" | null,
    createdByRole: (createdByRole || null) as "admin" | "seller" | null,
    storeId,
    published: typeof publishedValue === "boolean" ? publishedValue : null,
    paginate,
    page,
    limit,
    sortColumn,
    sortDirection: direction,
  };
};

const loadAttributeValuesByIds = async (
  attributeIds: readonly number[],
  transaction?: Transaction
) => {
  const map = new Map<number, AttributeValueRow[]>();
  if (!attributeIds.length) return map;

  const rows = await sequelize.query<AttributeValueRow>(
    `
      SELECT id, attribute_id AS attributeId, value
      FROM attribute_values
      WHERE attribute_id IN (${buildSqlInClause(attributeIds)})
        AND status = 'active'
      ORDER BY value ASC
    `,
    {
      replacements: [...attributeIds],
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  rows.forEach((row) => {
    const normalized: AttributeValueRow = {
      id: Number(row.id),
      attributeId: Number(row.attributeId),
      value: toTrimmedText(row.value),
    };
    const current = map.get(normalized.attributeId) || [];
    current.push(normalized);
    map.set(normalized.attributeId, current);
  });

  return map;
};

const buildAttributeReadModels = async (
  rows: AttributeRow[],
  transaction?: Transaction
): Promise<AttributeReadModel[]> => {
  const ids = rows.map((row) => row.id);
  const valuesById = await loadAttributeValuesByIds(ids, transaction);
  return rows.map((row) => {
    const values = (valuesById.get(row.id) || []).map((entry) => entry.value);
    return {
      ...row,
      values,
      valueCount: values.length,
    };
  });
};

const loadAttributeRowById = async (id: number, transaction?: Transaction) => {
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
      LIMIT 1
    `,
    {
      replacements: [id],
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return rows[0] ? normalizeAttributeRow(rows[0]) : null;
};

const loadAttributeReadModelById = async (id: number, transaction?: Transaction) => {
  const row = await loadAttributeRowById(id, transaction);
  if (!row) return null;
  const [item] = await buildAttributeReadModels([row], transaction);
  return item || null;
};

const listAttributeReadModels = async (
  query: Record<string, unknown>,
  transaction?: Transaction
) => {
  const options = parseListOptions(query);
  const whereClauses: string[] = [];
  const replacements: unknown[] = [];

  if (options.q) {
    whereClauses.push("(a.name LIKE ? OR a.display_name LIKE ?)");
    const keyword = `%${options.q}%`;
    replacements.push(keyword, keyword);
  }
  if (options.type) {
    whereClauses.push("a.type = ?");
    replacements.push(options.type);
  }
  if (options.scope) {
    whereClauses.push("a.scope = ?");
    replacements.push(options.scope);
  }
  if (options.status) {
    whereClauses.push("a.status = ?");
    replacements.push(options.status);
  }
  if (options.createdByRole) {
    whereClauses.push("a.created_by_role = ?");
    replacements.push(options.createdByRole);
  }
  if (options.storeId) {
    whereClauses.push("a.store_id = ?");
    replacements.push(options.storeId);
  }
  if (typeof options.published === "boolean") {
    whereClauses.push("a.published = ?");
    replacements.push(options.published ? 1 : 0);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const [countRows, rowResults] = await Promise.all([
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
          ${options.sortColumn} ${options.sortDirection},
          a.id ASC
        ${options.paginate ? "LIMIT ? OFFSET ?" : ""}
      `,
      {
        replacements: options.paginate
          ? [...replacements, options.limit, (options.page - 1) * options.limit]
          : [...replacements],
        type: QueryTypes.SELECT,
        transaction,
      }
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const rows = rowResults.map((row) => normalizeAttributeRow(row));
  const data = await buildAttributeReadModels(rows, transaction);
  const effectiveLimit = options.paginate ? options.limit : Math.max(total, data.length, 1);

  return {
    data,
    meta: {
      page: options.paginate ? options.page : 1,
      limit: effectiveLimit,
      total,
      totalPages: options.paginate ? Math.max(1, Math.ceil(total / options.limit)) : 1,
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
    (variationUsageMaps.attributeUsage.get(attributeId) || []).forEach((productId) =>
      merged.add(productId)
    );
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

const assertAttributesUnused = async (attributeIds: readonly number[]) => {
  const usage = await resolveAttributeUsage(attributeIds);
  const blockedIds = attributeIds.filter((attributeId) => (usage.get(attributeId)?.size || 0) > 0);
  if (blockedIds.length > 0) {
    throw Object.assign(
      createHttpError(
        409,
        "One or more attributes are already used by products and cannot be deleted."
      ),
      { blockedIds }
    );
  }
};

const assertAttributeValuesUnused = async (valueIds: readonly number[]) => {
  const usage = await resolveAttributeValueUsage(valueIds);
  const blockedIds = valueIds.filter((valueId) => (usage.get(valueId)?.size || 0) > 0);
  if (blockedIds.length > 0) {
    throw Object.assign(
      createHttpError(
        409,
        "One or more attribute values are already used by products and cannot be deleted."
      ),
      { blockedIds }
    );
  }
};

const syncAttributeValues = async (
  attributeId: number,
  nextValues: string[],
  transaction: Transaction
) => {
  const existingValues = await loadAttributeValuesByIds([attributeId], transaction);
  const current = existingValues.get(attributeId) || [];
  const currentByKey = new Map(current.map((entry) => [entry.value.toLowerCase(), entry]));
  const nextKeys = new Set(nextValues.map((value) => value.toLowerCase()));

  const toCreate = nextValues.filter((value) => !currentByKey.has(value.toLowerCase()));
  const toDelete = current.filter((entry) => !nextKeys.has(entry.value.toLowerCase()));

  if (toDelete.length > 0) {
    await assertAttributeValuesUnused(toDelete.map((entry) => entry.id));
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

  if (toCreate.length > 0) {
    const valuesSql = toCreate.map(() => "(?, ?, NOW(), NOW())").join(", ");
    const replacements = toCreate.flatMap((value) => [attributeId, value]);
    await sequelize.query(
      `
        INSERT INTO attribute_values (attribute_id, value, created_at, updated_at)
        VALUES ${valuesSql}
      `,
      {
        replacements,
        transaction,
      }
    );
  }
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

const upsertImportedAttribute = async (
  rowInput: unknown,
  transaction: Transaction
) => {
  const parsed = parseAttributeInput(rowInput, { requireName: true });
  const existing = await Attribute.findOne({
    where: { name: parsed.name!, scope: "global" } as any,
    transaction,
  });

  if (!existing) {
    const created = await Attribute.create(
      {
        name: parsed.name!,
        displayName: parsed.displayNameProvided ? parsed.displayName : parsed.name!,
        type: parsed.type || "dropdown",
        published: parsed.publishedProvided ? Boolean(parsed.published) : true,
        scope: "global",
        storeId: null,
        createdByRole: "admin",
        createdByUserId: null,
        status: "active",
      } as any,
      { transaction }
    );

    if (parsed.valuesProvided && parsed.values.length > 0) {
      await syncAttributeValues(Number(created.get("id")), parsed.values, transaction);
    }
    return { created: 1, updated: 0 };
  }

  const patch: Record<string, unknown> = {};
  if (parsed.displayNameProvided) patch.displayName = parsed.displayName;
  if (parsed.typeProvided) patch.type = parsed.type;
  if (parsed.publishedProvided) patch.published = parsed.published;
  if (Object.keys(patch).length > 0) {
    await existing.update(patch as any, { transaction });
  }
  if (parsed.valuesProvided) {
    await syncAttributeValues(Number(existing.get("id")), parsed.values, transaction);
  }

  return { created: 0, updated: 1 };
};

// GET /api/admin/attributes
router.get("/", async (req, res, next) => {
  try {
    const result = await listAttributeReadModels(req.query as Record<string, unknown>);
    return res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({
        success: true,
        data: [],
        meta: { page: 1, limit: 1, total: 0, totalPages: 1 },
        warning: "attributes table not found",
      });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// GET /api/admin/attributes/export?type=csv|json
router.get("/export", async (req, res, next) => {
  try {
    const exportType =
      String(req.query.format || req.query.type || "json").trim().toLowerCase() === "csv"
        ? "csv"
        : "json";
    const exportFilters = { ...(req.query as Record<string, unknown>) };
    delete exportFilters.type;
    delete exportFilters.format;
    const result = await listAttributeReadModels({
      ...exportFilters,
      page: undefined,
      limit: undefined,
    });
    const rows = result.data;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (exportType === "csv") {
      const header = csvRow([
        "id",
        "scope",
        "storeId",
        "createdByRole",
        "status",
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
          row.createdByRole,
          row.status,
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
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attributes-export-${timestamp}.csv"`
      );
      return res.status(200).send(csv);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      total: rows.length,
      data: rows,
    };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attributes-export-${timestamp}.json"`
    );
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// POST /api/admin/attributes/import
router.post("/import", upload.single("file"), async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
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
      const result = await upsertImportedAttribute(entry, transaction);
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
      return res.status(409).json({ success: false, message: "Attribute already exists" });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// POST /api/admin/attributes/bulk
router.post("/bulk", async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const { action, ids } = bulkActionSchema.parse(req.body || {});
    const uniqueIds = Array.from(new Set(ids.map((value) => Number(value))));
    const attributes = await Attribute.findAll({
      where: {
        id: {
          [Op.in]: uniqueIds,
        },
      } as any,
      transaction,
    });
    const globalIds = attributes
      .filter((attribute) => String((attribute as any).get?.("scope") ?? attribute.getDataValue("scope") ?? "global") === "global")
      .map((attribute) => Number((attribute as any).get?.("id") ?? attribute.getDataValue("id") ?? 0))
      .filter(Boolean);
    const storeIds = attributes
      .filter((attribute) => String((attribute as any).get?.("scope") ?? attribute.getDataValue("scope") ?? "global") === "store")
      .map((attribute) => Number((attribute as any).get?.("id") ?? attribute.getDataValue("id") ?? 0))
      .filter(Boolean);

    if (action === "delete") {
      if (globalIds.length > 0) {
        await assertAttributesUnused(globalIds);
        await sequelize.query(
          `
            DELETE FROM attributes
            WHERE id IN (${buildSqlInClause(globalIds)})
          `,
          {
            replacements: globalIds,
            transaction,
          }
        );
      }
      if (storeIds.length > 0) {
        if (!actorIsSuperAdmin) {
          await transaction.rollback();
          return res.status(403).json({
            success: false,
            message: "Only Super Admin can archive seller attributes from Admin.",
          });
        }
        await Attribute.update(
          { status: "archived", published: false } as any,
          {
            where: {
              id: {
                [Op.in]: storeIds,
              },
            } as any,
            transaction,
          }
        );
        await sequelize.query(
          `
            UPDATE attribute_values
            SET status = 'archived', updated_at = NOW()
            WHERE attribute_id IN (${buildSqlInClause(storeIds)})
          `,
          {
            replacements: storeIds,
            transaction,
          }
        );
      }
      await transaction.commit();
      return res.json({
        success: true,
        affected: uniqueIds.length,
      });
    }

    let affected = 0;
    if (globalIds.length > 0) {
      const [updatedCount] = await Attribute.update(
        { published: action === "publish" } as any,
        {
          where: {
            id: {
              [Op.in]: globalIds,
            },
            scope: "global",
          } as any,
          transaction,
        }
      );
      affected += Number(updatedCount || 0);
    }

    if (storeIds.length > 0) {
      if (!actorIsSuperAdmin) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "Only Super Admin can update seller attributes from Admin.",
        });
      }
      const [updatedCount] = await Attribute.update(
        { published: action === "publish" } as any,
        {
          where: {
            id: {
              [Op.in]: storeIds,
            },
            scope: "store",
          } as any,
          transaction,
        }
      );
      affected += Number(updatedCount || 0);
    }

    await transaction.commit();
    return res.json({
      success: true,
      affected,
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
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        blockedIds: error.blockedIds || undefined,
      });
    }
    return next(error);
  }
});

// POST /api/admin/attributes
router.post("/", async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const parsed = parseAttributeInput(req.body, { requireName: true });
    const created = await Attribute.create(
      {
        name: parsed.name!,
        displayName: parsed.displayNameProvided ? parsed.displayName : parsed.name!,
        type: parsed.type || "dropdown",
        published: parsed.publishedProvided ? Boolean(parsed.published) : true,
        scope: "global",
        storeId: null,
        createdByRole: "admin",
        createdByUserId: null,
        status: "active",
      } as any,
      { transaction }
    );

    if (parsed.valuesProvided && parsed.values.length > 0) {
      await syncAttributeValues(Number(created.get("id")), parsed.values, transaction);
    }

    const response = await loadAttributeReadModelById(Number(created.get("id")), transaction);
    await transaction.commit();
    return res.json({ success: true, data: response });
  } catch (error: any) {
    await transaction.rollback();
    if ((error as any)?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Attribute already exists" });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// PATCH /api/admin/attributes/:id
router.patch("/:id", async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const id = parseId(req.params.id);
    if (!id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid attribute id" });
    }

    const attribute = await Attribute.findByPk(id, { transaction });
    if (!attribute) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }
    const scope = String((attribute as any).get?.("scope") ?? attribute.getDataValue("scope") ?? "global")
      .trim()
      .toLowerCase();
    if (scope === "store" && !actorIsSuperAdmin) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can edit seller attributes from Admin.",
      });
    }

    const parsed = parseAttributeInput(req.body, { requireName: false });
    const patch: Record<string, unknown> = {};
    if (parsed.nameProvided) patch.name = parsed.name;
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
      await syncAttributeValues(id, parsed.values, transaction);
    }

    const response = await loadAttributeReadModelById(id, transaction);
    await transaction.commit();
    return res.json({ success: true, data: response });
  } catch (error: any) {
    await transaction.rollback();
    if ((error as any)?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "Attribute already exists" });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        blockedIds: error.blockedIds || undefined,
      });
    }
    return next(error);
  }
});

// DELETE /api/admin/attributes/:id
router.delete("/:id", async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const id = parseId(req.params.id);
    if (!id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid attribute id" });
    }

    const attribute = await Attribute.findByPk(id, { transaction });
    if (!attribute) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }

    const scope = String((attribute as any).get?.("scope") ?? attribute.getDataValue("scope") ?? "global")
      .trim()
      .toLowerCase();
    if (scope === "store") {
      if (!actorIsSuperAdmin) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: "Only Super Admin can archive seller attributes from Admin.",
        });
      }
      await attribute.update({ status: "archived", published: false } as any, { transaction });
      await sequelize.query(
        `
          UPDATE attribute_values
          SET status = 'archived', updated_at = NOW()
          WHERE attribute_id = ?
        `,
        {
          replacements: [id],
          transaction,
        }
      );
      await transaction.commit();
      return res.json({ success: true, archived: true });
    }

    await assertAttributesUnused([id]);
    await attribute.destroy({ transaction });
    await transaction.commit();
    return res.json({ success: true });
  } catch (error: any) {
    await transaction.rollback();
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res.status(200).json({
        success: true,
        warning: "attributes table not found",
      });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        blockedIds: error.blockedIds || undefined,
      });
    }
    return next(error);
  }
});

export default router;

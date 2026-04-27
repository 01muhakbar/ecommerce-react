import { Router, Request, Response, NextFunction } from "express";
import { Op, QueryTypes } from "sequelize";
import { z } from "zod";
import multer from "multer";
import { requireAdmin, requireStaffOrAdmin } from "../middleware/requireRole.js";
import { Product } from "../models/Product.js";
import {
  CartItem,
  Category,
  OrderItem,
  ProductCategory,
  ProductReview,
  Store,
  SuborderItem,
  sequelize,
} from "../models/index.js";
import { buildProductVisibilitySnapshot } from "../services/productVisibility.js";
import { buildPublicStoreOperationalReadiness } from "../services/sharedContracts/publicStoreIdentity.js";
import { STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES } from "../services/sharedContracts/storePaymentProfileCompat.js";
import {
  logProductActivity,
  PRODUCT_ACTIVITY_LOG_ACTIONS,
} from "../services/productActivityLog.service.js";

const router = Router();
router.use(requireStaffOrAdmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const asSingle = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const parseId = (value: string) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const parseOptionalPositiveId = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalizePositiveIdList = (value: unknown): number[] => {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : typeof value === "number"
        ? [value]
        : [];

  return Array.from(
    new Set(
      input
        .map((entry) => parseOptionalPositiveId(entry))
        .filter((entry): entry is number => entry !== null)
    )
  );
};
const normalizeCategoryIdsInput = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.map((entry) => parseOptionalPositiveId(entry)).filter((entry) => entry !== null))) as number[];
};
const normalizeUploadsUrl = (value?: unknown): string | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;

  if (
    normalized === "[]" ||
    normalized === "[" ||
    normalized === "]" ||
    normalized === "{}" ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return null;
  }

  if (normalized.startsWith("[") || normalized.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return normalizeUploadsUrl(parsed[0]);
      }
      if (parsed && typeof parsed === "object") {
        return (
          normalizeUploadsUrl((parsed as any).url) ||
          normalizeUploadsUrl((parsed as any).path) ||
          normalizeUploadsUrl((parsed as any).src)
        );
      }
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/uploads/")) return normalized;
  if (normalized.startsWith("/")) return normalized;
  return `/uploads/${normalized}`;
};

const normalizeImagePathList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((entry) => normalizeUploadsUrl(entry)).filter(Boolean))
    ) as string[];
  }

  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return [];

  if (normalized.startsWith("[")) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(parsed.map((entry) => normalizeUploadsUrl(entry)).filter(Boolean))
        ) as string[];
      }
    } catch {
      return [];
    }
  }

  const single = normalizeUploadsUrl(normalized);
  return single ? [single] : [];
};
const isMalformedLiteral = (value: string) => {
  const normalized = value.trim();
  return (
    normalized === "[]" ||
    normalized === "[" ||
    normalized === "]" ||
    normalized === "{}" ||
    normalized === "null" ||
    normalized === "undefined"
  );
};
const tryParseJson = (value: string) => {
  try {
    return { ok: true as const, value: JSON.parse(value) };
  } catch {
    return { ok: false as const, value: null };
  }
};
const normalizeAdminJsonValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized || isMalformedLiteral(normalized)) return null;
    const parsed = tryParseJson(normalized);
    return parsed.ok ? parsed.value : normalized;
  }
  return value;
};
export type AdminProductSeo = {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImageUrl: string;
};

const createEmptyAdminProductSeo = (): AdminProductSeo => ({
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  ogImageUrl: "",
});

const isValidAdminProductSeoOgImageUrl = (value: string) =>
  /^https?:\/\//i.test(value) || value.startsWith("/");

export const sanitizeAdminProductSeo = (value: unknown): AdminProductSeo | null => {
  const normalizedValue = normalizeAdminJsonValue(value);
  if (normalizedValue === null || typeof normalizedValue === "undefined") return null;
  if (!normalizedValue || typeof normalizedValue !== "object" || Array.isArray(normalizedValue)) {
    throw createCategoryContractError("seo must be an object or null.");
  }

  const raw = normalizedValue as Record<string, unknown>;
  const metaTitle = String(raw.metaTitle ?? "").trim();
  const metaDescription = String(raw.metaDescription ?? "").trim();
  const ogImageUrl = String(raw.ogImageUrl ?? "").trim();
  const keywordsRaw = raw.keywords;

  if (metaTitle.length > 255) {
    throw createCategoryContractError("seo.metaTitle must be 255 characters or fewer.");
  }
  if (metaDescription.length > 1000) {
    throw createCategoryContractError("seo.metaDescription must be 1000 characters or fewer.");
  }
  if (ogImageUrl.length > 2048) {
    throw createCategoryContractError("seo.ogImageUrl must be 2048 characters or fewer.");
  }
  if (ogImageUrl && !isValidAdminProductSeoOgImageUrl(ogImageUrl)) {
    throw createCategoryContractError(
      "seo.ogImageUrl must be an absolute http(s) URL or a local path starting with /."
    );
  }

  if (typeof keywordsRaw !== "undefined" && !Array.isArray(keywordsRaw)) {
    throw createCategoryContractError("seo.keywords must be an array of strings.");
  }

  const keywords: string[] = [];
  const seenKeywords = new Set<string>();
  for (const entry of Array.isArray(keywordsRaw) ? keywordsRaw : []) {
    if (typeof entry !== "string") {
      throw createCategoryContractError("seo.keywords must contain only strings.");
    }
    const keyword = entry.trim();
    if (!keyword) continue;
    if (keyword.length > 100) {
      throw createCategoryContractError("seo.keywords entries must be 100 characters or fewer.");
    }
    const dedupeKey = keyword.toLowerCase();
    if (seenKeywords.has(dedupeKey)) continue;
    seenKeywords.add(dedupeKey);
    keywords.push(keyword);
  }

  if (keywords.length > 30) {
    throw createCategoryContractError("seo.keywords must contain 30 entries or fewer.");
  }

  if (!metaTitle && !metaDescription && keywords.length === 0 && !ogImageUrl) {
    return null;
  }

  return {
    metaTitle,
    metaDescription,
    keywords,
    ogImageUrl,
  };
};

export const normalizeAdminProductSeoResponse = (value: unknown): AdminProductSeo => {
  const normalizedValue = normalizeAdminJsonValue(value);
  if (!normalizedValue || typeof normalizedValue !== "object" || Array.isArray(normalizedValue)) {
    return createEmptyAdminProductSeo();
  }

  const raw = normalizedValue as Record<string, unknown>;
  const metaTitle = String(raw.metaTitle ?? "").trim();
  const metaDescription = String(raw.metaDescription ?? "").trim();
  const ogImageUrlRaw = String(raw.ogImageUrl ?? "").trim();
  const ogImageUrl = isValidAdminProductSeoOgImageUrl(ogImageUrlRaw) ? ogImageUrlRaw : "";
  const keywords: string[] = [];
  const seenKeywords = new Set<string>();

  for (const entry of Array.isArray(raw.keywords) ? raw.keywords : []) {
    if (typeof entry !== "string") continue;
    const keyword = entry.trim();
    if (!keyword) continue;
    const dedupeKey = keyword.toLowerCase();
    if (seenKeywords.has(dedupeKey)) continue;
    seenKeywords.add(dedupeKey);
    keywords.push(keyword);
  }

  return {
    metaTitle,
    metaDescription,
    keywords,
    ogImageUrl,
  };
};

export const mergeAdminProductSeoInput = (existingSeo: unknown, seoPatch: unknown) => {
  if (seoPatch === null) return null;
  if (!seoPatch || typeof seoPatch !== "object" || Array.isArray(seoPatch)) return seoPatch;
  return {
    ...normalizeAdminProductSeoResponse(existingSeo),
    ...(seoPatch as Record<string, unknown>),
  };
};

const normalizeAdminProductTags = (value: unknown): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushTag = (candidate: unknown) => {
    const normalized = String(candidate ?? "").trim();
    if (!normalized || isMalformedLiteral(normalized)) return;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(normalized);
  };

  const consume = (entry: unknown, depth = 0): void => {
    if (entry === null || typeof entry === "undefined" || depth > 4) return;

    if (Array.isArray(entry)) {
      entry.forEach((item) => consume(item, depth + 1));
      return;
    }

    if (typeof entry === "string") {
      let normalized = entry.trim();
      if (!normalized || isMalformedLiteral(normalized)) return;

      const parsed = tryParseJson(normalized);
      if (parsed.ok) {
        consume(parsed.value, depth + 1);
        return;
      }

      const unescaped = normalized
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
        .trim();
      if (unescaped && unescaped !== normalized) {
        const reparsed = tryParseJson(unescaped);
        if (reparsed.ok) {
          consume(reparsed.value, depth + 1);
          return;
        }
        normalized = unescaped;
      }

      if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
      ) {
        const stripped = normalized.slice(1, -1).trim();
        if (stripped && stripped !== normalized) {
          consume(stripped, depth + 1);
          return;
        }
      }

      if (normalized.includes(",")) {
        normalized
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => consume(part, depth + 1));
        return;
      }

      pushTag(normalized);
      return;
    }

    if (typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const unitValue = record.unit ?? record.Unit;
      if (unitValue !== null && typeof unitValue !== "undefined") {
        consume(unitValue, depth + 1);
      }

      Object.entries(record).forEach(([key, item]) => {
        if (key === "unit" || key === "Unit") return;
        if (/^(source|seed|__)/i.test(key)) return;
        consume(item, depth + 1);
      });
      return;
    }

    pushTag(entry);
  };

  consume(value);
  return result;
};
const extractAdminProductUnit = (value: unknown): string | null => {
  const consume = (entry: unknown, depth = 0): string | null => {
    if (entry === null || typeof entry === "undefined" || depth > 4) return null;

    if (Array.isArray(entry)) {
      for (const item of entry) {
        const resolved = consume(item, depth + 1);
        if (resolved) return resolved;
      }
      return null;
    }

    if (typeof entry === "string") {
      const normalized = entry.trim();
      if (!normalized || isMalformedLiteral(normalized)) return null;

      const parsed = tryParseJson(normalized);
      if (parsed.ok) return consume(parsed.value, depth + 1);

      const unescaped = normalized
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
        .trim();
      if (unescaped && unescaped !== normalized) {
        const reparsed = tryParseJson(unescaped);
        if (reparsed.ok) return consume(reparsed.value, depth + 1);
      }

      return null;
    }

    if (typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const directUnit = record.unit ?? record.Unit;
      if (directUnit !== null && typeof directUnit !== "undefined") {
        const normalized = String(directUnit).trim();
        return normalized && !isMalformedLiteral(normalized) ? normalized : null;
      }
    }

    return null;
  };

  return consume(value);
};
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asOptionalString = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};
const toBooleanOrUndefined = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const normalizeSellerSubmissionStatus = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "submitted") return "submitted";
  if (normalized === "needs_revision") return "needs_revision";
  return "none";
};

const normalizeAdminSellerSubmissionFilter = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "submitted") return "submitted";
  if (normalized === "needs_revision") return "needs_revision";
  if (normalized === "review_queue") return "review_queue";
  return null;
};
const normalizeAdminInventoryFilter = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "selling") return "selling";
  if (normalized === "out_of_stock") return "out_of_stock";
  return null;
};
const normalizeAdminProductSort = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "price_asc") return "price_asc";
  if (normalized === "price_desc") return "price_desc";
  if (normalized === "date_updated") return "date_updated";
  return "date_added";
};
const normalizeAdminVariationCompareKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
const buildAdminVariationCombination = (
  selections: Array<{ value: string }>
) => selections.map((entry) => entry.value).filter(Boolean).join(" / ");
const buildAdminVariationCombinationKey = (
  selections: Array<{ attributeId: number; valueId: number | string | null; value: string }>
) =>
  selections
    .map((entry) => `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`)
    .join("|");
const buildAdminSqlInClause = (values: number[]) => values.map(() => "?").join(", ");

type AdminVariationAttributeRow = {
  id: number;
  name: string;
  displayName: string | null;
};

type AdminVariationValueRow = {
  id: number;
  attributeId: number;
  value: string;
};

const loadAdminVariationDomainSnapshot = async (
  attributeIds: number[],
  referencedValueIds: number[] = []
) => {
  if (!attributeIds.length) {
    return {
      attributeById: new Map<number, AdminVariationAttributeRow>(),
      valueById: new Map<number, AdminVariationValueRow>(),
      valuesByAttributeId: new Map<
        number,
        {
          byId: Map<number, AdminVariationValueRow>;
          byValue: Map<string, AdminVariationValueRow>;
        }
      >(),
    };
  }

  const inClause = buildAdminSqlInClause(attributeIds);
  const normalizedReferencedValueIds = Array.from(
    new Set(referencedValueIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
  );
  const valueWhereClauses = [`attribute_id IN (${inClause})`];
  const valueReplacements: number[] = [...attributeIds];
  if (normalizedReferencedValueIds.length > 0) {
    valueWhereClauses.push(`id IN (${buildAdminSqlInClause(normalizedReferencedValueIds)})`);
    valueReplacements.push(...normalizedReferencedValueIds);
  }
  const [attributeRows, valueRows] = await Promise.all([
    sequelize.query<AdminVariationAttributeRow>(
      `
        SELECT id, name, display_name AS displayName
        FROM attributes
        WHERE id IN (${inClause})
      `,
      {
        replacements: attributeIds,
        type: QueryTypes.SELECT,
      }
    ),
    sequelize.query<AdminVariationValueRow>(
      `
        SELECT id, attribute_id AS attributeId, value
        FROM attribute_values
        WHERE ${valueWhereClauses.join(" OR ")}
      `,
      {
        replacements: valueReplacements,
        type: QueryTypes.SELECT,
      }
    ),
  ]);

  const attributeById = new Map<number, AdminVariationAttributeRow>();
  attributeRows.forEach((row) => {
    attributeById.set(Number(row.id), {
      id: Number(row.id),
      name: String(row.name || "").trim(),
      displayName: asOptionalString(row.displayName),
    });
  });

  const valueById = new Map<number, AdminVariationValueRow>();
  const valuesByAttributeId = new Map<
    number,
    {
      byId: Map<number, AdminVariationValueRow>;
      byValue: Map<string, AdminVariationValueRow>;
    }
  >();

  valueRows.forEach((row) => {
    const normalizedRow: AdminVariationValueRow = {
      id: Number(row.id),
      attributeId: Number(row.attributeId),
      value: String(row.value || "").trim(),
    };
    valueById.set(normalizedRow.id, normalizedRow);
    const current =
      valuesByAttributeId.get(normalizedRow.attributeId) || {
        byId: new Map<number, AdminVariationValueRow>(),
        byValue: new Map<string, AdminVariationValueRow>(),
      };
    current.byId.set(normalizedRow.id, normalizedRow);
    current.byValue.set(normalizeAdminVariationCompareKey(normalizedRow.value), normalizedRow);
    valuesByAttributeId.set(normalizedRow.attributeId, current);
  });

  return {
    attributeById,
    valueById,
    valuesByAttributeId,
  };
};

const resolveAdminVariationAttributeName = (row: AdminVariationAttributeRow) =>
  String(row.displayName || row.name || "").trim();

const resolveAdminVariationValueRow = (input: {
  attributeId: number;
  attributeName: string;
  candidateId: unknown;
  candidateValue: unknown;
  valueById: Map<number, AdminVariationValueRow>;
  valuesByAttributeId: Map<
    number,
    {
      byId: Map<number, AdminVariationValueRow>;
      byValue: Map<string, AdminVariationValueRow>;
    }
  >;
  path: string;
}) => {
  const candidateId = parseOptionalPositiveId(input.candidateId);
  const candidateValue = asOptionalString(input.candidateValue);
  const attributeValues = input.valuesByAttributeId.get(input.attributeId);

  if (candidateId) {
    const match = input.valueById.get(candidateId);
    if (!match) {
      throw createCategoryContractError(
        `${input.path} references unknown value id ${candidateId}.`
      );
    }
    if (Number(match.attributeId) !== Number(input.attributeId)) {
      throw createCategoryContractError(
        `${input.path} value id ${candidateId} does not belong to attribute ${input.attributeName}.`
      );
    }
    if (
      candidateValue &&
      normalizeAdminVariationCompareKey(candidateValue) !==
        normalizeAdminVariationCompareKey(match.value)
    ) {
      throw createCategoryContractError(
        `${input.path} value "${candidateValue}" does not match value id ${candidateId}.`
      );
    }
    return match;
  }

  if (!candidateValue) {
    throw createCategoryContractError(
      `${input.path} requires a valid value id or value label.`
    );
  }

  const match = attributeValues?.byValue.get(
    normalizeAdminVariationCompareKey(candidateValue)
  );
  if (!match) {
    throw createCategoryContractError(
      `${input.path} value "${candidateValue}" does not belong to attribute ${input.attributeName}.`
    );
  }
  return match;
};

const sanitizeAdminProductVariations = async (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createCategoryContractError("variations must be an object.");
  }

  const raw = value as Record<string, any>;
  const hasVariants = Boolean(raw.hasVariants);
  if (!hasVariants) return null;

  const selectedAttributesInput = Array.isArray(raw.selectedAttributes) ? raw.selectedAttributes : [];
  if (selectedAttributesInput.length === 0) {
    throw createCategoryContractError(
      "variations.selectedAttributes must contain at least one attribute when hasVariants is true."
    );
  }

  const requestedAttributeIds: number[] = [];
  const seenSelectedAttributeIds = new Set<number>();
  selectedAttributesInput.forEach((entry, index) => {
    const id = parseOptionalPositiveId(entry?.id);
    if (!id) {
      throw createCategoryContractError(
        `variations.selectedAttributes[${index}] has an invalid attribute id.`
      );
    }
    if (seenSelectedAttributeIds.has(id)) {
      throw createCategoryContractError(
        `variations.selectedAttributes contains duplicate attribute id ${id}.`
      );
    }
    seenSelectedAttributeIds.add(id);
    requestedAttributeIds.push(id);
  });

  const referencedValueIds = Array.from(
    new Set(
      [
        ...(Array.isArray(raw.selectedAttributeValues) ? raw.selectedAttributeValues : []).flatMap(
          (entry: any) =>
            (Array.isArray(entry?.values) ? entry.values : [])
              .map((item: any) => parseOptionalPositiveId(item?.id))
              .filter((item: number | null): item is number => item !== null)
        ),
        ...(Array.isArray(raw.variants) ? raw.variants : []).flatMap((entry: any) =>
          (Array.isArray(entry?.selections) ? entry.selections : [])
            .map((selection: any) => parseOptionalPositiveId(selection?.valueId))
            .filter((item: number | null): item is number => item !== null)
        ),
      ].map((id) => Number(id))
    )
  );

  const { attributeById, valueById, valuesByAttributeId } =
    await loadAdminVariationDomainSnapshot(requestedAttributeIds, referencedValueIds);

  const missingAttributeIds = requestedAttributeIds.filter((id) => !attributeById.has(id));
  if (missingAttributeIds.length > 0) {
    throw createCategoryContractError(
      `variations.selectedAttributes references unknown attribute ids: ${missingAttributeIds.join(", ")}.`
    );
  }

  const selectedAttributes = requestedAttributeIds.map((id) => {
    const attribute = attributeById.get(id)!;
    return {
      id,
      name: resolveAdminVariationAttributeName(attribute),
    };
  });
  const selectedAttributeIds = new Set(selectedAttributes.map((entry) => entry.id));
  const selectedAttributeOrder = new Map(selectedAttributes.map((entry, index) => [entry.id, index]));

  const selectedAttributeValuesInput = Array.isArray(raw.selectedAttributeValues)
    ? raw.selectedAttributeValues
    : [];
  if (selectedAttributeValuesInput.length === 0) {
    throw createCategoryContractError(
      "variations.selectedAttributeValues must contain at least one entry when hasVariants is true."
    );
  }

  const selectedAttributeValuesByAttributeId = new Map<
    number,
    {
      attributeId: number;
      values: Array<{ id: number; label: string; value: string }>;
    }
  >();

  selectedAttributeValuesInput.forEach((entry, index) => {
    const attributeId = parseOptionalPositiveId(entry?.attributeId);
    if (!attributeId || !selectedAttributeIds.has(attributeId)) {
      throw createCategoryContractError(
        `variations.selectedAttributeValues[${index}] references an invalid selected attribute.`
      );
    }
    if (selectedAttributeValuesByAttributeId.has(attributeId)) {
      throw createCategoryContractError(
        `variations.selectedAttributeValues contains duplicate entries for attribute id ${attributeId}.`
      );
    }

    const attributeName = selectedAttributes.find((item) => item.id === attributeId)?.name || `#${attributeId}`;
    const rawValues = Array.isArray(entry?.values) ? entry.values : [];
    if (rawValues.length === 0) {
      throw createCategoryContractError(
        `variations.selectedAttributeValues[${index}] must include at least one value.`
      );
    }

    const seenValueIds = new Set<number>();
    const values = rawValues.map((item: any, valueIndex: number) => {
      const resolved = resolveAdminVariationValueRow({
        attributeId,
        attributeName,
        candidateId: item?.id,
        candidateValue: item?.value ?? item?.label,
        valueById,
        valuesByAttributeId,
        path: `variations.selectedAttributeValues[${index}].values[${valueIndex}]`,
      });
      if (seenValueIds.has(resolved.id)) {
        throw createCategoryContractError(
          `variations.selectedAttributeValues[${index}] contains duplicate value "${resolved.value}".`
        );
      }
      seenValueIds.add(resolved.id);
      return {
        id: resolved.id,
        label: resolved.value,
        value: resolved.value,
      };
    });

    selectedAttributeValuesByAttributeId.set(attributeId, {
      attributeId,
      values,
    });
  });

  const missingSelectedValueAttributes = selectedAttributes
    .map((entry) => entry.id)
    .filter((attributeId) => !selectedAttributeValuesByAttributeId.has(attributeId));
  if (missingSelectedValueAttributes.length > 0) {
    throw createCategoryContractError(
      `variations.selectedAttributeValues must include values for every selected attribute. Missing: ${missingSelectedValueAttributes.join(", ")}.`
    );
  }

  const selectedAttributeValues = selectedAttributes.map((attribute) =>
    selectedAttributeValuesByAttributeId.get(attribute.id)!
  );
  const selectedValueIdsByAttributeId = new Map(
    selectedAttributeValues.map((entry) => [
      entry.attributeId,
      new Set(entry.values.map((value) => Number(value.id))),
    ])
  );

  const seenVariantKeys = new Set<string>();
  const variantsInput = Array.isArray(raw.variants) ? raw.variants : [];
  if (variantsInput.length === 0) {
    throw createCategoryContractError(
      "variations.variants must contain at least one variant when hasVariants is true."
    );
  }

  const variants = variantsInput
    .map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw createCategoryContractError(`variations.variants[${index}] must be an object.`);
      }

      const providedCombination = asOptionalString(entry.combination);
      const providedCombinationKey = asOptionalString(entry.combinationKey);
      if (!providedCombination || !providedCombinationKey) {
        throw createCategoryContractError(
          `variations.variants[${index}] requires combination and combinationKey.`
        );
      }

      const rawSelections = Array.isArray(entry.selections) ? entry.selections : [];
      if (rawSelections.length === 0) {
        throw createCategoryContractError(
          `variations.variants[${index}].selections must contain one value per selected attribute.`
        );
      }

      const selectionByAttributeId = new Map<
        number,
        {
          attributeId: number;
          attributeName: string;
          valueId: number;
          value: string;
        }
      >();

      rawSelections
        .map((selection: any, selectionIndex: number) => {
          const attributeId = parseOptionalPositiveId(selection?.attributeId);
          if (!attributeId || !selectedAttributeIds.has(attributeId)) {
            throw createCategoryContractError(
              `variations.variants[${index}].selections[${selectionIndex}] references an invalid selected attribute.`
            );
          }
          if (selectionByAttributeId.has(attributeId)) {
            throw createCategoryContractError(
              `variations.variants[${index}] contains duplicate selections for attribute id ${attributeId}.`
            );
          }

          const attributeName =
            selectedAttributes.find((item) => item.id === attributeId)?.name || `#${attributeId}`;
          const resolvedValue = resolveAdminVariationValueRow({
            attributeId,
            attributeName,
            candidateId: selection?.valueId,
            candidateValue: selection?.value,
            valueById,
            valuesByAttributeId,
            path: `variations.variants[${index}].selections[${selectionIndex}]`,
          });

          if (!selectedValueIdsByAttributeId.get(attributeId)?.has(resolvedValue.id)) {
            throw createCategoryContractError(
              `variations.variants[${index}].selections[${selectionIndex}] uses value "${resolvedValue.value}" outside the selected values for attribute ${attributeName}.`
            );
          }

          selectionByAttributeId.set(attributeId, {
            attributeId,
            attributeName,
            valueId: resolvedValue.id,
            value: resolvedValue.value,
          });
        })
        .filter(Boolean);

      if (selectionByAttributeId.size !== selectedAttributes.length) {
        throw createCategoryContractError(
          `variations.variants[${index}].selections must include exactly one value for each selected attribute.`
        );
      }

      const selections = selectedAttributes
        .slice()
        .sort(
          (left, right) =>
            (selectedAttributeOrder.get(left.id) ?? 0) - (selectedAttributeOrder.get(right.id) ?? 0)
        )
        .map((attribute) => {
          const selection = selectionByAttributeId.get(attribute.id);
          if (!selection) {
            throw createCategoryContractError(
              `variations.variants[${index}].selections is missing attribute ${attribute.name}.`
            );
          }
          return selection;
        });

      const combination = buildAdminVariationCombination(selections);
      const combinationKey = buildAdminVariationCombinationKey(selections);
      if (providedCombination !== combination) {
        throw createCategoryContractError(
          `variations.variants[${index}].combination does not match the selected attribute values.`
        );
      }
      if (providedCombinationKey !== combinationKey) {
        throw createCategoryContractError(
          `variations.variants[${index}].combinationKey does not match the selected attribute values.`
        );
      }
      if (seenVariantKeys.has(combinationKey)) {
        throw createCategoryContractError(
          `Duplicate variation combination "${combination}" is not allowed.`
        );
      }
      seenVariantKeys.add(combinationKey);

      const price =
        entry.price === null || typeof entry.price === "undefined" || entry.price === ""
          ? null
          : toNumber(entry.price, Number.NaN);
      if (price !== null && !Number.isFinite(price)) {
        throw createCategoryContractError(`variations.variants[${index}].price must be a valid number.`);
      }

      const salePrice =
        entry.salePrice === null || typeof entry.salePrice === "undefined" || entry.salePrice === ""
          ? null
          : toNumber(entry.salePrice, Number.NaN);
      if (salePrice !== null && !Number.isFinite(salePrice)) {
        throw createCategoryContractError(
          `variations.variants[${index}].salePrice must be a valid number.`
        );
      }
      if (price !== null && salePrice !== null && salePrice > price) {
        throw createCategoryContractError(
          `variations.variants[${index}].salePrice cannot be greater than price.`
        );
      }

      const quantity =
        entry.quantity === null || typeof entry.quantity === "undefined" || entry.quantity === ""
          ? null
          : Math.round(toNumber(entry.quantity, Number.NaN));
      if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
        throw createCategoryContractError(
          `variations.variants[${index}].quantity must be a valid non-negative integer.`
        );
      }

      return {
        id: asOptionalString(entry.id) ?? `variant-${index + 1}`,
        combination,
        combinationKey,
        selections,
        sku: asOptionalString(entry.sku),
        barcode: asOptionalString(entry.barcode),
        price,
        salePrice,
        quantity,
        image: normalizeUploadsUrl(entry.image),
      };
    })
    .filter(Boolean);

  return {
    hasVariants: true,
    selectedAttributes,
    selectedAttributeValues,
    variants,
  };
};
const csvEscape = (value: unknown) => {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvRow = (values: unknown[]) => values.map((value) => csvEscape(value)).join(",");

const resolveReferencedProductIds = async (productIds: number[]) => {
  if (!productIds.length) return [];

  const [orderRefs, suborderRefs, reviewRefs] = await Promise.all([
    OrderItem.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
    SuborderItem.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
    ProductReview.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
  ]);

  return Array.from(
    new Set(
      [...orderRefs, ...suborderRefs, ...reviewRefs]
        .map((entry: any) => Number(entry?.productId))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
};

const deleteProductsSafely = async (productIds: number[]) => {
  const uniqueIds = Array.from(new Set(productIds.filter((value) => Number.isInteger(value) && value > 0)));
  if (!uniqueIds.length) {
    return {
      affected: 0,
      blockedIds: [],
    };
  }

  const blockedIds = await resolveReferencedProductIds(uniqueIds);
  const deletableIds = uniqueIds.filter((id) => !blockedIds.includes(id));

  if (!deletableIds.length) {
    return {
      affected: 0,
      blockedIds,
    };
  }

  const affected = await sequelize.transaction(async (transaction) => {
    await ProductCategory.destroy({
      where: { productId: { [Op.in]: deletableIds } } as any,
      transaction,
    });
    await CartItem.destroy({
      where: { productId: { [Op.in]: deletableIds } } as any,
      transaction,
    });
    return Product.destroy({
      where: { id: { [Op.in]: deletableIds } } as any,
      transaction,
    });
  });

  return {
    affected,
    blockedIds,
  };
};

const isSuperAdminRequest = (req: Request) => {
  const normalized = String((req as any).user?.role || "")
    .trim()
    .toLowerCase();
  return ["super_admin", "superadmin", "super-admin", "super admin"].includes(normalized);
};

const getPlainAttr = (entity: any, key: string) =>
  entity?.get ? entity.get(key) : entity?.[key];

const getProductSellerSubmissionStatus = (product: any) =>
  normalizeSellerSubmissionStatus(getPlainAttr(product, "sellerSubmissionStatus"));

const getProductLifecycleStatus = (product: any) =>
  String(getPlainAttr(product, "status") || "draft").trim().toLowerCase();

const buildClearedSellerSubmissionPatch = () => ({
  sellerSubmissionStatus: "none",
  sellerSubmittedAt: null,
  sellerSubmittedByUserId: null,
  sellerRevisionRequestedAt: null,
  sellerRevisionRequestedByUserId: null,
  sellerRevisionNote: null,
});

const archiveProductsSafely = async (productIds: number[]) => {
  const uniqueIds = Array.from(
    new Set(productIds.filter((value) => Number.isInteger(value) && value > 0))
  );
  if (!uniqueIds.length) {
    return {
      affected: 0,
      archivedIds: [],
    };
  }

  await sequelize.transaction(async (transaction) => {
    await Product.update(
      {
        isPublished: false,
        status: "inactive",
        ...buildClearedSellerSubmissionPatch(),
      } as any,
      {
        where: { id: { [Op.in]: uniqueIds } } as any,
        transaction,
      }
    );
  });

  return {
    affected: uniqueIds.length,
    archivedIds: uniqueIds,
  };
};

const resolveAdminPublishGate = (plain: any) => {
  const submissionStatus = normalizeSellerSubmissionStatus(plain?.sellerSubmissionStatus);
  const lifecycleStatus = String(plain?.status || "draft").trim().toLowerCase();

  if (submissionStatus === "submitted") {
    return {
      canUseListToggle: false,
      canPublishFromReview: true,
      requiresFinalReviewOutcome: true,
      willClearSubmissionState: true,
      nextLifecycleStatus: lifecycleStatus === "active" ? "active" : "active",
      reasonCode: "REVIEW_SUBMITTED",
      hint: "Open review preview to publish this seller submission as the final admin outcome.",
    };
  }

  if (submissionStatus === "needs_revision") {
    return {
      canUseListToggle: false,
      canPublishFromReview: false,
      requiresFinalReviewOutcome: false,
      willClearSubmissionState: false,
      nextLifecycleStatus: lifecycleStatus,
      reasonCode: "REVISION_PENDING",
      hint: "This product is waiting for seller revisions and cannot be published yet.",
    };
  }

  return {
    canUseListToggle: true,
    canPublishFromReview: true,
    requiresFinalReviewOutcome: false,
    willClearSubmissionState: false,
    nextLifecycleStatus: lifecycleStatus,
    reasonCode: null,
    hint: null,
  };
};

const assertAdminPublishAllowed = (
  product: any,
  options: {
    nextPublished: boolean;
    route: "toggle" | "update" | "bulk";
    nextStatus?: string | undefined;
  }
) => {
  if (!options.nextPublished) {
    return {
      patch: null,
      sellerSubmissionStatus: getProductSellerSubmissionStatus(product),
    };
  }

  const sellerSubmissionStatus = getProductSellerSubmissionStatus(product);
  if (sellerSubmissionStatus === "needs_revision") {
    const error = new Error(
      "Products in needs revision cannot be published until the seller resubmits for review."
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  if (options.route === "bulk" && sellerSubmissionStatus !== "none") {
    const error = new Error(
      "Bulk publish is disabled for seller review products. Open the review drawer and publish each reviewed product individually."
    ) as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  if (sellerSubmissionStatus === "submitted") {
    const effectiveStatus =
      typeof options.nextStatus === "string" && options.nextStatus.trim()
        ? options.nextStatus.trim().toLowerCase()
        : getProductLifecycleStatus(product) === "active"
          ? "active"
          : "active";

    if (effectiveStatus !== "active") {
      const error = new Error(
        "Submitted seller products must move to active before they can be published."
      ) as Error & { status?: number };
      error.status = 409;
      throw error;
    }

    return {
      patch: {
        status: "active",
        ...buildClearedSellerSubmissionPatch(),
      },
      sellerSubmissionStatus,
    };
  }

  return {
    patch: null,
    sellerSubmissionStatus,
  };
};

const serializeAdminSellerSubmission = (plain: any) => {
  const status = normalizeSellerSubmissionStatus(plain?.sellerSubmissionStatus);
  const publishGate = resolveAdminPublishGate(plain);
  return {
    status,
    label:
      status === "submitted"
        ? "Submitted for review"
        : status === "needs_revision"
          ? "Needs revision"
          : "Not submitted",
    hasSubmission: status !== "none",
    submittedAt: plain?.sellerSubmittedAt ?? null,
    submittedByUserId:
      typeof plain?.sellerSubmittedByUserId === "number"
        ? plain.sellerSubmittedByUserId
        : plain?.sellerSubmittedByUserId
          ? Number(plain.sellerSubmittedByUserId)
          : null,
    reviewState:
      status === "submitted"
        ? "PENDING_REVIEW"
        : status === "needs_revision"
          ? "NEEDS_REVISION"
          : "NOT_SUBMITTED",
    revisionRequestedAt: plain?.sellerRevisionRequestedAt ?? null,
    revisionRequestedByUserId:
      typeof plain?.sellerRevisionRequestedByUserId === "number"
        ? plain.sellerRevisionRequestedByUserId
        : plain?.sellerRevisionRequestedByUserId
          ? Number(plain.sellerRevisionRequestedByUserId)
          : null,
    revisionNote:
      plain?.sellerRevisionNote === null || typeof plain?.sellerRevisionNote === "undefined"
        ? null
        : String(plain.sellerRevisionNote).trim() || null,
    requiresSellerChanges: status === "needs_revision",
    publishGate,
  };
};
const normalizeImportedSalePrice = (salePrice: unknown, basePrice: number) => {
  if (salePrice === null) return null;
  if (typeof salePrice === "undefined" || salePrice === "") return undefined;
  const parsed = Number(salePrice);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= basePrice) {
    return null;
  }
  return parsed;
};
const buildProductsWhere = (
  query: Request["query"],
  options: { includeSellerSubmission?: boolean } = {}
) => {
  const includeSellerSubmission = options.includeSellerSubmission !== false;
  const q = String(asSingle(query.q) ?? "").trim();
  const categoryIdParam = String(asSingle(query.categoryId) ?? "").trim();
  const categoryIds = Array.from(
    new Set([
      ...normalizePositiveIdList(query.categoryIds),
      ...normalizePositiveIdList(query.categories),
      ...normalizePositiveIdList(categoryIdParam),
    ])
  );
  const sellerSubmissionFilter = includeSellerSubmission
    ? normalizeAdminSellerSubmissionFilter(asSingle(query.sellerSubmissionStatus))
    : null;
  const publishedFilter = toBooleanOrUndefined(asSingle(query.published));
  const inventoryStatusFilter = normalizeAdminInventoryFilter(
    asSingle(query.inventoryStatus) ?? asSingle(query.status)
  );
  const sort = normalizeAdminProductSort(asSingle(query.sort));
  const andConditions: any[] = [];

  if (q) {
    andConditions.push({
      [Op.or]: [
      { name: { [Op.like]: `%${q}%` } },
      { slug: { [Op.like]: `%${q}%` } },
      ],
    });
  }

  if (categoryIds.length > 0) {
    const idsCsv = categoryIds.join(",");
    andConditions.push({
      [Op.or]: [
        { categoryId: { [Op.in]: categoryIds } },
        { defaultCategoryId: { [Op.in]: categoryIds } },
        sequelize.literal(
          `EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = Product.id AND pc.category_id IN (${idsCsv}))`
        ),
      ],
    });
  }

  if (typeof publishedFilter === "boolean") {
    andConditions.push({ isPublished: publishedFilter });
  }

  if (inventoryStatusFilter === "selling") {
    andConditions.push({ stock: { [Op.gt]: 0 } });
  } else if (inventoryStatusFilter === "out_of_stock") {
    andConditions.push({ stock: { [Op.lte]: 0 } });
  }

  if (sellerSubmissionFilter === "submitted" || sellerSubmissionFilter === "needs_revision") {
    andConditions.push({ sellerSubmissionStatus: sellerSubmissionFilter });
  } else if (sellerSubmissionFilter === "review_queue") {
    andConditions.push({
      sellerSubmissionStatus: {
        [Op.in]: ["submitted", "needs_revision"],
      },
    });
  }

  const where = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

  return {
    where,
    q,
    categoryIdParam,
    categoryIds,
    sellerSubmissionFilter,
    publishedFilter,
    inventoryStatusFilter,
    sort,
  };
};

const toAdminCategorySummary = (category: any) => {
  if (!category) return null;
  const plain = category?.get ? category.get({ plain: true }) : category;
  return {
    id: plain?.id ?? null,
    name: plain?.name ?? null,
    code: plain?.code ?? null,
    parentId: plain?.parentId ?? plain?.parent_id ?? plain?.parent?.id ?? null,
  };
};

const resolveProductSelectedCategories = (plain: any) => {
  const selected = Array.isArray(plain?.categories) ? plain.categories : [];
  return selected.map(toAdminCategorySummary).filter(Boolean);
};

const resolveProductDefaultCategory = (plain: any) =>
  toAdminCategorySummary(plain?.defaultCategory ?? plain?.category);

const getAdminProductStoreId = (product: any) => {
  const direct =
    Number((product as any)?.storeId ?? product?.get?.("storeId") ?? 0) ||
    Number(
      (product as any)?.store?.id ??
        product?.get?.("store")?.id ??
        product?.dataValues?.store?.id ??
        0
    );
  return Number.isInteger(direct) && direct > 0 ? direct : 0;
};

const loadAdminStoreOperationalReadinessByIds = async (storeIds: number[]) => {
  const normalizedIds = Array.from(
    new Set(storeIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))
  );
  if (!normalizedIds.length) {
    return new Map<number, any>();
  }

  const stores = await Store.findAll({
    where: { id: { [Op.in]: normalizedIds } } as any,
    attributes: ["id", "status", "activeStorePaymentProfileId"],
    include: [
      {
        association: "paymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
      {
        association: "activePaymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
    ],
  });

  return new Map<number, any>(
    stores.map((store: any) => [
      Number(store?.id || 0),
      buildPublicStoreOperationalReadiness(store),
    ])
  );
};

const buildAdminProductIncludes = () => [
  {
    model: Store,
    as: "store",
    attributes: ["id", "slug", "status", "activeStorePaymentProfileId"],
    include: [
      {
        association: "paymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
      {
        association: "activePaymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
    ],
    required: false,
  },
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "code", "parentId"],
    required: false,
  },
  {
    model: Category,
    as: "defaultCategory",
    attributes: ["id", "name", "code", "parentId"],
    required: false,
  },
  {
    model: Category,
    as: "categories",
    attributes: ["id", "name", "code", "parentId"],
    through: { attributes: [] },
    required: false,
  },
];

const buildAdminProductsOrder = (sort: string) => {
  if (sort === "price_asc") return [["price", "ASC"]] as any;
  if (sort === "price_desc") return [["price", "DESC"]] as any;
  if (sort === "date_updated") return [["updatedAt", "DESC"]] as any;
  return [["createdAt", "DESC"]] as any;
};

const createCategoryContractError = (message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
};

const assertCategoryIdsExist = async (categoryIds: number[]) => {
  if (!categoryIds.length) return;
  const rows = await Category.findAll({
    where: { id: { [Op.in]: categoryIds } } as any,
    attributes: ["id"],
  });
  const existingIds = new Set(rows.map((row: any) => Number(row.id)));
  const missing = categoryIds.filter((id) => !existingIds.has(Number(id)));
  if (missing.length > 0) {
    throw createCategoryContractError(
      `Selected categories were not found: ${missing.join(", ")}`
    );
  }
};

const resolveCategorySelection = async (
  input: any,
  options: {
    mode: "create" | "update";
    existingCategoryIds?: number[];
    existingDefaultCategoryId?: number | null;
  }
) => {
  const hasCategoryIds = typeof input?.categoryIds !== "undefined";
  const hasCompatibilityCategoryId = typeof input?.categoryId !== "undefined";
  const hasDefaultCategoryId = typeof input?.defaultCategoryId !== "undefined";

  if (
    options.mode === "update" &&
    !hasCategoryIds &&
    !hasCompatibilityCategoryId &&
    !hasDefaultCategoryId
  ) {
    return null;
  }

  const normalizedCategoryIds = normalizeCategoryIdsInput(input?.categoryIds);
  const compatibilityCategoryId = parseOptionalPositiveId(input?.categoryId);
  const providedDefaultCategoryId = hasDefaultCategoryId
    ? parseOptionalPositiveId(input?.defaultCategoryId)
    : undefined;

  let categoryIds: number[];
  if (hasCategoryIds) {
    categoryIds = normalizedCategoryIds || [];
  } else if (hasCompatibilityCategoryId) {
    categoryIds = compatibilityCategoryId ? [compatibilityCategoryId] : [];
  } else {
    categoryIds = Array.isArray(options.existingCategoryIds) ? [...options.existingCategoryIds] : [];
  }

  let defaultCategoryId: number | null;
  if (hasDefaultCategoryId) {
    defaultCategoryId = providedDefaultCategoryId ?? null;
  } else if (hasCompatibilityCategoryId) {
    defaultCategoryId = compatibilityCategoryId;
  } else {
    defaultCategoryId = options.existingDefaultCategoryId ?? null;
  }

  if (defaultCategoryId !== null && categoryIds.length === 0) {
    throw createCategoryContractError(
      "defaultCategoryId requires at least one selected category in categoryIds."
    );
  }

  if (categoryIds.length > 0 && defaultCategoryId === null) {
    throw createCategoryContractError(
      "defaultCategoryId is required when categoryIds are provided."
    );
  }

  if (defaultCategoryId !== null && !categoryIds.includes(defaultCategoryId)) {
    throw createCategoryContractError("defaultCategoryId must belong to categoryIds.");
  }

  await assertCategoryIdsExist(categoryIds);

  return {
    categoryIds,
    defaultCategoryId,
    categoryId: defaultCategoryId,
  };
};

const syncProductCategoryAssignments = async (
  productId: number,
  categoryIds: number[],
  transaction?: any
) => {
  const existingRows = await ProductCategory.findAll({
    where: { productId } as any,
    attributes: ["categoryId"],
    transaction,
  });
  const existingIds = existingRows
    .map((row: any) => Number(row.categoryId))
    .filter((id) => id > 0);
  const nextIds = Array.from(
    new Set(categoryIds.map((id) => Number(id)).filter((id) => id > 0))
  );
  const idsToDelete = existingIds.filter((id) => !nextIds.includes(id));
  const idsToCreate = nextIds.filter((id) => !existingIds.includes(id));

  if (idsToDelete.length > 0) {
    await ProductCategory.destroy({
      where: { productId, categoryId: { [Op.in]: idsToDelete } } as any,
      transaction,
    });
  }

  if (idsToCreate.length > 0) {
    await ProductCategory.bulkCreate(
      idsToCreate.map((categoryId) => ({ productId, categoryId })) as any,
      { ignoreDuplicates: true, transaction }
    );
  }
};

const resolveAdminPriceFields = (plain: any) => {
  const basePrice = toNumber(plain?.price, 0);
  const salePriceRaw = plain?.salePrice;
  const normalizedSalePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const hasDiscount =
    normalizedSalePrice !== null &&
    normalizedSalePrice > 0 &&
    normalizedSalePrice < basePrice;

  return {
    // Admin CRUD keeps `price` as the source-of-truth base price.
    price: basePrice,
    salePrice: hasDiscount ? normalizedSalePrice : null,
    originalPrice: hasDiscount ? basePrice : null,
    discountPercent:
      hasDiscount && basePrice > 0
        ? Math.round(((basePrice - Number(normalizedSalePrice)) / basePrice) * 100)
        : 0,
  };
};

const toAdminProductListItem = (product: any, storeOperationalReadiness: any = null) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const imagePaths = normalizeImagePathList(plain?.imagePaths);
  const imageUrl = normalizeUploadsUrl(plain?.promoImagePath) || imagePaths[0] || null;
  const priceFields = resolveAdminPriceFields(plain);
  const published =
    typeof plain?.published !== "undefined"
      ? Boolean(plain.published)
      : Boolean(plain?.isPublished);
  const visibility = buildProductVisibilitySnapshot({
    isPublished: published,
    status: plain?.status,
    submissionStatus: plain?.sellerSubmissionStatus,
    storeOperationalReadiness,
    storeStatus: plain?.store?.status,
    storeId: plain?.storeId,
  });

  const ratingAvgRaw = toNumber(plain?.ratingAvg ?? plain?.rating_avg, 0);
  const ratingAvg = Number(ratingAvgRaw.toFixed(1));
  const reviewCount = Math.max(0, Math.round(toNumber(plain?.reviewCount ?? plain?.review_count, 0)));
  const unit = extractAdminProductUnit(plain?.tags);

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    categoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    defaultCategoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    category: resolveProductDefaultCategory(plain),
    defaultCategory: resolveProductDefaultCategory(plain),
    categoryIds: resolveProductSelectedCategories(plain).map((category: any) => Number(category.id)),
    categories: resolveProductSelectedCategories(plain),
    imageUrl,
    promoImagePath: imageUrl,
    price: priceFields.price,
    originalPrice: priceFields.originalPrice,
    salePrice: priceFields.salePrice,
    discountPercent: priceFields.discountPercent,
    ratingAvg,
    reviewCount,
    unit,
    stock: plain?.stock ?? 0,
    status: plain?.status ?? "draft",
    sellerSubmission: serializeAdminSellerSubmission(plain),
    published,
    visibility,
    storefrontVisibilityState: visibility.stateCode,
    createdAt: plain?.createdAt ?? null,
    updatedAt: plain?.updatedAt ?? null,
  };
};

const toAdminProductDetail = (product: any, storeOperationalReadiness: any = null) => {
  const plain = product?.get ? product.get({ plain: true }) : product;
  const imagePaths = normalizeImagePathList(plain?.imagePaths);
  const imageUrl = normalizeUploadsUrl(plain?.promoImagePath) || imagePaths[0] || null;
  const priceFields = resolveAdminPriceFields(plain);
  const tags = normalizeAdminProductTags(plain?.tags);
  const seo = normalizeAdminProductSeoResponse(plain?.seo);
  const variations = normalizeAdminJsonValue(plain?.variations);
  const published =
    typeof plain?.published !== "undefined"
      ? Boolean(plain.published)
      : Boolean(plain?.isPublished);
  const visibility = buildProductVisibilitySnapshot({
    isPublished: published,
    status: plain?.status,
    submissionStatus: plain?.sellerSubmissionStatus,
    storeOperationalReadiness,
    storeStatus: plain?.store?.status,
    storeId: plain?.storeId,
  });

  return {
    id: plain?.id,
    name: plain?.name,
    slug: plain?.slug,
    sku: plain?.sku ?? null,
    barcode: plain?.barcode ?? null,
    description: plain?.description ?? "",
    price: priceFields.price,
    salePrice: priceFields.salePrice,
    stock: plain?.stock ?? 0,
    status: plain?.status ?? "draft",
    sellerSubmission: serializeAdminSellerSubmission(plain),
    published,
    visibility,
    storefrontVisibilityState: visibility.stateCode,
    categoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    defaultCategoryId: plain?.defaultCategoryId ?? plain?.categoryId ?? null,
    category: resolveProductDefaultCategory(plain),
    defaultCategory: resolveProductDefaultCategory(plain),
    categoryIds: resolveProductSelectedCategories(plain).map((category: any) => Number(category.id)),
    categories: resolveProductSelectedCategories(plain),
    imageUrl,
    promoImagePath: imageUrl,
    imagePaths:
      imageUrl && !imagePaths.includes(imageUrl) ? [imageUrl, ...imagePaths] : imagePaths,
    tags,
    seo,
    variations,
    createdAt: plain?.createdAt ?? null,
    updatedAt: plain?.updatedAt ?? null,
  };
};

const toAdminProductExportItem = (product: any) => {
  const detail = toAdminProductDetail(product);
  return {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    sku: detail.sku,
    barcode: detail.barcode,
    description: detail.description,
    price: detail.price,
    salePrice: detail.salePrice,
    stock: detail.stock,
    status: detail.status,
    sellerSubmission: detail.sellerSubmission,
    published: detail.published,
    categoryId: detail.categoryId,
    defaultCategoryId: detail.defaultCategoryId,
    categoryIds: detail.categoryIds,
    categoryCode: detail.category?.code ?? null,
    categoryName: detail.category?.name ?? null,
    defaultCategoryCode: detail.defaultCategory?.code ?? null,
    defaultCategoryName: detail.defaultCategory?.name ?? null,
    categoryCodes: detail.categories.map((category: any) => category?.code).filter(Boolean),
    categoryNames: detail.categories.map((category: any) => category?.name).filter(Boolean),
    category: detail.category,
    defaultCategory: detail.defaultCategory,
    categories: detail.categories,
    imageUrl: detail.imageUrl,
    imagePaths: detail.imagePaths,
    tags: detail.tags,
    seo: detail.seo,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
};

const buildAdminProductsCsv = (rows: any[]) => {
  const header = csvRow([
    "id",
    "name",
    "slug",
    "category",
    "categories",
    "price",
    "sale_price",
    "stock",
    "inventory_status",
    "published",
    "lifecycle_status",
    "seller_submission_status",
    "created_at",
    "updated_at",
  ]);

  const lines = rows.map((row) => {
    const item = toAdminProductExportItem(row);
    const stock = Number(item.stock || 0);
    return csvRow([
      item.id,
      item.name,
      item.slug,
      item.category?.name ?? item.defaultCategory?.name ?? "",
      item.categories.map((category: any) => category?.name).filter(Boolean).join(" | "),
      item.price ?? "",
      item.salePrice ?? "",
      stock,
      stock > 0 ? "selling" : "out_of_stock",
      item.published ? "published" : "unpublished",
      item.status ?? "",
      item.sellerSubmission?.status ?? "none",
      item.createdAt ? new Date(item.createdAt).toISOString() : "",
      item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
    ]);
  });

  return [header, ...lines].join("\n");
};

const buildUniqueProductSlug = async (baseValue: string) => {
  const normalizedBase = slugify(baseValue) || `product-copy-${Date.now()}`;
  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    const existingCount = await Product.count({ where: { slug: candidate } as any });
    if (existingCount === 0) return candidate;
    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }
};

const resolveImportCategoryId = async (input: {
  categoryId?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}) => {
  if (input.categoryId) {
    const category = await Category.findByPk(input.categoryId);
    if (!category) {
      throw new Error(`Category id ${input.categoryId} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryCode) {
    const category = await Category.findOne({ where: { code: input.categoryCode } as any });
    if (!category) {
      throw new Error(`Category code ${input.categoryCode} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryName) {
    const category = await Category.findOne({ where: { name: input.categoryName } as any });
    if (!category) {
      throw new Error(`Category name ${input.categoryName} was not found.`);
    }
    return Number((category as any).id);
  }

  return undefined;
};

const normalizeImportCategoryReference = (value: any) => {
  if (value === null || typeof value === "undefined" || value === "") return null;

  if (typeof value === "number" || typeof value === "string") {
    const numericId = parseOptionalPositiveId(value);
    if (numericId) {
      return { categoryId: numericId, categoryCode: null, categoryName: null };
    }

    const textValue = asOptionalString(value);
    if (textValue) {
      return { categoryId: null, categoryCode: textValue, categoryName: null };
    }

    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      categoryId: parseOptionalPositiveId(value.categoryId ?? value.id),
      categoryCode: asOptionalString(value.categoryCode ?? value.code),
      categoryName: asOptionalString(value.categoryName ?? value.name),
    };
  }

  return null;
};

const resolveImportCategorySelection = async (
  row: any,
  options: {
    mode: "create" | "update";
    existingCategoryIds?: number[];
    existingDefaultCategoryId?: number | null;
  }
) => {
  const categoryRefs = [
    ...(Array.isArray(row.categoryIds) ? row.categoryIds.map((value: any) => ({ categoryId: value })) : []),
    ...(Array.isArray(row.categories)
      ? row.categories.map((value: any) => normalizeImportCategoryReference(value)).filter(Boolean)
      : []),
    ...(Array.isArray(row.categoryCodes)
      ? row.categoryCodes
          .map((value: any) => ({ categoryCode: asOptionalString(value) }))
          .filter((value: any) => value.categoryCode)
      : []),
    ...(Array.isArray(row.categoryNames)
      ? row.categoryNames
          .map((value: any) => ({ categoryName: asOptionalString(value) }))
          .filter((value: any) => value.categoryName)
      : []),
  ];

  const legacyCategoryRef = normalizeImportCategoryReference({
    categoryId: row.categoryId,
    categoryCode: row.categoryCode,
    categoryName: row.categoryName,
  });
  if (legacyCategoryRef) {
    categoryRefs.push(legacyCategoryRef);
  }

  const hasCategorySelectionInput =
    categoryRefs.length > 0 ||
    typeof row.defaultCategoryId !== "undefined" ||
    typeof row.defaultCategory !== "undefined" ||
    typeof row.defaultCategoryCode !== "undefined" ||
    typeof row.defaultCategoryName !== "undefined";

  if (options.mode === "update" && !hasCategorySelectionInput) {
    return null;
  }

  const resolvedCategoryIds = Array.from(
    new Set(
      (
        await Promise.all(
          categoryRefs.map((reference) =>
            resolveImportCategoryId({
              categoryId: reference?.categoryId ?? null,
              categoryCode: reference?.categoryCode ?? null,
              categoryName: reference?.categoryName ?? null,
            })
          )
        )
      ).filter(
        (value): value is number =>
          typeof value === "number" && Number.isInteger(value) && value > 0
      )
    )
  );

  const defaultCategoryReference = normalizeImportCategoryReference(
    row.defaultCategory ?? {
      categoryId: row.defaultCategoryId,
      categoryCode: row.defaultCategoryCode,
      categoryName: row.defaultCategoryName,
    }
  );

  const resolvedDefaultCategoryId = defaultCategoryReference
    ? await resolveImportCategoryId({
        categoryId: defaultCategoryReference.categoryId ?? null,
        categoryCode: defaultCategoryReference.categoryCode ?? null,
        categoryName: defaultCategoryReference.categoryName ?? null,
      })
    : resolvedCategoryIds.length === 1
      ? resolvedCategoryIds[0]
      : undefined;

  return resolveCategorySelection(
    {
      categoryIds: resolvedCategoryIds,
      defaultCategoryId:
        typeof resolvedDefaultCategoryId !== "undefined" ? resolvedDefaultCategoryId : undefined,
      categoryId:
        resolvedCategoryIds.length === 1
          ? resolvedCategoryIds[0]
          : legacyCategoryRef?.categoryId ?? undefined,
    },
    options
  );
};

const normalizeImportProductRow = (raw: any) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Each product row must be an object.");
  }

  const category =
    raw.category && typeof raw.category === "object" && !Array.isArray(raw.category)
      ? raw.category
      : null;
  const defaultCategory =
    raw.defaultCategory && typeof raw.defaultCategory === "object" && !Array.isArray(raw.defaultCategory)
      ? raw.defaultCategory
      : null;
  const name = asOptionalString(raw.name);
  const slugSource = asOptionalString(raw.slug) || name;
  const slug = slugSource ? slugify(slugSource) : "";
  if (!slug) {
    throw new Error("Each product row requires a valid `slug` or `name`.");
  }

  const price =
    raw.price === null || typeof raw.price === "undefined" || raw.price === ""
      ? undefined
      : toNumber(raw.price, Number.NaN);
  if (typeof price !== "undefined" && !Number.isFinite(price)) {
    throw new Error("`price` must be a valid number.");
  }

  const stock =
    raw.stock === null || typeof raw.stock === "undefined" || raw.stock === ""
      ? undefined
      : Math.max(0, Math.round(toNumber(raw.stock, Number.NaN)));
  if (typeof stock !== "undefined" && !Number.isFinite(stock)) {
    throw new Error("`stock` must be a valid integer.");
  }

  const status = asOptionalString(raw.status);
  if (status && !["active", "inactive", "draft"].includes(status)) {
    throw new Error("`status` must be active, inactive, or draft.");
  }

  const categoryIdRaw =
    raw.categoryId ?? category?.id ?? null;
  const categoryId =
    categoryIdRaw === null || typeof categoryIdRaw === "undefined" || categoryIdRaw === ""
      ? undefined
      : toNumber(categoryIdRaw, Number.NaN);
  if (typeof categoryId !== "undefined" && !Number.isFinite(categoryId)) {
    throw new Error("`categoryId` must be a valid number.");
  }

  const imagePaths = Array.isArray(raw.imagePaths)
    ? raw.imagePaths.map((value: unknown) => asOptionalString(value)).filter(Boolean)
    : [];
  const imageUrl = asOptionalString(raw.imageUrl);

  const tagsRaw = raw.tags ?? [];
  const tags =
    typeof raw.tags === "undefined"
      ? undefined
      : Array.isArray(tagsRaw)
      ? tagsRaw.map((tag) => String(tag || "").trim()).filter(Boolean)
      : typeof tagsRaw === "string"
      ? tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
  const salePrice =
    raw.salePrice === undefined
      ? undefined
      : raw.salePrice === null || raw.salePrice === ""
      ? null
      : toNumber(raw.salePrice, Number.NaN);
  if (typeof salePrice !== "undefined" && salePrice !== null && !Number.isFinite(salePrice)) {
    throw new Error("`salePrice` must be a valid number.");
  }

  return {
    name,
    slug,
    sku: asOptionalString(raw.sku),
    barcode: asOptionalString(raw.barcode),
    description:
      typeof raw.description === "undefined" ? undefined : asOptionalString(raw.description) ?? "",
    price,
    salePrice,
    stock,
    status: status ?? undefined,
    published: toBooleanOrUndefined(raw.published),
    categoryId:
      typeof categoryId !== "undefined" ? Math.max(1, Math.round(categoryId)) : undefined,
    categoryIds: normalizeCategoryIdsInput(raw.categoryIds),
    categoryCode: asOptionalString(raw.categoryCode ?? category?.code),
    categoryName: asOptionalString(raw.categoryName ?? category?.name),
    categoryCodes: Array.isArray(raw.categoryCodes) ? raw.categoryCodes : undefined,
    categoryNames: Array.isArray(raw.categoryNames) ? raw.categoryNames : undefined,
    categories: Array.isArray(raw.categories) ? raw.categories : undefined,
    defaultCategoryId: parseOptionalPositiveId(raw.defaultCategoryId ?? defaultCategory?.id),
    defaultCategoryCode: asOptionalString(raw.defaultCategoryCode ?? defaultCategory?.code),
    defaultCategoryName: asOptionalString(raw.defaultCategoryName ?? defaultCategory?.name),
    defaultCategory,
    imageUrls: imagePaths.length ? imagePaths : imageUrl ? [imageUrl] : undefined,
    tags,
  };
};


const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  categoryId: z.coerce.number().int().nonnegative().optional(),
  categoryIds: z.array(z.coerce.number().int().positive()).optional(),
  defaultCategoryId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.union([z.coerce.number().int().positive(), z.null()])
  ).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  published: z.boolean().optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  slug: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().max(255).optional().nullable(),
  imageUrls: z.array(z.string().max(255)).optional(),
  seo: z.unknown().nullable().optional(),
  variations: z.unknown().nullable().optional(),
});

const updateSchema = createSchema.partial();
const updatePublishedSchema = z.object({
  published: z.boolean(),
});

const requestRevisionSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000, "Revision note must be 1000 characters or fewer.")
    .nullable()
    .optional(),
});
const bulkActionSchema = z.object({
  action: z.enum(["delete", "publish", "unpublish"]),
  ids: z.array(z.coerce.number().int().positive()).min(1),
});

// GET /api/admin/products?page=&limit=&q=&categoryId=
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(req.query.limit || req.query.pageSize || "10"), 10))
    );
    const { where, sellerSubmissionFilter, sort } = buildProductsWhere(req.query);
    const { where: reviewQueueWhere } = buildProductsWhere(req.query, {
      includeSellerSubmission: false,
    });

    const offset = (page - 1) * limit;

    const [reviewSubmittedCount, reviewNeedsRevisionCount, { rows, count }] = await Promise.all([
      Product.count({
        where: {
          ...reviewQueueWhere,
          sellerSubmissionStatus: "submitted",
        } as any,
        include: buildAdminProductIncludes(),
        distinct: true,
        col: "id",
      }),
      Product.count({
        where: {
          ...reviewQueueWhere,
          sellerSubmissionStatus: "needs_revision",
        } as any,
        include: buildAdminProductIncludes(),
        distinct: true,
        col: "id",
      }),
      Product.findAndCountAll({
        where,
        attributes: [
          "id",
          "name",
          "slug",
          "price",
          "salePrice",
          "stock",
          "status",
          "sellerSubmissionStatus",
          "sellerSubmittedAt",
          "sellerSubmittedByUserId",
          "sellerRevisionRequestedAt",
          "sellerRevisionRequestedByUserId",
          "sellerRevisionNote",
          "published",
          "categoryId",
          "defaultCategoryId",
          "promoImagePath",
          "imagePaths",
          "tags",
          "createdAt",
          "updatedAt",
          [
            sequelize.literal(
              "(SELECT ROUND(AVG(pr.rating), 1) FROM product_reviews pr WHERE pr.product_id = Product.id)"
            ),
            "ratingAvg",
          ],
          [
            sequelize.literal(
              "(SELECT COUNT(*) FROM product_reviews pr WHERE pr.product_id = Product.id)"
            ),
            "reviewCount",
          ],
        ],
        include: buildAdminProductIncludes(),
        distinct: true,
        limit,
        offset,
        order: buildAdminProductsOrder(sort),
      }),
    ]);
    const storeReadinessById = await loadAdminStoreOperationalReadinessByIds(
      rows.map((row: any) => getAdminProductStoreId(row))
    );

    res.json({
      data: rows.map((row: any) =>
        toAdminProductListItem(
          row,
          storeReadinessById.get(getAdminProductStoreId(row)) || null
        )
      ),
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
        reviewQueue: {
          submitted: Number(reviewSubmittedCount || 0),
          needsRevision: Number(reviewNeedsRevisionCount || 0),
          total: Number(reviewSubmittedCount || 0) + Number(reviewNeedsRevisionCount || 0),
          activeFilter: sellerSubmissionFilter || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format =
      String(asSingle(req.query.format) || "json").trim().toLowerCase() === "csv"
        ? "csv"
        : "json";
    const {
      where,
      q,
      categoryIdParam,
      categoryIds,
      sellerSubmissionFilter,
      publishedFilter,
      inventoryStatusFilter,
      sort,
    } = buildProductsWhere(req.query);
    const rows = await Product.findAll({
      where,
      attributes: [
        "id",
        "name",
        "slug",
        "sku",
        "barcode",
        "description",
        "price",
        "salePrice",
        "stock",
        "status",
        "sellerSubmissionStatus",
        "sellerSubmittedAt",
        "sellerSubmittedByUserId",
        "sellerRevisionRequestedAt",
        "sellerRevisionRequestedByUserId",
        "sellerRevisionNote",
        "published",
        "categoryId",
        "defaultCategoryId",
        "promoImagePath",
        "imagePaths",
        "tags",
        "createdAt",
        "updatedAt",
      ],
      include: buildAdminProductIncludes(),
      order: buildAdminProductsOrder(sort),
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "csv") {
      const csv = `\uFEFF${buildAdminProductsCsv(rows)}`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="products-export-${timestamp}.csv"`
      );
      return res.status(200).send(csv);
    }

    const payload = {
      format: "admin-products.v1",
      exportedAt: new Date().toISOString(),
      total: rows.length,
      filters: {
        q: q || null,
        categoryId: categoryIdParam || null,
        categoryIds,
        sellerSubmissionStatus: sellerSubmissionFilter || null,
        published: typeof publishedFilter === "boolean" ? publishedFilter : null,
        inventoryStatus: inventoryStatusFilter || null,
        sort,
      },
      items: rows.map(toAdminProductExportItem),
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="products-export-${timestamp}.json"`
    );
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/import",
  requireAdmin,
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buf = req.file?.buffer;
      if (!buf) {
        return res.status(400).json({ success: false, message: "No file uploaded." });
      }

      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(buf.toString("utf8"));
      } catch {
        return res.status(400).json({ success: false, message: "Invalid JSON file." });
      }

      const items = Array.isArray(parsedPayload)
        ? parsedPayload
        : Array.isArray(parsedPayload?.items)
        ? parsedPayload.items
        : null;
      if (!items) {
        return res.status(400).json({
          success: false,
          message: "Import file must be a JSON array or an object with an `items` array.",
        });
      }

      let created = 0;
      let updated = 0;
      let failed = 0;
      const errors: Array<{ row: number; slug: string | null; message: string }> = [];
      const actorUserId = Number((req as any).user?.id || 0) || null;

      for (let index = 0; index < items.length; index += 1) {
        const rawRow = items[index];

        try {
          const row = normalizeImportProductRow(rawRow);
          const existing = await Product.findOne({
            where: { slug: row.slug } as any,
            include: buildAdminProductIncludes(),
          });
          const basePrice =
            typeof row.price !== "undefined"
              ? row.price
              : Number(existing?.get?.("price") ?? 0);
          const normalizedSalePrice = normalizeImportedSalePrice(row.salePrice, basePrice);
          const existingCategoryIds = existing
            ? resolveProductSelectedCategories(existing).map((category: any) => Number(category.id))
            : [];
          const categorySelection = await resolveImportCategorySelection(row, {
            mode: existing ? "update" : "create",
            existingCategoryIds,
            existingDefaultCategoryId: existing
              ? parseOptionalPositiveId((existing as any).get?.("defaultCategoryId")) ??
                parseOptionalPositiveId((existing as any).get?.("categoryId"))
              : null,
          });

          if (existing) {
            const beforeSnapshot = existing.get?.({ plain: true }) ?? existing;
            const patch: any = {};
            if (row.name) patch.name = row.name;
            patch.slug = row.slug;
            if (typeof row.price !== "undefined") patch.price = row.price;
            if (typeof row.salePrice !== "undefined") patch.salePrice = normalizedSalePrice ?? null;
            if (typeof row.stock !== "undefined") patch.stock = row.stock;
            if (typeof row.status !== "undefined") patch.status = row.status;
            if (typeof row.published !== "undefined") patch.isPublished = row.published;
            if (categorySelection) {
              patch.categoryId = categorySelection.categoryId;
              patch.defaultCategoryId = categorySelection.defaultCategoryId;
            }
            if (typeof row.description !== "undefined") patch.description = row.description;
            if (typeof row.sku !== "undefined") patch.sku = row.sku || null;
            if (typeof row.barcode !== "undefined") patch.barcode = row.barcode || null;
            if (typeof row.imageUrls !== "undefined") {
              patch.imagePaths = row.imageUrls;
              patch.promoImagePath = row.imageUrls?.[0] || null;
            }
            if (typeof row.tags !== "undefined") patch.tags = row.tags;

            await sequelize.transaction(async (transaction) => {
              await existing.update(patch, { transaction });
              if (categorySelection) {
                await syncProductCategoryAssignments(
                  Number((existing as any).id),
                  categorySelection.categoryIds,
                  transaction
                );
              }
            });
            await logProductActivity({
              storeId: getAdminProductStoreId(existing),
              entityId: Number((existing as any)?.id || 0),
              action: PRODUCT_ACTIVITY_LOG_ACTIONS.IMPORTED,
              actorType: "admin",
              actorId: actorUserId,
              before: beforeSnapshot,
              after: existing,
              metadata: {
                source: "import",
                importFormat: "json",
                lane: "admin",
                importMode: "update",
              },
            });
            updated += 1;
            continue;
          }

          if (!row.name) {
            throw new Error("New products require `name`.");
          }
          if (typeof row.price === "undefined") {
            throw new Error("New products require `price`.");
          }

          const createdProduct = await sequelize.transaction(async (transaction) => {
            const createdProduct = await Product.create({
              name: row.name,
              slug: row.slug,
              description: row.description,
              price: row.price,
              salePrice: normalizedSalePrice ?? null,
              stock: row.stock ?? 0,
              categoryId: categorySelection?.categoryId ?? row.categoryId,
              defaultCategoryId: categorySelection?.defaultCategoryId ?? null,
              status: row.status || "active",
              userId: (req as any).user?.id ?? 0,
              isPublished: row.published ?? true,
              sku: row.sku ?? null,
              barcode: row.barcode ?? null,
              tags: row.tags ?? [],
              promoImagePath: row.imageUrls?.[0] || null,
              imagePaths: row.imageUrls ?? [],
            } as any, { transaction });

            if (categorySelection) {
              await syncProductCategoryAssignments(
                Number((createdProduct as any).id),
                categorySelection.categoryIds,
                transaction
              );
            }
            return Product.findByPk(Number((createdProduct as any).id), {
              include: buildAdminProductIncludes(),
              transaction,
            });
          });
          await logProductActivity({
            storeId: getAdminProductStoreId(createdProduct),
            entityId: Number((createdProduct as any)?.id || 0),
            action: PRODUCT_ACTIVITY_LOG_ACTIONS.IMPORTED,
            actorType: "admin",
            actorId: actorUserId,
            after: createdProduct,
            metadata: {
              source: "import",
              importFormat: "json",
              lane: "admin",
              importMode: "create",
            },
          });
          created += 1;
        } catch (error: any) {
          failed += 1;
          errors.push({
            row: index + 1,
            slug: asOptionalString(rawRow?.slug ?? rawRow?.name),
            message: error?.message || "Import row failed.",
          });
        }
      }

      return res.json({
        data: {
          totalRows: items.length,
          created,
          updated,
          failed,
          errors,
        },
      });
    } catch (err) {
      if ((err as any)?.status === 409) {
        return res.status(409).json({ message: (err as any).message });
      }
      next(err);
    }
  }
);

router.post(
  "/bulk",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action, ids } = bulkActionSchema.parse(req.body);
      const uniqueIds = Array.from(new Set(ids.map((value) => Number(value))));

      if (uniqueIds.length === 0) {
        return res.status(400).json({ success: false, message: "ids must not be empty" });
      }

      let affected = 0;

      if (action === "delete") {
        const actorIsSuperAdmin = isSuperAdminRequest(req);
        const deletion = await deleteProductsSafely(uniqueIds);
        affected = deletion.affected;

        if (deletion.blockedIds.length > 0) {
          if (actorIsSuperAdmin) {
            const archiveResult = await archiveProductsSafely(deletion.blockedIds);
            return res.json({
              success: true,
              affected,
              archived: archiveResult.affected,
              archivedIds: archiveResult.archivedIds,
              mode:
                archiveResult.affected > 0
                  ? affected > 0
                    ? "delete_and_archive"
                    : "archive_only"
                  : "delete",
            });
          }

          const blockedLabel =
            deletion.blockedIds.length === 1
              ? `Product #${deletion.blockedIds[0]} is`
              : `${deletion.blockedIds.length} selected products are`;
          const deletedLabel =
            deletion.affected > 0
              ? `${deletion.affected} product(s) deleted. `
              : "";
          const message = `${deletedLabel}${blockedLabel} already used in orders, reviews, or suborders and cannot be deleted.`;

          return res.status(409).json({
            success: false,
            message,
            affected,
            blockedIds: deletion.blockedIds,
          });
        }
      } else {
        const nextPublished = action === "publish";
        if (nextPublished) {
          const reviewBoundProducts = await Product.findAll({
            where: {
              id: { [Op.in]: uniqueIds },
              sellerSubmissionStatus: { [Op.in]: ["submitted", "needs_revision"] },
            } as any,
            attributes: ["id", "sellerSubmissionStatus"],
          });

          reviewBoundProducts.forEach((product) => {
            assertAdminPublishAllowed(product, {
              nextPublished,
              route: "bulk",
            });
          });
        }

        const [updatedCount] = await Product.update(
          { isPublished: nextPublished } as any,
          { where: { id: { [Op.in]: uniqueIds } } as any }
        );
        affected = Number(updatedCount || 0);
      }

      return res.json({ success: true, affected });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/:id/duplicate",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(req.params.id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });

      const product = await Product.findByPk(idNum, {
        include: buildAdminProductIncludes(),
      });
      if (!product) return res.status(404).json({ message: "Not found" });
      const beforeSnapshot = product.get?.({ plain: true }) ?? product;

      const plain = product.get ? product.get({ plain: true }) : product;
      const priceFields = resolveAdminPriceFields(plain);
      const sourceCategoryIds = resolveProductSelectedCategories(plain)
        .map((category: any) => Number(category?.id))
        .filter((value: number) => Number.isInteger(value) && value > 0);
      const defaultCategoryId =
        parseOptionalPositiveId(plain?.defaultCategoryId) ??
        parseOptionalPositiveId(plain?.categoryId);
      const nextCategoryIds =
        sourceCategoryIds.length > 0
          ? sourceCategoryIds
          : defaultCategoryId
            ? [defaultCategoryId]
            : [];
      const nextDefaultCategoryId =
        defaultCategoryId && nextCategoryIds.includes(defaultCategoryId)
          ? defaultCategoryId
          : nextCategoryIds[0] ?? null;
      const nextSlug = await buildUniqueProductSlug(
        `${String(plain?.slug || plain?.name || `product-${idNum}`).trim()}-copy`
      );
      const duplicateOwnerId = Number((req as any).user?.id || 0) || Number(plain?.userId || 0);
      const imagePaths = normalizeImagePathList(plain?.imagePaths);
      const promoImagePath =
        normalizeUploadsUrl(plain?.promoImagePath) || imagePaths[0] || null;

      const duplicated = await sequelize.transaction(async (transaction) => {
        const created = await Product.create(
          {
            name: `${String(plain?.name || `Product ${idNum}`).trim()} (Copy)`,
            slug: nextSlug,
            sku: null,
            barcode: null,
            price: priceFields.price,
            salePrice: priceFields.salePrice,
            stock: Number(plain?.stock || 0),
            userId: duplicateOwnerId,
            storeId: null,
            categoryId: nextDefaultCategoryId,
            defaultCategoryId: nextDefaultCategoryId,
            status: String(plain?.status || "draft").trim().toLowerCase() || "draft",
            isPublished: false,
            sellerSubmissionStatus: "none",
            sellerSubmittedAt: null,
            sellerSubmittedByUserId: null,
            sellerRevisionRequestedAt: null,
            sellerRevisionRequestedByUserId: null,
            sellerRevisionNote: null,
            description: plain?.description ?? null,
            promoImagePath,
            imagePaths,
            tags: plain?.tags ?? [],
            seo: plain?.seo ?? null,
            weight: plain?.weight ?? null,
            notes: plain?.notes ?? null,
            parentSku: plain?.parentSku ?? null,
            condition: plain?.condition ?? null,
            length: plain?.length ?? null,
            width: plain?.width ?? null,
            height: plain?.height ?? null,
            dangerousProduct: Boolean(plain?.dangerousProduct),
            preOrder: Boolean(plain?.preOrder),
            preorderDays: plain?.preorderDays ?? null,
            youtubeLink: plain?.youtubeLink ?? null,
            variations: plain?.variations ?? null,
            wholesale: plain?.wholesale ?? null,
          } as any,
          { transaction }
        );

        if (nextCategoryIds.length > 0) {
          await syncProductCategoryAssignments(
            Number((created as any).id),
            nextCategoryIds,
            transaction
          );
        }

        return Product.findByPk(Number((created as any).id), {
          include: buildAdminProductIncludes(),
          transaction,
        });
      });

      const storeReadinessById = await loadAdminStoreOperationalReadinessByIds([
        getAdminProductStoreId(duplicated),
      ]);
      await logProductActivity({
        storeId: getAdminProductStoreId(duplicated),
        entityId: Number((duplicated as any)?.id || 0),
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.DUPLICATED,
        actorType: "admin",
        actorId: Number((req as any).user?.id || 0) || null,
        before: beforeSnapshot,
        after: duplicated,
        metadata: {
          source: "duplicate",
          lane: "admin",
          sourceProductId: idNum,
          sourceProductName: String(plain?.name || "").trim() || null,
        },
      });
      return res.status(201).json({
        data: toAdminProductDetail(
          duplicated,
          storeReadinessById.get(getAdminProductStoreId(duplicated)) || null
        ),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/admin/products/:id
router.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(String(asSingle(req.params.id) ?? ""));
      if (!idNum) return res.status(400).json({ success: false, message: "Invalid id" });
      const p = await Product.findByPk(idNum, {
        include: buildAdminProductIncludes(),
      });
      if (!p) return res.status(404).json({ success: false, message: "Not found" });
      const storeReadinessById = await loadAdminStoreOperationalReadinessByIds([
        getAdminProductStoreId(p),
      ]);
      res.json({
        data: toAdminProductDetail(
          p,
          storeReadinessById.get(getAdminProductStoreId(p)) || null
        ),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createSchema.parse(req.body);
      const categorySelection = await resolveCategorySelection(body, { mode: "create" });
      const seo = sanitizeAdminProductSeo(body.seo);
      const variations = await sanitizeAdminProductVariations(body.variations);
      const name = body.name.trim();
      const slug = body.slug ? slugify(body.slug) : slugify(name);
      const imageUrls = body.imageUrls?.length
        ? body.imageUrls
        : body.imageUrl
        ? [body.imageUrl]
        : [];
      const created = await sequelize.transaction(async (transaction) => {
        const nextProduct = await Product.create(
          {
            name,
            slug,
            description: body.description,
            price: body.price,
            salePrice: body.salePrice ?? null,
            categoryId: categorySelection?.categoryId ?? body.categoryId,
            defaultCategoryId: categorySelection?.defaultCategoryId ?? null,
            stock: body.stock ?? 0,
            sku: body.sku ?? null,
            barcode: body.barcode ?? null,
            tags: body.tags ?? [],
            seo,
            promoImagePath: imageUrls[0] || null,
            imagePaths: imageUrls,
            variations,
            status: body.status || "active",
            userId: (req as any).user?.id ?? 0,
            isPublished: body.published ?? true,
          } as any,
          { transaction }
        );

        if (categorySelection) {
          await syncProductCategoryAssignments(
            Number((nextProduct as any).id),
            categorySelection.categoryIds,
            transaction
          );
        }

        return Product.findByPk(Number((nextProduct as any).id), {
          include: buildAdminProductIncludes(),
          transaction,
        });
      });
      const storeReadinessById = await loadAdminStoreOperationalReadinessByIds([
        getAdminProductStoreId(created),
      ]);
      await logProductActivity({
        storeId: getAdminProductStoreId(created),
        entityId: Number((created as any)?.id || 0),
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.CREATED,
        actorType: "admin",
        actorId: Number((req as any).user?.id || 0) || null,
        after: created,
        metadata: {
          source: "manual",
          lane: "admin",
        },
      });
      return res.status(201).json({
        data: toAdminProductDetail(
          created,
          storeReadinessById.get(getAdminProductStoreId(created)) || null
        ),
      });
    } catch (err) {
      if ((err as any)?.status === 400) {
        return res.status(400).json({ message: (err as any).message });
      }
      if ((err as any)?.status === 409) {
        return res.status(409).json({ message: (err as any).message });
      }
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.patch(
  "/:id",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });
      const body = updateSchema.parse(req.body);
      const variations =
        typeof body.variations !== "undefined"
          ? await sanitizeAdminProductVariations(body.variations)
          : undefined;

      const product = await Product.findByPk(idNum, {
        include: buildAdminProductIncludes(),
      });
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }
      const beforeSnapshot = product.get?.({ plain: true }) ?? product;
      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        (product as any).get?.("sellerSubmissionStatus") ?? (product as any).sellerSubmissionStatus
      );
      const seo =
        typeof body.seo !== "undefined"
          ? sanitizeAdminProductSeo(mergeAdminProductSeoInput((product as any).get?.("seo"), body.seo))
          : undefined;
      const existingCategoryIds = resolveProductSelectedCategories(product).map((category: any) =>
        Number(category.id)
      );
      const categorySelection = await resolveCategorySelection(body, {
        mode: "update",
        existingCategoryIds,
        existingDefaultCategoryId:
          parseOptionalPositiveId((product as any).get?.("defaultCategoryId")) ??
          parseOptionalPositiveId((product as any).get?.("categoryId")),
      });

      const patch: any = {};
      if (body.name) {
        patch.name = body.name;
      }
      if (body.name) patch.slug = slugify(body.name);
      if (body.price !== undefined) patch.price = body.price;
      if (body.salePrice !== undefined) patch.salePrice = body.salePrice;
      if (body.stock !== undefined) patch.stock = body.stock;
      if (categorySelection) {
        patch.categoryId = categorySelection.categoryId;
        patch.defaultCategoryId = categorySelection.defaultCategoryId;
      }
      if (body.description !== undefined) patch.description = body.description;
      if (body.sku !== undefined) patch.sku = body.sku || null;
      if (body.barcode !== undefined) patch.barcode = body.barcode || null;
      if (body.tags !== undefined) patch.tags = body.tags;
      if (typeof seo !== "undefined") patch.seo = seo;
      if (typeof variations !== "undefined") patch.variations = variations;
      if (body.imageUrls !== undefined) {
        patch.imagePaths = body.imageUrls;
        patch.promoImagePath = body.imageUrls?.[0] || null;
      } else if (body.imageUrl !== undefined) {
        patch.promoImagePath = body.imageUrl;
        patch.imagePaths = body.imageUrl ? [body.imageUrl] : [];
      }
      if (body.status !== undefined) patch.status = body.status;
      if (body.published !== undefined) {
        const publishGatePatch = assertAdminPublishAllowed(product, {
          nextPublished: body.published,
          route: "update",
          nextStatus: typeof body.status === "string" ? body.status : undefined,
        });
        patch.isPublished = body.published;
        if (publishGatePatch.patch) {
          Object.assign(patch, publishGatePatch.patch);
        }
      }
      if (body.slug !== undefined) {
        const normalizedSlug = String(body.slug || "").trim();
        if (normalizedSlug) patch.slug = slugify(normalizedSlug);
      }

      const updated = await sequelize.transaction(async (transaction) => {
        await product.update(patch, { transaction });
        if (categorySelection) {
          await syncProductCategoryAssignments(
            idNum,
            categorySelection.categoryIds,
            transaction
          );
        }
        return Product.findByPk(idNum, {
          include: buildAdminProductIncludes(),
          transaction,
        });
      });
      const storeReadinessById = await loadAdminStoreOperationalReadinessByIds([
        getAdminProductStoreId(updated),
      ]);
      const actorUserId = Number((req as any).user?.id || 0) || null;
      await logProductActivity({
        storeId: getAdminProductStoreId(updated),
        entityId: idNum,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.UPDATED,
        actorType: "admin",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: updated,
        metadata: {
          source: "manual",
          lane: "admin",
        },
      });
      if (body.published === true) {
        if (currentSubmissionStatus === "submitted") {
          await logProductActivity({
            storeId: getAdminProductStoreId(updated),
            entityId: idNum,
            action: PRODUCT_ACTIVITY_LOG_ACTIONS.REVIEW_APPROVED,
            actorType: "admin",
            actorId: actorUserId,
            before: beforeSnapshot,
            after: updated,
            metadata: {
              source: "manual",
              lane: "admin",
            },
          });
        }
        await logProductActivity({
          storeId: getAdminProductStoreId(updated),
          entityId: idNum,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.PUBLISHED,
          actorType: "admin",
          actorId: actorUserId,
          before: beforeSnapshot,
          after: updated,
          metadata: {
            source: "manual",
            lane: "admin",
          },
        });
      } else if (body.published === false) {
        await logProductActivity({
          storeId: getAdminProductStoreId(updated),
          entityId: idNum,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.UNPUBLISHED,
          actorType: "admin",
          actorId: actorUserId,
          before: beforeSnapshot,
          after: updated,
          metadata: {
            source: "manual",
            lane: "admin",
          },
        });
      }
      return res.json({
        data: toAdminProductDetail(
          updated,
          storeReadinessById.get(getAdminProductStoreId(updated)) || null
        ),
      });
    } catch (err) {
      if ((err as any)?.status === 400) {
        return res.status(400).json({ message: (err as any).message });
      }
      if ((err as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ message: "Slug already exists" });
      }
      next(err);
    }
  }
);

router.patch(
  "/:id/revision-request",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(req.params.id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });

      const { note } = requestRevisionSchema.parse(req.body);
      const product = await Product.findByPk(idNum, {
        include: buildAdminProductIncludes(),
      });
      if (!product) return res.status(404).json({ message: "Not found" });
      const beforeSnapshot = product.get?.({ plain: true }) ?? product;

      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        (product as any).get?.("sellerSubmissionStatus") ?? (product as any).sellerSubmissionStatus
      );

      if (currentSubmissionStatus !== "submitted") {
        return res.status(409).json({
          message: "Only submitted seller products can be moved into revision.",
        });
      }

      const updated = await sequelize.transaction(async (transaction) => {
        await product.update(
          {
            sellerSubmissionStatus: "needs_revision",
            sellerRevisionRequestedAt: new Date(),
            sellerRevisionRequestedByUserId: (req as any).user?.id ?? null,
            sellerRevisionNote: note ?? null,
          } as any,
          { transaction }
        );

        return Product.findByPk(idNum, {
          include: buildAdminProductIncludes(),
          transaction,
        });
      });

      const storeReadinessById = await loadAdminStoreOperationalReadinessByIds([
        getAdminProductStoreId(updated),
      ]);
      await logProductActivity({
        storeId: getAdminProductStoreId(updated),
        entityId: idNum,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.REVIEW_REJECTED,
        actorType: "admin",
        actorId: Number((req as any).user?.id || 0) || null,
        before: beforeSnapshot,
        after: updated,
        metadata: {
          source: "manual",
          lane: "admin",
          note: note ?? null,
        },
      });
      return res.json({
        data: toAdminProductDetail(
          updated,
          storeReadinessById.get(getAdminProductStoreId(updated)) || null
        ),
      });
    } catch (err) {
      if ((err as any)?.name === "ZodError") {
        return res.status(400).json({ message: (err as any).issues?.[0]?.message || "Invalid payload" });
      }
      next(err);
    }
  }
);

router.patch(
  "/:id/published",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const idNum = parseId(req.params.id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });

      const { published } = updatePublishedSchema.parse(req.body);
      const product = await Product.findByPk(idNum);
      if (!product) return res.status(404).json({ message: "Not found" });
      const beforeSnapshot = product.get?.({ plain: true }) ?? product;
      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        (product as any).get?.("sellerSubmissionStatus") ?? (product as any).sellerSubmissionStatus
      );

      const publishGatePatch = assertAdminPublishAllowed(product, {
        nextPublished: published,
        route: "toggle",
      });

      await product.update(
        {
          isPublished: published,
          ...(publishGatePatch.patch || {}),
        } as any
      );
      const afterSnapshot = product.get?.({ plain: true }) ?? product;
      await logProductActivity({
        storeId: getAdminProductStoreId(product),
        entityId: idNum,
        action: published
          ? PRODUCT_ACTIVITY_LOG_ACTIONS.PUBLISHED
          : PRODUCT_ACTIVITY_LOG_ACTIONS.UNPUBLISHED,
        actorType: "admin",
        actorId: Number((req as any).user?.id || 0) || null,
        before: beforeSnapshot,
        after: afterSnapshot,
        metadata: {
          source: "manual",
          lane: "admin",
        },
      });
      if (published && currentSubmissionStatus === "submitted") {
        await logProductActivity({
          storeId: getAdminProductStoreId(product),
          entityId: idNum,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.REVIEW_APPROVED,
          actorType: "admin",
          actorId: Number((req as any).user?.id || 0) || null,
          before: beforeSnapshot,
          after: afterSnapshot,
          metadata: {
            source: "manual",
            lane: "admin",
          },
        });
      }
      return res.json({
        data: {
          id: idNum,
          published: Boolean(
            product.get?.("published") ?? product.get?.("isPublished") ?? published
          ),
          status: String(product.get?.("status") ?? product.status ?? ""),
          sellerSubmission: serializeAdminSellerSubmission(
            product.get?.({ plain: true }) ?? product
          ),
        },
      });
    } catch (err) {
      if ((err as any)?.status === 409) {
        return res.status(409).json({ message: (err as any).message });
      }
      next(err);
    }
  }
);

router.delete(
  "/:id",
  requireAdmin,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const idNum = parseId(id);
      if (!idNum) return res.status(400).json({ message: "Invalid id" });
      const product = await Product.findByPk(idNum);
      if (!product) return res.status(404).json({ message: "Not found" });
      const beforeSnapshot = product.get?.({ plain: true }) ?? product;
      const actorUserId = Number((req as any).user?.id || 0) || null;
      const deletion = await deleteProductsSafely([idNum]);
      if (deletion.blockedIds.length > 0) {
        if (isSuperAdminRequest(req)) {
          const archiveResult = await archiveProductsSafely([idNum]);
          const archivedProduct = await Product.findByPk(idNum);
          await logProductActivity({
            storeId: getAdminProductStoreId(product),
            entityId: idNum,
            action: PRODUCT_ACTIVITY_LOG_ACTIONS.ARCHIVED,
            actorType: "admin",
            actorId: actorUserId,
            before: beforeSnapshot,
            after: archivedProduct,
            metadata: {
              source: "manual",
              lane: "admin",
              archiveReason: "ORDER_OR_REVIEW_HISTORY",
            },
          });
          return res.json({
            ok: true,
            archived: true,
            archivedCount: archiveResult.affected,
            archivedIds: archiveResult.archivedIds,
            message:
              "This product is already used in transaction history, so it was hidden from the catalog instead of being deleted.",
          });
        }
        return res.status(409).json({
          message:
            "This product is already used in orders, reviews, or suborders and cannot be deleted.",
        });
      }
      if (deletion.affected <= 0) {
        return res.status(409).json({
          message: "Delete failed. Please try again.",
        });
      }
      await logProductActivity({
        storeId: getAdminProductStoreId(product),
        entityId: idNum,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.DELETED,
        actorType: "admin",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: null,
        metadata: {
          source: "manual",
          lane: "admin",
        },
      });
      return res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

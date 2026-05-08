import { Op, QueryTypes } from "sequelize";
import { Product, sequelize } from "../models/index.js";

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const buildSqlInClause = (ids: readonly number[]) => ids.map(() => "?").join(", ");

const buildValueRefKey = (attributeId: number, valueId: number) => `${attributeId}:${valueId}`;

const collectVariationAttributeValueRefs = (variations: unknown) => {
  const refs = new Set<string>();
  let source = variations;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = null;
    }
  }

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return refs;
  }

  const plain = source as Record<string, any>;
  const selectedAttributeValues = Array.isArray(plain.selectedAttributeValues)
    ? plain.selectedAttributeValues
    : [];
  selectedAttributeValues.forEach((entry) => {
    const attributeId = parseId(entry?.attributeId);
    if (!attributeId) return;
    const values = Array.isArray(entry?.values) ? entry.values : [];
    values.forEach((valueEntry: any) => {
      const valueId = parseId(valueEntry?.id ?? valueEntry?.valueId);
      if (valueId) refs.add(buildValueRefKey(attributeId, valueId));
    });
  });

  const variants = Array.isArray(plain.variants) ? plain.variants : [];
  variants.forEach((entry) => {
    const selections = Array.isArray(entry?.selections) ? entry.selections : [];
    selections.forEach((selection: any) => {
      const attributeId = parseId(selection?.attributeId);
      const valueId = parseId(selection?.valueId);
      if (attributeId && valueId) refs.add(buildValueRefKey(attributeId, valueId));
    });
  });

  return refs;
};

const loadAttributeValueAttributeIds = async (valueIds: readonly number[]) => {
  const normalizedIds = Array.from(
    new Set(valueIds.map((value) => parseId(value)).filter((value): value is number => value !== null))
  );
  const map = new Map<number, number>();
  if (!normalizedIds.length) return map;

  const rows = await sequelize.query<{ id: number; attributeId: number }>(
    `
      SELECT id, attribute_id AS attributeId
      FROM attribute_values
      WHERE id IN (${buildSqlInClause(normalizedIds)})
    `,
    {
      replacements: normalizedIds,
      type: QueryTypes.SELECT,
    }
  );

  rows.forEach((row) => {
    const valueId = parseId(row.id);
    const attributeId = parseId(row.attributeId);
    if (valueId && attributeId) map.set(valueId, attributeId);
  });

  return map;
};

export const resolveAttributeValueVariationUsage = async (valueIds: readonly number[]) => {
  const usage = new Map<number, Set<number>>();
  const valueAttributeIds = await loadAttributeValueAttributeIds(valueIds);

  valueIds.forEach((valueId) => {
    const id = parseId(valueId);
    if (id) usage.set(id, new Set<number>());
  });
  if (valueAttributeIds.size === 0) return usage;

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
    const refs = collectVariationAttributeValueRefs(variations);

    valueAttributeIds.forEach((attributeId, valueId) => {
      if (!refs.has(buildValueRefKey(attributeId, valueId))) return;
      const current = usage.get(valueId) || new Set<number>();
      current.add(productId);
      usage.set(valueId, current);
    });
  });

  return usage;
};

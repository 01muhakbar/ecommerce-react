import { Request, Router } from "express";
import { Op, QueryTypes } from "sequelize";
import { Attribute, Product, sequelize } from "../models/index.js";

const router = Router();

const parseId = (value: any) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const createHttpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

const isSuperAdminRequest = (req: Request) => {
  const normalized = String((req as any).user?.role || "")
    .trim()
    .toLowerCase();
  return ["super_admin", "superadmin", "super-admin", "super admin"].includes(normalized);
};

const normalizeValueText = (value: unknown) => String(value ?? "").trim();

const collectVariationValueIds = (variations: unknown) => {
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
    return valueIds;
  }

  const plain = source as Record<string, any>;
  const selectedAttributeValues = Array.isArray(plain.selectedAttributeValues)
    ? plain.selectedAttributeValues
    : [];
  selectedAttributeValues.forEach((entry) => {
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
      const valueId = parseId(selection?.valueId);
      if (valueId) valueIds.add(valueId);
    });
  });

  return valueIds;
};

const assertAttributeValueUnused = async (valueId: number) => {
  try {
    const legacyRows = await sequelize.query<{ productId: number }>(
      `
        SELECT DISTINCT product_id AS productId
        FROM product_attribute_values
        WHERE attribute_value_id = ?
      `,
      {
        replacements: [valueId],
        type: QueryTypes.SELECT,
      }
    );
    if (legacyRows.length > 0) {
      throw createHttpError(
        409,
        "Attribute value is already used by products and cannot be deleted."
      );
    }
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code !== "ER_NO_SUCH_TABLE") {
      if (error?.statusCode) throw error;
      throw error;
    }
  }

  const products = await Product.findAll({
    attributes: ["id", "variations"],
    where: {
      variations: {
        [Op.ne]: null,
      },
    } as any,
  });

  const usedInVariations = products.some((product) => {
    const variations = (product as any).get?.("variations") ?? (product as any).variations;
    return collectVariationValueIds(variations).has(valueId);
  });

  if (usedInVariations) {
    throw createHttpError(
      409,
      "Attribute value is already used by products and cannot be deleted."
    );
  }
};

const findAttributeValueById = async (id: number) => {
  const rows = await sequelize.query<{
    id: number;
    attribute_id: number;
    value: string;
    scope?: string;
  }>(
    `
      SELECT av.id, av.attribute_id, av.value, a.scope
      FROM attribute_values av
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE av.id = ?
      LIMIT 1
    `,
    {
      replacements: [id],
      type: QueryTypes.SELECT,
    }
  );
  return rows[0] || null;
};

const assertAdminOwnsAttribute = async (attributeId: number, options: { allowStore?: boolean } = {}) => {
  const attribute = await Attribute.findByPk(attributeId);
  if (!attribute) {
    throw createHttpError(404, "Attribute not found");
  }
  const scope = String((attribute as any).get?.("scope") ?? attribute.getDataValue("scope") ?? "global")
    .trim()
    .toLowerCase();
  if (scope !== "global" && !options.allowStore) {
    throw createHttpError(403, "Store attributes are view-only in Admin.");
  }
};

// GET /api/admin/attributes/:id/values
router.get("/attributes/:id/values", async (req, res, next) => {
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const attributeId = parseId(req.params.id);
    if (!attributeId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }
    await assertAdminOwnsAttribute(attributeId, { allowStore: actorIsSuperAdmin });

    const rows = await sequelize.query(
      "SELECT id, attribute_id, value FROM attribute_values WHERE attribute_id = ? AND status = 'active' ORDER BY value ASC",
      { replacements: [attributeId], type: QueryTypes.SELECT },
    );

    return res.json({ success: true, data: rows });
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({
          success: true,
          data: [],
          warning: "attribute_values table not found",
        });
    }
    return next(error);
  }
});

// POST /api/admin/attributes/:id/values
router.post("/attributes/:id/values", async (req, res, next) => {
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const attributeId = parseId(req.params.id);
    if (!attributeId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }
    await assertAdminOwnsAttribute(attributeId, { allowStore: actorIsSuperAdmin });
    const value = normalizeValueText(req.body?.value);
    if (!value || value.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: "Value must be 1-120 characters" });
    }

    try {
      const [_rows, meta] = await sequelize.query(
        "INSERT INTO attribute_values (attribute_id, value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
        { replacements: [attributeId, value] },
      );
      let id =
        (meta as any)?.insertId ??
        (meta as any)?.[0]?.insertId ??
        null;
      if (!id) {
        const rows = await sequelize.query(
          "SELECT id FROM attribute_values WHERE attribute_id = ? AND value = ? LIMIT 1",
          { replacements: [attributeId, value], type: QueryTypes.SELECT },
        );
        id = (rows as any)?.[0]?.id ?? null;
      }
      return res.json({
        success: true,
        data: { id, attributeId, value },
      });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ success: false, message: "Value already exists" });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/admin/attribute-values/:id
router.patch("/attribute-values/:id", async (req, res, next) => {
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const id = parseId(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid value id" });
    }

    const value = normalizeValueText(req.body?.value);
    if (!value || value.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: "Value must be 1-120 characters" });
    }

    const current = await findAttributeValueById(id);
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: "Value not found" });
    }
    if (String(current.scope || "global").trim().toLowerCase() !== "global" && !actorIsSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only Super Admin can edit seller attribute values from Admin." });
    }

    try {
      const [_rows, meta] = await sequelize.query(
        `
          UPDATE attribute_values
          SET value = ?, updated_at = NOW()
          WHERE id = ?
        `,
        {
          replacements: [value, id],
        }
      );
      const affected = Number((meta as any)?.affectedRows || 0);
      if (affected === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Value not found" });
      }

      return res.json({
        success: true,
        data: {
          id: current.id,
          attributeId: current.attribute_id,
          value,
        },
      });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ success: false, message: "Value already exists" });
      }
      throw error;
    }
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({ success: true, warning: "attribute_values table not found" });
    }
    return next(error);
  }
});

// POST /api/admin/attribute-values/bulk-delete
router.post("/attribute-values/bulk-delete", async (req, res, next) => {
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const incoming = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids: number[] = Array.from(
      new Set(
        incoming
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      )
    );

    if (ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "ids must be a non-empty array" });
    }

    for (const id of ids) {
      await assertAttributeValueUnused(id);
    }
    const values = await Promise.all(ids.map((id) => findAttributeValueById(id)));
    if (
      values.some((entry) => entry && String(entry.scope || "global").trim().toLowerCase() !== "global") &&
      !actorIsSuperAdmin
    ) {
      return res.status(403).json({ success: false, message: "Only Super Admin can delete seller attribute values from Admin." });
    }

    const placeholders = ids.map(() => "?").join(", ");
    const [_rows, meta] = await sequelize.query(
      `DELETE FROM attribute_values WHERE id IN (${placeholders})`,
      { replacements: ids }
    );
    const affected = Number((meta as any)?.affectedRows || 0);

    return res.json({ success: true, affected });
  } catch (error: any) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    if (code === "ER_NO_SUCH_TABLE") {
      return res
        .status(200)
        .json({ success: true, affected: 0, warning: "attribute_values table not found" });
    }
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
});

// DELETE /api/admin/attribute-values/:id
router.delete("/attribute-values/:id", async (req, res, next) => {
  try {
    const actorIsSuperAdmin = isSuperAdminRequest(req);
    const id = parseId(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid value id" });
    }
    const current = await findAttributeValueById(id);
    if (!current) {
      return res
        .status(404)
        .json({ success: false, message: "Value not found" });
    }
    if (String(current.scope || "global").trim().toLowerCase() !== "global" && !actorIsSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only Super Admin can delete seller attribute values from Admin." });
    }

    try {
      await assertAttributeValueUnused(id);
      const [_rows, meta] = await sequelize.query(
        "DELETE FROM attribute_values WHERE id = ?",
        { replacements: [id] },
      );
      const affected = Number((meta as any)?.affectedRows || 0);
      if (affected === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Value not found" });
      }
      return res.json({ success: true });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_NO_SUCH_TABLE") {
        return res
          .status(200)
          .json({ success: true, warning: "attribute_values table not found" });
      }
      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

export default router;

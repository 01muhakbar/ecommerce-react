import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

const parseId = (value: any) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/admin/attributes/:id/values
router.get("/attributes/:id/values", async (req, res, next) => {
  try {
    const attributeId = parseId(req.params.id);
    if (!attributeId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }

    const rows = await sequelize.query(
      "SELECT id, attribute_id, value FROM attribute_values WHERE attribute_id = ? ORDER BY value ASC",
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
    const attributeId = parseId(req.params.id);
    if (!attributeId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }
    const value = String(req.body?.value || "").trim();
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

// DELETE /api/admin/attribute-values/:id
router.delete("/attribute-values/:id", async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid value id" });
    }

    try {
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
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

export default router;

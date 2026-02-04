import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

// GET /api/admin/attributes
router.get("/", async (_req, res, next) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, name FROM attributes ORDER BY name ASC",
      { type: QueryTypes.SELECT },
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
          warning: "attributes table not found",
        });
    }
    return next(error);
  }
});

// POST /api/admin/attributes
router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    if (name.length < 2 || name.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: "Name must be 2-120 characters" });
    }

    try {
      const [_rows, meta] = await sequelize.query(
        "INSERT INTO attributes (name, created_at, updated_at) VALUES (?, NOW(), NOW())",
        { replacements: [name] },
      );
      const id = (meta as any)?.insertId ?? null;
      return res.json({ success: true, data: { id, name } });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ success: false, message: "Attribute already exists" });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/admin/attributes/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }

    try {
      const [_rows, meta] = await sequelize.query(
        "DELETE FROM attributes WHERE id = ?",
        { replacements: [id] },
      );
      const affected = Number((meta as any)?.affectedRows || 0);
      if (affected === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Attribute not found" });
      }
      return res.json({ success: true });
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_NO_SUCH_TABLE") {
        return res
          .status(200)
          .json({ success: true, warning: "attributes table not found" });
      }
      if (code === "ER_ROW_IS_REFERENCED_2") {
        return res
          .status(409)
          .json({ success: false, message: "Attribute is in use" });
      }
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

export default router;

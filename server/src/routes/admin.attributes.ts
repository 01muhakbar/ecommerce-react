import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

const toTrimmedText = (value: unknown) => String(value ?? "").trim();

const getDisplayNameInput = (body: any) => {
  if (!body || typeof body !== "object") {
    return { provided: false, value: null as string | null };
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayName")) {
    const text = toTrimmedText(body.displayName);
    return { provided: true, value: text || null };
  }

  if (Object.prototype.hasOwnProperty.call(body, "display_name")) {
    const text = toTrimmedText(body.display_name);
    return { provided: true, value: text || null };
  }

  return { provided: false, value: null as string | null };
};

// GET /api/admin/attributes
router.get("/", async (_req, res, next) => {
  try {
    const rows = await sequelize.query(
      "SELECT id, name, display_name AS displayName FROM attributes ORDER BY name ASC",
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
    const name = toTrimmedText(req.body?.name);
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
    const displayNameInput = getDisplayNameInput(req.body);
    if (
      displayNameInput.provided &&
      displayNameInput.value &&
      displayNameInput.value.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Display name must be 255 characters or fewer",
      });
    }

    try {
      await sequelize.query(
        "INSERT INTO attributes (name, display_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
        { replacements: [name, displayNameInput.value] },
      );

      const createdRows = (await sequelize.query(
        "SELECT id, name, display_name AS displayName FROM attributes WHERE name = ? LIMIT 1",
        { replacements: [name], type: QueryTypes.SELECT },
      )) as any[];
      const created = createdRows[0] || null;

      return res.json({
        success: true,
        data: {
          id: created?.id ?? null,
          name: created?.name ?? name,
          displayName:
            created?.displayName ?? displayNameInput.value ?? null,
        },
      });
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

// PATCH /api/admin/attributes/:id
router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid attribute id" });
    }

    const name = toTrimmedText(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (name.length < 2 || name.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: "Name must be 2-120 characters" });
    }

    const displayNameInput = getDisplayNameInput(req.body);
    if (
      displayNameInput.provided &&
      displayNameInput.value &&
      displayNameInput.value.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Display name must be 255 characters or fewer",
      });
    }

    const rows = (await sequelize.query(
      "SELECT id, name, display_name AS displayName FROM attributes WHERE id = ? LIMIT 1",
      { replacements: [id], type: QueryTypes.SELECT },
    )) as any[];

    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: "Attribute not found" });
    }

    const nextDisplayName = displayNameInput.provided
      ? displayNameInput.value
      : (existing as any)?.displayName ?? null;

    try {
      await sequelize.query(
        "UPDATE attributes SET name = ?, display_name = ?, updated_at = NOW() WHERE id = ?",
        { replacements: [name, nextDisplayName, id] },
      );
    } catch (error: any) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      if (code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ success: false, message: "Attribute already exists" });
      }
      throw error;
    }

    return res.json({
      success: true,
      data: { id, name, displayName: nextDisplayName },
    });
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

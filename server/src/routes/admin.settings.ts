import { Router, Request, Response } from "express";
import { sequelize } from "../models/index.js";
import {
  ensureDefaultSystemSettings,
  normalizeSystemSettingsUpdate,
  sanitizeSystemSettingsForAdmin,
  upsertSystemSetting,
} from "../services/systemSettings.js";

const router = Router();

// GET all settings as a key-value object
router.get("/", async (_req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const grouped = await ensureDefaultSystemSettings(transaction);
    await transaction.commit();
    res.json(sanitizeSystemSettingsForAdmin(grouped));
  } catch (error) {
    await transaction.rollback();
    console.error("[admin.settings][GET] failed:", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

// PUT to bulk update settings
router.put("/", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Invalid payload: body must be an object" });
  }

  const settingsToUpdate = req.body;
  const transaction = await sequelize.transaction();
  try {
    const existing = await ensureDefaultSystemSettings(transaction);
    const normalized = normalizeSystemSettingsUpdate(settingsToUpdate, existing);
    for (const [key, value] of Object.entries(normalized)) {
      await upsertSystemSetting(key, value, transaction);
    }
    await transaction.commit();
    const latest = await ensureDefaultSystemSettings();
    res.json(sanitizeSystemSettingsForAdmin(latest));
  } catch (error) {
    await transaction.rollback();
    console.error("[admin.settings][PUT] failed:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;

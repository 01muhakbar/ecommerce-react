import { Router, Request, Response } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const db: any = require("../../../models");
const { Setting, sequelize } = db;

const router = Router();

// GET all settings as a key-value object
router.get("/", async (_req: Request, res: Response) => {
  const settings = await Setting.findAll();
  const grouped: Record<string, any> = {};
  for (const setting of settings) {
    grouped[setting.key] = setting.value;
  }
  res.json(grouped);
});

// PUT to bulk update settings
router.put("/", async (req: Request, res: Response) => {
  const settingsToUpdate = req.body;
  const transaction = await (sequelize as any).transaction();
  try {
    for (const key in settingsToUpdate) {
      await Setting.upsert({ key, value: settingsToUpdate[key] }, {
        transaction,
      } as any);
    }
    await transaction.commit();
    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ message: "Failed to update settings", error });
  }
});

export default router;

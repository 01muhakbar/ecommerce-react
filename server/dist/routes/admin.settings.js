import { Router } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const db = require("../../../models");
const { Setting, sequelize } = db;
const router = Router();
// GET all settings as a key-value object
router.get("/", async (_req, res) => {
    const settings = await Setting.findAll();
    const grouped = {};
    for (const setting of settings) {
        grouped[setting.key] = setting.value;
    }
    res.json(grouped);
});
// PUT to bulk update settings
router.put("/", async (req, res) => {
    const settingsToUpdate = req.body;
    const transaction = await sequelize.transaction();
    try {
        for (const key in settingsToUpdate) {
            await Setting.upsert({ key, value: settingsToUpdate[key] }, {
                transaction,
            });
        }
        await transaction.commit();
        res.json({ message: "Settings updated successfully" });
    }
    catch (error) {
        await transaction.rollback();
        res.status(500).json({ message: "Failed to update settings", error });
    }
});
export default router;

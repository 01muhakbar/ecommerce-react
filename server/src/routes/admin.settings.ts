import { Router, Request, Response } from "express";
import { QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  imagesPerProduct: "12",
  allowAutoTranslation: "false",
  defaultLanguage: "English",
  defaultCurrency: "IDR",
  defaultTimeZone: "Asia/Makassar",
  defaultDateFormat: "D MMM, YYYY",
  receiptWidth: "57 mm",
  invoiceEmailEnabled: "true",
  invoiceFromEmail: "sales@kachabazar.com",
  companyFromName: "KachaBazar",
  companyName: "HtmlLover ltd",
  vatNumber: "47589",
  companyAddress: "59 Station Rd, Purls Bridge, United Kingdom",
  postCode: "2030",
  contactPhone: "019579034",
  contactEmail: "kachabazar@gmail.com",
  website: "kachabazar-admin.vercel.app",
};

type SettingRow = {
  key: string;
  value: string;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
};

const ensureSettingsTable = async (transaction?: Transaction) => {
  await sequelize.query(
    `
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(191) NOT NULL,
        \`value\` TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
    { transaction }
  );
};

const upsertSetting = async (key: string, value: string, transaction?: Transaction) => {
  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES (:key, :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { key, value },
      transaction,
    }
  );
};

const fetchSettingsMap = async (transaction?: Transaction): Promise<Record<string, string>> => {
  const settings = await sequelize.query<SettingRow>(
    "SELECT `key`, `value` FROM settings",
    { type: QueryTypes.SELECT, transaction }
  );
  const grouped: Record<string, string> = {};
  for (const setting of settings) {
    grouped[String(setting.key)] = toStringValue(setting.value);
  }
  return grouped;
};

const ensureDefaultSettings = async (
  transaction?: Transaction
): Promise<Record<string, string>> => {
  await ensureSettingsTable(transaction);
  const grouped = await fetchSettingsMap(transaction);
  const missingDefaults = Object.entries(DEFAULT_SETTINGS).filter(
    ([key]) => grouped[key] === undefined
  );

  for (const [key, value] of missingDefaults) {
    await upsertSetting(key, value, transaction);
    grouped[key] = value;
  }

  return grouped;
};

// GET all settings as a key-value object
router.get("/", async (_req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  try {
    const grouped = await ensureDefaultSettings(transaction);
    await transaction.commit();
    res.json(grouped);
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
    await ensureDefaultSettings(transaction);
    for (const key in settingsToUpdate) {
      const value = settingsToUpdate[key];
      if (value === undefined) continue;
      await upsertSetting(key, toStringValue(value), transaction);
    }
    await transaction.commit();
    const latest = await ensureDefaultSettings();
    res.json(latest);
  } catch (error) {
    await transaction.rollback();
    console.error("[admin.settings][PUT] failed:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;

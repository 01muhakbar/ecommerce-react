import { QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../models/index.js";

export const DEFAULT_SYSTEM_SETTINGS: Record<string, string> = {
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
  smtpProvider: "google",
  smtpHost: "smtp.gmail.com",
  smtpPort: "465",
  smtpSecure: "true",
  smtpUser: "",
  smtpPassword: "",
  smtpFromEmail: "",
  smtpFromName: "TP PRENEURS",
};

const SENSITIVE_SYSTEM_SETTING_KEYS = new Set(["smtpPassword"]);

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

export const ensureSettingsTable = async (transaction?: Transaction) => {
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

export const upsertSystemSetting = async (
  key: string,
  value: string,
  transaction?: Transaction
) => {
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

export const fetchRawSystemSettingsMap = async (
  transaction?: Transaction
): Promise<Record<string, string>> => {
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

export const ensureDefaultSystemSettings = async (
  transaction?: Transaction
): Promise<Record<string, string>> => {
  await ensureSettingsTable(transaction);
  const grouped = await fetchRawSystemSettingsMap(transaction);
  const missingDefaults = Object.entries(DEFAULT_SYSTEM_SETTINGS).filter(
    ([key]) => grouped[key] === undefined
  );

  for (const [key, value] of missingDefaults) {
    await upsertSystemSetting(key, value, transaction);
    grouped[key] = value;
  }

  return grouped;
};

export const sanitizeSystemSettingsForAdmin = (
  settings: Record<string, string>
): Record<string, string> => ({
  ...settings,
  smtpPassword: "",
  smtpPasswordConfigured: settings.smtpPassword ? "true" : "false",
});

export const normalizeSystemSettingsUpdate = (
  payload: Record<string, unknown>,
  existing: Record<string, string>
) => {
  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(payload || {})) {
    if (key === "smtpPasswordConfigured") continue;
    if (rawValue === undefined) continue;

    if (SENSITIVE_SYSTEM_SETTING_KEYS.has(key)) {
      const nextValue = toStringValue(rawValue).trim();
      if (!nextValue) continue;
      normalized[key] = nextValue;
      continue;
    }

    normalized[key] = toStringValue(rawValue);
  }

  if (!("smtpPassword" in normalized) && existing.smtpPassword) {
    normalized.smtpPassword = existing.smtpPassword;
  }

  return normalized;
};

const parseBoolean = (value: unknown, fallback = false) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const firstNonEmpty = (...values: Array<unknown>) => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
};

export const resolveEmailRuntimeSettings = async () => {
  const settings = await ensureDefaultSystemSettings();
  const host = firstNonEmpty(process.env.EMAIL_HOST, settings.smtpHost);
  const port = Number(firstNonEmpty(process.env.EMAIL_PORT, settings.smtpPort, "587"));
  const secure = parseBoolean(
    firstNonEmpty(process.env.EMAIL_SECURE, settings.smtpSecure, port === 465 ? "true" : "false"),
    port === 465
  );
  const user = firstNonEmpty(process.env.EMAIL_USER, settings.smtpUser);
  const pass = firstNonEmpty(process.env.EMAIL_PASS, settings.smtpPassword);
  const fromEmail = firstNonEmpty(process.env.EMAIL_FROM, settings.smtpFromEmail);
  const fromName = firstNonEmpty(
    process.env.EMAIL_FROM_NAME,
    settings.smtpFromName,
    DEFAULT_SYSTEM_SETTINGS.smtpFromName
  );

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  };
};

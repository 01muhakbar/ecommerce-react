import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router, Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

const STORE_SETTINGS_KEY = "storeSettings";

const DEFAULT_STORE_SETTINGS = {
  payments: {
    cashOnDeliveryEnabled: true,
    stripeEnabled: true,
    stripeKey: "",
    stripeSecret: "",
    razorPayEnabled: false,
  },
  socialLogin: {
    googleEnabled: true,
    googleClientId: "",
    googleSecretKey: "",
    githubEnabled: true,
    githubId: "",
    githubSecret: "",
    facebookEnabled: true,
    facebookId: "",
    facebookSecret: "",
  },
  analytics: {
    googleAnalyticsEnabled: true,
    googleAnalyticKey: "",
  },
  chat: {
    tawkEnabled: true,
    tawkPropertyId: "",
    tawkWidgetId: "",
  },
  branding: {
    clientLogoUrl: "",
    adminLogoUrl: "",
    sellerLogoUrl: "",
    workspaceBrandName: "TP PRENEURS",
  },
};

const BRANDING_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "branding");
const BRANDING_UPLOAD_LIMIT_BYTES = 1024 * 1024;
const BRANDING_TARGET_FIELD_BY_KEY = {
  client: "clientLogoUrl",
  admin: "adminLogoUrl",
  seller: "sellerLogoUrl",
} as const;

type BrandingTarget = keyof typeof BRANDING_TARGET_FIELD_BY_KEY;

type SettingsRow = {
  key: string;
  value: string;
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_STORE_SETTINGS));

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const mergeDeep = (base: any, source: any): any => {
  if (!isPlainObject(base)) return source;
  const output: Record<string, any> = { ...base };
  if (!isPlainObject(source)) return output;

  for (const [key, sourceValue] of Object.entries(source)) {
    const baseValue = output[key];
    if (isPlainObject(baseValue) && isPlainObject(sourceValue)) {
      output[key] = mergeDeep(baseValue, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  }
  return output;
};

const sanitizeStoreSettings = (rawData: unknown) => {
  const defaults = cloneDefaults();
  const source = isPlainObject(rawData) ? rawData : {};
  const paymentsSource = isPlainObject(source.payments) ? source.payments : {};
  const socialLoginSource = isPlainObject(source.socialLogin) ? source.socialLogin : {};
  const analyticsSource = isPlainObject(source.analytics) ? source.analytics : {};
  const chatSource = isPlainObject(source.chat) ? source.chat : {};
  const brandingSource = isPlainObject(source.branding) ? source.branding : {};

  return {
    ...defaults,
    ...source,
    payments: {
      ...defaults.payments,
      ...paymentsSource,
      cashOnDeliveryEnabled: toBool(
        paymentsSource.cashOnDeliveryEnabled,
        defaults.payments.cashOnDeliveryEnabled
      ),
      stripeEnabled: toBool(paymentsSource.stripeEnabled, defaults.payments.stripeEnabled),
      stripeKey: toText(paymentsSource.stripeKey, ""),
      stripeSecret: toText(paymentsSource.stripeSecret, ""),
      razorPayEnabled: toBool(
        paymentsSource.razorPayEnabled,
        defaults.payments.razorPayEnabled
      ),
    },
    socialLogin: {
      ...defaults.socialLogin,
      ...socialLoginSource,
      googleEnabled: toBool(
        socialLoginSource.googleEnabled,
        defaults.socialLogin.googleEnabled
      ),
      googleClientId: toText(socialLoginSource.googleClientId, ""),
      googleSecretKey: toText(socialLoginSource.googleSecretKey, ""),
      githubEnabled: toBool(
        socialLoginSource.githubEnabled,
        defaults.socialLogin.githubEnabled
      ),
      githubId: toText(socialLoginSource.githubId, ""),
      githubSecret: toText(socialLoginSource.githubSecret, ""),
      facebookEnabled: toBool(
        socialLoginSource.facebookEnabled,
        defaults.socialLogin.facebookEnabled
      ),
      facebookId: toText(socialLoginSource.facebookId, ""),
      facebookSecret: toText(socialLoginSource.facebookSecret, ""),
    },
    analytics: {
      ...defaults.analytics,
      ...analyticsSource,
      googleAnalyticsEnabled: toBool(
        analyticsSource.googleAnalyticsEnabled,
        defaults.analytics.googleAnalyticsEnabled
      ),
      googleAnalyticKey: toText(analyticsSource.googleAnalyticKey, ""),
    },
    chat: {
      ...defaults.chat,
      ...chatSource,
      tawkEnabled: toBool(chatSource.tawkEnabled, defaults.chat.tawkEnabled),
      tawkPropertyId: toText(chatSource.tawkPropertyId, ""),
      tawkWidgetId: toText(chatSource.tawkWidgetId, ""),
    },
    branding: {
      ...defaults.branding,
      ...brandingSource,
      clientLogoUrl: toText(brandingSource.clientLogoUrl, defaults.branding.clientLogoUrl),
      adminLogoUrl: toText(brandingSource.adminLogoUrl, defaults.branding.adminLogoUrl),
      sellerLogoUrl: toText(brandingSource.sellerLogoUrl, defaults.branding.sellerLogoUrl),
      workspaceBrandName: toText(
        brandingSource.workspaceBrandName,
        defaults.branding.workspaceBrandName
      ),
    },
  };
};

const normalizeBrandingTarget = (value: unknown): BrandingTarget | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "client" || normalized === "admin" || normalized === "seller") {
    return normalized;
  }
  return null;
};

const ensureSettingsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(191) NOT NULL,
      \`value\` TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const getSettingsRow = async (key: string) => {
  const rows = await sequelize.query<SettingsRow>(
    `
      SELECT \`key\`, \`value\`
      FROM settings
      WHERE \`key\` = :key
      LIMIT 1
    `,
    {
      type: QueryTypes.SELECT,
      replacements: { key },
    }
  );
  return rows[0] || null;
};

const upsertSettingsValue = async (key: string, value: string) => {
  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES (:key, :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`value\` = VALUES(\`value\`),
        updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { key, value },
    }
  );
};

const getPersistedStoreSettings = async () => {
  const row = await getSettingsRow(STORE_SETTINGS_KEY);
  if (!row?.value) {
    return sanitizeStoreSettings({});
  }

  try {
    return sanitizeStoreSettings(JSON.parse(row.value));
  } catch {
    return sanitizeStoreSettings({});
  }
};

fs.mkdirSync(BRANDING_UPLOAD_DIR, { recursive: true });

const brandingLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BRANDING_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const target = normalizeBrandingTarget(req.params?.target) || "client";
      const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
      const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
      const fileName = `branding-${target}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}${safeExt}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const acceptedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!acceptedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only PNG, JPEG, and WEBP images are allowed."));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: BRANDING_UPLOAD_LIMIT_BYTES,
  },
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    await ensureSettingsTable();
    const storeSettings = await getPersistedStoreSettings();
    return res.json({
      success: true,
      data: { storeSettings },
    });
  } catch (error) {
    console.error("[admin.storeSettings][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch store settings." });
  }
});

router.put("/", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, message: "Invalid payload: body must be an object." });
  }

  try {
    await ensureSettingsTable();
    const existing = await getPersistedStoreSettings();
    const incomingRaw = isPlainObject(req.body.storeSettings)
      ? req.body.storeSettings
      : req.body;
    const merged = mergeDeep(existing, incomingRaw);
    const storeSettings = sanitizeStoreSettings(merged);
    await upsertSettingsValue(STORE_SETTINGS_KEY, JSON.stringify(storeSettings));

    return res.json({
      success: true,
      data: { storeSettings },
    });
  } catch (error) {
    console.error("[admin.storeSettings][PUT] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update store settings." });
  }
});

router.post("/branding/:target/logo", (req: Request, res: Response, next) => {
  brandingLogoUpload.single("file")(req, res, async (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to upload branding logo.",
      });
    }

    const target = normalizeBrandingTarget(req.params?.target);
    if (!target) {
      return res.status(400).json({
        success: false,
        message: "Invalid branding target.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    try {
      await ensureSettingsTable();
      const existing = await getPersistedStoreSettings();
      const brandingField = BRANDING_TARGET_FIELD_BY_KEY[target];
      const uploadedLogoUrl = `/uploads/branding/${req.file.filename}`;
      const storeSettings = sanitizeStoreSettings({
        ...existing,
        branding: {
          ...existing.branding,
          [brandingField]: uploadedLogoUrl,
        },
      });

      await upsertSettingsValue(STORE_SETTINGS_KEY, JSON.stringify(storeSettings));

      return res.json({
        success: true,
        data: {
          target,
          logoUrl: uploadedLogoUrl,
          branding: storeSettings.branding,
          storeSettings,
        },
      });
    } catch (uploadPersistError) {
      return next(uploadPersistError);
    }
  });
});

export default router;

import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";
import { sanitizeCustomization } from "./admin.storeCustomization.js";

const router = Router();

type CustomizationRow = {
  id: number;
  lang: string;
  data: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizeLang = (value: unknown) => {
  const normalized = String(value || "en")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return normalized || "en";
};

const parseIncludeSet = (value: unknown) => {
  const rawValues = Array.isArray(value) ? value : [value];
  const tokens = rawValues
    .flatMap((item) => String(item ?? "").split(","))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(tokens);
};

const ensureStoreCustomizationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS store_customizations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      lang VARCHAR(16) NOT NULL,
      data LONGTEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_store_customizations_lang (lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const getCustomizationRow = async (lang: string) => {
  const rows = (await sequelize.query(
    `
      SELECT id, lang, data, createdAt, updatedAt
      FROM store_customizations
      WHERE lang = :lang
      LIMIT 1
    `,
    { type: QueryTypes.SELECT, replacements: { lang } }
  )) as CustomizationRow[];
  return rows[0] || null;
};

const parseCustomization = (raw: string | null) => {
  if (!raw) return sanitizeCustomization({});
  try {
    return sanitizeCustomization(JSON.parse(raw));
  } catch {
    return sanitizeCustomization({});
  }
};

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const extractHeaderSettings = (
  lang: string,
  customization: Record<string, any>,
  updatedAt?: string | null
) => {
  const headerSource =
    customization?.home && typeof customization.home === "object"
      ? customization.home.header || {}
      : {};

  return {
    language: lang,
    headerText: toText(headerSource.headerText, "Need help?"),
    phoneNumber: toText(headerSource.phoneNumber, ""),
    whatsAppLink: toText(headerSource.whatsAppLink, ""),
    headerLogoUrl: toText(headerSource.headerLogoUrl ?? headerSource.logoDataUrl, ""),
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
  };
};

// GET /api/store/customization/header?lang=en
// Response contract: { success: true, data: { language, headerText, phoneNumber, whatsAppLink, headerLogoUrl, updatedAt } }
router.get("/header", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);
    const row = await getCustomizationRow(lang);
    const fallbackRow = !row && lang !== "en" ? await getCustomizationRow("en") : null;
    const sourceRow = row || fallbackRow;
    const sourcePayload = sourceRow ? parseCustomization(sourceRow.data) : sanitizeCustomization({});
    const sanitized = sanitizeCustomization(sourcePayload);

    return res.json({
      success: true,
      data: extractHeaderSettings(lang, sanitized, sourceRow?.updatedAt),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization?lang=en (public read-only, whitelist response)
// Response contract: { success: true, data: { lang, customization } }
router.get("/", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);
    const includeSet = parseIncludeSet(req.query?.include);
    const includeProvided = includeSet.size > 0;
    const includeAboutUs =
      !includeProvided ||
      includeSet.has("aboutus") ||
      includeSet.has("about-us") ||
      includeSet.has("about_us");
    const includePolicy = includeSet.has("policy");
    const includeFaq = includeSet.has("faq") || includeSet.has("faqs");
    const includeOffers = includeSet.has("offer") || includeSet.has("offers");
    const includeContactUs =
      includeSet.has("contactus") ||
      includeSet.has("contact-us") ||
      includeSet.has("contact_us");
    const includeCheckout = includeSet.has("checkout");
    const includeDashboardSetting =
      includeSet.has("dashboardsetting") ||
      includeSet.has("dashboard-setting") ||
      includeSet.has("dashboard_setting");

    const row = await getCustomizationRow(lang);
    const fallbackRow = !row && lang !== "en" ? await getCustomizationRow("en") : null;
    const sourcePayload = row
      ? parseCustomization(row.data)
      : fallbackRow
        ? parseCustomization(fallbackRow.data)
        : sanitizeCustomization({});
    const sanitized = sanitizeCustomization(sourcePayload);
    const customization: Record<string, unknown> = {};

    if (includeAboutUs) {
      customization.aboutUs = sanitized.aboutUs;
    }
    if (includePolicy) {
      customization.privacyPolicy = sanitized.privacyPolicy;
      customization.termsAndConditions = sanitized.termsAndConditions;
    }
    if (includeFaq) {
      customization.faqs = sanitized.faqs;
    }
    if (includeOffers) {
      customization.offers = sanitized.offers;
    }
    if (includeContactUs) {
      customization.contactUs = sanitized.contactUs;
    }
    if (includeCheckout) {
      customization.checkout = sanitized.checkout;
    }
    if (includeDashboardSetting) {
      customization.dashboardSetting = sanitized.dashboardSetting;
    }

    return res.json({
      success: true,
      data: {
        lang,
        customization,
      },
      // Backward compatibility for existing consumers that still read top-level fields.
      lang,
      customization,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

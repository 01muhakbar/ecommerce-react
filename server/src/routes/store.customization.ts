import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";
import { Store } from "../models/index.js";
import {
  PUBLIC_STORE_IDENTITY_ATTRIBUTES,
  buildPublicOperationalPaymentProfileInclude,
  serializePublicStoreIdentityPayload,
} from "../services/sharedContracts/publicStoreIdentity.js";
import {
  buildEffectiveStoreMicrositeRichAboutPayload,
  buildPublicStoreCustomizationHeaderSettings,
  normalizeStoreCustomizationRichAboutPayload,
  parseStoredCustomization,
  sanitizeStoreCustomization,
} from "../services/sharedContracts/storeCustomizationSanitizer.js";
import { buildPublicOffersCustomization } from "../services/offersReadModel.js";

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

const parseRawCustomization = (raw: string | null) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const normalizeSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

const resolvePrimaryPublicStore = async () => {
  return Store.findOne({
    where: { status: "ACTIVE" } as any,
    attributes: [...PUBLIC_STORE_IDENTITY_ATTRIBUTES],
    include: [buildPublicOperationalPaymentProfileInclude()],
    order: [["id", "ASC"]],
  });
};

const resolvePublicStoreBySlug = async (slug: string) => {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  return Store.findOne({
    where: {
      slug: normalizedSlug,
      status: "ACTIVE",
    } as any,
    attributes: [...PUBLIC_STORE_IDENTITY_ATTRIBUTES],
    include: [
      {
        association: "activePaymentProfile",
        attributes: [...buildPublicOperationalPaymentProfileInclude().attributes],
        required: false,
      },
      {
        association: "paymentProfile",
        attributes: [...buildPublicOperationalPaymentProfileInclude().attributes],
        required: false,
      },
    ],
  });
};

// GET /api/store/customization/header?lang=en
// Response contract: { success: true, data: { language, headerText, phoneNumber, whatsAppLink, headerLogoUrl, updatedAt, contract } }
router.get("/header", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);
    const row = await getCustomizationRow(lang);
    const fallbackRow = !row && lang !== "en" ? await getCustomizationRow("en") : null;
    const sourceRow = row || fallbackRow;
    const sanitized = sourceRow
      ? parseStoredCustomization(sourceRow.data)
      : sanitizeStoreCustomization({});
    const store = await resolvePrimaryPublicStore();

    return res.json({
      success: true,
      data: buildPublicStoreCustomizationHeaderSettings(
        lang,
        sanitized,
        store,
        sourceRow?.updatedAt
      ),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization/identity
// Response contract: { success: true, data: { name, slug, description, logoUrl, bannerUrl, email, phone, whatsapp, websiteUrl, instagramUrl, tiktokUrl, addressLine1, addressLine2, city, province, postalCode, country, updatedAt, contract } }
router.get("/identity", async (_req, res, next) => {
  try {
    const store = await resolvePrimaryPublicStore();
    return res.json({
      success: true,
      data: await serializePublicStoreIdentityPayload(store),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization/identity/:slug
// Response contract: { success: true, data: { name, slug, description, logoUrl, bannerUrl, email, phone, whatsapp, websiteUrl, instagramUrl, tiktokUrl, addressLine1, addressLine2, city, province, postalCode, country, updatedAt, contract } }
router.get("/identity/:slug", async (req, res, next) => {
  try {
    const normalizedSlug = normalizeSlug(req.params.slug);
    if (!normalizedSlug) {
      return res.status(400).json({
        success: false,
        message: "Invalid store slug.",
      });
    }

    const store = await resolvePublicStoreBySlug(normalizedSlug);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    return res.json({
      success: true,
      data: await serializePublicStoreIdentityPayload(store),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization/microsites/:slug/rich-about?lang=en
// Response contract: { success: true, data: { storeSlug, lang, richAbout: { title, body, hasContent }, effective: { title, body, source }, updatedAt, contract } }
router.get("/microsites/:slug/rich-about", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const normalizedSlug = normalizeSlug(req.params.slug);
    if (!normalizedSlug) {
      return res.status(400).json({
        success: false,
        message: "Invalid store slug.",
      });
    }

    const store = await resolvePublicStoreBySlug(normalizedSlug);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found.",
      });
    }

    const lang = normalizeLang(req.query?.lang);
    const row = await getCustomizationRow(lang);
    const fallbackRow = !row && lang !== "en" ? await getCustomizationRow("en") : null;
    const sourceRow = row || fallbackRow;
    const rawCustomization = parseRawCustomization(sourceRow?.data ?? null);
    const micrositesSource =
      rawCustomization &&
      typeof rawCustomization === "object" &&
      !Array.isArray(rawCustomization) &&
      rawCustomization.storeMicrosites &&
      typeof rawCustomization.storeMicrosites === "object" &&
      !Array.isArray(rawCustomization.storeMicrosites)
        ? rawCustomization.storeMicrosites
        : {};
    const storeMicrositeSource =
      micrositesSource &&
      typeof micrositesSource === "object" &&
      !Array.isArray(micrositesSource) &&
      micrositesSource[normalizedSlug] &&
      typeof micrositesSource[normalizedSlug] === "object" &&
      !Array.isArray(micrositesSource[normalizedSlug])
        ? micrositesSource[normalizedSlug]
        : {};
    const richAbout = normalizeStoreCustomizationRichAboutPayload(
      (storeMicrositeSource as any).richAbout ?? (storeMicrositeSource as any).about
    );
    const effective = buildEffectiveStoreMicrositeRichAboutPayload(store, richAbout);

    return res.json({
      success: true,
      data: {
        storeSlug: normalizedSlug,
        lang,
        richAbout,
        effective,
        updatedAt:
          effective.source === "STORE_CUSTOMIZATION" && sourceRow?.updatedAt
            ? new Date(sourceRow.updatedAt).toISOString()
            : effective.source === "STORE_DESCRIPTION_FALLBACK" && store?.updatedAt
              ? new Date(store.updatedAt).toISOString()
              : "",
        contract: {
          authoritativeSource: "STORE_CUSTOMIZATION",
          fallbackOrder: {
            body: ["storeMicrosites[slug].richAbout.body", "STORE.description"],
            title: ["storeMicrosites[slug].richAbout.title", "static:About This Store"],
          },
          notes: [
            "Store microsite rich about content is customization-owned.",
            "When rich about body is empty, the storefront falls back to the seller-owned Store.description field.",
          ],
        },
      },
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
    const includeHome =
      includeSet.has("home") ||
      includeSet.has("homesettings") ||
      includeSet.has("home-settings") ||
      includeSet.has("home_settings");
    const includePolicy = includeSet.has("policy");
    const includeFaq = includeSet.has("faq") || includeSet.has("faqs");
    const includeOffers = includeSet.has("offer") || includeSet.has("offers");
    const includeContactUs =
      includeSet.has("contactus") ||
      includeSet.has("contact-us") ||
      includeSet.has("contact_us");
    const includeCheckout = includeSet.has("checkout");
    const includeSeoSettings =
      includeSet.has("seo") ||
      includeSet.has("seosettings") ||
      includeSet.has("seo-settings") ||
      includeSet.has("seo_settings");
    const includeDashboardSetting =
      includeSet.has("dashboardsetting") ||
      includeSet.has("dashboard-setting") ||
      includeSet.has("dashboard_setting");
    const includeProductSlugPage =
      includeSet.has("productslugpage") ||
      includeSet.has("product-slug-page") ||
      includeSet.has("product_slug_page");

    const row = await getCustomizationRow(lang);
    const fallbackRow = !row && lang !== "en" ? await getCustomizationRow("en") : null;
    const sourcePayload = row
      ? parseStoredCustomization(row.data)
      : fallbackRow
        ? parseStoredCustomization(fallbackRow.data)
        : sanitizeStoreCustomization({});
    const sanitized = sanitizeStoreCustomization(sourcePayload);
    const customization: Record<string, unknown> = {};

    if (includeHome) {
      customization.home = sanitized.home;
    }
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
      customization.offers = await buildPublicOffersCustomization(sanitized.offers);
    }
    if (includeContactUs) {
      customization.contactUs = sanitized.contactUs;
    }
    if (includeCheckout) {
      customization.checkout = sanitized.checkout;
    }
    if (includeSeoSettings) {
      customization.seoSettings = sanitized.seoSettings;
    }
    if (includeDashboardSetting) {
      customization.dashboardSetting = sanitized.dashboardSetting;
    }
    if (includeProductSlugPage) {
      customization.productSlugPage = sanitized.productSlugPage;
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

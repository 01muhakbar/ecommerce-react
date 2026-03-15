import { Router } from "express";
import { Op, QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";
import { Product, Store } from "../models/index.js";
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

const parseRawCustomization = (raw: string | null) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toIsoString = (value: unknown) => {
  if (!value) return "";
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
};

const pickLatestIsoString = (...values: unknown[]) => {
  const timestamps = values
    .map((value) => {
      const iso = toIsoString(value);
      if (!iso) return null;
      const parsed = Date.parse(iso);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  if (!timestamps.length) return "";
  return new Date(Math.max(...timestamps)).toISOString();
};

const normalizeSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

const toPreferredWhatsAppLink = (preferredValue: unknown, fallbackValue: unknown) => {
  const preferred = toText(preferredValue);
  if (preferred) {
    const lowered = preferred.toLowerCase();
    if (
      lowered.startsWith("https://wa.me/") ||
      lowered.startsWith("https://api.whatsapp.com/")
    ) {
      return preferred;
    }

    const digits = preferred.replace(/\D+/g, "");
    if (digits) {
      return `https://wa.me/${digits}`;
    }
  }

  return toText(fallbackValue);
};

const serializePublicStoreIdentityContract = () => ({
  authoritativeSource: "STORE",
  sellerOwnedFields: [
    "name",
    "slug",
    "description",
    "logoUrl",
    "bannerUrl",
    "email",
    "phone",
    "whatsapp",
    "websiteUrl",
    "instagramUrl",
    "tiktokUrl",
    "addressLine1",
    "addressLine2",
    "city",
    "province",
    "postalCode",
    "country",
  ],
  adminManagedSurfaces: [
    "marketplace-header-copy",
    "marketplace-contact-layout",
    "store-microsite-rich-about",
  ],
  notes: [
    "Public store identity and store microsite contact fields read from Store.",
    "Store microsite hero artwork and public outbound links read seller-owned Store fields when present.",
    "Global marketplace header copy and contact-page layout remain admin customization-managed.",
    "Store description is the fallback for store microsite about content when rich-about customization is empty.",
  ],
});

const publicStoreIdentityAttributes = [
  "id",
  "name",
  "slug",
  "status",
  "description",
  "logoUrl",
  "bannerUrl",
  "email",
  "phone",
  "whatsapp",
  "websiteUrl",
  "instagramUrl",
  "tiktokUrl",
  "addressLine1",
  "addressLine2",
  "city",
  "province",
  "postalCode",
  "country",
  "createdAt",
  "updatedAt",
] as const;

const buildPublicStoreSummary = async (store: any) => {
  if (!store?.id) {
    return {
      status: {
        code: "UNKNOWN",
        label: "Unavailable",
        tone: "neutral",
      },
      productCount: null,
      ratingAverage: null,
      ratingCount: 0,
      followerCount: null,
      responseRate: null,
      responseTimeLabel: null,
      joinedAt: "",
      chatMode: "disabled",
      canChat: false,
      canContact: false,
    };
  }

  const storeId = Number(store.id);
  const productCount = await Product.count({
    where: {
      storeId,
      status: "active",
      isPublished: { [Op.in]: [1, true] },
    } as any,
  });

  const rows = (await sequelize.query(
    `
      SELECT
        ROUND(AVG(pr.rating), 1) AS ratingAverage,
        COUNT(pr.id) AS ratingCount
      FROM product_reviews pr
      INNER JOIN products p ON p.id = pr.product_id
      WHERE p.store_id = :storeId
        AND p.status = 'active'
        AND p.published IN (1, true)
    `,
    {
      replacements: { storeId },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ ratingAverage?: number | string | null; ratingCount?: number | string | null }>;

  const aggregate = rows[0] || {};
  const ratingAverageRaw = Number(aggregate.ratingAverage);
  const ratingAverage = Number.isFinite(ratingAverageRaw) && ratingAverageRaw > 0
    ? Number(ratingAverageRaw.toFixed(1))
    : null;
  const ratingCount = Math.max(0, Number(aggregate.ratingCount || 0));
  const storeStatus = toText(store.status, "ACTIVE").toUpperCase();
  const hasWhatsApp = Boolean(toPreferredWhatsAppLink(store.whatsapp, ""));
  const hasContact = Boolean(toText(store.email) || toText(store.phone) || hasWhatsApp);

  return {
    status: {
      code: storeStatus,
      label: storeStatus === "ACTIVE" ? "Active" : "Unavailable",
      tone: storeStatus === "ACTIVE" ? "success" : "neutral",
    },
    productCount: Number(productCount) || 0,
    ratingAverage,
    ratingCount,
    followerCount: null,
    responseRate: null,
    responseTimeLabel: null,
    joinedAt: toIsoString(store.createdAt),
    chatMode: hasWhatsApp ? "enabled" : hasContact ? "contact_fallback" : "disabled",
    canChat: hasWhatsApp,
    canContact: hasContact,
  };
};

const resolvePrimaryPublicStore = async () => {
  const activeStore = await Store.findOne({
    where: { status: "ACTIVE" } as any,
    attributes: [...publicStoreIdentityAttributes],
    order: [["id", "ASC"]],
  });
  if (activeStore) return activeStore;

  return Store.findOne({
    attributes: [...publicStoreIdentityAttributes],
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
    attributes: [...publicStoreIdentityAttributes],
  });
};

const serializePublicStoreIdentity = async (store: any) => {
  const summary = await buildPublicStoreSummary(store);

  if (!store) {
    return {
      id: null,
      name: "",
      slug: "",
      description: "",
      logoUrl: "",
      bannerUrl: "",
      email: "",
      phone: "",
      whatsapp: "",
      websiteUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      createdAt: "",
      updatedAt: "",
      summary,
      contract: serializePublicStoreIdentityContract(),
    };
  }

  return {
    id: Number(store.id),
    name: toText(store.name),
    slug: toText(store.slug),
    description: toText(store.description),
    logoUrl: toText(store.logoUrl),
    bannerUrl: toText(store.bannerUrl),
    email: toText(store.email),
    phone: toText(store.phone),
    whatsapp: toText(store.whatsapp),
    websiteUrl: toText(store.websiteUrl),
    instagramUrl: toText(store.instagramUrl),
    tiktokUrl: toText(store.tiktokUrl),
    addressLine1: toText(store.addressLine1),
    addressLine2: toText(store.addressLine2),
    city: toText(store.city),
    province: toText(store.province),
    postalCode: toText(store.postalCode),
    country: toText(store.country),
    createdAt: toIsoString(store.createdAt),
    updatedAt: toIsoString(store.updatedAt),
    summary,
    contract: serializePublicStoreIdentityContract(),
  };
};

const normalizeRichAboutPayload = (raw: unknown) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const title = toText(
    (source as any).title ?? (source as any).heading ?? (source as any).label,
    ""
  );
  const body = toText(
    (source as any).body ?? (source as any).content ?? (source as any).text ?? (source as any).description,
    ""
  );

  return {
    title,
    body,
    hasContent: Boolean(title || body),
  };
};

const extractHeaderSettings = (
  lang: string,
  customization: Record<string, any>,
  store: any,
  updatedAt?: string | null
) => {
  const headerSource =
    customization?.home && typeof customization.home === "object"
      ? customization.home.header || {}
      : {};
  const storePhone = toText(store?.phone);
  const storeWhatsApp = toPreferredWhatsAppLink(store?.whatsapp, "");
  const storeLogoUrl = toText(store?.logoUrl);
  const customizationPhone = toText(headerSource.phoneNumber, "");
  const customizationWhatsApp = toText(headerSource.whatsAppLink, "");
  const customizationHeaderLogoUrl = toText(
    headerSource.headerLogoUrl ?? headerSource.logoDataUrl,
    ""
  );

  return {
    language: lang,
    headerText: toText(headerSource.headerText, "Need help?"),
    phoneNumber: storePhone || customizationPhone,
    whatsAppLink: storeWhatsApp || customizationWhatsApp,
    headerLogoUrl: storeLogoUrl || customizationHeaderLogoUrl,
    updatedAt:
      pickLatestIsoString(store?.updatedAt, updatedAt) || new Date().toISOString(),
    contract: {
      authoritativeFields: {
        headerText: "STORE_CUSTOMIZATION",
        phoneNumber: storePhone ? "STORE" : "STORE_CUSTOMIZATION",
        whatsAppLink: storeWhatsApp ? "STORE" : "STORE_CUSTOMIZATION",
        headerLogoUrl: storeLogoUrl ? "STORE" : "STORE_CUSTOMIZATION",
      },
      fallbackOrder: {
        phoneNumber: ["STORE.phone", "customization.home.header.phoneNumber"],
        whatsAppLink: ["STORE.whatsapp", "customization.home.header.whatsAppLink"],
        headerLogoUrl: ["STORE.logoUrl", "customization.home.header.headerLogoUrl"],
      },
      notes: [
        "Marketplace header copy stays admin customization-managed.",
        "Seller-owned store phone, WhatsApp, and logo override customization header fallback when present.",
      ],
    },
  };
};

const buildEffectiveRichAboutPayload = (store: any, richAbout: { title: string; body: string; hasContent: boolean }) => {
  const fallbackBody = toText(store?.description);
  const effectiveTitle = toText(richAbout.title, "About This Store");
  const effectiveBody = toText(richAbout.body, fallbackBody);
  const source = richAbout.hasContent
    ? "STORE_CUSTOMIZATION"
    : fallbackBody
      ? "STORE_DESCRIPTION_FALLBACK"
      : "EMPTY";

  return {
    title: effectiveTitle,
    body: effectiveBody,
    source,
  };
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
    const sourcePayload = sourceRow ? parseCustomization(sourceRow.data) : sanitizeCustomization({});
    const sanitized = sanitizeCustomization(sourcePayload);
    const store = await resolvePrimaryPublicStore();

    return res.json({
      success: true,
      data: extractHeaderSettings(lang, sanitized, store, sourceRow?.updatedAt),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization/identity
// Response contract: { success: true, data: { id, name, slug, description, logoUrl, bannerUrl, email, phone, whatsapp, websiteUrl, instagramUrl, tiktokUrl, addressLine1, addressLine2, city, province, postalCode, country, updatedAt, contract } }
router.get("/identity", async (_req, res, next) => {
  try {
    const store = await resolvePrimaryPublicStore();
    return res.json({
      success: true,
      data: await serializePublicStoreIdentity(store),
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/store/customization/identity/:slug
// Response contract: { success: true, data: { id, name, slug, description, logoUrl, bannerUrl, email, phone, whatsapp, websiteUrl, instagramUrl, tiktokUrl, addressLine1, addressLine2, city, province, postalCode, country, updatedAt, contract } }
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
      data: await serializePublicStoreIdentity(store),
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
    const richAbout = normalizeRichAboutPayload(
      (storeMicrositeSource as any).richAbout ?? (storeMicrositeSource as any).about
    );
    const effective = buildEffectiveRichAboutPayload(store, richAbout);

    return res.json({
      success: true,
      data: {
        storeSlug: normalizedSlug,
        lang,
        richAbout,
        effective,
        updatedAt:
          pickLatestIsoString(
            richAbout.hasContent ? sourceRow?.updatedAt : null,
            effective.source === "STORE_DESCRIPTION_FALLBACK" ? store?.updatedAt : null
          ) || "",
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

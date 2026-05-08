import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

export const STORE_SETTINGS_KEY = "storeSettings";

export const DEFAULT_STORE_SETTINGS = {
  payments: {
    cashOnDeliveryEnabled: true,
    stripeEnabled: true,
    stripeKey: "",
    stripeSecret: "",
    stripeWebhookSecret: "",
    razorPayEnabled: false,
    razorPayKeyId: "",
    razorPayKeySecret: "",
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
    adminLoginHeroUrl: "",
    adminForgotPasswordHeroUrl: "",
    adminCreateAccountHeroUrl: "",
    workspaceBrandName: "TP PRENEURS",
  },
};

type SettingsRow = {
  key: string;
  value: string;
};

const PAYMENT_RUNTIME_SUPPORTED = {
  COD: true,
  STRIPE: true,
  RAZORPAY: false,
} as const;

const SOCIAL_RUNTIME_SUPPORTED = {
  google: false,
  github: false,
  facebook: false,
} as const;

const STRIPE_PUBLISHABLE_KEY_REGEX = /^pk_(test|live)_[A-Za-z0-9]+$/;
const STRIPE_SECRET_KEY_REGEX = /^sk_(test|live)_[A-Za-z0-9]+$/;
const STRIPE_WEBHOOK_SECRET_REGEX = /^whsec_[A-Za-z0-9]+$/;
const RAZORPAY_KEY_ID_REGEX = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const RAZORPAY_SECRET_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
const GOOGLE_ANALYTICS_KEY_REGEX = /^(G|AW|UA)-[A-Z0-9-]+$/;
const TAWK_ID_REGEX = /^[A-Za-z0-9]{6,64}$/;

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

const maskSecret = (value: unknown) => {
  const normalized = toText(value, "");
  if (!normalized) return "";
  if (normalized.length <= 6) return "••••••";
  return `${normalized.slice(0, 3)}••••${normalized.slice(-2)}`;
};

const normalizeGoogleAnalyticsKey = (value: unknown) => {
  const normalized = toText(value, "").toUpperCase();
  return GOOGLE_ANALYTICS_KEY_REGEX.test(normalized) ? normalized : "";
};

const normalizeTawkId = (value: unknown) => {
  const normalized = toText(value, "");
  return TAWK_ID_REGEX.test(normalized) ? normalized : "";
};

const buildStatus = (input: {
  requestedEnabled: boolean;
  configured: boolean;
  valid: boolean;
  effectiveEnabled: boolean;
  runtimeSupported: boolean;
  missingFields?: string[];
  invalidFields?: string[];
  configuredButUnavailableLabel?: string;
  disabledLabel?: string;
  readyLabel?: string;
}) => {
  const requestedEnabled = Boolean(input.requestedEnabled);
  const configured = Boolean(input.configured);
  const valid = Boolean(input.valid);
  const effectiveEnabled = Boolean(input.effectiveEnabled);
  const runtimeSupported = Boolean(input.runtimeSupported);
  const missingFields = Array.isArray(input.missingFields) ? input.missingFields : [];
  const invalidFields = Array.isArray(input.invalidFields) ? input.invalidFields : [];

  if (!requestedEnabled) {
    return {
      code: "DISABLED",
      label: input.disabledLabel || "Disabled",
      tone: "slate",
      missingFields,
      invalidFields,
    };
  }

  if (invalidFields.length > 0) {
    return {
      code: "INVALID",
      label: "Invalid configuration",
      tone: "rose",
      missingFields,
      invalidFields,
    };
  }

  if (missingFields.length > 0 || !configured) {
    return {
      code: "INCOMPLETE",
      label: "Missing credentials",
      tone: "amber",
      missingFields,
      invalidFields,
    };
  }

  if (!runtimeSupported) {
    return {
      code: "CONFIGURED",
      label: input.configuredButUnavailableLabel || "Configured",
      tone: "blue",
      missingFields,
      invalidFields,
    };
  }

  if (effectiveEnabled && valid) {
    return {
      code: "READY",
      label: input.readyLabel || "Ready",
      tone: "emerald",
      missingFields,
      invalidFields,
    };
  }

  return {
    code: "INCOMPLETE",
    label: "Incomplete",
    tone: "amber",
    missingFields,
    invalidFields,
  };
};

export const sanitizeStoreSettings = (rawData: unknown) => {
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
      stripeWebhookSecret: toText(paymentsSource.stripeWebhookSecret, ""),
      razorPayEnabled: toBool(
        paymentsSource.razorPayEnabled,
        defaults.payments.razorPayEnabled
      ),
      razorPayKeyId: toText(paymentsSource.razorPayKeyId, ""),
      razorPayKeySecret: toText(paymentsSource.razorPayKeySecret, ""),
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
      adminLoginHeroUrl: toText(
        brandingSource.adminLoginHeroUrl,
        defaults.branding.adminLoginHeroUrl
      ),
      adminForgotPasswordHeroUrl: toText(
        brandingSource.adminForgotPasswordHeroUrl,
        defaults.branding.adminForgotPasswordHeroUrl
      ),
      adminCreateAccountHeroUrl: toText(
        brandingSource.adminCreateAccountHeroUrl,
        defaults.branding.adminCreateAccountHeroUrl
      ),
      workspaceBrandName: toText(
        brandingSource.workspaceBrandName,
        defaults.branding.workspaceBrandName
      ),
    },
  };
};

export const mergeStoreSettingsForUpdate = (existingRaw: unknown, incomingRaw: unknown) => {
  const existing = sanitizeStoreSettings(existingRaw);
  const incoming = sanitizeStoreSettings(
    mergeDeep(existing, isPlainObject(incomingRaw) ? incomingRaw : {})
  );

  return sanitizeStoreSettings({
    ...incoming,
    payments: {
      ...incoming.payments,
      stripeSecret: toText(incoming.payments.stripeSecret, "") || existing.payments.stripeSecret,
      stripeWebhookSecret:
        toText(incoming.payments.stripeWebhookSecret, "") ||
        existing.payments.stripeWebhookSecret,
      razorPayKeySecret:
        toText(incoming.payments.razorPayKeySecret, "") || existing.payments.razorPayKeySecret,
    },
    socialLogin: {
      ...incoming.socialLogin,
      googleSecretKey:
        toText(incoming.socialLogin.googleSecretKey, "") || existing.socialLogin.googleSecretKey,
      githubSecret:
        toText(incoming.socialLogin.githubSecret, "") || existing.socialLogin.githubSecret,
      facebookSecret:
        toText(incoming.socialLogin.facebookSecret, "") || existing.socialLogin.facebookSecret,
    },
  });
};

export const ensureSettingsTable = async () => {
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

export const getPersistedStoreSettings = async () => {
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

export const upsertStoreSettings = async (settings: unknown) => {
  const value = JSON.stringify(sanitizeStoreSettings(settings));
  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES (:key, :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`value\` = VALUES(\`value\`),
        updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { key: STORE_SETTINGS_KEY, value },
    }
  );
};

export const buildStoreSettingsContracts = (rawSettings: unknown) => {
  const settings = sanitizeStoreSettings(rawSettings);

  const stripeKey = toText(settings.payments.stripeKey, "");
  const stripeSecret = toText(settings.payments.stripeSecret, "");
  const stripeWebhookSecret = toText(settings.payments.stripeWebhookSecret, "");
  const stripeMissingFields = [];
  const stripeInvalidFields = [];
  if (!stripeKey) stripeMissingFields.push("stripeKey");
  if (!stripeSecret) stripeMissingFields.push("stripeSecret");
  if (stripeKey && !STRIPE_PUBLISHABLE_KEY_REGEX.test(stripeKey)) {
    stripeInvalidFields.push("stripeKey");
  }
  if (stripeSecret && !STRIPE_SECRET_KEY_REGEX.test(stripeSecret)) {
    stripeInvalidFields.push("stripeSecret");
  }
  const stripeConfigured = Boolean(stripeKey && stripeSecret);
  const stripeValid = stripeConfigured && stripeInvalidFields.length === 0;
  const stripeEffectiveEnabled =
    Boolean(settings.payments.stripeEnabled) &&
    stripeValid &&
    PAYMENT_RUNTIME_SUPPORTED.STRIPE;
  const stripeStatus = buildStatus({
    requestedEnabled: settings.payments.stripeEnabled,
    configured: stripeConfigured,
    valid: stripeValid,
    effectiveEnabled: stripeEffectiveEnabled,
    runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.STRIPE,
    missingFields: stripeMissingFields,
    invalidFields: stripeInvalidFields,
    configuredButUnavailableLabel: "Configured, runtime unavailable",
  });
  const stripeWebhookMissingFields = [];
  const stripeWebhookInvalidFields = [];
  if (!stripeWebhookSecret) stripeWebhookMissingFields.push("stripeWebhookSecret");
  if (
    stripeWebhookSecret &&
    !STRIPE_WEBHOOK_SECRET_REGEX.test(stripeWebhookSecret)
  ) {
    stripeWebhookInvalidFields.push("stripeWebhookSecret");
  }
  const stripeWebhookConfigured = Boolean(stripeWebhookSecret);
  const stripeWebhookValid =
    stripeWebhookConfigured && stripeWebhookInvalidFields.length === 0;
  const stripeWebhookEffectiveEnabled =
    stripeEffectiveEnabled && stripeWebhookValid && PAYMENT_RUNTIME_SUPPORTED.STRIPE;
  const stripeWebhookStatus = buildStatus({
    requestedEnabled: Boolean(settings.payments.stripeEnabled),
    configured: stripeWebhookConfigured,
    valid: stripeWebhookValid,
    effectiveEnabled: stripeWebhookEffectiveEnabled,
    runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.STRIPE,
    missingFields: stripeWebhookMissingFields,
    invalidFields: stripeWebhookInvalidFields,
    readyLabel: "Ready for webhook verification",
  });

  const razorPayKeyId = toText(settings.payments.razorPayKeyId, "");
  const razorPayKeySecret = toText(settings.payments.razorPayKeySecret, "");
  const razorPayMissingFields = [];
  const razorPayInvalidFields = [];
  if (!razorPayKeyId) razorPayMissingFields.push("razorPayKeyId");
  if (!razorPayKeySecret) razorPayMissingFields.push("razorPayKeySecret");
  if (razorPayKeyId && !RAZORPAY_KEY_ID_REGEX.test(razorPayKeyId)) {
    razorPayInvalidFields.push("razorPayKeyId");
  }
  if (razorPayKeySecret && !RAZORPAY_SECRET_REGEX.test(razorPayKeySecret)) {
    razorPayInvalidFields.push("razorPayKeySecret");
  }
  const razorPayConfigured = Boolean(razorPayKeyId && razorPayKeySecret);
  const razorPayValid = razorPayConfigured && razorPayInvalidFields.length === 0;
  const razorPayEffectiveEnabled =
    Boolean(settings.payments.razorPayEnabled) &&
    razorPayValid &&
    PAYMENT_RUNTIME_SUPPORTED.RAZORPAY;
  const razorPayStatus = buildStatus({
    requestedEnabled: settings.payments.razorPayEnabled,
    configured: razorPayConfigured,
    valid: razorPayValid,
    effectiveEnabled: razorPayEffectiveEnabled,
    runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.RAZORPAY,
    missingFields: razorPayMissingFields,
    invalidFields: razorPayInvalidFields,
    configuredButUnavailableLabel: "Configured, runtime unavailable",
  });

  const cashOnDeliveryStatus = buildStatus({
    requestedEnabled: settings.payments.cashOnDeliveryEnabled,
    configured: true,
    valid: true,
    effectiveEnabled: Boolean(settings.payments.cashOnDeliveryEnabled),
    runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.COD,
  });

  const buildSocialProvider = (
    code: "google" | "github" | "facebook",
    enabled: boolean,
    clientId: string,
    secret: string
  ) => {
    const missingFields = [];
    if (!clientId) missingFields.push("clientId");
    if (!secret) missingFields.push("secret");
    const configured = Boolean(clientId && secret);
    const runtimeSupported = SOCIAL_RUNTIME_SUPPORTED[code];
    const effectiveEnabled = enabled && configured && runtimeSupported;
    const status = buildStatus({
      requestedEnabled: enabled,
      configured,
      valid: configured,
      effectiveEnabled,
      runtimeSupported,
      missingFields,
      configuredButUnavailableLabel: "Configured, runtime unavailable",
    });

    return {
      requestedEnabled: Boolean(enabled),
      configured,
      valid: configured,
      runtimeSupported,
      effectiveEnabled,
      clientIdConfigured: Boolean(clientId),
      secretConfigured: Boolean(secret),
      secretMask: maskSecret(secret),
      status,
    };
  };

  const googleAnalyticsKey = toText(settings.analytics.googleAnalyticKey, "");
  const normalizedAnalyticsKey = normalizeGoogleAnalyticsKey(googleAnalyticsKey);
  const analyticsMissingFields = [];
  const analyticsInvalidFields = [];
  if (!googleAnalyticsKey) analyticsMissingFields.push("googleAnalyticKey");
  if (googleAnalyticsKey && !normalizedAnalyticsKey) {
    analyticsInvalidFields.push("googleAnalyticKey");
  }
  const analyticsConfigured = Boolean(googleAnalyticsKey);
  const analyticsValid = Boolean(normalizedAnalyticsKey);
  const analyticsEffectiveEnabled =
    Boolean(settings.analytics.googleAnalyticsEnabled) && analyticsValid;
  const analyticsStatus = buildStatus({
    requestedEnabled: settings.analytics.googleAnalyticsEnabled,
    configured: analyticsConfigured,
    valid: analyticsValid,
    effectiveEnabled: analyticsEffectiveEnabled,
    runtimeSupported: true,
    missingFields: analyticsMissingFields,
    invalidFields: analyticsInvalidFields,
  });

  const tawkPropertyId = toText(settings.chat.tawkPropertyId, "");
  const tawkWidgetId = toText(settings.chat.tawkWidgetId, "");
  const normalizedTawkPropertyId = normalizeTawkId(tawkPropertyId);
  const normalizedTawkWidgetId = normalizeTawkId(tawkWidgetId);
  const tawkMissingFields = [];
  const tawkInvalidFields = [];
  if (!tawkPropertyId) tawkMissingFields.push("tawkPropertyId");
  if (!tawkWidgetId) tawkMissingFields.push("tawkWidgetId");
  if (tawkPropertyId && !normalizedTawkPropertyId) {
    tawkInvalidFields.push("tawkPropertyId");
  }
  if (tawkWidgetId && !normalizedTawkWidgetId) {
    tawkInvalidFields.push("tawkWidgetId");
  }
  const tawkConfigured = Boolean(tawkPropertyId && tawkWidgetId);
  const tawkValid = Boolean(normalizedTawkPropertyId && normalizedTawkWidgetId);
  const tawkEffectiveEnabled = Boolean(settings.chat.tawkEnabled) && tawkValid;
  const tawkStatus = buildStatus({
    requestedEnabled: settings.chat.tawkEnabled,
    configured: tawkConfigured,
    valid: tawkValid,
    effectiveEnabled: tawkEffectiveEnabled,
    runtimeSupported: true,
    missingFields: tawkMissingFields,
    invalidFields: tawkInvalidFields,
  });

  const availableMethods = [];
  if (Boolean(settings.payments.cashOnDeliveryEnabled)) {
    availableMethods.push({
      code: "COD",
      label: "Cash on Delivery",
      description: "Pay when your order arrives.",
    });
  }
  if (stripeEffectiveEnabled) {
    availableMethods.push({
      code: "STRIPE",
      label: "Stripe",
      description: "Pay securely with card via Stripe Checkout.",
    });
  }

  const fatalIssues = [];
  for (const field of [
    ...stripeInvalidFields,
    ...stripeWebhookInvalidFields,
    ...razorPayInvalidFields,
  ]) {
    fatalIssues.push({
      section: "payments",
      field,
      message: `${field} format is invalid.`,
    });
  }
  for (const field of analyticsInvalidFields) {
    fatalIssues.push({
      section: "analytics",
      field,
      message: `${field} format is invalid.`,
    });
  }
  for (const field of tawkInvalidFields) {
    fatalIssues.push({
      section: "chat",
      field,
      message: `${field} format is invalid.`,
    });
  }

  return {
    persisted: settings,
    admin: {
      storeSettings: {
        ...settings,
        payments: {
          ...settings.payments,
          stripeSecret: "",
          stripeWebhookSecret: "",
          razorPayKeySecret: "",
        },
        socialLogin: {
          ...settings.socialLogin,
          googleSecretKey: "",
          githubSecret: "",
          facebookSecret: "",
        },
      },
      diagnostics: {
        payments: {
          checkout: {
            availableMethods,
            availableMethodCodes: availableMethods.map((method) => method.code),
          },
          cashOnDelivery: {
            requestedEnabled: Boolean(settings.payments.cashOnDeliveryEnabled),
            effectiveEnabled: Boolean(settings.payments.cashOnDeliveryEnabled),
            runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.COD,
            status: cashOnDeliveryStatus,
          },
          stripe: {
            requestedEnabled: Boolean(settings.payments.stripeEnabled),
            configured: stripeConfigured,
            valid: stripeValid,
            runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.STRIPE,
            effectiveEnabled: stripeEffectiveEnabled,
            publicKeyConfigured: Boolean(stripeKey),
            secretConfigured: Boolean(stripeSecret),
            secretMask: maskSecret(stripeSecret),
            status: stripeStatus,
          },
          stripeWebhook: {
            requestedEnabled: Boolean(settings.payments.stripeEnabled),
            configured: stripeWebhookConfigured,
            valid: stripeWebhookValid,
            runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.STRIPE,
            effectiveEnabled: stripeWebhookEffectiveEnabled,
            secretConfigured: Boolean(stripeWebhookSecret),
            secretMask: maskSecret(stripeWebhookSecret),
            status: stripeWebhookStatus,
          },
          razorpay: {
            requestedEnabled: Boolean(settings.payments.razorPayEnabled),
            configured: razorPayConfigured,
            valid: razorPayValid,
            runtimeSupported: PAYMENT_RUNTIME_SUPPORTED.RAZORPAY,
            effectiveEnabled: razorPayEffectiveEnabled,
            keyIdConfigured: Boolean(razorPayKeyId),
            secretConfigured: Boolean(razorPayKeySecret),
            secretMask: maskSecret(razorPayKeySecret),
            status: razorPayStatus,
          },
        },
        socialLogin: {
          google: buildSocialProvider(
            "google",
            Boolean(settings.socialLogin.googleEnabled),
            toText(settings.socialLogin.googleClientId, ""),
            toText(settings.socialLogin.googleSecretKey, "")
          ),
          github: buildSocialProvider(
            "github",
            Boolean(settings.socialLogin.githubEnabled),
            toText(settings.socialLogin.githubId, ""),
            toText(settings.socialLogin.githubSecret, "")
          ),
          facebook: buildSocialProvider(
            "facebook",
            Boolean(settings.socialLogin.facebookEnabled),
            toText(settings.socialLogin.facebookId, ""),
            toText(settings.socialLogin.facebookSecret, "")
          ),
        },
        analytics: {
          googleAnalytics: {
            requestedEnabled: Boolean(settings.analytics.googleAnalyticsEnabled),
            configured: analyticsConfigured,
            valid: analyticsValid,
            effectiveEnabled: analyticsEffectiveEnabled,
            status: analyticsStatus,
          },
        },
        chat: {
          tawk: {
            requestedEnabled: Boolean(settings.chat.tawkEnabled),
            configured: tawkConfigured,
            valid: tawkValid,
            effectiveEnabled: tawkEffectiveEnabled,
            status: tawkStatus,
          },
        },
        validation: {
          fatalIssues,
        },
      },
    },
    public: {
      storeSettings: {
        payments: {
          cashOnDeliveryEnabled: Boolean(settings.payments.cashOnDeliveryEnabled),
          stripeEnabled: stripeEffectiveEnabled,
          razorPayEnabled: razorPayEffectiveEnabled,
          stripeKey: stripeEffectiveEnabled ? stripeKey : "",
          razorPayKeyId: razorPayEffectiveEnabled ? razorPayKeyId : "",
          methods: availableMethods,
        },
        socialLogin: {
          googleEnabled: false,
          githubEnabled: false,
          facebookEnabled: false,
          googleClientId: "",
          githubId: "",
          facebookId: "",
        },
        analytics: {
          googleAnalyticsEnabled: analyticsEffectiveEnabled,
          googleAnalyticKey: analyticsEffectiveEnabled ? normalizedAnalyticsKey : "",
        },
        chat: {
          tawkEnabled: tawkEffectiveEnabled,
          tawkPropertyId: tawkEffectiveEnabled ? normalizedTawkPropertyId : "",
          tawkWidgetId: tawkEffectiveEnabled ? normalizedTawkWidgetId : "",
        },
        branding: {
          clientLogoUrl: toText(settings.branding.clientLogoUrl, ""),
          adminLogoUrl: toText(settings.branding.adminLogoUrl, ""),
          sellerLogoUrl: toText(settings.branding.sellerLogoUrl, ""),
          adminLoginHeroUrl: toText(settings.branding.adminLoginHeroUrl, ""),
          adminForgotPasswordHeroUrl: toText(settings.branding.adminForgotPasswordHeroUrl, ""),
          adminCreateAccountHeroUrl: toText(settings.branding.adminCreateAccountHeroUrl, ""),
          workspaceBrandName: toText(settings.branding.workspaceBrandName, "TP PRENEURS"),
        },
      },
    },
  };
};

export const getAvailableCheckoutPaymentMethods = (rawSettings: unknown) => {
  const contracts = buildStoreSettingsContracts(rawSettings);
  return Array.isArray(contracts.admin.diagnostics.payments.checkout.availableMethods)
    ? contracts.admin.diagnostics.payments.checkout.availableMethods
    : [];
};

export const getStripeRuntimeConfig = (rawSettings: unknown) => {
  const settings = sanitizeStoreSettings(rawSettings);
  const stripeKey = toText(settings.payments.stripeKey, "");
  const stripeSecret = toText(settings.payments.stripeSecret, "");
  const valid =
    Boolean(settings.payments.stripeEnabled) &&
    STRIPE_PUBLISHABLE_KEY_REGEX.test(stripeKey) &&
    STRIPE_SECRET_KEY_REGEX.test(stripeSecret);

  return {
    enabled: valid && PAYMENT_RUNTIME_SUPPORTED.STRIPE,
    publishableKey: stripeKey,
    secretKey: stripeSecret,
    currency: "idr" as const,
  };
};

export const getStripeWebhookConfig = (rawSettings: unknown) => {
  const settings = sanitizeStoreSettings(rawSettings);
  const signingSecret = toText(settings.payments.stripeWebhookSecret, "");
  return {
    enabled: STRIPE_WEBHOOK_SECRET_REGEX.test(signingSecret),
    signingSecret,
  };
};

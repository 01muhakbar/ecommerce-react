import { z } from "zod";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const normalizeNullableText = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const nullableStringField = (max: number) =>
  z.preprocess(normalizeNullableText, z.string().max(max).nullable().optional());

const nullablePhoneField = (label: string) =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(64)
      .regex(/^[0-9+().\-\s]{6,64}$/, {
        message: `${label} format is invalid.`,
      })
      .nullable()
      .optional()
  );

const nullablePostalCodeField = () =>
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(32)
      .regex(/^[A-Z0-9\- ]{3,32}$/i, {
        message: "Postal code format is invalid.",
      })
      .nullable()
      .optional()
  );

const SHIPPING_SETUP_FIELD_LABELS: Record<string, string> = {
  shippingEnabled: "Shipping enabled",
  originContactName: "Origin contact name",
  originPhone: "Origin phone",
  originAddressLine1: "Origin address line 1",
  originAddressLine2: "Origin address line 2",
  originDistrict: "Origin district",
  originCity: "Origin city",
  originProvince: "Origin province",
  originPostalCode: "Origin postal code",
  originCountry: "Origin country",
  pickupNotes: "Pickup notes",
};

export const SELLER_SHIPPING_SETUP_REQUIRED_FIELDS = [
  { key: "originContactName", label: SHIPPING_SETUP_FIELD_LABELS.originContactName },
  { key: "originPhone", label: SHIPPING_SETUP_FIELD_LABELS.originPhone },
  { key: "originAddressLine1", label: SHIPPING_SETUP_FIELD_LABELS.originAddressLine1 },
  { key: "originCity", label: SHIPPING_SETUP_FIELD_LABELS.originCity },
  { key: "originProvince", label: SHIPPING_SETUP_FIELD_LABELS.originProvince },
  { key: "originPostalCode", label: SHIPPING_SETUP_FIELD_LABELS.originPostalCode },
  { key: "originCountry", label: SHIPPING_SETUP_FIELD_LABELS.originCountry },
] as const;

export const sellerShippingSetupPatchSchema = z
  .object({
    shippingEnabled: z.boolean().optional(),
    originContactName: nullableStringField(160),
    originPhone: nullablePhoneField("Origin phone"),
    originAddressLine1: nullableStringField(255),
    originAddressLine2: nullableStringField(255),
    originDistrict: nullableStringField(120),
    originCity: nullableStringField(120),
    originProvince: nullableStringField(120),
    originPostalCode: nullablePostalCodeField(),
    originCountry: nullableStringField(120),
    pickupNotes: nullableStringField(500),
  })
  .strict();

const normalizeStoredShippingSetup = (value: unknown) => {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const shippingEnabledRaw = source.shippingEnabled;

  return {
    shippingEnabled:
      typeof shippingEnabledRaw === "boolean" ? shippingEnabledRaw : undefined,
    originContactName:
      typeof normalizeNullableText(source.originContactName) === "string"
        ? String(normalizeNullableText(source.originContactName))
        : null,
    originPhone:
      typeof normalizeNullableText(source.originPhone) === "string"
        ? String(normalizeNullableText(source.originPhone))
        : null,
    originAddressLine1:
      typeof normalizeNullableText(source.originAddressLine1) === "string"
        ? String(normalizeNullableText(source.originAddressLine1))
        : null,
    originAddressLine2:
      typeof normalizeNullableText(source.originAddressLine2) === "string"
        ? String(normalizeNullableText(source.originAddressLine2))
        : null,
    originDistrict:
      typeof normalizeNullableText(source.originDistrict) === "string"
        ? String(normalizeNullableText(source.originDistrict))
        : null,
    originCity:
      typeof normalizeNullableText(source.originCity) === "string"
        ? String(normalizeNullableText(source.originCity))
        : null,
    originProvince:
      typeof normalizeNullableText(source.originProvince) === "string"
        ? String(normalizeNullableText(source.originProvince))
        : null,
    originPostalCode:
      typeof normalizeNullableText(source.originPostalCode) === "string"
        ? String(normalizeNullableText(source.originPostalCode))
        : null,
    originCountry:
      typeof normalizeNullableText(source.originCountry) === "string"
        ? String(normalizeNullableText(source.originCountry))
        : null,
    pickupNotes:
      typeof normalizeNullableText(source.pickupNotes) === "string"
        ? String(normalizeNullableText(source.pickupNotes))
        : null,
  };
};

export const mergeSellerShippingSetupPatch = (
  currentValue: unknown,
  patchValue: unknown
) => {
  const current = normalizeStoredShippingSetup(currentValue);
  const patch =
    patchValue && typeof patchValue === "object" && !Array.isArray(patchValue)
      ? (patchValue as Record<string, unknown>)
      : {};

  return normalizeStoredShippingSetup({
    ...current,
    ...patch,
  });
};

const pickEffectiveText = (
  storedValue: unknown,
  fallbackValue: unknown
): { value: string | null; usesFallback: boolean } => {
  const explicit = normalizeNullableText(storedValue);
  if (typeof explicit === "string") {
    return {
      value: explicit,
      usesFallback: false,
    };
  }

  const fallback = normalizeNullableText(fallbackValue);
  return {
    value: typeof fallback === "string" ? fallback : null,
    usesFallback: typeof fallback === "string",
  };
};

const formatAddressLine = (parts: unknown[]) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

export const buildStoreShippingSetupReadiness = (store: any) => {
  const storedSetup = normalizeStoredShippingSetup(getAttr(store, "shippingSetup"));
  const shippingEnabled =
    typeof storedSetup.shippingEnabled === "boolean" ? storedSetup.shippingEnabled : true;

  const effectiveContactName = pickEffectiveText(
    storedSetup.originContactName,
    getAttr(store, "name")
  );
  const effectivePhone = pickEffectiveText(
    storedSetup.originPhone,
    getAttr(store, "phone") || getAttr(store, "whatsapp")
  );
  const effectiveAddressLine1 = pickEffectiveText(
    storedSetup.originAddressLine1,
    getAttr(store, "addressLine1")
  );
  const effectiveAddressLine2 = pickEffectiveText(
    storedSetup.originAddressLine2,
    getAttr(store, "addressLine2")
  );
  const effectiveDistrict = pickEffectiveText(storedSetup.originDistrict, null);
  const effectiveCity = pickEffectiveText(storedSetup.originCity, getAttr(store, "city"));
  const effectiveProvince = pickEffectiveText(
    storedSetup.originProvince,
    getAttr(store, "province")
  );
  const effectivePostalCode = pickEffectiveText(
    storedSetup.originPostalCode,
    getAttr(store, "postalCode")
  );
  const effectiveCountry = pickEffectiveText(
    storedSetup.originCountry,
    getAttr(store, "country")
  );
  const effectivePickupNotes = pickEffectiveText(storedSetup.pickupNotes, null);

  const effectiveValues = {
    shippingEnabled,
    explicitShippingEnabled:
      typeof storedSetup.shippingEnabled === "boolean" ? storedSetup.shippingEnabled : null,
    originContactName: effectiveContactName.value,
    originPhone: effectivePhone.value,
    originAddressLine1: effectiveAddressLine1.value,
    originAddressLine2: effectiveAddressLine2.value,
    originDistrict: effectiveDistrict.value,
    originCity: effectiveCity.value,
    originProvince: effectiveProvince.value,
    originPostalCode: effectivePostalCode.value,
    originCountry: effectiveCountry.value,
    pickupNotes: effectivePickupNotes.value,
  };

  const fallbackFields = [
    effectiveContactName.usesFallback ? "originContactName" : null,
    effectivePhone.usesFallback ? "originPhone" : null,
    effectiveAddressLine1.usesFallback ? "originAddressLine1" : null,
    effectiveAddressLine2.usesFallback ? "originAddressLine2" : null,
    effectiveCity.usesFallback ? "originCity" : null,
    effectiveProvince.usesFallback ? "originProvince" : null,
    effectivePostalCode.usesFallback ? "originPostalCode" : null,
    effectiveCountry.usesFallback ? "originCountry" : null,
  ]
    .filter(Boolean)
    .map((key) => ({
      key: String(key),
      label: SHIPPING_SETUP_FIELD_LABELS[String(key)] || String(key),
    }));

  const missingShippingFields = SELLER_SHIPPING_SETUP_REQUIRED_FIELDS.filter(
    (field) => !String((effectiveValues as any)[field.key] || "").trim()
  ).map((field) => ({
    key: field.key,
    label: field.label,
  }));

  let shippingSetupStatus = {
    code: "READY",
    label: "Ready",
    tone: "emerald",
    description:
      "Store shipping origin defaults are complete enough for seller shipment operations.",
  };
  let shippingSetupMeta = {
    severity: "success",
    message:
      "Shipping setup is ready. Seller shipment lanes can reuse this store-scoped origin snapshot.",
    hints: [] as string[],
    usesStoreProfileFallback: fallbackFields.length > 0,
    fallbackFields,
    sourceOfTruth:
      "Backend store shipping setup merges store-scoped overrides with store profile fallback fields.",
    operationalBoundary:
      "This setup prepares seller shipping origin data only. It does not replace buyer shipping address truth or payment/order governance.",
  };

  if (!shippingEnabled) {
    shippingSetupStatus = {
      code: "DISABLED",
      label: "Disabled",
      tone: "stone",
      description:
        "Seller has disabled shipping setup for this store, so shipment operations should stay blocked here.",
    };
    shippingSetupMeta = {
      ...shippingSetupMeta,
      severity: "info",
      message:
        "Shipping setup is disabled for this store. Re-enable it before using shipment operations.",
      hints: [
        "Turn shipping on again when the origin contact and pickup address are ready.",
      ],
    };
  } else if (missingShippingFields.length > 0) {
    shippingSetupStatus = {
      code: "INCOMPLETE",
      label: "Incomplete",
      tone: "amber",
      description:
        "Some required shipping origin fields are still missing. Seller shipment operations should not rely on this store setup yet.",
    };
    shippingSetupMeta = {
      ...shippingSetupMeta,
      severity: "warning",
      message:
        "Complete the missing shipping setup fields before relying on seller shipment operations.",
      hints: [
        "Use the store profile address as a fallback or provide shipping-specific origin overrides.",
      ],
    };
  } else if (fallbackFields.length > 0) {
    shippingSetupMeta = {
      ...shippingSetupMeta,
      message:
        "Shipping setup is ready. Some fields still fall back to the store profile snapshot.",
      hints: [
        "Override fallback fields here if shipping origin details need to differ from the public store profile.",
      ],
    };
  }

  const originAddressLine = formatAddressLine([
    effectiveValues.originAddressLine1,
    effectiveValues.originAddressLine2,
    effectiveValues.originDistrict,
    effectiveValues.originCity,
    effectiveValues.originProvince,
    effectiveValues.originPostalCode,
    effectiveValues.originCountry,
  ]);

  return {
    shippingSetup: effectiveValues,
    shippingSetupStatus,
    shippingSetupMeta,
    isShippingReady: shippingEnabled && missingShippingFields.length === 0,
    missingShippingFields,
    shippingSetupSummary: {
      shippingEnabled,
      originContactName: effectiveValues.originContactName,
      originPhone: effectiveValues.originPhone,
      originAddressLine: originAddressLine || null,
      pickupNotes: effectiveValues.pickupNotes,
      usesStoreProfileFallback: fallbackFields.length > 0,
      fallbackFields,
    },
  };
};

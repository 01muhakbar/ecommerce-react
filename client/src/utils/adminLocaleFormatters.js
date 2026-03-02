const DEFAULT_LOCALE_SETTINGS = {
  defaultCurrency: "IDR",
  defaultTimeZone: "Asia/Makassar",
  defaultDateFormat: "D MMM, YYYY",
};

const LOCALE_BY_LANGUAGE = {
  id: "id-ID",
  en: "en-US",
  ar: "ar-SA",
  de: "de-DE",
  fr: "fr-FR",
  ur: "ur-PK",
  bn: "bn-BD",
  hi: "hi-IN",
};

const toSafeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const normalizeSettings = (settings = {}) => ({
  defaultCurrency: toSafeString(
    settings?.defaultCurrency,
    DEFAULT_LOCALE_SETTINGS.defaultCurrency
  ).toUpperCase(),
  defaultTimeZone: toSafeString(
    settings?.defaultTimeZone,
    DEFAULT_LOCALE_SETTINGS.defaultTimeZone
  ),
  defaultDateFormat: toSafeString(
    settings?.defaultDateFormat,
    DEFAULT_LOCALE_SETTINGS.defaultDateFormat
  ),
});

const normalizeRupiahDisplay = (formattedValue) =>
  String(formattedValue || "")
    .replace(/\bIDR\b/gi, "Rp")
    .replace(/Rp(?=\S)/g, "Rp ")
    .replace(/\s+/g, " ")
    .trim();

export const getLocale = (languageIso = "en") => {
  const normalized = toSafeString(languageIso, "en").toLowerCase().trim();
  return LOCALE_BY_LANGUAGE[normalized] || "en-US";
};

export const getAdminLanguageIso = () => {
  try {
    const raw = localStorage.getItem("adminLanguage");
    if (!raw) return "en";
    const parsed = JSON.parse(raw);
    const iso = toSafeString(parsed?.isoCode || "en").toLowerCase().trim();
    return iso || "en";
  } catch {
    return "en";
  }
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getDateParts = (date, locale, timeZone) => {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return {
    day: lookup.day || "01",
    month: lookup.month || "01",
    year: lookup.year || "1970",
  };
};

const formatDateByPattern = (date, pattern, locale, timeZone) => {
  if (pattern === "D MMM, YYYY") {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  if (pattern === "DD/MM/YYYY") {
    const { day, month, year } = getDateParts(date, locale, timeZone);
    return `${day}/${month}/${year}`;
  }

  if (pattern === "YYYY-MM-DD") {
    const { day, month, year } = getDateParts(date, locale, timeZone);
    return `${year}-${month}-${day}`;
  }

  if (pattern === "MMM D, YYYY") {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export const formatMoney = (amount, settings, language) => {
  const locale = getLocale(language);
  const { defaultCurrency } = normalizeSettings(settings);
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;
  const moneyLocale = defaultCurrency === "IDR" ? "id-ID" : locale;

  const formatterOptions = {
    style: "currency",
    currency: defaultCurrency,
  };

  if (defaultCurrency === "IDR") {
    formatterOptions.minimumFractionDigits = 0;
    formatterOptions.maximumFractionDigits = 0;
  }

  try {
    const formatted = new Intl.NumberFormat(moneyLocale, formatterOptions).format(
      safeValue
    );
    if (defaultCurrency === "IDR") {
      return normalizeRupiahDisplay(formatted);
    }
    return formatted;
  } catch {
    if (defaultCurrency === "IDR") {
      return normalizeRupiahDisplay(`Rp ${safeValue.toLocaleString("id-ID")}`);
    }
    return `${defaultCurrency} ${safeValue.toLocaleString(locale)}`;
  }
};

export const formatDateTime = (value, settings, language, options = {}) => {
  const locale = getLocale(language);
  const { defaultTimeZone, defaultDateFormat } = normalizeSettings(settings);
  const date = toDate(value);
  if (!date) return "-";

  const includeTime = options?.includeTime !== false;
  const dateText = formatDateByPattern(date, defaultDateFormat, locale, defaultTimeZone);
  if (!includeTime) return dateText;

  const timeText = new Intl.DateTimeFormat(locale, {
    timeZone: defaultTimeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${dateText}, ${timeText}`;
};

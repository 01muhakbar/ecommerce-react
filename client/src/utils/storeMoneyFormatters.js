const DEFAULT_STORE_CURRENCY = "IDR";
const DEFAULT_STORE_LOCALE = "id-ID";
const STORE_CURRENCY_STORAGE_KEY = "storeCurrencyCode";

const LOCALE_BY_CURRENCY = {
  IDR: "id-ID",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  SGD: "en-SG",
};

const normalizeRupiahDisplay = (formattedValue) =>
  String(formattedValue || "")
    .replace(/\bIDR\b/gi, "Rp")
    .replace(/Rp(?=\S)/g, "Rp ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCurrency = (value) => {
  if (!value) return DEFAULT_STORE_CURRENCY;
  return String(value).trim().toUpperCase() || DEFAULT_STORE_CURRENCY;
};

export const getStoreCurrencyCode = () => {
  if (typeof window === "undefined") return DEFAULT_STORE_CURRENCY;

  try {
    const raw = window.localStorage.getItem(STORE_CURRENCY_STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_CURRENCY;
    return normalizeCurrency(raw);
  } catch {
    return DEFAULT_STORE_CURRENCY;
  }
};

export const getStoreLocale = (currencyCode = DEFAULT_STORE_CURRENCY) => {
  const normalizedCurrency = normalizeCurrency(currencyCode);
  return LOCALE_BY_CURRENCY[normalizedCurrency] || DEFAULT_STORE_LOCALE;
};

export const formatStoreMoney = (
  amount,
  currencyCode = getStoreCurrencyCode()
) => {
  const normalizedCurrency = normalizeCurrency(currencyCode);
  const locale = getStoreLocale(normalizedCurrency);
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "--";

  const formatterOptions = {
    style: "currency",
    currency: normalizedCurrency,
  };

  if (normalizedCurrency === "IDR") {
    formatterOptions.minimumFractionDigits = 0;
    formatterOptions.maximumFractionDigits = 0;
  }

  try {
    const formatted = new Intl.NumberFormat(locale, formatterOptions).format(
      numeric
    );
    if (normalizedCurrency !== "IDR") return formatted;
    return normalizeRupiahDisplay(formatted);
  } catch {
    if (normalizedCurrency === "IDR") {
      return normalizeRupiahDisplay(`Rp ${numeric.toLocaleString("id-ID")}`);
    }
    return `${normalizedCurrency} ${numeric.toLocaleString(locale)}`;
  }
};

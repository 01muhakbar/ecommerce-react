import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminSettings } from "../lib/adminApi.js";
import {
  formatDateTime as formatDateTimeBase,
  formatMoney as formatMoneyBase,
  getAdminLanguageIso,
} from "../utils/adminLocaleFormatters.js";

const DEFAULT_LOCALE_SETTINGS = {
  defaultCurrency: "IDR",
  defaultTimeZone: "Asia/Makassar",
  defaultDateFormat: "D MMM, YYYY",
};

export default function useAdminLocale() {
  const [languageIso] = useState(() => getAdminLanguageIso());

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchAdminSettings,
    staleTime: 60_000,
  });

  const settings = settingsQuery.data || DEFAULT_LOCALE_SETTINGS;

  const formatMoney = useMemo(
    () => (amount) => formatMoneyBase(amount, settings, languageIso),
    [settings, languageIso]
  );

  const formatDateTime = useMemo(
    () => (value, options) =>
      formatDateTimeBase(value, settings, languageIso, options),
    [settings, languageIso]
  );

  return {
    settings,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error ?? null,
    languageIso,
    formatMoney,
    formatDateTime,
  };
}

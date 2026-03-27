import { api } from "./axios";
import type {
  StoreCustomizationResponse,
  StoreHeaderCustomizationResponse,
  StoreMicrositeRichAboutResponse,
  StoreSettingsResponse,
} from "./store.types.ts";

export type {
  EffectiveStoreMicrositeRichAbout,
  PublicStoreSettings,
  StoreCustomizationResponse,
  StoreHeaderCustomization,
  StoreHeaderCustomizationResponse,
  StoreMicrositeRichAbout,
  StoreMicrositeRichAboutResponse,
  StoreSettingsResponse,
} from "./store.types.ts";

export const getStoreCustomization = async (params?: {
  lang?: string;
  include?: string;
}) => {
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const include = String(params?.include || "").trim();
  const query: Record<string, string> = { lang: normalizedLang };
  if (include) {
    query.include = include;
  }

  const { data } = await api.get<StoreCustomizationResponse>("/store/customization", {
    params: query,
  });
  return data;
};

export const fetchStoreCustomization = async (lang = "en") => {
  const normalizedLang = String(lang || "en").trim().toLowerCase() || "en";
  return getStoreCustomization({ lang: normalizedLang });
};

export const getStoreHeaderCustomization = async (params?: { lang?: string }) => {
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const { data } = await api.get<StoreHeaderCustomizationResponse>(
    "/store/customization/header",
    {
      params: { lang: normalizedLang },
    }
  );
  return data;
};

export const getStoreMicrositeRichAboutBySlug = async (
  slug: string,
  params?: { lang?: string }
) => {
  const normalizedSlug = String(slug || "").trim();
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const { data } = await api.get<StoreMicrositeRichAboutResponse>(
    `/store/customization/microsites/${encodeURIComponent(normalizedSlug)}/rich-about`,
    {
      params: { lang: normalizedLang },
    }
  );
  return data;
};

export const getStoreSettings = async () => {
  const { data } = await api.get<StoreSettingsResponse>("/store/settings");
  return data;
};

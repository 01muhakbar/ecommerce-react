import { api } from "./axios";
import type { PublicStoreIdentityResponse } from "./store.types.ts";

export type {
  PublicStoreIdentity,
  PublicStoreIdentityResponse,
} from "./store.types.ts";

export const getStorePublicIdentity = async () => {
  const { data } = await api.get<PublicStoreIdentityResponse>("/store/customization/identity");
  return data;
};

export const getStorePublicIdentityBySlug = async (slug: string) => {
  const normalizedSlug = String(slug || "").trim();
  const { data } = await api.get<PublicStoreIdentityResponse>(
    `/store/customization/identity/${encodeURIComponent(normalizedSlug)}`
  );
  return data;
};

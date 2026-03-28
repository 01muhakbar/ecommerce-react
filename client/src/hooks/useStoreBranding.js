import { useQuery } from "@tanstack/react-query";
import { getStoreSettings } from "../api/storeCustomizationPublic.ts";

const EMPTY_BRANDING = {
  clientLogoUrl: "",
  adminLogoUrl: "",
  sellerLogoUrl: "",
  workspaceBrandName: "TP PRENEURS",
};

export default function useStoreBranding(options = {}) {
  const query = useQuery({
    queryKey: ["store-settings", "public", "branding"],
    queryFn: getStoreSettings,
    staleTime: 60_000,
    retry: 1,
    ...options,
  });

  return {
    ...query,
    branding: query.data?.data?.storeSettings?.branding || EMPTY_BRANDING,
  };
}

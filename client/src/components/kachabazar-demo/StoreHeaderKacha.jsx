import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { useStoreCategories } from "../../hooks/useStoreCategories.ts";
import { useAuth } from "../../auth/useAuth.js";
import { getStoreHeaderCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { getStorePublicIdentity } from "../../api/public/storePublicIdentity.ts";
import {
  normalizePublicStoreIdentity,
  resolvePreferredText,
  toPreferredWhatsAppLink,
} from "../../utils/storePublicIdentity.ts";
import TopInfoBar from "./TopInfoBar.jsx";
import GreenHeaderBar from "./GreenHeaderBar.jsx";
import NavBar from "./NavBar.jsx";

const DEFAULT_HEADER_CONTENT = {
  headerText: "Need help?",
  phoneNumber: "+62 812 3456 7890",
  whatsAppLink: "",
  headerLogoUrl: "",
  updatedAt: "",
};

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const sanitizeHeaderBrandName = (value, fallback = "KACHA BAZAR") => {
  const normalized = toText(value, fallback);
  const lowered = normalized.toLowerCase();
  if (lowered === "super admin" || lowered === "super-admin" || lowered === "super_admin") {
    return fallback;
  }
  return normalized;
};

export default function StoreHeaderKacha({ onCartClick, publicIdentityOverride = null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const totalQty = useCartStore((state) => state.totalQty);
  const { data: categories, isLoading: categoriesLoading } = useStoreCategories();
  const { isAuthenticated } = useAuth() || {};
  const headerQuery = useQuery({
    queryKey: ["store-customization-header", "en"],
    queryFn: () => getStoreHeaderCustomization({ lang: "en" }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
  const publicIdentityQuery = useQuery({
    queryKey: ["store-public-identity"],
    queryFn: getStorePublicIdentity,
    enabled: !publicIdentityOverride,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  const [search, setSearch] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const hasHeaderPayload = Boolean(headerQuery.data?.data);
  const hasPublicIdentityPayload = Boolean(publicIdentityQuery.data?.data);
  const headerContent = useMemo(() => {
    const headerContentRaw = headerQuery.data?.data || {};
    if (!hasHeaderPayload) {
      return {
        headerText: "",
        phoneNumber: "",
        whatsAppLink: "",
        headerLogoUrl: "",
        updatedAt: "",
      };
    }
    return {
      headerText: toText(headerContentRaw.headerText, DEFAULT_HEADER_CONTENT.headerText),
      phoneNumber: toText(headerContentRaw.phoneNumber, DEFAULT_HEADER_CONTENT.phoneNumber),
      whatsAppLink: toText(
        headerContentRaw.whatsAppLink,
        DEFAULT_HEADER_CONTENT.whatsAppLink
      ),
      headerLogoUrl: toText(
        headerContentRaw.headerLogoUrl,
        DEFAULT_HEADER_CONTENT.headerLogoUrl
      ),
      updatedAt: toText(headerContentRaw.updatedAt, DEFAULT_HEADER_CONTENT.updatedAt),
    };
  }, [headerQuery.data, hasHeaderPayload]);
  const publicIdentity = useMemo(() => {
    if (publicIdentityOverride && typeof publicIdentityOverride === "object") {
      return normalizePublicStoreIdentity({ data: publicIdentityOverride });
    }
    return normalizePublicStoreIdentity(publicIdentityQuery.data);
  }, [publicIdentityOverride, publicIdentityQuery.data]);
  const resolvedBrandName = sanitizeHeaderBrandName(
    resolvePreferredText(publicIdentity.name, "", "KACHA BAZAR")
  );
  const resolvedPhoneNumber = publicIdentityOverride
    ? resolvePreferredText(publicIdentity.phone, headerContent.phoneNumber)
    : resolvePreferredText(headerContent.phoneNumber, publicIdentity.phone);
  const resolvedWhatsAppLink = publicIdentityOverride
    ? toPreferredWhatsAppLink(publicIdentity.whatsapp, headerContent.whatsAppLink)
    : toPreferredWhatsAppLink(headerContent.whatsAppLink, publicIdentity.whatsapp);
  const resolvedHeaderLogoUrl = publicIdentityOverride
    ? resolvePreferredText(publicIdentity.logoUrl, headerContent.headerLogoUrl)
    : resolvePreferredText(headerContent.headerLogoUrl, publicIdentity.logoUrl);
  const isIdentityLoading =
    !publicIdentityOverride &&
    !hasHeaderPayload &&
    !hasPublicIdentityPayload &&
    (headerQuery.isFetching || publicIdentityQuery.isFetching);
  const headerVersion = useMemo(() => {
    const versionSource = publicIdentityOverride
      ? resolvePreferredText(publicIdentity.updatedAt, headerContent.updatedAt)
      : resolvePreferredText(headerContent.updatedAt, publicIdentity.updatedAt);
    const parsed = Date.parse(versionSource);
    return Number.isFinite(parsed)
      ? String(parsed)
      : toText(versionSource);
  }, [headerContent.updatedAt, publicIdentity.updatedAt]);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-demo-dropdown]")) {
        setShowCategories(false);
        setShowPages(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const q = search.trim();
    if (!q) return;
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("page", "1");
    navigate(`/search?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="hidden sm:block">
        <TopInfoBar
          headerText={headerContent.headerText}
          phoneNumber={resolvedPhoneNumber}
          whatsAppLink={resolvedWhatsAppLink}
          isHeaderLoading={isIdentityLoading}
        />
      </div>
      <GreenHeaderBar
        search={search}
        setSearch={setSearch}
        onSubmit={handleSearchSubmit}
        totalQty={totalQty}
        isAuthenticated={Boolean(isAuthenticated)}
        onCartClick={onCartClick}
        brandName={resolvedBrandName}
        headerLogoUrl={resolvedHeaderLogoUrl}
        logoUpdatedAt={headerVersion}
        isHeaderLoading={isIdentityLoading}
      />
      <div className="hidden sm:block">
        <NavBar
          showCategories={showCategories}
          setShowCategories={setShowCategories}
          showPages={showPages}
          setShowPages={setShowPages}
          categories={categories}
          categoriesLoading={categoriesLoading}
        />
      </div>
    </header>
  );
}

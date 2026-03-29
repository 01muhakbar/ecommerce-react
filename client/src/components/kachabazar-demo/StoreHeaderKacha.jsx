import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";
import { useStoreCategories } from "../../hooks/useStoreCategories.ts";
import { useAuth } from "../../auth/useAuth.js";
import {
  getStoreCustomization,
  getStoreHeaderCustomization,
} from "../../api/public/storeCustomizationPublic.ts";
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
const DEFAULT_MENU_CONTENT = {
  labels: {
    categories: "Categories",
    aboutUs: "About Us",
    contactUs: "Contact Us",
    offers: "Offers",
    faq: "FAQ",
    privacyPolicy: "Privacy Policy",
    termsAndConditions: "Terms & Conditions",
    pages: "Pages",
    myAccount: "My Account",
    login: "Login",
    logout: "Logout",
    checkout: "Checkout",
  },
  enabled: {
    showCategories: true,
    showAboutUs: true,
    showContactUs: true,
    showOffers: true,
    showFaq: true,
    showPrivacyPolicy: true,
    showTermsAndConditions: true,
  },
};

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const sanitizeHeaderBrandName = (value, fallback = "KACHA BAZAR") => {
  const normalized = toText(value, fallback);
  const lowered = normalized.toLowerCase();
  if (lowered === "super admin" || lowered === "super-admin" || lowered === "super_admin") {
    return fallback;
  }
  return normalized;
};

export default function StoreHeaderKacha({
  onCartClick,
  publicIdentityOverride = null,
  brandingLogoUrl = "",
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const totalQty = useCartStore((state) => state.totalQty);
  const { data: categories, isLoading: categoriesLoading } = useStoreCategories();
  const { isAuthenticated } = useAuth() || {};
  const lang = "en";
  const headerQuery = useQuery({
    queryKey: ["store-customization-header", lang],
    queryFn: () => getStoreHeaderCustomization({ lang }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
  const homeCustomizationQuery = useQuery({
    queryKey: ["store-customization", "home-header", lang],
    queryFn: () => getStoreCustomization({ lang, include: "home" }),
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
  const hasHomeCustomizationPayload = Boolean(homeCustomizationQuery.data?.customization?.home);
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
  const menuContent = useMemo(() => {
    const menuEditor =
      homeCustomizationQuery.data?.customization?.home?.menuEditor || {};
    const labels =
      menuEditor.labels && typeof menuEditor.labels === "object" ? menuEditor.labels : {};
    const enabled =
      menuEditor.enabled && typeof menuEditor.enabled === "object" ? menuEditor.enabled : {};

    if (!hasHomeCustomizationPayload) {
      return DEFAULT_MENU_CONTENT;
    }

    return {
      labels: {
        categories: toText(labels.categories, DEFAULT_MENU_CONTENT.labels.categories),
        aboutUs: toText(labels.aboutUs, DEFAULT_MENU_CONTENT.labels.aboutUs),
        contactUs: toText(labels.contactUs, DEFAULT_MENU_CONTENT.labels.contactUs),
        offers: toText(labels.offers, DEFAULT_MENU_CONTENT.labels.offers),
        faq: toText(labels.faq, DEFAULT_MENU_CONTENT.labels.faq),
        privacyPolicy: toText(
          labels.privacyPolicy,
          DEFAULT_MENU_CONTENT.labels.privacyPolicy
        ),
        termsAndConditions: toText(
          labels.termsAndConditions,
          DEFAULT_MENU_CONTENT.labels.termsAndConditions
        ),
        pages: toText(labels.pages, DEFAULT_MENU_CONTENT.labels.pages),
        myAccount: toText(labels.myAccount, DEFAULT_MENU_CONTENT.labels.myAccount),
        login: toText(labels.login, DEFAULT_MENU_CONTENT.labels.login),
        logout: toText(labels.logout, DEFAULT_MENU_CONTENT.labels.logout),
        checkout: toText(labels.checkout, DEFAULT_MENU_CONTENT.labels.checkout),
      },
      enabled: {
        showCategories: toBool(
          enabled.showCategories,
          DEFAULT_MENU_CONTENT.enabled.showCategories
        ),
        showAboutUs: toBool(enabled.showAboutUs, DEFAULT_MENU_CONTENT.enabled.showAboutUs),
        showContactUs: toBool(
          enabled.showContactUs,
          DEFAULT_MENU_CONTENT.enabled.showContactUs
        ),
        showOffers: toBool(enabled.showOffers, DEFAULT_MENU_CONTENT.enabled.showOffers),
        showFaq: toBool(enabled.showFaq, DEFAULT_MENU_CONTENT.enabled.showFaq),
        showPrivacyPolicy: toBool(
          enabled.showPrivacyPolicy,
          DEFAULT_MENU_CONTENT.enabled.showPrivacyPolicy
        ),
        showTermsAndConditions: toBool(
          enabled.showTermsAndConditions,
          DEFAULT_MENU_CONTENT.enabled.showTermsAndConditions
        ),
      },
    };
  }, [hasHomeCustomizationPayload, homeCustomizationQuery.data]);
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
  const effectiveHeaderLogoUrl = resolvePreferredText(
    brandingLogoUrl,
    resolvedHeaderLogoUrl
  );
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
          menuLabels={menuContent.labels}
          menuEnabled={menuContent.enabled}
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
        headerLogoUrl={effectiveHeaderLogoUrl}
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
          menuLabels={menuContent.labels}
          menuEnabled={menuContent.enabled}
        />
      </div>
    </header>
  );
}

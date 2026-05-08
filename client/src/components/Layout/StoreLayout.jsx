import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Menu, ShoppingCart, UserRound } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import StoreHeaderKacha from "../kachabazar-demo/StoreHeaderKacha.jsx";
import FloatingCartWidget from "../kachabazar-demo/FloatingCartWidget.jsx";
import StoreFooterKacha from "../kachabazar-demo/StoreFooterKacha.jsx";
import { StoreCartDrawer } from "../../pages/store/StoreCartPage.jsx";
import { useCartStore } from "../../store/cart.store.ts";
import MobileMenuDrawer from "./MobileMenuDrawer.jsx";
import { formatCurrency } from "../../utils/format.js";
import {
  getStoreCustomization,
  getStoreSettings,
} from "../../api/public/storeCustomizationPublic.ts";

const DEFAULT_PUBLIC_STORE_SETTINGS = {
  payments: {
    cashOnDeliveryEnabled: false,
    stripeEnabled: false,
    razorPayEnabled: false,
    stripeKey: "",
    razorPayKeyId: "",
    methods: [],
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
    googleAnalyticsEnabled: false,
    googleAnalyticKey: "",
  },
  chat: {
    tawkEnabled: false,
    tawkPropertyId: "",
    tawkWidgetId: "",
  },
  branding: {
    clientLogoUrl: "",
    adminLogoUrl: "",
    sellerLogoUrl: "",
    workspaceBrandName: "TP PRENEURS",
  },
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

const normalizePublicStoreSettings = (raw) => {
  const source = isPlainObject(raw) ? raw : {};
  const payments = isPlainObject(source.payments) ? source.payments : {};
  const socialLogin = isPlainObject(source.socialLogin) ? source.socialLogin : {};
  const analytics = isPlainObject(source.analytics) ? source.analytics : {};
  const chat = isPlainObject(source.chat) ? source.chat : {};
  const branding = isPlainObject(source.branding) ? source.branding : {};

  return {
    payments: {
      cashOnDeliveryEnabled: toBool(
        payments.cashOnDeliveryEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.payments.cashOnDeliveryEnabled
      ),
      stripeEnabled: toBool(
        payments.stripeEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.payments.stripeEnabled
      ),
      razorPayEnabled: toBool(
        payments.razorPayEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.payments.razorPayEnabled
      ),
      stripeKey: toText(payments.stripeKey, ""),
      razorPayKeyId: toText(payments.razorPayKeyId, ""),
      methods: Array.isArray(payments.methods)
        ? payments.methods
            .map((method) => ({
              code: toText(method?.code, "").toUpperCase(),
              label: toText(method?.label, ""),
              description: toText(method?.description, ""),
            }))
            .filter((method) => method.code && method.label)
        : [
            ...(toBool(
              payments.cashOnDeliveryEnabled,
              DEFAULT_PUBLIC_STORE_SETTINGS.payments.cashOnDeliveryEnabled
            )
              ? [
                  {
                    code: "COD",
                    label: "Cash on Delivery",
                    description: "Pay when your order arrives.",
                  },
                ]
              : []),
          ],
    },
    socialLogin: {
      googleEnabled: toBool(
        socialLogin.googleEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.socialLogin.googleEnabled
      ),
      githubEnabled: toBool(
        socialLogin.githubEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.socialLogin.githubEnabled
      ),
      facebookEnabled: toBool(
        socialLogin.facebookEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.socialLogin.facebookEnabled
      ),
      googleClientId: toText(socialLogin.googleClientId, ""),
      githubId: toText(socialLogin.githubId, ""),
      facebookId: toText(socialLogin.facebookId, ""),
    },
    analytics: {
      googleAnalyticsEnabled: toBool(
        analytics.googleAnalyticsEnabled,
        DEFAULT_PUBLIC_STORE_SETTINGS.analytics.googleAnalyticsEnabled
      ),
      googleAnalyticKey: toText(analytics.googleAnalyticKey, ""),
    },
    chat: {
      tawkEnabled: toBool(chat.tawkEnabled, DEFAULT_PUBLIC_STORE_SETTINGS.chat.tawkEnabled),
      tawkPropertyId: toText(chat.tawkPropertyId, ""),
      tawkWidgetId: toText(chat.tawkWidgetId, ""),
    },
    branding: {
      clientLogoUrl: toText(
        branding.clientLogoUrl,
        DEFAULT_PUBLIC_STORE_SETTINGS.branding.clientLogoUrl
      ),
      adminLogoUrl: toText(
        branding.adminLogoUrl,
        DEFAULT_PUBLIC_STORE_SETTINGS.branding.adminLogoUrl
      ),
      sellerLogoUrl: toText(
        branding.sellerLogoUrl,
        DEFAULT_PUBLIC_STORE_SETTINGS.branding.sellerLogoUrl
      ),
      workspaceBrandName: toText(
        branding.workspaceBrandName,
        DEFAULT_PUBLIC_STORE_SETTINGS.branding.workspaceBrandName
      ),
    },
  };
};

const isScriptInjectionBlocked = () =>
  import.meta.env.MODE === "test" ||
  (typeof window !== "undefined" && Boolean(window.__QA_MVF__));

export default function StoreLayout() {
  const location = useLocation();
  const isCheckoutRoute = location.pathname.startsWith("/checkout");
  const totalQty = useCartStore((state) => state.totalQty);
  const subtotal = useCartStore((state) => state.subtotal);
  const isHomeActive = location.pathname === "/";
  const isCartRoute = location.pathname.startsWith("/cart");
  const isCartActive = isCartRoute;
  const isProfileActive =
    location.pathname.startsWith("/user") ||
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/my-account");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const storeSettingsQuery = useQuery({
    queryKey: ["store-settings", "public"],
    queryFn: getStoreSettings,
    staleTime: 60_000,
    retry: 1,
  });
  const homeCustomizationQuery = useQuery({
    queryKey: ["store-customization", "store-layout", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "home" }),
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const storeSettings = normalizePublicStoreSettings(
    storeSettingsQuery.data?.data?.storeSettings
  );
  const footerConfig = homeCustomizationQuery.data?.customization?.home?.footer;

  useEffect(() => {
    setIsMenuOpen(false);
    setIsCartDrawerOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onOpenDrawer = () => setIsCartDrawerOpen(true);
    window.addEventListener("cart-drawer:open", onOpenDrawer);
    return () => window.removeEventListener("cart-drawer:open", onOpenDrawer);
  }, []);

  useEffect(() => {
    if (!isCartDrawerOpen || isCartRoute) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCartDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartDrawerOpen, isCartRoute]);

  useEffect(() => {
    if (isScriptInjectionBlocked()) return;
    const key = toText(storeSettings.analytics.googleAnalyticKey, "");
    const enabled = Boolean(storeSettings.analytics.googleAnalyticsEnabled && key);
    const scriptId = "store-ga-script";
    const inlineId = "store-ga-inline";

    const existingScript = document.getElementById(scriptId);
    const existingInline = document.getElementById(inlineId);
    if (!enabled) {
      existingScript?.remove();
      existingInline?.remove();
      return;
    }

    if (existingScript?.getAttribute("data-ga-key") !== key) {
      existingScript?.remove();
      const script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(key)}`;
      script.setAttribute("data-ga-key", key);
      document.head.appendChild(script);
    }

    if (existingInline?.getAttribute("data-ga-key") !== key) {
      existingInline?.remove();
      const inline = document.createElement("script");
      inline.id = inlineId;
      inline.setAttribute("data-ga-key", key);
      inline.text = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${key}');`;
      document.head.appendChild(inline);
    }
  }, [
    storeSettings.analytics.googleAnalyticsEnabled,
    storeSettings.analytics.googleAnalyticKey,
  ]);

  useEffect(() => {
    if (isScriptInjectionBlocked()) return;
    const propertyId = toText(storeSettings.chat.tawkPropertyId, "");
    const widgetId = toText(storeSettings.chat.tawkWidgetId, "");
    const enabled =
      Boolean(storeSettings.chat.tawkEnabled) && Boolean(propertyId) && Boolean(widgetId);
    const scriptId = "store-tawk-script";
    const existing = document.getElementById(scriptId);

    if (!enabled) {
      existing?.remove();
      return;
    }

    const source = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    if (existing?.getAttribute("data-src") === source) return;
    existing?.remove();

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = source;
    script.setAttribute("data-src", source);
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.body.appendChild(script);
  }, [storeSettings.chat.tawkEnabled, storeSettings.chat.tawkPropertyId, storeSettings.chat.tawkWidgetId]);

  const openCartDrawer = () => {
    setIsCartDrawerOpen(true);
  };

  const closeCartDrawer = () => {
    setIsCartDrawerOpen(false);
  };

  const subtotalDisplay = formatCurrency(Number(subtotal || 0));
  const showFloatingCartWidget = !isCheckoutRoute && !isCartRoute;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <StoreHeaderKacha
        onCartClick={openCartDrawer}
        brandingLogoUrl={storeSettings.branding.clientLogoUrl}
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:pb-8">
        <Outlet context={{ storeSettings }} />
      </main>
      {!isCheckoutRoute ? (
        <StoreFooterKacha
          footerConfig={footerConfig}
          brandingName={storeSettings.branding.workspaceBrandName}
        />
      ) : null}
      {showFloatingCartWidget ? (
        <FloatingCartWidget
          totalQty={totalQty}
          subtotalDisplay={subtotalDisplay}
        />
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-emerald-700/70 bg-emerald-600 px-4 py-2 text-white shadow-[0_-8px_20px_rgba(5,150,105,0.35)] sm:hidden">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            aria-label="Open menu"
            className="flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] text-white/90 hover:bg-emerald-500"
          >
            <Menu className="h-[18px] w-[18px]" />
            <span className="leading-none">Menu</span>
          </button>
          <Link
            to="/"
            className={`flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isHomeActive
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <Home className="h-[18px] w-[18px]" />
            <span className="leading-none">Home</span>
          </Link>
          <button
            type="button"
            onClick={openCartDrawer}
            className={`relative flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isCartActive || isCartDrawerOpen
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            <span className="leading-none">Cart</span>
            {totalQty > 0 ? (
              <span className="absolute right-3 top-1.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-bold text-slate-900">
                {totalQty}
              </span>
            ) : null}
          </button>
          <Link
            to="/user/my-account"
            className={`flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isProfileActive
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <UserRound className="h-[18px] w-[18px]" />
            <span className="leading-none">Profile</span>
          </Link>
        </div>
      </nav>
      <MobileMenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      {!isCartRoute ? (
        <StoreCartDrawer
          isOpen={isCartDrawerOpen}
          onClose={closeCartDrawer}
          showBackdrop
        />
      ) : null}
    </div>
  );
}

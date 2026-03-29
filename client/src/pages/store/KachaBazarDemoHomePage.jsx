import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useCategories, useProducts } from "../../storefront.jsx";
import { fetchStoreCoupons } from "../../api/public/storeCoupons.ts";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { formatCurrency } from "../../utils/format.js";
import CouponPanel from "../../components/kachabazar-demo/CouponPanel.jsx";
import FeatureStrip from "../../components/kachabazar-demo/FeatureStrip.jsx";
import FeaturedCategoriesSection from "../../components/kachabazar-demo/FeaturedCategoriesSection.jsx";
import ProductSection from "../../components/kachabazar-demo/ProductSection.jsx";
import PromoDeliveryBanner from "../../components/kachabazar-demo/PromoDeliveryBanner.jsx";
import DiscountedProductsSection from "../../components/kachabazar-demo/DiscountedProductsSection.jsx";
import GetYourDailyNeedsSection from "../../components/kachabazar-demo/GetYourDailyNeedsSection.jsx";
import HomeHeroBanners from "../../components/store/HomeHeroBanners.jsx";
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
} from "../../components/primitives/state/index.js";
import { GENERIC_ERROR } from "../../constants/uiMessages.js";

const DEFAULT_SLIDES = [
  {
    title: "Quality Freshness Guaranteed!",
    description: "Get fresh groceries delivered to your door every day.",
    buttonName: "Buy Now",
    buttonLink: "/search?q=apple&page=1",
    imageDataUrl: "",
    imageFocus: "right",
    usesDefaultArtwork: true,
  },
  {
    title: "Organic & Natural Essentials",
    description: "Healthy choices curated for your daily needs.",
    buttonName: "Shop Now",
    buttonLink: "/search?page=1",
    imageDataUrl: "",
    imageFocus: "right",
    usesDefaultArtwork: true,
  },
  {
    title: "Big Savings for Daily Shopping",
    description: "Discover deals on pantry staples and snacks.",
    buttonName: "Browse Deals",
    buttonLink: "/offers",
    imageDataUrl: "",
    imageFocus: "right",
    usesDefaultArtwork: true,
  },
];
const DEFAULT_MAIN_SLIDER_OPTIONS = {
  showArrows: false,
  showDots: true,
  showBoth: false,
  autoplayEnabled: false,
  autoplayDelaySeconds: 5,
};
const DEFAULT_HOME_SECTION_CONFIG = {
  discountCouponBox: {
    enabled: true,
    title: "Latest Super Discount Active Coupon Code",
    activeCouponCodes: ["SUMMER26", "WINTER25"],
  },
  promotionBanner: {
    enabled: true,
    title: "100% Natural Quality Organic Product",
    description:
      "See Our latest discounted products from here and get a special discount product",
    buttonName: "Buy Now",
    buttonLink: "/search?category=breakfast",
  },
  featuredCategories: {
    enabled: true,
    title: "Featured Categories",
    description: "Choose your necessary products from this feature categories.",
    productsLimit: 12,
  },
  popularProducts: {
    enabled: true,
    title: "Popular Products for Daily Shopping",
    description:
      "See all our popular products in this week. You can choose your daily needs products from this list and get some special offer with free shipping.",
    productsLimit: 18,
  },
  quickDelivery: {
    enabled: true,
    subTitle: "Organic Products and Food",
    title: "Quick Delivery to Your Home",
    description:
      "There are many products you will find in our shop, Choose your daily necessary product from our KachaBazar shop and get some special offers. See Our latest discounted products from here and get a special discount.",
    buttonName: "Download App",
    buttonLink: "#",
    imageDataUrl: "",
  },
  latestDiscountedProducts: {
    enabled: true,
    title: "Latest Discounted Products",
    description:
      "See Our latest discounted products below. Choose your daily needs from here and get a special discount with free shipping.",
    productsLimit: 18,
  },
  getYourDailyNeeds: {
    enabled: true,
    title: "Get Your Daily Needs From Our KachaBazar Store",
    description:
      "There are many products you will find in our shop, Choose your daily necessary product from our KachaBazar shop and get some special offers.",
    imageLeftDataUrl: "",
    imageRightDataUrl: "",
    button1: {
      imageDataUrl: "",
      link: "https://www.apple.com/app-store/",
    },
    button2: {
      imageDataUrl: "",
      link: "https://play.google.com/store/games",
    },
  },
  featurePromoSection: {
    enabled: true,
    freeShippingText: "Free Shipping From €500.00",
    supportText: "Support 24/7 At Anytime",
    securePaymentText: "Secure Payment Totally Safe",
    latestOfferText: "Latest Offer Upto 20% Off",
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

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const normalizeMainSliderImageFocus = (value, fallback = "right") => {
  const normalized = toText(value, fallback).toLowerCase();
  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }
  return fallback;
};

const normalizeMainSliderAutoplayDelaySeconds = (value, fallback = 5) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (parsed === 5 || parsed === 10 || parsed === 15) {
    return parsed;
  }
  return fallback === 10 || fallback === 15 ? fallback : 5;
};

const normalizeCouponCodes = (value, fallback = []) => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeHomeSectionConfig = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const discountCouponBoxSource =
    source.discountCouponBox && typeof source.discountCouponBox === "object"
      ? source.discountCouponBox
      : {};
  const promotionBannerSource =
    source.promotionBanner && typeof source.promotionBanner === "object"
      ? source.promotionBanner
      : {};
  const featuredCategoriesSource =
    source.featuredCategories && typeof source.featuredCategories === "object"
      ? source.featuredCategories
      : {};
  const popularProductsSource =
    source.popularProducts && typeof source.popularProducts === "object"
      ? source.popularProducts
      : {};
  const quickDeliverySource =
    source.quickDelivery && typeof source.quickDelivery === "object"
      ? source.quickDelivery
      : {};
  const latestDiscountedProductsSource =
    source.latestDiscountedProducts && typeof source.latestDiscountedProducts === "object"
      ? source.latestDiscountedProducts
      : {};
  const getYourDailyNeedsSource =
    source.getYourDailyNeeds && typeof source.getYourDailyNeeds === "object"
      ? source.getYourDailyNeeds
      : {};
  const getYourDailyNeedsButton1Source =
    getYourDailyNeedsSource.button1 && typeof getYourDailyNeedsSource.button1 === "object"
      ? getYourDailyNeedsSource.button1
      : {};
  const getYourDailyNeedsButton2Source =
    getYourDailyNeedsSource.button2 && typeof getYourDailyNeedsSource.button2 === "object"
      ? getYourDailyNeedsSource.button2
      : {};
  const featurePromoSectionSource =
    source.featurePromoSection && typeof source.featurePromoSection === "object"
      ? source.featurePromoSection
      : {};

  return {
    discountCouponBox: {
      enabled: toBool(
        discountCouponBoxSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.discountCouponBox.enabled
      ),
      title: toText(
        discountCouponBoxSource.title,
        DEFAULT_HOME_SECTION_CONFIG.discountCouponBox.title
      ),
      activeCouponCodes: normalizeCouponCodes(
        discountCouponBoxSource.activeCouponCodes,
        DEFAULT_HOME_SECTION_CONFIG.discountCouponBox.activeCouponCodes
      ),
    },
    promotionBanner: {
      enabled: toBool(
        promotionBannerSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.promotionBanner.enabled
      ),
      title: toText(
        promotionBannerSource.title,
        DEFAULT_HOME_SECTION_CONFIG.promotionBanner.title
      ),
      description: toText(
        promotionBannerSource.description,
        DEFAULT_HOME_SECTION_CONFIG.promotionBanner.description
      ),
      buttonName: toText(
        promotionBannerSource.buttonName,
        DEFAULT_HOME_SECTION_CONFIG.promotionBanner.buttonName
      ),
      buttonLink: toText(
        promotionBannerSource.buttonLink,
        DEFAULT_HOME_SECTION_CONFIG.promotionBanner.buttonLink
      ),
    },
    featuredCategories: {
      enabled: toBool(
        featuredCategoriesSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.featuredCategories.enabled
      ),
      title: toText(
        featuredCategoriesSource.title,
        DEFAULT_HOME_SECTION_CONFIG.featuredCategories.title
      ),
      description: toText(
        featuredCategoriesSource.description,
        DEFAULT_HOME_SECTION_CONFIG.featuredCategories.description
      ),
      productsLimit: toPositiveInt(
        featuredCategoriesSource.productsLimit,
        DEFAULT_HOME_SECTION_CONFIG.featuredCategories.productsLimit
      ),
    },
    popularProducts: {
      enabled: toBool(
        popularProductsSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.popularProducts.enabled
      ),
      title: toText(
        popularProductsSource.title,
        DEFAULT_HOME_SECTION_CONFIG.popularProducts.title
      ),
      description: toText(
        popularProductsSource.description,
        DEFAULT_HOME_SECTION_CONFIG.popularProducts.description
      ),
      productsLimit: toPositiveInt(
        popularProductsSource.productsLimit,
        DEFAULT_HOME_SECTION_CONFIG.popularProducts.productsLimit
      ),
    },
    quickDelivery: {
      enabled: toBool(
        quickDeliverySource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.quickDelivery.enabled
      ),
      subTitle: toText(
        quickDeliverySource.subTitle,
        DEFAULT_HOME_SECTION_CONFIG.quickDelivery.subTitle
      ),
      title: toText(quickDeliverySource.title, DEFAULT_HOME_SECTION_CONFIG.quickDelivery.title),
      description: toText(
        quickDeliverySource.description,
        DEFAULT_HOME_SECTION_CONFIG.quickDelivery.description
      ),
      buttonName: toText(
        quickDeliverySource.buttonName,
        DEFAULT_HOME_SECTION_CONFIG.quickDelivery.buttonName
      ),
      buttonLink: toText(
        quickDeliverySource.buttonLink,
        DEFAULT_HOME_SECTION_CONFIG.quickDelivery.buttonLink
      ),
      imageDataUrl: toText(quickDeliverySource.imageDataUrl),
    },
    latestDiscountedProducts: {
      enabled: toBool(
        latestDiscountedProductsSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.latestDiscountedProducts.enabled
      ),
      title: toText(
        latestDiscountedProductsSource.title,
        DEFAULT_HOME_SECTION_CONFIG.latestDiscountedProducts.title
      ),
      description: toText(
        latestDiscountedProductsSource.description,
        DEFAULT_HOME_SECTION_CONFIG.latestDiscountedProducts.description
      ),
      productsLimit: toPositiveInt(
        latestDiscountedProductsSource.productsLimit,
        DEFAULT_HOME_SECTION_CONFIG.latestDiscountedProducts.productsLimit
      ),
    },
    getYourDailyNeeds: {
      enabled: toBool(
        getYourDailyNeedsSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.getYourDailyNeeds.enabled
      ),
      title: toText(
        getYourDailyNeedsSource.title,
        DEFAULT_HOME_SECTION_CONFIG.getYourDailyNeeds.title
      ),
      description: toText(
        getYourDailyNeedsSource.description,
        DEFAULT_HOME_SECTION_CONFIG.getYourDailyNeeds.description
      ),
      imageLeftDataUrl: toText(getYourDailyNeedsSource.imageLeftDataUrl),
      imageRightDataUrl: toText(getYourDailyNeedsSource.imageRightDataUrl),
      button1: {
        imageDataUrl: toText(getYourDailyNeedsButton1Source.imageDataUrl),
        link: toText(
          getYourDailyNeedsButton1Source.link,
          DEFAULT_HOME_SECTION_CONFIG.getYourDailyNeeds.button1.link
        ),
      },
      button2: {
        imageDataUrl: toText(getYourDailyNeedsButton2Source.imageDataUrl),
        link: toText(
          getYourDailyNeedsButton2Source.link,
          DEFAULT_HOME_SECTION_CONFIG.getYourDailyNeeds.button2.link
        ),
      },
    },
    featurePromoSection: {
      enabled: toBool(
        featurePromoSectionSource.enabled,
        DEFAULT_HOME_SECTION_CONFIG.featurePromoSection.enabled
      ),
      freeShippingText: toText(
        featurePromoSectionSource.freeShippingText,
        DEFAULT_HOME_SECTION_CONFIG.featurePromoSection.freeShippingText
      ),
      supportText: toText(
        featurePromoSectionSource.supportText,
        DEFAULT_HOME_SECTION_CONFIG.featurePromoSection.supportText
      ),
      securePaymentText: toText(
        featurePromoSectionSource.securePaymentText,
        DEFAULT_HOME_SECTION_CONFIG.featurePromoSection.securePaymentText
      ),
      latestOfferText: toText(
        featurePromoSectionSource.latestOfferText,
        DEFAULT_HOME_SECTION_CONFIG.featurePromoSection.latestOfferText
      ),
    },
  };
};

const normalizeMainSlider = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const rawSlides = Array.isArray(source.sliders) ? source.sliders : [];
  const optionsSource = source.options && typeof source.options === "object" ? source.options : {};
  const showArrows = toBool(optionsSource.showArrows, DEFAULT_MAIN_SLIDER_OPTIONS.showArrows);
  const showDots = toBool(optionsSource.showDots, DEFAULT_MAIN_SLIDER_OPTIONS.showDots);
  const showBoth = toBool(optionsSource.showBoth, showArrows && showDots);
  const autoplayEnabled = toBool(
    optionsSource.autoplayEnabled ?? optionsSource.autoPlay,
    DEFAULT_MAIN_SLIDER_OPTIONS.autoplayEnabled
  );
  const autoplayDelaySeconds = normalizeMainSliderAutoplayDelaySeconds(
    optionsSource.autoplayDelaySeconds ?? optionsSource.autoPlayDelaySeconds,
    DEFAULT_MAIN_SLIDER_OPTIONS.autoplayDelaySeconds
  );
  const options = showBoth
    ? {
        showArrows: true,
        showDots: true,
        showBoth: true,
        autoplayEnabled,
        autoplayDelaySeconds,
      }
    : {
        showArrows,
        showDots,
        showBoth: false,
        autoplayEnabled,
        autoplayDelaySeconds,
      };
  const slides = rawSlides
    .map((item, index) => {
      const sourceItem = item && typeof item === "object" ? item : {};
      return {
        imageDataUrl: toText(sourceItem.imageDataUrl ?? sourceItem.image),
        title: toText(sourceItem.title),
        description: toText(
          sourceItem.description ?? sourceItem.subTitle ?? sourceItem.subtitle
        ),
        buttonName: toText(sourceItem.buttonName),
        buttonLink: toText(sourceItem.buttonLink),
        imageFocus: normalizeMainSliderImageFocus(sourceItem.imageFocus, "right"),
        usesDefaultArtwork: false,
      };
    })
    .filter((item) => item.imageDataUrl || item.title || item.description || item.buttonName);

  if (slides.length === 0) {
    return {
      slides: DEFAULT_SLIDES,
      options: DEFAULT_MAIN_SLIDER_OPTIONS,
      isFallback: true,
    };
  }

  return {
    slides,
    options,
    isFallback: false,
  };
};

export default function KachaBazarDemoHomePage() {
  const lang = "en";
  const {
    data: categoriesData,
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories();
  const {
    data: productsData,
    isLoading,
    isError,
    refetch: refetchProducts,
  } = useProducts({ page: 1, limit: 30 });
  const categories = categoriesData?.data?.items ?? [];
  const hasCategories = categories.length > 0;
  const showCategoriesLoading = isCategoriesLoading && !categoriesData;
  const showCategoriesError = isCategoriesError && !hasCategories;
  const categoriesErrorMessage =
    categoriesError?.response?.data?.message ||
    categoriesError?.message ||
    GENERIC_ERROR;
  const homeCustomizationQuery = useQuery({
    queryKey: ["store-customization", "home-page", lang],
    queryFn: () => getStoreCustomization({ lang, include: "home" }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });
  const categoriesById = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((category) => {
      if (category?.id != null) {
        map.set(Number(category.id), category);
      }
    });
    return map;
  }, [categories]);
  const rawProducts = productsData?.data?.items ?? [];

  const [activeSlide, setActiveSlide] = useState(0);
  const [copiedCode, setCopiedCode] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [couponError, setCouponError] = useState("");
  const [isCouponsLoading, setIsCouponsLoading] = useState(true);
  const mainSlider = useMemo(
    () => normalizeMainSlider(homeCustomizationQuery.data?.customization?.home?.mainSlider),
    [homeCustomizationQuery.data]
  );
  const homeSections = useMemo(
    () => normalizeHomeSectionConfig(homeCustomizationQuery.data?.customization?.home),
    [homeCustomizationQuery.data]
  );

  useEffect(() => {
    if (activeSlide >= mainSlider.slides.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, mainSlider.slides.length]);

  useEffect(() => {
    let mounted = true;
    const loadCoupons = async () => {
      if (mounted) {
        setIsCouponsLoading(true);
        setCouponError("");
      }
      try {
        const response = await fetchStoreCoupons();
        if (!mounted) return;
        setCoupons(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        if (!mounted) return;
        setCoupons([]);
        setCouponError("Failed to load coupons from the store API.");
      } finally {
        if (mounted) {
          setIsCouponsLoading(false);
        }
      }
    };
    loadCoupons();
    return () => {
      mounted = false;
    };
  }, []);

  const popularProducts = rawProducts;
  const couponList = useMemo(() => {
    const activeCodes = new Set(
      (homeSections.discountCouponBox.activeCouponCodes || []).map((code) =>
        String(code).trim().toLowerCase()
      )
    );
    const filteredCoupons =
      activeCodes.size > 0
        ? coupons.filter((coupon) => activeCodes.has(String(coupon?.code || "").trim().toLowerCase()))
        : coupons;

    return filteredCoupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      discountLabel:
        coupon.discountType === "percent"
          ? `${coupon.amount}% Off`
          : `${formatCurrency(Number(coupon.amount || 0))} Off`,
      title:
        coupon.discountType === "percent"
          ? `Save up to ${coupon.amount}% on selected items`
          : `Flat savings of ${formatCurrency(Number(coupon.amount || 0))}`,
      countdown: "00 : 00 : 00 : 00",
      status:
        coupon.expiresAt && Number.isFinite(Date.parse(coupon.expiresAt))
          ? Date.parse(coupon.expiresAt) > Date.now()
            ? "Active"
            : "Inactive"
          : "Active",
    }));
  }, [coupons, homeSections.discountCouponBox.activeCouponCodes]);

  const safeProducts = useMemo(
    () =>
      popularProducts.map((raw) => {
        const title = raw?.title ?? raw?.name ?? "";
        const price = Number(raw?.price ?? raw?.sellingPrice ?? raw?.salePrice ?? 0);
        const originalPrice = Number(raw?.originalPrice ?? raw?.price ?? 0);
        const salePrice =
          raw?.salePrice != null ? Number(raw.salePrice) : null;
        const discountPercent = Number(raw?.discountPercent ?? 0);
        const ratingAvg = Number(raw?.ratingAvg ?? raw?.averageRating ?? 0);
        const reviewCount = Number(raw?.reviewCount ?? 0);
        const categoryObj =
          raw?.category ??
          raw?.Category ??
          (raw?.categoryId != null ? categoriesById.get(Number(raw.categoryId)) : null) ??
          (raw?.categoryName ? { name: raw.categoryName } : null) ??
          { name: "Uncategorized" };
        const imageUrl = raw?.promoImagePath ?? raw?.imageUrl ?? raw?.image ?? null;
        const slug = raw?.slug ?? String(raw?.id ?? "");

        return {
          id: raw?.id,
          title,
          name: raw?.name ?? title,
          price,
          originalPrice,
          salePrice,
          discountPercent,
          ratingAvg,
          reviewCount,
          unit: raw?.unit ?? raw?.tags?.unit ?? "1 pc",
          category: categoryObj,
          imageUrl,
          image: imageUrl,
          slug,
        };
      }),
    [popularProducts, categoriesById]
  );
  const showDiscountCouponBox = homeSections.discountCouponBox.enabled;
  const showFeaturedCategories = homeSections.featuredCategories.enabled;
  const showPopularProducts = homeSections.popularProducts.enabled;
  const showPromotionBanner = homeSections.promotionBanner.enabled;
  const showQuickDelivery = homeSections.quickDelivery.enabled;
  const showLatestDiscountedProducts = homeSections.latestDiscountedProducts.enabled;
  const showGetYourDailyNeeds = homeSections.getYourDailyNeeds.enabled;
  const showFeaturePromoSection = homeSections.featurePromoSection.enabled;

  const handleCopyCoupon = async (code) => {
    if (!code) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 1500);
    } catch (err) {
      setCopiedCode("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl space-y-14 px-4 pb-8 pt-4 md:px-6 lg:pb-10 lg:pt-5">
        <section>
          <div
            className={`grid grid-cols-1 gap-4 ${
              showDiscountCouponBox
                ? "lg:grid-cols-[minmax(0,1fr)_272px] lg:items-start lg:gap-7 xl:grid-cols-[minmax(0,1fr)_284px] xl:gap-8"
                : ""
            }`}
          >
            <div>
              <HomeHeroBanners
                slides={mainSlider.slides}
                activeSlide={activeSlide}
                setActiveSlide={setActiveSlide}
                options={mainSlider.options}
              />
            </div>
            {showDiscountCouponBox ? (
              <div className="lg:pt-2">
                <CouponPanel
                  title={homeSections.discountCouponBox.title}
                  couponList={couponList}
                  isLoading={isCouponsLoading}
                  couponError={couponError}
                  copiedCode={copiedCode}
                  onCopy={handleCopyCoupon}
                />
              </div>
            ) : null}
          </div>
        </section>

        {showFeaturePromoSection ? (
          <FeatureStrip
            freeShippingText={homeSections.featurePromoSection.freeShippingText}
            supportText={homeSections.featurePromoSection.supportText}
            securePaymentText={homeSections.featurePromoSection.securePaymentText}
            latestOfferText={homeSections.featurePromoSection.latestOfferText}
          />
        ) : null}
        {showFeaturedCategories && showCategoriesLoading ? (
          <section className="space-y-6 rounded-3xl bg-slate-100 px-3 py-8 sm:px-5">
            <header className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {homeSections.featuredCategories.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {homeSections.featuredCategories.description || "Loading categories for your shopping flow."}
              </p>
            </header>
            <UiSkeleton variant="grid" rows={6} />
          </section>
        ) : null}

        {showFeaturedCategories && showCategoriesError ? (
          <section className="space-y-6 rounded-3xl bg-slate-100 px-3 py-8 sm:px-5">
            <header className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {homeSections.featuredCategories.title}
              </h2>
            </header>
            <UiErrorState
              title="Failed to load categories."
              message={categoriesErrorMessage}
              onRetry={() => refetchCategories()}
            />
          </section>
        ) : null}

        {showFeaturedCategories && !showCategoriesLoading && !showCategoriesError && !hasCategories ? (
          <section className="space-y-6 rounded-3xl bg-slate-100 px-3 py-8 sm:px-5">
            <header className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                {homeSections.featuredCategories.title}
              </h2>
              {homeSections.featuredCategories.description ? (
                <p className="mt-2 text-sm text-slate-500">
                  {homeSections.featuredCategories.description}
                </p>
              ) : null}
            </header>
            <UiEmptyState
              title="No categories available yet"
              description="Browse products directly while categories are being prepared."
              actions={
                <Link
                  to="/search"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Browse Products
                </Link>
              }
            />
          </section>
        ) : null}

        {showFeaturedCategories && !showCategoriesLoading && !showCategoriesError && hasCategories ? (
          <FeaturedCategoriesSection
            title={homeSections.featuredCategories.title}
            description={homeSections.featuredCategories.description}
            maxCategories={homeSections.featuredCategories.productsLimit}
            categories={categories}
            products={safeProducts}
          />
        ) : null}
        {showPopularProducts ? (
          <ProductSection
            title={homeSections.popularProducts.title}
            subtitle={homeSections.popularProducts.description}
            maxProducts={homeSections.popularProducts.productsLimit}
            products={safeProducts}
            categories={categories}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetchProducts()}
          />
        ) : null}
        {showPromotionBanner ? (
          <PromoDeliveryBanner
            title={homeSections.promotionBanner.title}
            description={homeSections.promotionBanner.description}
            buttonName={homeSections.promotionBanner.buttonName}
            buttonLink={homeSections.promotionBanner.buttonLink}
          />
        ) : null}
        {showQuickDelivery ? (
          <PromoDeliveryBanner
            subTitle={homeSections.quickDelivery.subTitle}
            title={homeSections.quickDelivery.title}
            description={homeSections.quickDelivery.description}
            buttonName={homeSections.quickDelivery.buttonName}
            buttonLink={homeSections.quickDelivery.buttonLink}
            imageDataUrl={homeSections.quickDelivery.imageDataUrl}
          />
        ) : null}
        {showLatestDiscountedProducts ? (
          <DiscountedProductsSection
            title={homeSections.latestDiscountedProducts.title}
            description={homeSections.latestDiscountedProducts.description}
            maxProducts={homeSections.latestDiscountedProducts.productsLimit}
            products={safeProducts}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetchProducts()}
          />
        ) : null}
        {showGetYourDailyNeeds ? (
          <GetYourDailyNeedsSection
            title={homeSections.getYourDailyNeeds.title}
            description={homeSections.getYourDailyNeeds.description}
            imageLeftDataUrl={homeSections.getYourDailyNeeds.imageLeftDataUrl}
            imageRightDataUrl={homeSections.getYourDailyNeeds.imageRightDataUrl}
            button1={homeSections.getYourDailyNeeds.button1}
            button2={homeSections.getYourDailyNeeds.button2}
          />
        ) : null}
      </main>
    </div>
  );
}

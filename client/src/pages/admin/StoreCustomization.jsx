import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Settings, Upload, X } from "lucide-react";
import {
  fetchAdminLanguages,
  createAdminLanguage,
  fetchAdminStoreCustomization,
  updateAdminStoreCustomization,
} from "../../lib/adminApi.js";
import {
  fileToDataUrl,
  validateCustomizationLogoFile,
} from "../../utils/fileToDataUrl.js";

const ADMIN_LANGUAGE_KEY = "adminLanguage";

const TABS = [
  { key: "home", label: "Home Page" },
  { key: "productSlugPage", label: "Product Slug Page" },
  { key: "aboutUs", label: "About Us" },
  { key: "privacyPolicyTerms", label: "Privacy Policy and T&C" },
  { key: "faqs", label: "FAQs" },
  { key: "offers", label: "Offers" },
  { key: "contactUs", label: "Contact Us" },
  { key: "checkout", label: "Checkout" },
  { key: "dashboardSetting", label: "Dashboard Setting" },
  { key: "seoSettings", label: "Seo Settings" },
];

const LANGUAGE_PRESETS = [
  { name: "English", displayName: "English", isoCode: "en", flag: "US" },
  { name: "Arabic", displayName: "Arabic", isoCode: "ar", flag: "SA" },
  { name: "German", displayName: "German", isoCode: "de", flag: "DE" },
  { name: "French", displayName: "French", isoCode: "fr", flag: "FR" },
  { name: "Urdu", displayName: "Urdu", isoCode: "ur", flag: "PK" },
  { name: "Bengali", displayName: "Bengali", isoCode: "bn", flag: "BD" },
  { name: "Hindi", displayName: "Hindi", isoCode: "hi", flag: "IN" },
  {
    name: "Indonesian",
    displayName: "Bahasa Indonesia",
    isoCode: "id",
    flag: "ID",
  },
];

const MENU_LABEL_FIELDS = [
  { key: "categories", label: "Categories" },
  { key: "aboutUs", label: "About Us" },
  { key: "contactUs", label: "Contact Us" },
  { key: "offers", label: "Offers" },
  { key: "faq", label: "FAQ" },
  { key: "privacyPolicy", label: "Privacy Policy" },
  { key: "termsAndConditions", label: "Terms & Conditions" },
  { key: "pages", label: "Pages" },
  { key: "myAccount", label: "My Account" },
  { key: "login", label: "Login" },
  { key: "logout", label: "Logout" },
  { key: "checkout", label: "Checkout" },
];

const ENABLED_FIELDS = [
  { key: "showCategories", label: "Show Categories" },
  { key: "showAboutUs", label: "Show About Us" },
  { key: "showContactUs", label: "Show Contact Us" },
  { key: "showOffers", label: "Show Offers" },
  { key: "showFaq", label: "Show FAQ" },
  { key: "showPrivacyPolicy", label: "Show Privacy Policy" },
  { key: "showTermsAndConditions", label: "Show Terms & Conditions" },
];

const MAIN_SLIDER_TABS = [
  { key: "slider-0", label: "Slider 1", index: 0 },
  { key: "slider-1", label: "Slider 2", index: 1 },
  { key: "slider-2", label: "Slider 3", index: 2 },
  { key: "slider-3", label: "Slider 4", index: 3 },
  { key: "slider-4", label: "Slider 5", index: 4 },
  { key: "options", label: "Options", index: -1 },
];

const MAIN_SLIDER_LENGTH = 5;
const PRODUCTS_LIMIT_OPTIONS = [6, 12, 18, 24];
const PRODUCT_SLUG_DESCRIPTION_LABELS = [
  "Description One",
  "Description Two",
  "Description Three",
  "Description Four",
  "Description Five",
  "Description Six",
  "Description Seven",
];

const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const sectionCard =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]";

const getDefaultCustomization = () => ({
  home: {
    header: {
      headerText: "We are available 24/7, Need help??",
      phoneNumber: "565555",
      logoDataUrl: "",
    },
    mainSlider: {
      sliders: Array.from({ length: MAIN_SLIDER_LENGTH }, () => ({
        imageDataUrl: "",
        title: "",
        description: "",
        buttonName: "",
        buttonLink: "",
      })),
      options: {
        showArrows: false,
        showDots: true,
        showBoth: false,
      },
    },
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
    footer: {
      block1: {
        enabled: true,
        title: "Company",
        links: [
          { label: "About Us", href: "/about-us" },
          { label: "Contact Us", href: "/contact-us" },
          { label: "Careers", href: "#" },
          { label: "Latest News", href: "#" },
        ],
      },
      block2: {
        enabled: true,
        title: "Latest News",
        links: [
          { label: "Fish & Meat", href: "/search?category=fish-meat" },
          { label: "Soft Drink", href: "/search?category=drinks" },
          { label: "Milk & Dairy", href: "/search?category=milk-dairy" },
          { label: "Beauty & Health", href: "/search?category=beauty-health" },
        ],
      },
      block3: {
        enabled: true,
        title: "My Account",
        links: [
          { label: "Dashboard", href: "/user/dashboard" },
          { label: "My Orders", href: "/user/my-orders" },
          { label: "Recent Orders", href: "/user/dashboard" },
          { label: "Update Profile", href: "/user/update-profile" },
        ],
      },
      block4: {
        enabled: true,
        footerLogoDataUrl: "",
        address: "987 Andre Plain Suite High Street 838, Lake Hestertown, USA",
        phone: "02.356.1666",
        email: "ccruidk@test.com",
      },
      socialLinks: {
        enabled: true,
        facebook: "https://www.facebook.com/",
        twitter: "https://twitter.com/",
        pinterest: "https://www.pinterest.com/",
        linkedin: "https://www.linkedin.com/",
        whatsapp: "https://web.whatsapp.com/",
      },
      paymentMethod: {
        enabled: true,
        imageDataUrl: "",
      },
      bottomContact: {
        enabled: true,
        contactNumber: "+6599887766",
      },
    },
    menuEditor: {
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
    },
  },
  productSlugPage: {
    rightBox: {
      enabled: true,
      descriptions: [
        "Free shipping applies to all orders over shipping €100",
        "Home Delivery within 1 Hour",
        "Cash on Delivery Available",
        "7 Days returns money back guarantee",
        "Warranty not available for this item",
        "Guaranteed 100% organic from natural products.",
        "Delivery from our pick point Boho One, Bridge Street West, Middlesbrough, North Yorkshire, TS2 1AE.",
      ],
    },
  },
  seoSettings: {
    faviconDataUrl: "",
    metaTitle: "",
    metaDescription: "",
    metaUrl: "",
    metaKeywords: "",
    metaImageDataUrl: "",
  },
});

const normalizeLanguage = (item) => ({
  id: Number(item?.id || 0),
  name: String(item?.name || "").trim(),
  isoCode: String(item?.isoCode || "").trim().toLowerCase(),
  flag: String(item?.flag || "").trim().toUpperCase(),
  published:
    item?.published === true ||
    String(item?.published || "").toLowerCase() === "true" ||
    Number(item?.published) === 1,
});

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeDeep = (base, source) => {
  if (!isPlainObject(base)) return source;
  const output = { ...base };
  if (!isPlainObject(source)) return output;

  Object.entries(source).forEach(([key, value]) => {
    const baseValue = output[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      output[key] = mergeDeep(baseValue, value);
    } else {
      output[key] = value;
    }
  });

  return output;
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
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
};

const normalizeCouponCodes = (value, fallback = []) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = rawItems
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean);
  if (normalized.length === 0) return [...fallback];
  return [...new Set(normalized)];
};

const normalizeFooterLinks = (value, fallback = []) => {
  const rawItems = Array.isArray(value) ? value : [];
  return fallback.map((fallbackItem, index) => {
    const sourceItem =
      index < rawItems.length && isPlainObject(rawItems[index])
        ? rawItems[index]
        : {};
    return {
      label: toText(sourceItem.label, fallbackItem.label),
      href: toText(sourceItem.href, fallbackItem.href),
    };
  });
};

const normalizeRightBoxDescriptions = (value, fallback = [], legacySource = {}) => {
  const rawArray = Array.isArray(value) ? value : [];
  const legacyKeys = [
    "descriptionOne",
    "descriptionTwo",
    "descriptionThree",
    "descriptionFour",
    "descriptionFive",
    "descriptionSix",
    "descriptionSeven",
  ];
  return fallback.map((fallbackItem, index) => {
    const fromArray = toText(rawArray[index], "");
    const legacyKey = legacyKeys[index];
    const fromLegacy = toText(legacySource?.[legacyKey], "");
    return toText(fromArray || fromLegacy, fallbackItem);
  });
};

const normalizeCustomizationPayload = (raw) => {
  const defaults = getDefaultCustomization();
  const source = isPlainObject(raw) ? raw : {};
  const merged = mergeDeep(defaults, source);

  const homeSource = isPlainObject(source.home) ? source.home : {};
  const legacyHome = isPlainObject(source.homePage) ? source.homePage : {};

  const headerSource = isPlainObject(homeSource.header)
    ? homeSource.header
    : isPlainObject(legacyHome.headerContacts)
      ? legacyHome.headerContacts
      : {};

  const menuSource = isPlainObject(homeSource.menuEditor)
    ? homeSource.menuEditor
    : isPlainObject(legacyHome.menuEditor)
      ? legacyHome.menuEditor
      : {};
  const mainSliderSource = isPlainObject(homeSource.mainSlider)
    ? homeSource.mainSlider
    : isPlainObject(legacyHome.mainSlider)
      ? legacyHome.mainSlider
      : {};
  const discountCouponBoxSource = isPlainObject(homeSource.discountCouponBox)
    ? homeSource.discountCouponBox
    : {};
  const promotionBannerSource = isPlainObject(homeSource.promotionBanner)
    ? homeSource.promotionBanner
    : {};
  const featuredCategoriesSource = isPlainObject(homeSource.featuredCategories)
    ? homeSource.featuredCategories
    : {};
  const popularProductsSource = isPlainObject(homeSource.popularProducts)
    ? homeSource.popularProducts
    : {};
  const quickDeliverySource = isPlainObject(homeSource.quickDelivery)
    ? homeSource.quickDelivery
    : {};
  const latestDiscountedProductsSource = isPlainObject(
    homeSource.latestDiscountedProducts
  )
    ? homeSource.latestDiscountedProducts
    : {};
  const getYourDailyNeedsSource = isPlainObject(homeSource.getYourDailyNeeds)
    ? homeSource.getYourDailyNeeds
    : {};
  const featurePromoSectionSource = isPlainObject(homeSource.featurePromoSection)
    ? homeSource.featurePromoSection
    : {};
  const footerSource = isPlainObject(homeSource.footer) ? homeSource.footer : {};
  const getYourDailyNeedsButton1Source = isPlainObject(getYourDailyNeedsSource.button1)
    ? getYourDailyNeedsSource.button1
    : {};
  const getYourDailyNeedsButton2Source = isPlainObject(getYourDailyNeedsSource.button2)
    ? getYourDailyNeedsSource.button2
    : {};
  const footerBlock1Source = isPlainObject(footerSource.block1) ? footerSource.block1 : {};
  const footerBlock2Source = isPlainObject(footerSource.block2) ? footerSource.block2 : {};
  const footerBlock3Source = isPlainObject(footerSource.block3) ? footerSource.block3 : {};
  const footerBlock4Source = isPlainObject(footerSource.block4) ? footerSource.block4 : {};
  const footerSocialLinksSource = isPlainObject(footerSource.socialLinks)
    ? footerSource.socialLinks
    : {};
  const footerPaymentMethodSource = isPlainObject(footerSource.paymentMethod)
    ? footerSource.paymentMethod
    : {};
  const footerBottomContactSource = isPlainObject(footerSource.bottomContact)
    ? footerSource.bottomContact
    : {};
  const productSlugPageSource = isPlainObject(source.productSlugPage)
    ? source.productSlugPage
    : {};
  const productSlugRightBoxSource = isPlainObject(productSlugPageSource.rightBox)
    ? productSlugPageSource.rightBox
    : {};
  const seoSettingsSource = isPlainObject(source.seoSettings)
    ? source.seoSettings
    : isPlainObject(source.seo)
      ? source.seo
      : {};

  const labelsSource = isPlainObject(menuSource.labels) ? menuSource.labels : {};
  const enabledSource = isPlainObject(menuSource.enabled)
    ? menuSource.enabled
    : isPlainObject(menuSource.visibility)
      ? menuSource.visibility
      : {};
  const sliderArray = Array.isArray(mainSliderSource.sliders)
    ? mainSliderSource.sliders
    : [];
  const mainSliderDefaults = defaults.home.mainSlider;

  const sliders = Array.from({ length: MAIN_SLIDER_LENGTH }, (_, index) => {
    const order = index + 1;
    const fallback = mainSliderDefaults.sliders[index];
    const nested = isPlainObject(sliderArray[index]) ? sliderArray[index] : {};
    const legacyNested = isPlainObject(mainSliderSource[`slider${order}`])
      ? mainSliderSource[`slider${order}`]
      : {};

    return {
      imageDataUrl: toText(
        nested.imageDataUrl ??
          nested.image ??
          legacyNested.imageDataUrl ??
          legacyNested.image ??
          mainSliderSource[`slider${order}ImageDataUrl`] ??
          mainSliderSource[`slider${order}Image`] ??
          "",
        fallback.imageDataUrl
      ),
      title: toText(
        nested.title ??
          legacyNested.title ??
          mainSliderSource[`slider${order}Title`] ??
          "",
        fallback.title
      ),
      description: toText(
        nested.description ??
          legacyNested.description ??
          mainSliderSource[`slider${order}Description`] ??
          "",
        fallback.description
      ),
      buttonName: toText(
        nested.buttonName ??
          legacyNested.buttonName ??
          mainSliderSource[`slider${order}ButtonName`] ??
          "",
        fallback.buttonName
      ),
      buttonLink: toText(
        nested.buttonLink ??
          legacyNested.buttonLink ??
          mainSliderSource[`slider${order}ButtonLink`] ??
          "",
        fallback.buttonLink
      ),
    };
  });

  const optionsSource = isPlainObject(mainSliderSource.options)
    ? mainSliderSource.options
    : {};
  const showArrows = toBool(
    optionsSource.showArrows ??
      mainSliderSource.showArrows ??
      mainSliderSource.leftAndRightArrows,
    mainSliderDefaults.options.showArrows
  );
  const showDots = toBool(
    optionsSource.showDots ??
      mainSliderSource.showDots ??
      mainSliderSource.bottomDots,
    mainSliderDefaults.options.showDots
  );
  const showBoth = toBool(
    optionsSource.showBoth ?? mainSliderSource.showBoth ?? mainSliderSource.both,
    showArrows && showDots
  );
  const normalizedMainSliderOptions = showBoth
    ? { showArrows: true, showDots: true, showBoth: true }
    : { showArrows, showDots, showBoth: false };

  const defaultsHome = defaults.home;
  const defaultsProductSlugPage = defaults.productSlugPage;
  const defaultsSeoSettings = defaults.seoSettings;
  return {
    ...merged,
    home: {
      ...defaultsHome,
      ...homeSource,
      header: {
        ...defaultsHome.header,
        ...headerSource,
        headerText: toText(headerSource.headerText, defaultsHome.header.headerText),
        phoneNumber: toText(
          headerSource.phoneNumber,
          defaultsHome.header.phoneNumber
        ),
        logoDataUrl: toText(headerSource.logoDataUrl, ""),
      },
      menuEditor: {
        ...defaultsHome.menuEditor,
        ...menuSource,
        labels: mergeDeep(defaultsHome.menuEditor.labels, labelsSource),
        enabled: {
          showCategories: toBool(
            enabledSource.showCategories,
            defaultsHome.menuEditor.enabled.showCategories
          ),
          showAboutUs: toBool(
            enabledSource.showAboutUs,
            defaultsHome.menuEditor.enabled.showAboutUs
          ),
          showContactUs: toBool(
            enabledSource.showContactUs,
            defaultsHome.menuEditor.enabled.showContactUs
          ),
          showOffers: toBool(
            enabledSource.showOffers,
            defaultsHome.menuEditor.enabled.showOffers
          ),
          showFaq: toBool(
            enabledSource.showFaq,
            defaultsHome.menuEditor.enabled.showFaq
          ),
          showPrivacyPolicy: toBool(
            enabledSource.showPrivacyPolicy,
            defaultsHome.menuEditor.enabled.showPrivacyPolicy
          ),
          showTermsAndConditions: toBool(
            enabledSource.showTermsAndConditions,
            defaultsHome.menuEditor.enabled.showTermsAndConditions
          ),
        },
      },
      mainSlider: {
        ...defaultsHome.mainSlider,
        sliders,
        options: normalizedMainSliderOptions,
      },
      discountCouponBox: {
        ...defaultsHome.discountCouponBox,
        enabled: toBool(
          discountCouponBoxSource.enabled,
          defaultsHome.discountCouponBox.enabled
        ),
        title: toText(
          discountCouponBoxSource.title,
          defaultsHome.discountCouponBox.title
        ),
        activeCouponCodes: normalizeCouponCodes(
          discountCouponBoxSource.activeCouponCodes,
          defaultsHome.discountCouponBox.activeCouponCodes
        ),
      },
      promotionBanner: {
        ...defaultsHome.promotionBanner,
        enabled: toBool(
          promotionBannerSource.enabled,
          defaultsHome.promotionBanner.enabled
        ),
        title: toText(promotionBannerSource.title, defaultsHome.promotionBanner.title),
        description: toText(
          promotionBannerSource.description,
          defaultsHome.promotionBanner.description
        ),
        buttonName: toText(
          promotionBannerSource.buttonName,
          defaultsHome.promotionBanner.buttonName
        ),
        buttonLink: toText(
          promotionBannerSource.buttonLink,
          defaultsHome.promotionBanner.buttonLink
        ),
      },
      featuredCategories: {
        ...defaultsHome.featuredCategories,
        enabled: toBool(
          featuredCategoriesSource.enabled,
          defaultsHome.featuredCategories.enabled
        ),
        title: toText(
          featuredCategoriesSource.title,
          defaultsHome.featuredCategories.title
        ),
        description: toText(
          featuredCategoriesSource.description,
          defaultsHome.featuredCategories.description
        ),
        productsLimit: toPositiveInt(
          featuredCategoriesSource.productsLimit,
          defaultsHome.featuredCategories.productsLimit
        ),
      },
      popularProducts: {
        ...defaultsHome.popularProducts,
        enabled: toBool(
          popularProductsSource.enabled,
          defaultsHome.popularProducts.enabled
        ),
        title: toText(popularProductsSource.title, defaultsHome.popularProducts.title),
        description: toText(
          popularProductsSource.description,
          defaultsHome.popularProducts.description
        ),
        productsLimit: toPositiveInt(
          popularProductsSource.productsLimit,
          defaultsHome.popularProducts.productsLimit
        ),
      },
      quickDelivery: {
        ...defaultsHome.quickDelivery,
        enabled: toBool(quickDeliverySource.enabled, defaultsHome.quickDelivery.enabled),
        subTitle: toText(quickDeliverySource.subTitle, defaultsHome.quickDelivery.subTitle),
        title: toText(quickDeliverySource.title, defaultsHome.quickDelivery.title),
        description: toText(
          quickDeliverySource.description,
          defaultsHome.quickDelivery.description
        ),
        buttonName: toText(
          quickDeliverySource.buttonName,
          defaultsHome.quickDelivery.buttonName
        ),
        buttonLink: toText(
          quickDeliverySource.buttonLink,
          defaultsHome.quickDelivery.buttonLink
        ),
        imageDataUrl: toText(quickDeliverySource.imageDataUrl, ""),
      },
      latestDiscountedProducts: {
        ...defaultsHome.latestDiscountedProducts,
        enabled: toBool(
          latestDiscountedProductsSource.enabled,
          defaultsHome.latestDiscountedProducts.enabled
        ),
        title: toText(
          latestDiscountedProductsSource.title,
          defaultsHome.latestDiscountedProducts.title
        ),
        description: toText(
          latestDiscountedProductsSource.description,
          defaultsHome.latestDiscountedProducts.description
        ),
        productsLimit: toPositiveInt(
          latestDiscountedProductsSource.productsLimit,
          defaultsHome.latestDiscountedProducts.productsLimit
        ),
      },
      getYourDailyNeeds: {
        ...defaultsHome.getYourDailyNeeds,
        enabled: toBool(
          getYourDailyNeedsSource.enabled,
          defaultsHome.getYourDailyNeeds.enabled
        ),
        title: toText(
          getYourDailyNeedsSource.title,
          defaultsHome.getYourDailyNeeds.title
        ),
        description: toText(
          getYourDailyNeedsSource.description,
          defaultsHome.getYourDailyNeeds.description
        ),
        imageLeftDataUrl: toText(getYourDailyNeedsSource.imageLeftDataUrl, ""),
        imageRightDataUrl: toText(getYourDailyNeedsSource.imageRightDataUrl, ""),
        button1: {
          ...defaultsHome.getYourDailyNeeds.button1,
          imageDataUrl: toText(getYourDailyNeedsButton1Source.imageDataUrl, ""),
          link: toText(
            getYourDailyNeedsButton1Source.link,
            defaultsHome.getYourDailyNeeds.button1.link
          ),
        },
        button2: {
          ...defaultsHome.getYourDailyNeeds.button2,
          imageDataUrl: toText(getYourDailyNeedsButton2Source.imageDataUrl, ""),
          link: toText(
            getYourDailyNeedsButton2Source.link,
            defaultsHome.getYourDailyNeeds.button2.link
          ),
        },
      },
      featurePromoSection: {
        ...defaultsHome.featurePromoSection,
        enabled: toBool(
          featurePromoSectionSource.enabled,
          defaultsHome.featurePromoSection.enabled
        ),
        freeShippingText: toText(
          featurePromoSectionSource.freeShippingText,
          defaultsHome.featurePromoSection.freeShippingText
        ),
        supportText: toText(
          featurePromoSectionSource.supportText,
          defaultsHome.featurePromoSection.supportText
        ),
        securePaymentText: toText(
          featurePromoSectionSource.securePaymentText,
          defaultsHome.featurePromoSection.securePaymentText
        ),
        latestOfferText: toText(
          featurePromoSectionSource.latestOfferText,
          defaultsHome.featurePromoSection.latestOfferText
        ),
      },
      footer: {
        ...defaultsHome.footer,
        block1: {
          ...defaultsHome.footer.block1,
          enabled: toBool(
            footerBlock1Source.enabled,
            defaultsHome.footer.block1.enabled
          ),
          title: toText(footerBlock1Source.title, defaultsHome.footer.block1.title),
          links: normalizeFooterLinks(
            footerBlock1Source.links,
            defaultsHome.footer.block1.links
          ),
        },
        block2: {
          ...defaultsHome.footer.block2,
          enabled: toBool(
            footerBlock2Source.enabled,
            defaultsHome.footer.block2.enabled
          ),
          title: toText(footerBlock2Source.title, defaultsHome.footer.block2.title),
          links: normalizeFooterLinks(
            footerBlock2Source.links,
            defaultsHome.footer.block2.links
          ),
        },
        block3: {
          ...defaultsHome.footer.block3,
          enabled: toBool(
            footerBlock3Source.enabled,
            defaultsHome.footer.block3.enabled
          ),
          title: toText(footerBlock3Source.title, defaultsHome.footer.block3.title),
          links: normalizeFooterLinks(
            footerBlock3Source.links,
            defaultsHome.footer.block3.links
          ),
        },
        block4: {
          ...defaultsHome.footer.block4,
          enabled: toBool(
            footerBlock4Source.enabled,
            defaultsHome.footer.block4.enabled
          ),
          footerLogoDataUrl: toText(footerBlock4Source.footerLogoDataUrl, ""),
          address: toText(footerBlock4Source.address, defaultsHome.footer.block4.address),
          phone: toText(footerBlock4Source.phone, defaultsHome.footer.block4.phone),
          email: toText(footerBlock4Source.email, defaultsHome.footer.block4.email),
        },
        socialLinks: {
          ...defaultsHome.footer.socialLinks,
          enabled: toBool(
            footerSocialLinksSource.enabled,
            defaultsHome.footer.socialLinks.enabled
          ),
          facebook: toText(
            footerSocialLinksSource.facebook,
            defaultsHome.footer.socialLinks.facebook
          ),
          twitter: toText(
            footerSocialLinksSource.twitter,
            defaultsHome.footer.socialLinks.twitter
          ),
          pinterest: toText(
            footerSocialLinksSource.pinterest,
            defaultsHome.footer.socialLinks.pinterest
          ),
          linkedin: toText(
            footerSocialLinksSource.linkedin,
            defaultsHome.footer.socialLinks.linkedin
          ),
          whatsapp: toText(
            footerSocialLinksSource.whatsapp,
            defaultsHome.footer.socialLinks.whatsapp
          ),
        },
        paymentMethod: {
          ...defaultsHome.footer.paymentMethod,
          enabled: toBool(
            footerPaymentMethodSource.enabled,
            defaultsHome.footer.paymentMethod.enabled
          ),
          imageDataUrl: toText(footerPaymentMethodSource.imageDataUrl, ""),
        },
        bottomContact: {
          ...defaultsHome.footer.bottomContact,
          enabled: toBool(
            footerBottomContactSource.enabled,
            defaultsHome.footer.bottomContact.enabled
          ),
          contactNumber: toText(
            footerBottomContactSource.contactNumber,
            defaultsHome.footer.bottomContact.contactNumber
          ),
        },
      },
    },
    productSlugPage: {
      ...defaultsProductSlugPage,
      ...productSlugPageSource,
      rightBox: {
        ...defaultsProductSlugPage.rightBox,
        ...productSlugRightBoxSource,
        enabled: toBool(
          productSlugRightBoxSource.enabled,
          defaultsProductSlugPage.rightBox.enabled
        ),
        descriptions: normalizeRightBoxDescriptions(
          productSlugRightBoxSource.descriptions,
          defaultsProductSlugPage.rightBox.descriptions,
          productSlugRightBoxSource
        ),
      },
    },
    seoSettings: {
      ...defaultsSeoSettings,
      ...seoSettingsSource,
      faviconDataUrl: toText(
        seoSettingsSource.faviconDataUrl ??
          seoSettingsSource.favicon ??
          seoSettingsSource.faviconImage ??
          "",
        ""
      ),
      metaTitle: toText(seoSettingsSource.metaTitle, defaultsSeoSettings.metaTitle),
      metaDescription: toText(
        seoSettingsSource.metaDescription,
        defaultsSeoSettings.metaDescription
      ),
      metaUrl: toText(seoSettingsSource.metaUrl, defaultsSeoSettings.metaUrl),
      metaKeywords: toText(
        seoSettingsSource.metaKeywords,
        defaultsSeoSettings.metaKeywords
      ),
      metaImageDataUrl: toText(
        seoSettingsSource.metaImageDataUrl ??
          seoSettingsSource.metaImage ??
          seoSettingsSource.image ??
          "",
        ""
      ),
    },
  };
};

const getStoredAdminLanguageIso = () => {
  try {
    const raw = localStorage.getItem(ADMIN_LANGUAGE_KEY);
    if (!raw) return "en";
    const parsed = JSON.parse(raw);
    const isoCode = String(parsed?.isoCode || "en").trim().toLowerCase();
    return isoCode || "en";
  } catch {
    return "en";
  }
};

const toLanguagePayload = (form) => ({
  name: String(form.name || "").trim(),
  isoCode: String(form.isoCode || "").trim().toLowerCase(),
  flag: String(form.flag || "").trim().toUpperCase(),
  published: Boolean(form.published),
});

function SegmentedToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
          value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
          !value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        No
      </button>
    </div>
  );
}

export default function StoreCustomizationPage() {
  const queryClient = useQueryClient();
  const presetRef = useRef(null);
  const fileInputRef = useRef(null);
  const quickDeliveryFileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [activeMainSliderTab, setActiveMainSliderTab] = useState("slider-0");
  const [lang, setLang] = useState(getStoredAdminLanguageIso);
  const [homeState, setHomeState] = useState(() => getDefaultCustomization().home);
  const [productSlugPageState, setProductSlugPageState] = useState(
    () => getDefaultCustomization().productSlugPage
  );
  const [seoSettingsState, setSeoSettingsState] = useState(
    () => getDefaultCustomization().seoSettings
  );
  const [notice, setNotice] = useState(null);
  const [logoError, setLogoError] = useState("");
  const [isDropActive, setIsDropActive] = useState(false);
  const [isMainSliderDropActive, setIsMainSliderDropActive] = useState(false);
  const [mainSliderImageErrors, setMainSliderImageErrors] = useState({});
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [quickDeliveryImageError, setQuickDeliveryImageError] = useState("");
  const [isQuickDeliveryDropActive, setIsQuickDeliveryDropActive] = useState(false);
  const [dailyNeedsImageErrors, setDailyNeedsImageErrors] = useState({
    imageLeftDataUrl: "",
    imageRightDataUrl: "",
    button1ImageDataUrl: "",
    button2ImageDataUrl: "",
  });
  const [dailyNeedsDropActive, setDailyNeedsDropActive] = useState({
    imageLeftDataUrl: false,
    imageRightDataUrl: false,
    button1ImageDataUrl: false,
    button2ImageDataUrl: false,
  });
  const [footerImageErrors, setFooterImageErrors] = useState({
    footerLogoDataUrl: "",
    paymentImageDataUrl: "",
  });
  const [footerDropActive, setFooterDropActive] = useState({
    footerLogoDataUrl: false,
    paymentImageDataUrl: false,
  });
  const [seoImageErrors, setSeoImageErrors] = useState({
    faviconDataUrl: "",
    metaImageDataUrl: "",
  });
  const [seoDropActive, setSeoDropActive] = useState({
    faviconDataUrl: false,
    metaImageDataUrl: false,
  });

  const [isAddLanguageOpen, setIsAddLanguageOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [addLanguageError, setAddLanguageError] = useState("");
  const [addLanguageForm, setAddLanguageForm] = useState({
    selectedPreset: "id",
    name: "Indonesian",
    isoCode: "id",
    flag: "ID",
    published: true,
  });

  const languagesQuery = useQuery({
    queryKey: ["admin-customization-languages"],
    queryFn: () => fetchAdminLanguages(),
    staleTime: 60_000,
  });

  const publishedLanguages = useMemo(
    () =>
      (languagesQuery.data?.data || [])
        .map(normalizeLanguage)
        .filter((item) => item.isoCode && item.name && item.published),
    [languagesQuery.data]
  );

  useEffect(() => {
    if (publishedLanguages.length === 0) return;
    const exists = publishedLanguages.some((item) => item.isoCode === lang);
    if (exists) return;
    const fallback =
      publishedLanguages.find((item) => item.isoCode === "en") ||
      publishedLanguages[0];
    setLang(fallback.isoCode);
  }, [publishedLanguages, lang]);

  const customizationQuery = useQuery({
    queryKey: ["admin-store-customization", lang],
    enabled: Boolean(lang),
    queryFn: () => fetchAdminStoreCustomization(lang),
  });

  useEffect(() => {
    const payload = customizationQuery.data?.customization || customizationQuery.data;
    if (!payload) return;
    const normalized = normalizeCustomizationPayload(payload);
    setHomeState(normalized.home);
    setProductSlugPageState(normalized.productSlugPage);
    setSeoSettingsState(normalized.seoSettings);
    setLogoError("");
    setMainSliderImageErrors({});
    setIsMainSliderDropActive(false);
    setCouponCodeInput("");
    setQuickDeliveryImageError("");
    setIsQuickDeliveryDropActive(false);
    setDailyNeedsImageErrors({
      imageLeftDataUrl: "",
      imageRightDataUrl: "",
      button1ImageDataUrl: "",
      button2ImageDataUrl: "",
    });
    setDailyNeedsDropActive({
      imageLeftDataUrl: false,
      imageRightDataUrl: false,
      button1ImageDataUrl: false,
      button2ImageDataUrl: false,
    });
    setFooterImageErrors({
      footerLogoDataUrl: "",
      paymentImageDataUrl: "",
    });
    setFooterDropActive({
      footerLogoDataUrl: false,
      paymentImageDataUrl: false,
    });
    setSeoImageErrors({
      faviconDataUrl: "",
      metaImageDataUrl: "",
    });
    setSeoDropActive({
      faviconDataUrl: false,
      metaImageDataUrl: false,
    });
  }, [customizationQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ language, payload }) =>
      updateAdminStoreCustomization(language, payload),
    onSuccess: async (data) => {
      const payload = data?.customization || data;
      const normalized = normalizeCustomizationPayload(payload);
      setHomeState(normalized.home);
      setProductSlugPageState(normalized.productSlugPage);
      setSeoSettingsState(normalized.seoSettings);
      setNotice({ type: "success", message: "Store customization updated." });
      await queryClient.invalidateQueries({
        queryKey: ["admin-store-customization", lang],
      });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update customization.",
      });
    },
  });

  const addLanguageMutation = useMutation({
    mutationFn: createAdminLanguage,
    onSuccess: async (result) => {
      const created = normalizeLanguage(result?.data || result);
      await queryClient.invalidateQueries({
        queryKey: ["admin-customization-languages"],
      });
      setIsAddLanguageOpen(false);
      setPresetOpen(false);
      setAddLanguageError("");
      if (created?.published && created?.isoCode) {
        setLang(created.isoCode);
      }
      setNotice({ type: "success", message: "Language added." });
    },
    onError: (error) => {
      setAddLanguageError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to add language."
      );
    },
  });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isAddLanguageOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    const handleOutside = (event) => {
      if (!presetOpen) return;
      if (!presetRef.current?.contains(event.target)) {
        setPresetOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAddLanguageOpen(false);
        setPresetOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isAddLanguageOpen, presetOpen]);

  const selectedPreset = LANGUAGE_PRESETS.find(
    (item) => item.isoCode === addLanguageForm.selectedPreset
  );
  const selectedPresetLabel = selectedPreset
    ? `${selectedPreset.flag} ${selectedPreset.displayName} (${selectedPreset.isoCode})`
    : "Select a language";

  const onSave = () => {
    setNotice(null);
    const current = queryClient.getQueryData(["admin-store-customization", lang]);
    const currentCustomization = normalizeCustomizationPayload(
      current?.customization || current || {}
    );

    const nextPayload = {
      ...currentCustomization,
      home: {
        ...currentCustomization.home,
        header: {
          ...currentCustomization.home?.header,
          ...homeState.header,
        },
        menuEditor: {
          ...currentCustomization.home?.menuEditor,
          labels: {
            ...currentCustomization.home?.menuEditor?.labels,
            ...homeState.menuEditor.labels,
          },
          enabled: {
            ...currentCustomization.home?.menuEditor?.enabled,
            ...homeState.menuEditor.enabled,
          },
        },
        mainSlider: {
          ...currentCustomization.home?.mainSlider,
          sliders: Array.isArray(homeState?.mainSlider?.sliders)
            ? homeState.mainSlider.sliders.map((item) => ({
                imageDataUrl: toText(item?.imageDataUrl),
                title: toText(item?.title),
                description: toText(item?.description),
                buttonName: toText(item?.buttonName),
                buttonLink: toText(item?.buttonLink),
              }))
            : getDefaultCustomization().home.mainSlider.sliders,
          options: {
            ...currentCustomization.home?.mainSlider?.options,
            ...homeState.mainSlider.options,
          },
        },
        discountCouponBox: {
          ...currentCustomization.home?.discountCouponBox,
          enabled: Boolean(homeState.discountCouponBox.enabled),
          title: toText(homeState.discountCouponBox.title),
          activeCouponCodes: normalizeCouponCodes(
            homeState.discountCouponBox.activeCouponCodes
          ),
        },
        promotionBanner: {
          ...currentCustomization.home?.promotionBanner,
          enabled: Boolean(homeState.promotionBanner.enabled),
          title: toText(homeState.promotionBanner.title),
          description: toText(homeState.promotionBanner.description),
          buttonName: toText(homeState.promotionBanner.buttonName),
          buttonLink: toText(homeState.promotionBanner.buttonLink),
        },
        featuredCategories: {
          ...currentCustomization.home?.featuredCategories,
          enabled: Boolean(homeState.featuredCategories.enabled),
          title: toText(homeState.featuredCategories.title),
          description: toText(homeState.featuredCategories.description),
          productsLimit: toPositiveInt(homeState.featuredCategories.productsLimit, 12),
        },
        popularProducts: {
          ...currentCustomization.home?.popularProducts,
          enabled: Boolean(homeState.popularProducts.enabled),
          title: toText(homeState.popularProducts.title),
          description: toText(homeState.popularProducts.description),
          productsLimit: toPositiveInt(homeState.popularProducts.productsLimit, 18),
        },
        quickDelivery: {
          ...currentCustomization.home?.quickDelivery,
          enabled: Boolean(homeState.quickDelivery.enabled),
          subTitle: toText(homeState.quickDelivery.subTitle),
          title: toText(homeState.quickDelivery.title),
          description: toText(homeState.quickDelivery.description),
          buttonName: toText(homeState.quickDelivery.buttonName),
          buttonLink: toText(homeState.quickDelivery.buttonLink),
          imageDataUrl: toText(homeState.quickDelivery.imageDataUrl),
        },
        latestDiscountedProducts: {
          ...currentCustomization.home?.latestDiscountedProducts,
          enabled: Boolean(homeState.latestDiscountedProducts.enabled),
          title: toText(homeState.latestDiscountedProducts.title),
          description: toText(homeState.latestDiscountedProducts.description),
          productsLimit: toPositiveInt(
            homeState.latestDiscountedProducts.productsLimit,
            18
          ),
        },
        getYourDailyNeeds: {
          ...currentCustomization.home?.getYourDailyNeeds,
          enabled: Boolean(homeState.getYourDailyNeeds.enabled),
          title: toText(homeState.getYourDailyNeeds.title),
          description: toText(homeState.getYourDailyNeeds.description),
          imageLeftDataUrl: toText(homeState.getYourDailyNeeds.imageLeftDataUrl),
          imageRightDataUrl: toText(homeState.getYourDailyNeeds.imageRightDataUrl),
          button1: {
            ...currentCustomization.home?.getYourDailyNeeds?.button1,
            ...homeState.getYourDailyNeeds.button1,
            imageDataUrl: toText(homeState.getYourDailyNeeds.button1.imageDataUrl),
            link: toText(homeState.getYourDailyNeeds.button1.link),
          },
          button2: {
            ...currentCustomization.home?.getYourDailyNeeds?.button2,
            ...homeState.getYourDailyNeeds.button2,
            imageDataUrl: toText(homeState.getYourDailyNeeds.button2.imageDataUrl),
            link: toText(homeState.getYourDailyNeeds.button2.link),
          },
        },
        featurePromoSection: {
          ...currentCustomization.home?.featurePromoSection,
          enabled: Boolean(homeState.featurePromoSection.enabled),
          freeShippingText: toText(homeState.featurePromoSection.freeShippingText),
          supportText: toText(homeState.featurePromoSection.supportText),
          securePaymentText: toText(homeState.featurePromoSection.securePaymentText),
          latestOfferText: toText(homeState.featurePromoSection.latestOfferText),
        },
        footer: {
          ...currentCustomization.home?.footer,
          block1: {
            ...currentCustomization.home?.footer?.block1,
            enabled: Boolean(homeState.footer.block1.enabled),
            title: toText(homeState.footer.block1.title),
            links: normalizeFooterLinks(
              homeState.footer.block1.links,
              getDefaultCustomization().home.footer.block1.links
            ),
          },
          block2: {
            ...currentCustomization.home?.footer?.block2,
            enabled: Boolean(homeState.footer.block2.enabled),
            title: toText(homeState.footer.block2.title),
            links: normalizeFooterLinks(
              homeState.footer.block2.links,
              getDefaultCustomization().home.footer.block2.links
            ),
          },
          block3: {
            ...currentCustomization.home?.footer?.block3,
            enabled: Boolean(homeState.footer.block3.enabled),
            title: toText(homeState.footer.block3.title),
            links: normalizeFooterLinks(
              homeState.footer.block3.links,
              getDefaultCustomization().home.footer.block3.links
            ),
          },
          block4: {
            ...currentCustomization.home?.footer?.block4,
            enabled: Boolean(homeState.footer.block4.enabled),
            footerLogoDataUrl: toText(homeState.footer.block4.footerLogoDataUrl),
            address: toText(homeState.footer.block4.address),
            phone: toText(homeState.footer.block4.phone),
            email: toText(homeState.footer.block4.email),
          },
          socialLinks: {
            ...currentCustomization.home?.footer?.socialLinks,
            enabled: Boolean(homeState.footer.socialLinks.enabled),
            facebook: toText(homeState.footer.socialLinks.facebook),
            twitter: toText(homeState.footer.socialLinks.twitter),
            pinterest: toText(homeState.footer.socialLinks.pinterest),
            linkedin: toText(homeState.footer.socialLinks.linkedin),
            whatsapp: toText(homeState.footer.socialLinks.whatsapp),
          },
          paymentMethod: {
            ...currentCustomization.home?.footer?.paymentMethod,
            enabled: Boolean(homeState.footer.paymentMethod.enabled),
            imageDataUrl: toText(homeState.footer.paymentMethod.imageDataUrl),
          },
          bottomContact: {
            ...currentCustomization.home?.footer?.bottomContact,
            enabled: Boolean(homeState.footer.bottomContact.enabled),
            contactNumber: toText(homeState.footer.bottomContact.contactNumber),
          },
        },
      },
      productSlugPage: {
        ...currentCustomization.productSlugPage,
        rightBox: {
          ...currentCustomization.productSlugPage?.rightBox,
          enabled: Boolean(productSlugPageState?.rightBox?.enabled),
          descriptions: normalizeRightBoxDescriptions(
            productSlugPageState?.rightBox?.descriptions,
            getDefaultCustomization().productSlugPage.rightBox.descriptions
          ),
        },
      },
      seoSettings: {
        ...currentCustomization.seoSettings,
        ...seoSettingsState,
        faviconDataUrl: toText(seoSettingsState?.faviconDataUrl),
        metaTitle: toText(seoSettingsState?.metaTitle),
        metaDescription: toText(seoSettingsState?.metaDescription),
        metaUrl: toText(seoSettingsState?.metaUrl),
        metaKeywords: toText(seoSettingsState?.metaKeywords),
        metaImageDataUrl: toText(seoSettingsState?.metaImageDataUrl),
      },
    };

    updateMutation.mutate({
      language: lang || "en",
      payload: nextPayload,
    });
  };

  const onChangeHeaderField = (field, value) => {
    setHomeState((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        [field]: value,
      },
    }));
  };

  const onChangeMenuLabel = (key, value) => {
    setHomeState((prev) => ({
      ...prev,
      menuEditor: {
        ...prev.menuEditor,
        labels: {
          ...prev.menuEditor.labels,
          [key]: value,
        },
      },
    }));
  };

  const onChangeMenuEnabled = (key, value) => {
    setHomeState((prev) => ({
      ...prev,
      menuEditor: {
        ...prev.menuEditor,
        enabled: {
          ...prev.menuEditor.enabled,
          [key]: Boolean(value),
        },
      },
    }));
  };

  const onHandleLogoFile = async (file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setLogoError(validation.error);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoError("");
      onChangeHeaderField("logoDataUrl", dataUrl);
    } catch (error) {
      setLogoError(error?.message || "Failed to process image.");
    }
  };

  const onLogoInputChange = async (event) => {
    const file = event.target.files?.[0];
    await onHandleLogoFile(file);
    event.target.value = "";
  };

  const onRemoveLogo = () => {
    setLogoError("");
    onChangeHeaderField("logoDataUrl", "");
  };

  const onDropLogo = async (event) => {
    event.preventDefault();
    setIsDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleLogoFile(file);
  };

  const onOpenAddLanguage = () => {
    setAddLanguageError("");
    setPresetOpen(false);
    setAddLanguageForm({
      selectedPreset: "id",
      name: "Indonesian",
      isoCode: "id",
      flag: "ID",
      published: true,
    });
    setIsAddLanguageOpen(true);
  };

  const onSubmitAddLanguage = (event) => {
    event.preventDefault();
    setAddLanguageError("");
    const payload = toLanguagePayload(addLanguageForm);
    if (!payload.name) {
      setAddLanguageError("Name is required.");
      return;
    }
    if (!payload.isoCode) {
      setAddLanguageError("ISO code is required.");
      return;
    }
    addLanguageMutation.mutate(payload);
  };

  const onSelectPreset = (isoCode) => {
    const preset = LANGUAGE_PRESETS.find((item) => item.isoCode === isoCode);
    if (!preset) return;
    setAddLanguageForm((prev) => ({
      ...prev,
      selectedPreset: preset.isoCode,
      name: preset.name,
      isoCode: preset.isoCode,
      flag: preset.flag,
    }));
    setPresetOpen(false);
  };

  const onChangeMainSliderField = (index, field, value) => {
    setHomeState((prev) => {
      const sliders = Array.isArray(prev.mainSlider?.sliders)
        ? [...prev.mainSlider.sliders]
        : [];
      const currentItem = sliders[index] || {};
      sliders[index] = {
        imageDataUrl: toText(currentItem.imageDataUrl),
        title: toText(currentItem.title),
        description: toText(currentItem.description),
        buttonName: toText(currentItem.buttonName),
        buttonLink: toText(currentItem.buttonLink),
        [field]: value,
      };
      while (sliders.length < MAIN_SLIDER_LENGTH) {
        sliders.push({
          imageDataUrl: "",
          title: "",
          description: "",
          buttonName: "",
          buttonLink: "",
        });
      }
      return {
        ...prev,
        mainSlider: {
          ...prev.mainSlider,
          sliders: sliders.slice(0, MAIN_SLIDER_LENGTH),
        },
      };
    });
  };

  const onChangeMainSliderOption = (key, value) => {
    setHomeState((prev) => {
      const current = {
        showArrows: Boolean(prev.mainSlider?.options?.showArrows),
        showDots: Boolean(prev.mainSlider?.options?.showDots),
        showBoth: Boolean(prev.mainSlider?.options?.showBoth),
      };
      if (key === "showBoth") {
        if (value) {
          return {
            ...prev,
            mainSlider: {
              ...prev.mainSlider,
              options: {
                showArrows: true,
                showDots: true,
                showBoth: true,
              },
            },
          };
        }
        return {
          ...prev,
          mainSlider: {
            ...prev.mainSlider,
            options: {
              ...current,
              showBoth: false,
            },
          },
        };
      }

      const nextOptions = {
        ...current,
        [key]: Boolean(value),
      };
      nextOptions.showBoth = Boolean(nextOptions.showArrows && nextOptions.showDots);

      return {
        ...prev,
        mainSlider: {
          ...prev.mainSlider,
          options: nextOptions,
        },
      };
    });
  };

  const onHandleMainSliderFile = async (index, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setMainSliderImageErrors((prev) => ({
        ...prev,
        [index]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setMainSliderImageErrors((prev) => ({
        ...prev,
        [index]: "",
      }));
      onChangeMainSliderField(index, "imageDataUrl", dataUrl);
    } catch (error) {
      setMainSliderImageErrors((prev) => ({
        ...prev,
        [index]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onMainSliderInputChange = async (index, event) => {
    const file = event.target.files?.[0];
    await onHandleMainSliderFile(index, file);
    event.target.value = "";
  };

  const onRemoveMainSliderImage = (index) => {
    setMainSliderImageErrors((prev) => ({
      ...prev,
      [index]: "",
    }));
    onChangeMainSliderField(index, "imageDataUrl", "");
  };

  const onDropMainSliderImage = async (index, event) => {
    event.preventDefault();
    setIsMainSliderDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleMainSliderFile(index, file);
  };

  const onChangeSimpleHomeBlock = (block, field, value) => {
    setHomeState((prev) => ({
      ...prev,
      [block]: {
        ...prev[block],
        [field]: value,
      },
    }));
  };

  const onChangeSimpleHomeToggle = (block, value) => {
    onChangeSimpleHomeBlock(block, "enabled", Boolean(value));
  };

  const onChangeProductsLimit = (block, value) => {
    onChangeSimpleHomeBlock(block, "productsLimit", toPositiveInt(value, 12));
  };

  const appendCouponCodes = (rawValue) => {
    const parsed = normalizeCouponCodes(rawValue, []);
    if (parsed.length === 0) return;
    setHomeState((prev) => ({
      ...prev,
      discountCouponBox: {
        ...prev.discountCouponBox,
        activeCouponCodes: normalizeCouponCodes([
          ...(prev.discountCouponBox?.activeCouponCodes || []),
          ...parsed,
        ]),
      },
    }));
  };

  const onAddCouponCodes = () => {
    appendCouponCodes(couponCodeInput);
    setCouponCodeInput("");
  };

  const onCouponInputKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      onAddCouponCodes();
    }
  };

  const onRemoveCouponCode = (code) => {
    setHomeState((prev) => ({
      ...prev,
      discountCouponBox: {
        ...prev.discountCouponBox,
        activeCouponCodes: (prev.discountCouponBox?.activeCouponCodes || []).filter(
          (item) => item !== code
        ),
      },
    }));
  };

  const onHandleQuickDeliveryFile = async (file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setQuickDeliveryImageError(validation.error);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setQuickDeliveryImageError("");
      onChangeSimpleHomeBlock("quickDelivery", "imageDataUrl", dataUrl);
    } catch (error) {
      setQuickDeliveryImageError(error?.message || "Failed to process image.");
    }
  };

  const onQuickDeliveryImageChange = async (event) => {
    const file = event.target.files?.[0];
    await onHandleQuickDeliveryFile(file);
    event.target.value = "";
  };

  const onDropQuickDeliveryImage = async (event) => {
    event.preventDefault();
    setIsQuickDeliveryDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleQuickDeliveryFile(file);
  };

  const onRemoveQuickDeliveryImage = () => {
    setQuickDeliveryImageError("");
    onChangeSimpleHomeBlock("quickDelivery", "imageDataUrl", "");
  };

  const onChangeDailyNeedsButtonField = (buttonKey, field, value) => {
    setHomeState((prev) => ({
      ...prev,
      getYourDailyNeeds: {
        ...prev.getYourDailyNeeds,
        [buttonKey]: {
          ...prev.getYourDailyNeeds?.[buttonKey],
          [field]: value,
        },
      },
    }));
  };

  const setDailyNeedsDropActiveField = (fieldKey, value) => {
    setDailyNeedsDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onHandleDailyNeedsImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setDailyNeedsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setDailyNeedsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      if (fieldKey === "imageLeftDataUrl" || fieldKey === "imageRightDataUrl") {
        onChangeSimpleHomeBlock("getYourDailyNeeds", fieldKey, dataUrl);
      } else if (fieldKey === "button1ImageDataUrl") {
        onChangeDailyNeedsButtonField("button1", "imageDataUrl", dataUrl);
      } else if (fieldKey === "button2ImageDataUrl") {
        onChangeDailyNeedsButtonField("button2", "imageDataUrl", dataUrl);
      }
    } catch (error) {
      setDailyNeedsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onDailyNeedsImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleDailyNeedsImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropDailyNeedsImage = async (fieldKey, event) => {
    event.preventDefault();
    setDailyNeedsDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleDailyNeedsImage(fieldKey, file);
  };

  const onRemoveDailyNeedsImage = (fieldKey) => {
    setDailyNeedsImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    if (fieldKey === "imageLeftDataUrl" || fieldKey === "imageRightDataUrl") {
      onChangeSimpleHomeBlock("getYourDailyNeeds", fieldKey, "");
    } else if (fieldKey === "button1ImageDataUrl") {
      onChangeDailyNeedsButtonField("button1", "imageDataUrl", "");
    } else if (fieldKey === "button2ImageDataUrl") {
      onChangeDailyNeedsButtonField("button2", "imageDataUrl", "");
    }
  };

  const onChangeFooterBlockField = (blockKey, field, value) => {
    setHomeState((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        [blockKey]: {
          ...prev.footer?.[blockKey],
          [field]: value,
        },
      },
    }));
  };

  const onChangeFooterLink = (blockKey, index, field, value) => {
    setHomeState((prev) => {
      const fallbackLinks =
        getDefaultCustomization().home.footer[blockKey]?.links || [];
      const currentLinks = normalizeFooterLinks(
        prev.footer?.[blockKey]?.links,
        fallbackLinks
      );
      const nextLinks = currentLinks.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      );
      return {
        ...prev,
        footer: {
          ...prev.footer,
          [blockKey]: {
            ...prev.footer?.[blockKey],
            links: nextLinks,
          },
        },
      };
    });
  };

  const setFooterDropActiveField = (fieldKey, value) => {
    setFooterDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onHandleFooterImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setFooterImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setFooterImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      if (fieldKey === "footerLogoDataUrl") {
        onChangeFooterBlockField("block4", "footerLogoDataUrl", dataUrl);
      } else if (fieldKey === "paymentImageDataUrl") {
        onChangeFooterBlockField("paymentMethod", "imageDataUrl", dataUrl);
      }
    } catch (error) {
      setFooterImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onFooterImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleFooterImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropFooterImage = async (fieldKey, event) => {
    event.preventDefault();
    setFooterDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleFooterImage(fieldKey, file);
  };

  const onRemoveFooterImage = (fieldKey) => {
    setFooterImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    if (fieldKey === "footerLogoDataUrl") {
      onChangeFooterBlockField("block4", "footerLogoDataUrl", "");
    } else if (fieldKey === "paymentImageDataUrl") {
      onChangeFooterBlockField("paymentMethod", "imageDataUrl", "");
    }
  };

  const onChangeProductSlugRightBoxEnabled = (value) => {
    setProductSlugPageState((prev) => ({
      ...prev,
      rightBox: {
        ...prev.rightBox,
        enabled: Boolean(value),
      },
    }));
  };

  const onChangeProductSlugRightBoxDescription = (index, value) => {
    setProductSlugPageState((prev) => {
      const defaults =
        getDefaultCustomization().productSlugPage.rightBox.descriptions;
      const nextDescriptions = normalizeRightBoxDescriptions(
        prev?.rightBox?.descriptions,
        defaults
      );
      nextDescriptions[index] = value;
      return {
        ...prev,
        rightBox: {
          ...prev.rightBox,
          descriptions: normalizeRightBoxDescriptions(nextDescriptions, defaults),
        },
      };
    });
  };

  const onChangeSeoField = (field, value) => {
    setSeoSettingsState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const setSeoDropActiveField = (fieldKey, value) => {
    setSeoDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onHandleSeoImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setSeoImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSeoImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangeSeoField(fieldKey, dataUrl);
    } catch (error) {
      setSeoImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onSeoImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleSeoImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropSeoImage = async (fieldKey, event) => {
    event.preventDefault();
    setSeoDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleSeoImage(fieldKey, file);
  };

  const onRemoveSeoImage = (fieldKey) => {
    setSeoImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangeSeoField(fieldKey, "");
  };

  const activeMainSliderMeta = MAIN_SLIDER_TABS.find(
    (tab) => tab.key === activeMainSliderTab
  );
  const activeMainSliderIndex = Number(activeMainSliderMeta?.index ?? 0);
  const activeMainSliderItem =
    homeState.mainSlider?.sliders?.[activeMainSliderIndex] || {
      imageDataUrl: "",
      title: "",
      description: "",
      buttonName: "",
      buttonLink: "",
    };
  const mainSliderOptions = homeState.mainSlider?.options || {
    showArrows: false,
    showDots: true,
    showBoth: false,
  };
  const discountCouponBox = homeState.discountCouponBox || {
    enabled: true,
    title: "",
    activeCouponCodes: [],
  };
  const promotionBanner = homeState.promotionBanner || {
    enabled: true,
    title: "",
    description: "",
    buttonName: "",
    buttonLink: "",
  };
  const featuredCategories = homeState.featuredCategories || {
    enabled: true,
    title: "",
    description: "",
    productsLimit: 12,
  };
  const popularProducts = homeState.popularProducts || {
    enabled: true,
    title: "",
    description: "",
    productsLimit: 18,
  };
  const quickDelivery = homeState.quickDelivery || {
    enabled: true,
    subTitle: "",
    title: "",
    description: "",
    buttonName: "",
    buttonLink: "",
    imageDataUrl: "",
  };
  const latestDiscountedProducts = homeState.latestDiscountedProducts || {
    enabled: true,
    title: "",
    description: "",
    productsLimit: 18,
  };
  const getYourDailyNeeds = homeState.getYourDailyNeeds || {
    enabled: true,
    title: "",
    description: "",
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
  };
  const featurePromoSection = homeState.featurePromoSection || {
    enabled: true,
    freeShippingText: "",
    supportText: "",
    securePaymentText: "",
    latestOfferText: "",
  };
  const footerDefaults = getDefaultCustomization().home.footer;
  const footer = {
    block1: {
      ...footerDefaults.block1,
      ...(homeState.footer?.block1 || {}),
      links: normalizeFooterLinks(homeState.footer?.block1?.links, footerDefaults.block1.links),
    },
    block2: {
      ...footerDefaults.block2,
      ...(homeState.footer?.block2 || {}),
      links: normalizeFooterLinks(homeState.footer?.block2?.links, footerDefaults.block2.links),
    },
    block3: {
      ...footerDefaults.block3,
      ...(homeState.footer?.block3 || {}),
      links: normalizeFooterLinks(homeState.footer?.block3?.links, footerDefaults.block3.links),
    },
    block4: {
      ...footerDefaults.block4,
      ...(homeState.footer?.block4 || {}),
      footerLogoDataUrl: toText(homeState.footer?.block4?.footerLogoDataUrl, ""),
    },
    socialLinks: {
      ...footerDefaults.socialLinks,
      ...(homeState.footer?.socialLinks || {}),
    },
    paymentMethod: {
      ...footerDefaults.paymentMethod,
      ...(homeState.footer?.paymentMethod || {}),
      imageDataUrl: toText(homeState.footer?.paymentMethod?.imageDataUrl, ""),
    },
    bottomContact: {
      ...footerDefaults.bottomContact,
      ...(homeState.footer?.bottomContact || {}),
    },
  };
  const productSlugRightBoxDefaults =
    getDefaultCustomization().productSlugPage.rightBox;
  const productSlugRightBox = {
    ...productSlugRightBoxDefaults,
    ...(productSlugPageState?.rightBox || {}),
    enabled: Boolean(productSlugPageState?.rightBox?.enabled),
    descriptions: normalizeRightBoxDescriptions(
      productSlugPageState?.rightBox?.descriptions,
      productSlugRightBoxDefaults.descriptions,
      productSlugPageState?.rightBox
    ),
  };
  const seoSettingsDefaults = getDefaultCustomization().seoSettings;
  const seoSettings = {
    ...seoSettingsDefaults,
    ...(seoSettingsState || {}),
    faviconDataUrl: toText(seoSettingsState?.faviconDataUrl, ""),
    metaTitle: toText(seoSettingsState?.metaTitle, ""),
    metaDescription: toText(seoSettingsState?.metaDescription, ""),
    metaUrl: toText(seoSettingsState?.metaUrl, ""),
    metaKeywords: toText(seoSettingsState?.metaKeywords, ""),
    metaImageDataUrl: toText(seoSettingsState?.metaImageDataUrl, ""),
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 px-1 sm:px-2">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">
            Store Customizations
          </h1>
          <p className="text-sm text-slate-500">
            Configure home page sections and menu labels per language.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={lang}
              onChange={(event) => setLang(String(event.target.value).toLowerCase())}
              className={`${inputBase} min-w-[178px] appearance-none pr-9`}
            >
              {publishedLanguages.length === 0 ? (
                <option value="en">en</option>
              ) : (
                publishedLanguages.map((item) => (
                  <option key={item.id || item.isoCode} value={item.isoCode}>
                    {item.isoCode}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={onOpenAddLanguage}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            aria-label="Add language"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={updateMutation.isPending || !lang}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateMutation.isPending ? "Updating..." : "Update"}
          </button>
        </div>
      </div>

      {notice ? (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            notice.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className={sectionCard}>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {customizationQuery.isLoading ? (
        <div className={sectionCard}>Loading customization data...</div>
      ) : customizationQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {customizationQuery.error?.response?.data?.message ||
            customizationQuery.error?.message ||
            "Failed to load customization data."}
        </div>
      ) : activeTab === "productSlugPage" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Right Box</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(productSlugRightBox.enabled)}
                  onChange={onChangeProductSlugRightBoxEnabled}
                />
              </div>

              {PRODUCT_SLUG_DESCRIPTION_LABELS.map((label, index) => (
                <label key={label} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </span>
                  <textarea
                    value={productSlugRightBox.descriptions[index] || ""}
                    onChange={(event) =>
                      onChangeProductSlugRightBoxDescription(index, event.target.value)
                    }
                    className="mt-2 min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      ) : activeTab === "seoSettings" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Seo Settings</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Favicon
                </span>
                <input
                  id="seo-favicon-image-input"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) => onSeoImageInputChange("faviconDataUrl", event)}
                  className="hidden"
                />
                <label
                  htmlFor="seo-favicon-image-input"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setSeoDropActiveField("faviconDataUrl", true);
                  }}
                  onDragLeave={() => setSeoDropActiveField("faviconDataUrl", false)}
                  onDrop={(event) => onDropSeoImage("faviconDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    seoDropActive.faviconDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {seoImageErrors.faviconDataUrl ? (
                  <p className="text-xs text-rose-600">{seoImageErrors.faviconDataUrl}</p>
                ) : null}
                {seoSettings.faviconDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={seoSettings.faviconDataUrl}
                      alt="Favicon preview"
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveSeoImage("faviconDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove favicon image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Meta Title
                  </span>
                  <input
                    type="text"
                    value={seoSettings.metaTitle}
                    onChange={(event) => onChangeSeoField("metaTitle", event.target.value)}
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Meta Description
                  </span>
                  <textarea
                    value={seoSettings.metaDescription}
                    onChange={(event) =>
                      onChangeSeoField("metaDescription", event.target.value)
                    }
                    className="mt-2 min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Meta Url
                  </span>
                  <input
                    type="text"
                    value={seoSettings.metaUrl}
                    onChange={(event) => onChangeSeoField("metaUrl", event.target.value)}
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Meta Keywords
                  </span>
                  <textarea
                    value={seoSettings.metaKeywords}
                    onChange={(event) =>
                      onChangeSeoField("metaKeywords", event.target.value)
                    }
                    className="mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <div className="space-y-2 xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Meta Image
                </span>
                <input
                  id="seo-meta-image-input"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) => onSeoImageInputChange("metaImageDataUrl", event)}
                  className="hidden"
                />
                <label
                  htmlFor="seo-meta-image-input"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setSeoDropActiveField("metaImageDataUrl", true);
                  }}
                  onDragLeave={() => setSeoDropActiveField("metaImageDataUrl", false)}
                  onDrop={(event) => onDropSeoImage("metaImageDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    seoDropActive.metaImageDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {seoImageErrors.metaImageDataUrl ? (
                  <p className="text-xs text-rose-600">{seoImageErrors.metaImageDataUrl}</p>
                ) : null}
                {seoSettings.metaImageDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={seoSettings.metaImageDataUrl}
                      alt="Meta image preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveSeoImage("metaImageDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove meta image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : activeTab !== "home" ? (
        <div className={sectionCard}>
          <h2 className="text-base font-semibold text-slate-900">
            {TABS.find((tab) => tab.key === activeTab)?.label}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Coming soon. This tab will be implemented in the next task.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section className={`${sectionCard} order-1`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Header</h2>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Header Contacts
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Header Text
                </span>
                <input
                  type="text"
                  value={homeState.header.headerText}
                  onChange={(event) =>
                    onChangeHeaderField("headerText", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Number
                </span>
                <input
                  type="text"
                  value={homeState.header.phoneNumber}
                  onChange={(event) =>
                    onChangeHeaderField("phoneNumber", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Header Logo
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={onLogoInputChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDropActive(true);
                  }}
                  onDragLeave={() => setIsDropActive(false)}
                  onDrop={onDropLogo}
                  className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                    isDropActive
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </button>

                {logoError ? (
                  <p className="text-xs text-rose-600">{logoError}</p>
                ) : null}

                {homeState.header.logoDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={homeState.header.logoDataUrl}
                      alt="Header logo preview"
                      className="h-14 w-14 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={onRemoveLogo}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove logo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-3`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Main Slider</h2>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
                {MAIN_SLIDER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveMainSliderTab(tab.key)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeMainSliderTab === tab.key
                        ? "border border-slate-200 bg-white text-emerald-700 shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white p-4 sm:p-5">
                {activeMainSliderTab === "options" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Left and Right Arrows
                      </p>
                      <SegmentedToggle
                        value={Boolean(mainSliderOptions.showArrows)}
                        onChange={(value) =>
                          onChangeMainSliderOption("showArrows", value)
                        }
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Bottom Dots
                      </p>
                      <SegmentedToggle
                        value={Boolean(mainSliderOptions.showDots)}
                        onChange={(value) =>
                          onChangeMainSliderOption("showDots", value)
                        }
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Both
                      </p>
                      <SegmentedToggle
                        value={Boolean(mainSliderOptions.showBoth)}
                        onChange={(value) => onChangeMainSliderOption("showBoth", value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Slider Images
                      </span>
                      <input
                        id={`main-slider-file-${activeMainSliderIndex}`}
                        type="file"
                        accept=".png,.jpeg,.jpg,.webp"
                        onChange={(event) =>
                          onMainSliderInputChange(activeMainSliderIndex, event)
                        }
                        className="hidden"
                      />
                      <label
                        htmlFor={`main-slider-file-${activeMainSliderIndex}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsMainSliderDropActive(true);
                        }}
                        onDragLeave={() => setIsMainSliderDropActive(false)}
                        onDrop={(event) =>
                          onDropMainSliderImage(activeMainSliderIndex, event)
                        }
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                          isMainSliderDropActive
                            ? "border-emerald-400 bg-emerald-50"
                            : "border-slate-300 bg-slate-50 hover:border-slate-400"
                        }`}
                      >
                        <Upload className="h-5 w-5 text-slate-500" />
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          Drag your images here
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          (Only *.jpeg, *.webp and *.png images will be accepted)
                        </p>
                      </label>

                      {mainSliderImageErrors[activeMainSliderIndex] ? (
                        <p className="text-xs text-rose-600">
                          {mainSliderImageErrors[activeMainSliderIndex]}
                        </p>
                      ) : null}

                      {activeMainSliderItem.imageDataUrl ? (
                        <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                          <img
                            src={activeMainSliderItem.imageDataUrl}
                            alt={`Slider ${activeMainSliderIndex + 1} preview`}
                            className="h-20 w-24 rounded-md object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveMainSliderImage(activeMainSliderIndex)}
                            className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                            aria-label={`Remove slider ${activeMainSliderIndex + 1} image`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slider Title
                        </span>
                        <input
                          type="text"
                          value={activeMainSliderItem.title}
                          onChange={(event) =>
                            onChangeMainSliderField(
                              activeMainSliderIndex,
                              "title",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slider Button Name
                        </span>
                        <input
                          type="text"
                          value={activeMainSliderItem.buttonName}
                          onChange={(event) =>
                            onChangeMainSliderField(
                              activeMainSliderIndex,
                              "buttonName",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slider Description
                        </span>
                        <textarea
                          value={activeMainSliderItem.description}
                          onChange={(event) =>
                            onChangeMainSliderField(
                              activeMainSliderIndex,
                              "description",
                              event.target.value
                            )
                          }
                          rows={4}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slider Button Link
                        </span>
                        <input
                          type="text"
                          value={activeMainSliderItem.buttonLink}
                          onChange={(event) =>
                            onChangeMainSliderField(
                              activeMainSliderIndex,
                              "buttonLink",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-4`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Discount Coupon Code Box
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Show / Hide
                </p>
                <SegmentedToggle
                  value={Boolean(discountCouponBox.enabled)}
                  onChange={(value) =>
                    onChangeSimpleHomeToggle("discountCouponBox", value)
                  }
                />
              </div>

              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Home Page Discount Title
                </span>
                <input
                  type="text"
                  value={discountCouponBox.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "discountCouponBox",
                      "title",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <div className="xl:col-span-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Super Discount Active Coupon Code
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(event) => setCouponCodeInput(event.target.value)}
                    onKeyDown={onCouponInputKeyDown}
                    placeholder="SUMMER26, WINTER25"
                    className={`${inputBase} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={onAddCouponCodes}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(discountCouponBox.activeCouponCodes || []).map((code) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={() => onRemoveCouponCode(code)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                        aria-label={`Remove coupon ${code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-5`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Promotion Banner</h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(promotionBanner.enabled)}
                  onChange={(value) => onChangeSimpleHomeToggle("promotionBanner", value)}
                />
              </div>
              <label className="block md:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={promotionBanner.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock("promotionBanner", "title", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <textarea
                  rows={4}
                  value={promotionBanner.description}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "promotionBanner",
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button Name
                </span>
                <input
                  type="text"
                  value={promotionBanner.buttonName}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "promotionBanner",
                      "buttonName",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button Link
                </span>
                <input
                  type="text"
                  value={promotionBanner.buttonLink}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "promotionBanner",
                      "buttonLink",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={`${sectionCard} order-6`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Featured Categories
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(featuredCategories.enabled)}
                  onChange={(value) =>
                    onChangeSimpleHomeToggle("featuredCategories", value)
                  }
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={featuredCategories.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featuredCategories",
                      "title",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Featured Categories
                </span>
                <textarea
                  rows={4}
                  value={featuredCategories.description}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featuredCategories",
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Products Limit
                </span>
                <select
                  value={String(featuredCategories.productsLimit)}
                  onChange={(event) =>
                    onChangeProductsLimit("featuredCategories", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                >
                  {PRODUCTS_LIMIT_OPTIONS.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={`${sectionCard} order-7`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Popular Products</h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(popularProducts.enabled)}
                  onChange={(value) => onChangeSimpleHomeToggle("popularProducts", value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={popularProducts.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock("popularProducts", "title", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <textarea
                  rows={4}
                  value={popularProducts.description}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "popularProducts",
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Products Limit
                </span>
                <select
                  value={String(popularProducts.productsLimit)}
                  onChange={(event) =>
                    onChangeProductsLimit("popularProducts", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                >
                  {PRODUCTS_LIMIT_OPTIONS.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={`${sectionCard} order-8`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Quick Delivery Section
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Enable This Block
                  </p>
                  <SegmentedToggle
                    value={Boolean(quickDelivery.enabled)}
                    onChange={(value) => onChangeSimpleHomeToggle("quickDelivery", value)}
                  />
                </div>

                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Image
                </span>
                <input
                  ref={quickDeliveryFileInputRef}
                  id="quick-delivery-image-input"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={onQuickDeliveryImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => quickDeliveryFileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsQuickDeliveryDropActive(true);
                  }}
                  onDragLeave={() => setIsQuickDeliveryDropActive(false)}
                  onDrop={onDropQuickDeliveryImage}
                  className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    isQuickDeliveryDropActive
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </button>

                {quickDeliveryImageError ? (
                  <p className="text-xs text-rose-600">{quickDeliveryImageError}</p>
                ) : null}

                {quickDelivery.imageDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={quickDelivery.imageDataUrl}
                      alt="Quick delivery preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={onRemoveQuickDeliveryImage}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove quick delivery image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sub Title
                  </span>
                  <input
                    type="text"
                    value={quickDelivery.subTitle}
                    onChange={(event) =>
                      onChangeSimpleHomeBlock(
                        "quickDelivery",
                        "subTitle",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Title
                  </span>
                  <input
                    type="text"
                    value={quickDelivery.title}
                    onChange={(event) =>
                      onChangeSimpleHomeBlock("quickDelivery", "title", event.target.value)
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </span>
                  <textarea
                    rows={4}
                    value={quickDelivery.description}
                    onChange={(event) =>
                      onChangeSimpleHomeBlock(
                        "quickDelivery",
                        "description",
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Button Name
                  </span>
                  <input
                    type="text"
                    value={quickDelivery.buttonName}
                    onChange={(event) =>
                      onChangeSimpleHomeBlock(
                        "quickDelivery",
                        "buttonName",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Button Link
                  </span>
                  <input
                    type="text"
                    value={quickDelivery.buttonLink}
                    onChange={(event) =>
                      onChangeSimpleHomeBlock(
                        "quickDelivery",
                        "buttonLink",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-9`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Latest Discounted Products
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(latestDiscountedProducts.enabled)}
                  onChange={(value) =>
                    onChangeSimpleHomeToggle("latestDiscountedProducts", value)
                  }
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={latestDiscountedProducts.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "latestDiscountedProducts",
                      "title",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <textarea
                  rows={4}
                  value={latestDiscountedProducts.description}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "latestDiscountedProducts",
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Products Limit
                </span>
                <select
                  value={String(latestDiscountedProducts.productsLimit)}
                  onChange={(event) =>
                    onChangeProductsLimit(
                      "latestDiscountedProducts",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                >
                  {PRODUCTS_LIMIT_OPTIONS.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={`${sectionCard} order-10`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Get Your Daily Needs
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 xl:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(getYourDailyNeeds.enabled)}
                  onChange={(value) =>
                    onChangeSimpleHomeToggle("getYourDailyNeeds", value)
                  }
                />
              </div>

              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={getYourDailyNeeds.title}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "getYourDailyNeeds",
                      "title",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <textarea
                  rows={4}
                  value={getYourDailyNeeds.description}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "getYourDailyNeeds",
                      "description",
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Image Left
                </span>
                <input
                  id="daily-needs-image-left"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) =>
                    onDailyNeedsImageInputChange("imageLeftDataUrl", event)
                  }
                  className="hidden"
                />
                <label
                  htmlFor="daily-needs-image-left"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDailyNeedsDropActiveField("imageLeftDataUrl", true);
                  }}
                  onDragLeave={() =>
                    setDailyNeedsDropActiveField("imageLeftDataUrl", false)
                  }
                  onDrop={(event) => onDropDailyNeedsImage("imageLeftDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    dailyNeedsDropActive.imageLeftDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {dailyNeedsImageErrors.imageLeftDataUrl ? (
                  <p className="text-xs text-rose-600">
                    {dailyNeedsImageErrors.imageLeftDataUrl}
                  </p>
                ) : null}
                {getYourDailyNeeds.imageLeftDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={getYourDailyNeeds.imageLeftDataUrl}
                      alt="Daily needs left preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveDailyNeedsImage("imageLeftDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove daily needs left image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Image Right
                </span>
                <input
                  id="daily-needs-image-right"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) =>
                    onDailyNeedsImageInputChange("imageRightDataUrl", event)
                  }
                  className="hidden"
                />
                <label
                  htmlFor="daily-needs-image-right"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDailyNeedsDropActiveField("imageRightDataUrl", true);
                  }}
                  onDragLeave={() =>
                    setDailyNeedsDropActiveField("imageRightDataUrl", false)
                  }
                  onDrop={(event) => onDropDailyNeedsImage("imageRightDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    dailyNeedsDropActive.imageRightDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {dailyNeedsImageErrors.imageRightDataUrl ? (
                  <p className="text-xs text-rose-600">
                    {dailyNeedsImageErrors.imageRightDataUrl}
                  </p>
                ) : null}
                {getYourDailyNeeds.imageRightDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={getYourDailyNeeds.imageRightDataUrl}
                      alt="Daily needs right preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveDailyNeedsImage("imageRightDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove daily needs right image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button 1 Image
                </span>
                <input
                  id="daily-needs-button1-image"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) =>
                    onDailyNeedsImageInputChange("button1ImageDataUrl", event)
                  }
                  className="hidden"
                />
                <label
                  htmlFor="daily-needs-button1-image"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDailyNeedsDropActiveField("button1ImageDataUrl", true);
                  }}
                  onDragLeave={() =>
                    setDailyNeedsDropActiveField("button1ImageDataUrl", false)
                  }
                  onDrop={(event) => onDropDailyNeedsImage("button1ImageDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    dailyNeedsDropActive.button1ImageDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {dailyNeedsImageErrors.button1ImageDataUrl ? (
                  <p className="text-xs text-rose-600">
                    {dailyNeedsImageErrors.button1ImageDataUrl}
                  </p>
                ) : null}
                {getYourDailyNeeds.button1?.imageDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={getYourDailyNeeds.button1.imageDataUrl}
                      alt="Daily needs button 1 preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveDailyNeedsImage("button1ImageDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove daily needs button 1 image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Button 1 Link
                  </span>
                  <input
                    type="text"
                    value={getYourDailyNeeds.button1?.link || ""}
                    onChange={(event) =>
                      onChangeDailyNeedsButtonField(
                        "button1",
                        "link",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Button 2 Image
                </span>
                <input
                  id="daily-needs-button2-image"
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  onChange={(event) =>
                    onDailyNeedsImageInputChange("button2ImageDataUrl", event)
                  }
                  className="hidden"
                />
                <label
                  htmlFor="daily-needs-button2-image"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDailyNeedsDropActiveField("button2ImageDataUrl", true);
                  }}
                  onDragLeave={() =>
                    setDailyNeedsDropActiveField("button2ImageDataUrl", false)
                  }
                  onDrop={(event) => onDropDailyNeedsImage("button2ImageDataUrl", event)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                    dailyNeedsDropActive.button2ImageDataUrl
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Drag your images here
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
                {dailyNeedsImageErrors.button2ImageDataUrl ? (
                  <p className="text-xs text-rose-600">
                    {dailyNeedsImageErrors.button2ImageDataUrl}
                  </p>
                ) : null}
                {getYourDailyNeeds.button2?.imageDataUrl ? (
                  <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={getYourDailyNeeds.button2.imageDataUrl}
                      alt="Daily needs button 2 preview"
                      className="h-20 w-24 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveDailyNeedsImage("button2ImageDataUrl")}
                      className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                      aria-label="Remove daily needs button 2 image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Button 2 Link
                  </span>
                  <input
                    type="text"
                    value={getYourDailyNeeds.button2?.link || ""}
                    onChange={(event) =>
                      onChangeDailyNeedsButtonField(
                        "button2",
                        "link",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-11`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Feature Promo Section
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 md:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(featurePromoSection.enabled)}
                  onChange={(value) =>
                    onChangeSimpleHomeToggle("featurePromoSection", value)
                  }
                />
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Free Shipping
                </span>
                <input
                  type="text"
                  value={featurePromoSection.freeShippingText}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featurePromoSection",
                      "freeShippingText",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Support
                </span>
                <input
                  type="text"
                  value={featurePromoSection.supportText}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featurePromoSection",
                      "supportText",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Secure Payment
                </span>
                <input
                  type="text"
                  value={featurePromoSection.securePaymentText}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featurePromoSection",
                      "securePaymentText",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Latest Offer
                </span>
                <input
                  type="text"
                  value={featurePromoSection.latestOfferText}
                  onChange={(event) =>
                    onChangeSimpleHomeBlock(
                      "featurePromoSection",
                      "latestOfferText",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={`${sectionCard} order-12`}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Footer</h2>
            </div>

            <div className="mt-5 space-y-5">
              {[
                { key: "block1", heading: "Block 1" },
                { key: "block2", heading: "Block 2" },
                { key: "block3", heading: "Block 3" },
              ].map((meta) => {
                const blockData = footer[meta.key];
                return (
                  <div
                    key={meta.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                  >
                    <h3 className="text-sm font-semibold text-slate-900">{meta.heading}</h3>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Enable This Block
                        </p>
                        <SegmentedToggle
                          value={Boolean(blockData.enabled)}
                          onChange={(value) =>
                            onChangeFooterBlockField(meta.key, "enabled", value)
                          }
                        />
                      </div>

                      <label className="block md:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Title
                        </span>
                        <input
                          type="text"
                          value={blockData.title}
                          onChange={(event) =>
                            onChangeFooterBlockField(
                              meta.key,
                              "title",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>

                      {blockData.links.map((link, linkIndex) => (
                        <div key={`${meta.key}-link-${linkIndex}`} className="space-y-2">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Link {linkIndex + 1} Label
                            </span>
                            <input
                              type="text"
                              value={link.label}
                              onChange={(event) =>
                                onChangeFooterLink(
                                  meta.key,
                                  linkIndex,
                                  "label",
                                  event.target.value
                                )
                              }
                              className={`${inputBase} mt-2`}
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Link {linkIndex + 1} Href
                            </span>
                            <input
                              type="text"
                              value={link.href}
                              onChange={(event) =>
                                onChangeFooterLink(
                                  meta.key,
                                  linkIndex,
                                  "href",
                                  event.target.value
                                )
                              }
                              className={`${inputBase} mt-2`}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Block 4</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                  <div className="space-y-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Enable This Block
                      </p>
                      <SegmentedToggle
                        value={Boolean(footer.block4.enabled)}
                        onChange={(value) =>
                          onChangeFooterBlockField("block4", "enabled", value)
                        }
                      />
                    </div>

                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Footer Logo
                    </span>
                    <input
                      id="footer-logo-image-input"
                      type="file"
                      accept=".png,.jpeg,.jpg,.webp"
                      onChange={(event) =>
                        onFooterImageInputChange("footerLogoDataUrl", event)
                      }
                      className="hidden"
                    />
                    <label
                      htmlFor="footer-logo-image-input"
                      onDragOver={(event) => {
                        event.preventDefault();
                        setFooterDropActiveField("footerLogoDataUrl", true);
                      }}
                      onDragLeave={() =>
                        setFooterDropActiveField("footerLogoDataUrl", false)
                      }
                      onDrop={(event) => onDropFooterImage("footerLogoDataUrl", event)}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                        footerDropActive.footerLogoDataUrl
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-300 bg-white hover:border-slate-400"
                      }`}
                    >
                      <Upload className="h-5 w-5 text-slate-500" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        Drag your images here
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        (Only *.jpeg, *.webp and *.png images will be accepted)
                      </p>
                    </label>
                    {footerImageErrors.footerLogoDataUrl ? (
                      <p className="text-xs text-rose-600">
                        {footerImageErrors.footerLogoDataUrl}
                      </p>
                    ) : null}
                    {footer.block4.footerLogoDataUrl ? (
                      <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                        <img
                          src={footer.block4.footerLogoDataUrl}
                          alt="Footer logo preview"
                          className="h-20 w-24 rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveFooterImage("footerLogoDataUrl")}
                          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          aria-label="Remove footer logo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Address
                      </span>
                      <input
                        type="text"
                        value={footer.block4.address}
                        onChange={(event) =>
                          onChangeFooterBlockField("block4", "address", event.target.value)
                        }
                        className={`${inputBase} mt-2`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Phone
                      </span>
                      <input
                        type="text"
                        value={footer.block4.phone}
                        onChange={(event) =>
                          onChangeFooterBlockField("block4", "phone", event.target.value)
                        }
                        className={`${inputBase} mt-2`}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Email
                      </span>
                      <input
                        type="text"
                        value={footer.block4.email}
                        onChange={(event) =>
                          onChangeFooterBlockField("block4", "email", event.target.value)
                        }
                        className={`${inputBase} mt-2`}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Social Links</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Enable This Block
                    </p>
                    <SegmentedToggle
                      value={Boolean(footer.socialLinks.enabled)}
                      onChange={(value) =>
                        onChangeFooterBlockField("socialLinks", "enabled", value)
                      }
                    />
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Facebook
                    </span>
                    <input
                      type="text"
                      value={footer.socialLinks.facebook}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "socialLinks",
                          "facebook",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Twitter
                    </span>
                    <input
                      type="text"
                      value={footer.socialLinks.twitter}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "socialLinks",
                          "twitter",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pinterest
                    </span>
                    <input
                      type="text"
                      value={footer.socialLinks.pinterest}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "socialLinks",
                          "pinterest",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Linkedin
                    </span>
                    <input
                      type="text"
                      value={footer.socialLinks.linkedin}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "socialLinks",
                          "linkedin",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      WhatsApp
                    </span>
                    <input
                      type="text"
                      value={footer.socialLinks.whatsapp}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "socialLinks",
                          "whatsapp",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Payment Method</h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Enable This Block
                    </p>
                    <SegmentedToggle
                      value={Boolean(footer.paymentMethod.enabled)}
                      onChange={(value) =>
                        onChangeFooterBlockField("paymentMethod", "enabled", value)
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment Method Image
                    </span>
                    <input
                      id="footer-payment-image-input"
                      type="file"
                      accept=".png,.jpeg,.jpg,.webp"
                      onChange={(event) =>
                        onFooterImageInputChange("paymentImageDataUrl", event)
                      }
                      className="hidden"
                    />
                    <label
                      htmlFor="footer-payment-image-input"
                      onDragOver={(event) => {
                        event.preventDefault();
                        setFooterDropActiveField("paymentImageDataUrl", true);
                      }}
                      onDragLeave={() =>
                        setFooterDropActiveField("paymentImageDataUrl", false)
                      }
                      onDrop={(event) => onDropFooterImage("paymentImageDataUrl", event)}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                        footerDropActive.paymentImageDataUrl
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-300 bg-white hover:border-slate-400"
                      }`}
                    >
                      <Upload className="h-5 w-5 text-slate-500" />
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        Drag your images here
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        (Only *.jpeg, *.webp and *.png images will be accepted)
                      </p>
                    </label>
                    {footerImageErrors.paymentImageDataUrl ? (
                      <p className="text-xs text-rose-600">
                        {footerImageErrors.paymentImageDataUrl}
                      </p>
                    ) : null}
                    {footer.paymentMethod.imageDataUrl ? (
                      <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
                        <img
                          src={footer.paymentMethod.imageDataUrl}
                          alt="Footer payment preview"
                          className="h-20 w-24 rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveFooterImage("paymentImageDataUrl")}
                          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                          aria-label="Remove payment method image"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Footer Bottom Contact Number
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 md:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Enable This Block
                    </p>
                    <SegmentedToggle
                      value={Boolean(footer.bottomContact.enabled)}
                      onChange={(value) =>
                        onChangeFooterBlockField("bottomContact", "enabled", value)
                      }
                    />
                  </div>

                  <label className="block md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Footer Bottom Contact Number
                    </span>
                    <input
                      type="text"
                      value={footer.bottomContact.contactNumber}
                      onChange={(event) =>
                        onChangeFooterBlockField(
                          "bottomContact",
                          "contactNumber",
                          event.target.value
                        )
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className={`${sectionCard} order-2`}>
            <h2 className="text-base font-semibold text-slate-900">Menu Editor</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MENU_LABEL_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </span>
                  <input
                    type="text"
                    value={homeState.menuEditor.labels[field.key]}
                    onChange={(event) =>
                      onChangeMenuLabel(field.key, event.target.value)
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-800">Show / Hide Menu</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ENABLED_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3"
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {field.label}
                    </p>
                    <SegmentedToggle
                      value={Boolean(homeState.menuEditor.enabled[field.key])}
                      onChange={(value) => onChangeMenuEnabled(field.key, value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {isAddLanguageOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Close add language overlay"
            onClick={() => setIsAddLanguageOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full border-l border-slate-200 bg-white shadow-2xl sm:max-w-[560px] lg:w-[40vw] lg:max-w-[620px]">
            <form className="flex h-full flex-col" onSubmit={onSubmitAddLanguage}>
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Add Language</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Add your Language necessary information from here
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddLanguageOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
                    aria-label="Close language drawer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Select Language
                  </span>
                  <div className="relative mt-2" ref={presetRef}>
                    <button
                      type="button"
                      onClick={() => setPresetOpen((prev) => !prev)}
                      className={`${inputBase} flex items-center justify-between px-3.5`}
                    >
                      <span className="truncate">{selectedPresetLabel}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                          presetOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {presetOpen ? (
                      <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        {LANGUAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.isoCode}
                            type="button"
                            onClick={() => onSelectPreset(preset.isoCode)}
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                              addLanguageForm.selectedPreset === preset.isoCode
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-slate-700"
                            }`}
                          >
                            {preset.flag} {preset.displayName} ({preset.isoCode})
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </span>
                  <input
                    type="text"
                    value={addLanguageForm.name}
                    onChange={(event) =>
                      setAddLanguageForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ISO Code
                  </span>
                  <input
                    type="text"
                    value={addLanguageForm.isoCode}
                    onChange={(event) =>
                      setAddLanguageForm((prev) => ({
                        ...prev,
                        isoCode: event.target.value,
                      }))
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Flag
                  </span>
                  <input
                    type="text"
                    value={addLanguageForm.flag}
                    onChange={(event) =>
                      setAddLanguageForm((prev) => ({
                        ...prev,
                        flag: event.target.value,
                      }))
                    }
                    className={`${inputBase} mt-2 uppercase`}
                  />
                </label>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Published
                  </span>
                  <div className="mt-2">
                    <SegmentedToggle
                      value={Boolean(addLanguageForm.published)}
                      onChange={(value) =>
                        setAddLanguageForm((prev) => ({
                          ...prev,
                          published: value,
                        }))
                      }
                    />
                  </div>
                </div>

                {addLanguageError ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {addLanguageError}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddLanguageOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLanguageMutation.isPending}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addLanguageMutation.isPending ? "Adding..." : "Add Language"}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}

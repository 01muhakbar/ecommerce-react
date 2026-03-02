import { Router } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const router = Router();

type CustomizationRow = {
  id: number;
  lang: string;
  data: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_CUSTOMIZATION = {
  home: {
    header: {
      headerText: "We are available 24/7, Need help??",
      phoneNumber: "565555",
      logoDataUrl: "",
    },
    mainSlider: {
      sliders: Array.from({ length: 5 }, () => ({
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
        address:
          "987 Andre Plain Suite High Street 838, Lake Hestertown, USA",
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
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const normalizeLang = (value: unknown) => {
  const normalized = String(value || "en")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return normalized || "en";
};

const cloneDefaults = () => JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION));

const mergeDeep = (base: any, source: any): any => {
  if (!isPlainObject(base)) return source;
  const output: Record<string, any> = { ...base };
  if (!isPlainObject(source)) return output;

  for (const [key, sourceValue] of Object.entries(source)) {
    const baseValue = output[key];
    if (isPlainObject(baseValue) && isPlainObject(sourceValue)) {
      output[key] = mergeDeep(baseValue, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  }

  return output;
};

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
};

const normalizeCouponCodes = (value: unknown, fallback: string[] = []) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = rawItems
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter(Boolean);
  if (normalized.length === 0) {
    return [...fallback];
  }
  return [...new Set(normalized)];
};

const normalizeFooterLinks = (
  value: unknown,
  fallback: Array<{ label: string; href: string }>
) => {
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

const PRODUCT_SLUG_DESCRIPTION_KEYS = [
  "descriptionOne",
  "descriptionTwo",
  "descriptionThree",
  "descriptionFour",
  "descriptionFive",
  "descriptionSix",
  "descriptionSeven",
] as const;

const normalizeRightBoxDescriptions = (
  value: unknown,
  fallback: string[],
  legacySource: Record<string, unknown> = {}
) => {
  const rawArray = Array.isArray(value) ? value : [];
  return fallback.map((fallbackValue, index) => {
    const fromArray =
      index < rawArray.length ? toText(rawArray[index], "") : "";
    const legacyKey = PRODUCT_SLUG_DESCRIPTION_KEYS[index];
    const fromLegacy = toText(legacySource[legacyKey], "");
    return toText(fromArray || fromLegacy, fallbackValue);
  });
};

const normalizeHome = (root: Record<string, any>) => {
  const defaults = cloneDefaults().home;
  const homeCandidate = isPlainObject(root.home) ? root.home : {};
  const legacyHomeCandidate = isPlainObject(root.homePage) ? root.homePage : {};

  const headerSource = isPlainObject(homeCandidate.header)
    ? homeCandidate.header
    : isPlainObject(legacyHomeCandidate.headerContacts)
      ? legacyHomeCandidate.headerContacts
      : {};

  const menuSource = isPlainObject(homeCandidate.menuEditor)
    ? homeCandidate.menuEditor
    : isPlainObject(legacyHomeCandidate.menuEditor)
      ? legacyHomeCandidate.menuEditor
      : {};

  const labelsSource = isPlainObject(menuSource.labels) ? menuSource.labels : {};
  const enabledSource = isPlainObject(menuSource.enabled)
    ? menuSource.enabled
    : isPlainObject(menuSource.visibility)
      ? menuSource.visibility
      : {};

  const labels = mergeDeep(defaults.menuEditor.labels, labelsSource);
  const enabledDefaults = defaults.menuEditor.enabled;
  const mainSliderDefaults = defaults.mainSlider;
  const sliderFallbacks = mainSliderDefaults.sliders as Array<{
    imageDataUrl: string;
    title: string;
    description: string;
    buttonName: string;
    buttonLink: string;
  }>;

  const mainSliderSource = isPlainObject(homeCandidate.mainSlider)
    ? homeCandidate.mainSlider
    : isPlainObject(legacyHomeCandidate.mainSlider)
      ? legacyHomeCandidate.mainSlider
      : {};
  const sliderArray = Array.isArray(mainSliderSource.sliders)
    ? mainSliderSource.sliders
    : [];

  const sliders = sliderFallbacks.map((fallback, index: number) => {
    const order = index + 1;
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

  const discountCouponBoxSource = isPlainObject(homeCandidate.discountCouponBox)
    ? homeCandidate.discountCouponBox
    : {};
  const promotionBannerSource = isPlainObject(homeCandidate.promotionBanner)
    ? homeCandidate.promotionBanner
    : {};
  const featuredCategoriesSource = isPlainObject(homeCandidate.featuredCategories)
    ? homeCandidate.featuredCategories
    : {};
  const popularProductsSource = isPlainObject(homeCandidate.popularProducts)
    ? homeCandidate.popularProducts
    : {};
  const quickDeliverySource = isPlainObject(homeCandidate.quickDelivery)
    ? homeCandidate.quickDelivery
    : {};
  const latestDiscountedProductsSource = isPlainObject(
    homeCandidate.latestDiscountedProducts
  )
    ? homeCandidate.latestDiscountedProducts
    : {};
  const getYourDailyNeedsSource = isPlainObject(homeCandidate.getYourDailyNeeds)
    ? homeCandidate.getYourDailyNeeds
    : {};
  const featurePromoSectionSource = isPlainObject(homeCandidate.featurePromoSection)
    ? homeCandidate.featurePromoSection
    : {};
  const footerSource = isPlainObject(homeCandidate.footer) ? homeCandidate.footer : {};
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

  const enabled = {
    showCategories: toBool(enabledSource.showCategories, enabledDefaults.showCategories),
    showAboutUs: toBool(enabledSource.showAboutUs, enabledDefaults.showAboutUs),
    showContactUs: toBool(enabledSource.showContactUs, enabledDefaults.showContactUs),
    showOffers: toBool(enabledSource.showOffers, enabledDefaults.showOffers),
    showFaq: toBool(enabledSource.showFaq, enabledDefaults.showFaq),
    showPrivacyPolicy: toBool(
      enabledSource.showPrivacyPolicy,
      enabledDefaults.showPrivacyPolicy
    ),
    showTermsAndConditions: toBool(
      enabledSource.showTermsAndConditions,
      enabledDefaults.showTermsAndConditions
    ),
  };

  return {
    ...mergeDeep(defaults, homeCandidate),
    header: {
      ...defaults.header,
      headerText: toText(headerSource.headerText, defaults.header.headerText),
      phoneNumber: toText(headerSource.phoneNumber, defaults.header.phoneNumber),
      logoDataUrl: toText(headerSource.logoDataUrl, ""),
    },
    menuEditor: {
      ...defaults.menuEditor,
      labels,
      enabled,
    },
    mainSlider: {
      ...mainSliderDefaults,
      sliders,
      options: normalizedMainSliderOptions,
    },
    discountCouponBox: {
      ...defaults.discountCouponBox,
      enabled: toBool(
        discountCouponBoxSource.enabled,
        defaults.discountCouponBox.enabled
      ),
      title: toText(discountCouponBoxSource.title, defaults.discountCouponBox.title),
      activeCouponCodes: normalizeCouponCodes(
        discountCouponBoxSource.activeCouponCodes,
        defaults.discountCouponBox.activeCouponCodes
      ),
    },
    promotionBanner: {
      ...defaults.promotionBanner,
      enabled: toBool(
        promotionBannerSource.enabled,
        defaults.promotionBanner.enabled
      ),
      title: toText(promotionBannerSource.title, defaults.promotionBanner.title),
      description: toText(
        promotionBannerSource.description,
        defaults.promotionBanner.description
      ),
      buttonName: toText(
        promotionBannerSource.buttonName,
        defaults.promotionBanner.buttonName
      ),
      buttonLink: toText(
        promotionBannerSource.buttonLink,
        defaults.promotionBanner.buttonLink
      ),
    },
    featuredCategories: {
      ...defaults.featuredCategories,
      enabled: toBool(
        featuredCategoriesSource.enabled,
        defaults.featuredCategories.enabled
      ),
      title: toText(featuredCategoriesSource.title, defaults.featuredCategories.title),
      description: toText(
        featuredCategoriesSource.description,
        defaults.featuredCategories.description
      ),
      productsLimit: toPositiveInt(
        featuredCategoriesSource.productsLimit,
        defaults.featuredCategories.productsLimit
      ),
    },
    popularProducts: {
      ...defaults.popularProducts,
      enabled: toBool(popularProductsSource.enabled, defaults.popularProducts.enabled),
      title: toText(popularProductsSource.title, defaults.popularProducts.title),
      description: toText(
        popularProductsSource.description,
        defaults.popularProducts.description
      ),
      productsLimit: toPositiveInt(
        popularProductsSource.productsLimit,
        defaults.popularProducts.productsLimit
      ),
    },
    quickDelivery: {
      ...defaults.quickDelivery,
      enabled: toBool(quickDeliverySource.enabled, defaults.quickDelivery.enabled),
      subTitle: toText(quickDeliverySource.subTitle, defaults.quickDelivery.subTitle),
      title: toText(quickDeliverySource.title, defaults.quickDelivery.title),
      description: toText(
        quickDeliverySource.description,
        defaults.quickDelivery.description
      ),
      buttonName: toText(
        quickDeliverySource.buttonName,
        defaults.quickDelivery.buttonName
      ),
      buttonLink: toText(
        quickDeliverySource.buttonLink,
        defaults.quickDelivery.buttonLink
      ),
      imageDataUrl: toText(quickDeliverySource.imageDataUrl, ""),
    },
    latestDiscountedProducts: {
      ...defaults.latestDiscountedProducts,
      enabled: toBool(
        latestDiscountedProductsSource.enabled,
        defaults.latestDiscountedProducts.enabled
      ),
      title: toText(
        latestDiscountedProductsSource.title,
        defaults.latestDiscountedProducts.title
      ),
      description: toText(
        latestDiscountedProductsSource.description,
        defaults.latestDiscountedProducts.description
      ),
      productsLimit: toPositiveInt(
        latestDiscountedProductsSource.productsLimit,
        defaults.latestDiscountedProducts.productsLimit
      ),
    },
    getYourDailyNeeds: {
      ...defaults.getYourDailyNeeds,
      enabled: toBool(
        getYourDailyNeedsSource.enabled,
        defaults.getYourDailyNeeds.enabled
      ),
      title: toText(getYourDailyNeedsSource.title, defaults.getYourDailyNeeds.title),
      description: toText(
        getYourDailyNeedsSource.description,
        defaults.getYourDailyNeeds.description
      ),
      imageLeftDataUrl: toText(getYourDailyNeedsSource.imageLeftDataUrl, ""),
      imageRightDataUrl: toText(getYourDailyNeedsSource.imageRightDataUrl, ""),
      button1: {
        ...defaults.getYourDailyNeeds.button1,
        imageDataUrl: toText(getYourDailyNeedsButton1Source.imageDataUrl, ""),
        link: toText(
          getYourDailyNeedsButton1Source.link,
          defaults.getYourDailyNeeds.button1.link
        ),
      },
      button2: {
        ...defaults.getYourDailyNeeds.button2,
        imageDataUrl: toText(getYourDailyNeedsButton2Source.imageDataUrl, ""),
        link: toText(
          getYourDailyNeedsButton2Source.link,
          defaults.getYourDailyNeeds.button2.link
        ),
      },
    },
    featurePromoSection: {
      ...defaults.featurePromoSection,
      enabled: toBool(
        featurePromoSectionSource.enabled,
        defaults.featurePromoSection.enabled
      ),
      freeShippingText: toText(
        featurePromoSectionSource.freeShippingText,
        defaults.featurePromoSection.freeShippingText
      ),
      supportText: toText(
        featurePromoSectionSource.supportText,
        defaults.featurePromoSection.supportText
      ),
      securePaymentText: toText(
        featurePromoSectionSource.securePaymentText,
        defaults.featurePromoSection.securePaymentText
      ),
      latestOfferText: toText(
        featurePromoSectionSource.latestOfferText,
        defaults.featurePromoSection.latestOfferText
      ),
    },
    footer: {
      ...defaults.footer,
      block1: {
        ...defaults.footer.block1,
        enabled: toBool(footerBlock1Source.enabled, defaults.footer.block1.enabled),
        title: toText(footerBlock1Source.title, defaults.footer.block1.title),
        links: normalizeFooterLinks(
          footerBlock1Source.links,
          defaults.footer.block1.links
        ),
      },
      block2: {
        ...defaults.footer.block2,
        enabled: toBool(footerBlock2Source.enabled, defaults.footer.block2.enabled),
        title: toText(footerBlock2Source.title, defaults.footer.block2.title),
        links: normalizeFooterLinks(
          footerBlock2Source.links,
          defaults.footer.block2.links
        ),
      },
      block3: {
        ...defaults.footer.block3,
        enabled: toBool(footerBlock3Source.enabled, defaults.footer.block3.enabled),
        title: toText(footerBlock3Source.title, defaults.footer.block3.title),
        links: normalizeFooterLinks(
          footerBlock3Source.links,
          defaults.footer.block3.links
        ),
      },
      block4: {
        ...defaults.footer.block4,
        enabled: toBool(footerBlock4Source.enabled, defaults.footer.block4.enabled),
        footerLogoDataUrl: toText(footerBlock4Source.footerLogoDataUrl, ""),
        address: toText(footerBlock4Source.address, defaults.footer.block4.address),
        phone: toText(footerBlock4Source.phone, defaults.footer.block4.phone),
        email: toText(footerBlock4Source.email, defaults.footer.block4.email),
      },
      socialLinks: {
        ...defaults.footer.socialLinks,
        enabled: toBool(
          footerSocialLinksSource.enabled,
          defaults.footer.socialLinks.enabled
        ),
        facebook: toText(
          footerSocialLinksSource.facebook,
          defaults.footer.socialLinks.facebook
        ),
        twitter: toText(
          footerSocialLinksSource.twitter,
          defaults.footer.socialLinks.twitter
        ),
        pinterest: toText(
          footerSocialLinksSource.pinterest,
          defaults.footer.socialLinks.pinterest
        ),
        linkedin: toText(
          footerSocialLinksSource.linkedin,
          defaults.footer.socialLinks.linkedin
        ),
        whatsapp: toText(
          footerSocialLinksSource.whatsapp,
          defaults.footer.socialLinks.whatsapp
        ),
      },
      paymentMethod: {
        ...defaults.footer.paymentMethod,
        enabled: toBool(
          footerPaymentMethodSource.enabled,
          defaults.footer.paymentMethod.enabled
        ),
        imageDataUrl: toText(footerPaymentMethodSource.imageDataUrl, ""),
      },
      bottomContact: {
        ...defaults.footer.bottomContact,
        enabled: toBool(
          footerBottomContactSource.enabled,
          defaults.footer.bottomContact.enabled
        ),
        contactNumber: toText(
          footerBottomContactSource.contactNumber,
          defaults.footer.bottomContact.contactNumber
        ),
      },
    },
  };
};

const normalizeProductSlugPage = (root: Record<string, any>) => {
  const defaults = cloneDefaults().productSlugPage;
  const source = isPlainObject(root.productSlugPage) ? root.productSlugPage : {};
  const rightBoxSource = isPlainObject(source.rightBox) ? source.rightBox : {};
  const rightBoxDefaults = defaults.rightBox;

  return {
    ...defaults,
    ...source,
    rightBox: {
      ...rightBoxDefaults,
      ...rightBoxSource,
      enabled: toBool(rightBoxSource.enabled, rightBoxDefaults.enabled),
      descriptions: normalizeRightBoxDescriptions(
        rightBoxSource.descriptions,
        rightBoxDefaults.descriptions,
        rightBoxSource
      ),
    },
  };
};

const normalizeSeoSettings = (root: Record<string, any>) => {
  const defaults = cloneDefaults().seoSettings;
  const source = isPlainObject(root.seoSettings)
    ? root.seoSettings
    : isPlainObject(root.seo)
      ? root.seo
      : {};

  return {
    ...defaults,
    ...source,
    faviconDataUrl: toText(
      source.faviconDataUrl ?? source.favicon ?? source.faviconImage ?? "",
      ""
    ),
    metaTitle: toText(source.metaTitle, defaults.metaTitle),
    metaDescription: toText(source.metaDescription, defaults.metaDescription),
    metaUrl: toText(source.metaUrl, defaults.metaUrl),
    metaKeywords: toText(source.metaKeywords, defaults.metaKeywords),
    metaImageDataUrl: toText(
      source.metaImageDataUrl ?? source.metaImage ?? source.image ?? "",
      ""
    ),
  };
};

const sanitizeCustomization = (rawData: unknown) => {
  const source = isPlainObject(rawData) ? rawData : {};
  const merged = mergeDeep(cloneDefaults(), source);
  const normalizedHome = normalizeHome(source);
  const normalizedProductSlugPage = normalizeProductSlugPage(source);
  const normalizedSeoSettings = normalizeSeoSettings(source);
  const output = {
    ...merged,
    home: normalizedHome,
    productSlugPage: normalizedProductSlugPage,
    seoSettings: normalizedSeoSettings,
  };
  delete output.homePage;
  return output;
};

const parseRowData = (raw: string | null) => {
  if (!raw) return cloneDefaults();
  try {
    const parsed = JSON.parse(raw);
    return sanitizeCustomization(parsed);
  } catch {
    return cloneDefaults();
  }
};

const ensureStoreCustomizationsTable = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS store_customizations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      lang VARCHAR(16) NOT NULL,
      data LONGTEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_store_customizations_lang (lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const getCustomizationRow = async (lang: string) => {
  const rows = (await sequelize.query(
    `
      SELECT id, lang, data, createdAt, updatedAt
      FROM store_customizations
      WHERE lang = :lang
      LIMIT 1
    `,
    { type: QueryTypes.SELECT, replacements: { lang } }
  )) as CustomizationRow[];
  return rows[0] || null;
};

const upsertCustomization = async (lang: string, payload: Record<string, any>) => {
  const serialized = JSON.stringify(payload);
  await sequelize.query(
    `
      INSERT INTO store_customizations (lang, data, createdAt, updatedAt)
      VALUES (:lang, :data, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        data = VALUES(data),
        updatedAt = NOW()
    `,
    { replacements: { lang, data: serialized } }
  );
};

// GET /api/admin/store/customization?lang=en
router.get("/", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);

    const existing = await getCustomizationRow(lang);
    const payload = existing
      ? parseRowData(existing.data)
      : sanitizeCustomization({});

    if (!existing) {
      await upsertCustomization(lang, payload);
    }

    return res.json({
      success: true,
      data: {
        lang,
        customization: payload,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/admin/store/customization?lang=en
router.put("/", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);
    const rawPayload = isPlainObject(req.body?.customization)
      ? req.body.customization
      : req.body;

    if (!isPlainObject(rawPayload)) {
      return res.status(400).json({
        success: false,
        message: "Body must be an object",
      });
    }

    const existing = await getCustomizationRow(lang);
    const existingPayload = existing ? parseRowData(existing.data) : sanitizeCustomization({});
    const payload = sanitizeCustomization(mergeDeep(existingPayload, rawPayload));
    await upsertCustomization(lang, payload);

    return res.json({
      success: true,
      data: {
        lang,
        customization: payload,
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

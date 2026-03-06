import { Router } from "express";
import { QueryTypes } from "sequelize";
import fs from "fs";
import path from "path";
import multer from "multer";
import { sequelize } from "../models/index.js";

const router = Router();

type CustomizationRow = {
  id: number;
  lang: string;
  data: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_PRIVACY_POLICY_HTML = [
  "<h3>Consent</h3>",
  "<p>By using KachaBazar, you consent to this privacy policy and agree to the way we collect and use data for shopping, delivery, and support services.</p>",
  "<h3>Information we collect</h3>",
  "<p>We may collect account details, order information, payment metadata, and customer support communications when you use our platform.</p>",
  "<h3>How we use your information</h3>",
  "<ol>",
  "<li>To process and deliver your orders accurately.</li>",
  "<li>To verify payments and prevent fraud.</li>",
  "<li>To provide account access and order tracking updates.</li>",
  "<li>To improve product recommendations and store experience.</li>",
  "<li>To respond to support requests and complaints.</li>",
  "<li>To send service notices and policy updates.</li>",
  "<li>To comply with legal and regulatory obligations.</li>",
  "</ol>",
  "<h3>Data protection</h3>",
  "<p>We apply reasonable technical and organizational safeguards to protect your personal data from unauthorized access, misuse, or disclosure.</p>",
  "<h3>Your rights</h3>",
  "<p>You may request access, correction, or deletion of personal data by contacting the KachaBazar support team.</p>",
].join("");

const DEFAULT_TERMS_AND_CONDITIONS_HTML = [
  "<h2>Welcome to KachaBazar!</h2>",
  "<p>These terms and conditions govern your use of KachaBazar services, including browsing products, placing orders, and managing your account.</p>",
  "<h3>Cookies</h3>",
  "<p>We use cookies to keep your session active, remember preferences, and improve site performance. By continuing to use the site, you agree to our cookie usage.</p>",
  "<h3>License</h3>",
  "<p>Unless otherwise stated, KachaBazar and its licensors own the intellectual property rights for all material on this site.</p>",
  "<ol>",
  "<li>You must not republish material from KachaBazar.</li>",
  "<li>You must not sell, rent, or sub-license material from KachaBazar.</li>",
  "<li>You must not reproduce, duplicate, or copy material from KachaBazar.</li>",
  "<li>You must not redistribute content from KachaBazar without permission.</li>",
  "</ol>",
  "<h3>Content Liability</h3>",
  "<p>We are not responsible for content appearing on third-party websites that link to or reference KachaBazar.</p>",
  "<h3>Reservation of Rights</h3>",
  "<p>We reserve the right to request removal of links or restrict access if usage violates these terms.</p>",
  "<h3>Disclaimer</h3>",
  "<p>To the fullest extent permitted by law, we exclude all representations and warranties relating to this website and its use.</p>",
].join("");

const FAQS_ITEM_LENGTH = 8;
const DEFAULT_FAQS_ITEMS = [
  {
    title: "How does the KachaBazar work?",
    description:
      "KachaBazar lets customers browse daily essentials, add products to cart, and complete orders with a straightforward checkout flow.",
  },
  {
    title: "Can I cancel my subscription anytime?",
    description:
      "Yes. You can cancel or update your subscription preferences at any time from your account settings.",
  },
  {
    title: "Whice payment method you should accept?",
    description:
      "We currently support the configured payment methods available in your region and account setup.",
  },
  {
    title: "Can I cancel my subscription anytime?",
    description:
      "Yes. Subscription changes take effect according to your active billing cycle and selected plan.",
  },
  {
    title: "What is KachaBazar EC2 auto scaling?",
    description:
      "It is a scaling strategy that helps application resources handle traffic spikes while keeping performance stable.",
  },
  {
    title: "What are the benefits of using KachaBazar affiliate?",
    description:
      "Affiliate usage can help expand reach, improve campaign tracking, and increase customer acquisition efficiency.",
  },
  {
    title: "What is a affiliates product configuration?",
    description:
      "It is a setup that maps products, commissions, and campaign rules for partner-driven referrals.",
  },
  {
    title:
      "What is fleet management and how is it different from dynamic scaling?",
    description:
      "Fleet management focuses on maintaining and scheduling infrastructure capacity, while dynamic scaling adjusts resources automatically based on load.",
  },
];

const DEFAULT_CUSTOMIZATION = {
  home: {
    header: {
      headerText: "We are available 24/7, Need help??",
      phoneNumber: "565555",
      whatsAppLink: "",
      headerLogoUrl: "",
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
  aboutUs: {
    pageHeader: {
      enabled: true,
      backgroundImageDataUrl: "",
      pageTitle: "About Us",
    },
    topContentLeft: {
      enabled: true,
      topTitle: "Welcome to our KachaBazar shop",
      topDescription:
        "KachaBazar helps shoppers discover fresh groceries, household essentials, and daily deals with a smooth shopping flow.",
      boxOne: {
        title: "10K",
        subtitle: "Listed Products",
        description: "Carefully curated products across grocery and daily needs.",
      },
      boxTwo: {
        title: "8K",
        subtitle: "Lovely Customer",
        description: "Customers trust our fast fulfillment and product quality.",
      },
      boxThree: {
        title: "18K",
        subtitle: "Orders Delivered",
        description: "Orders delivered with reliable support and transparent updates.",
      },
    },
    topContentRight: {
      enabled: true,
      imageDataUrl: "",
    },
    contentSection: {
      enabled: true,
      firstParagraph:
        "Our mission is to make daily shopping simpler, faster, and more affordable for every household.",
      secondParagraph:
        "We continue improving operations, product quality, and customer support to provide a dependable shopping experience.",
      contentImageDataUrl: "",
    },
    ourTeam: {
      enabled: true,
      title: "Our Team",
      description:
        "Meet the people behind our operations, customer support, and product experience.",
      members: [
        { imageDataUrl: "", title: "Name 1", subTitle: "Role 1" },
        { imageDataUrl: "", title: "Name 2", subTitle: "Role 2" },
        { imageDataUrl: "", title: "Name 3", subTitle: "Role 3" },
        { imageDataUrl: "", title: "Name 4", subTitle: "Role 4" },
        { imageDataUrl: "", title: "Name 5", subTitle: "Role 5" },
        { imageDataUrl: "", title: "Name 6", subTitle: "Role 6" },
      ],
    },
  },
  privacyPolicy: {
    enabled: true,
    pageHeaderBackgroundDataUrl: "",
    pageTitle: "Privacy Policy",
    pageTextHtml: DEFAULT_PRIVACY_POLICY_HTML,
  },
  termsAndConditions: {
    enabled: true,
    pageHeaderBackgroundDataUrl: "",
    pageTitle: "Terms & Conditions",
    pageTextHtml: DEFAULT_TERMS_AND_CONDITIONS_HTML,
  },
  faqs: {
    pageHeader: {
      enabled: true,
      backgroundImageDataUrl: "",
      pageTitle: "FAQs",
    },
    leftColumn: {
      enabled: true,
      leftImageDataUrl: "",
    },
    content: {
      enabled: true,
      items: DEFAULT_FAQS_ITEMS,
    },
  },
  offers: {
    pageHeader: {
      enabled: true,
      backgroundImageDataUrl: "",
      pageTitle: "Mega Offer",
    },
    superDiscount: {
      enabled: true,
      activeCouponCode: "ALL",
    },
  },
  contactUs: {
    pageHeader: {
      enabled: true,
      backgroundImageDataUrl: "",
      pageTitle: "Contact Us",
    },
    emailBox: {
      enabled: true,
      title: "Email Us",
      email: "info@kachabazar.com",
      text: "Interactively grow empowered for process-centric total linkage.",
    },
    callBox: {
      enabled: true,
      title: "Call Us",
      phone: "029-00124667",
      text: "Distinctively disseminate focused solutions clicks-and-mortar ministerate.",
    },
    addressBox: {
      enabled: true,
      title: "Location",
      address: "Boho One, Bridge Street West, Middlesbrough, North Yorkshire, TS2 1AE.",
    },
    middleLeftColumn: {
      enabled: true,
      imageDataUrl: "",
    },
    contactForm: {
      enabled: true,
      title: "For any support just send your query",
      description:
        "Collaboratively promote client-focused convergence vis-a-vis customer-directed alignments via plagiarized strategic users and standardized infrastructures.",
    },
  },
  checkout: {
    personalDetails: {
      sectionTitle: "Personal Details",
      firstNameLabel: "First Name",
      lastNameLabel: "Last Name",
      emailLabel: "Email Address",
      phoneLabel: "Phone",
      firstNamePlaceholder: "First Name",
      lastNamePlaceholder: "Last Name",
      emailPlaceholder: "Email Address",
      phonePlaceholder: "Phone Number",
    },
    shippingDetails: {
      sectionTitle: "Shipping Details",
      streetAddressLabel: "Street Address",
      cityLabel: "City",
      countryLabel: "Country",
      zipLabel: "Zip / Postal",
      streetAddressPlaceholder: "Street Address",
      cityPlaceholder: "City",
      countryPlaceholder: "Country",
      zipPlaceholder: "Zip Code",
      shippingCostLabel: "Shipping Cost",
      shippingOneNameLabel: "Shipping One Name",
      shippingOneNameDefault: "FedEx",
      shippingOneDescriptionLabel: "Shipping One Description",
      shippingOneDescriptionDefault: "Delivery: Today Cost :",
      shippingOneCostLabel: "Shipping One Cost",
      shippingOneCostDefault: "60",
      shippingTwoNameLabel: "Shipping Two Name",
      shippingTwoNameDefault: "UPS",
      shippingTwoDescriptionLabel: "Shipping Two Description",
      shippingTwoDescriptionDefault: "Delivery: 7 Days Cost :",
      shippingTwoCostLabel: "Shipping Two Cost",
      shippingTwoCostDefault: "20",
      paymentMethodLabel: "Payment Method",
      paymentMethodPlaceholder: "Payment Method",
    },
    buttons: {
      continueButtonLabel: "Continue Shipping",
      confirmButtonLabel: "Confirm Order",
    },
    cartItemSection: {
      sectionTitle: "Cart Item Section",
      orderSummaryLabel: "Order Summary",
      applyButtonLabel: "Apply",
      subTotalLabel: "Sub Total",
      discountLabel: "Discount",
      totalCostLabel: "Total Cost",
    },
  },
  dashboardSetting: {
    dashboard: {
      sectionTitle: "Dashboard",
      invoiceMessageFirstPartLabel: "Invoice Message First Part",
      invoiceMessageFirstPartValue: "Thank You",
      invoiceMessageLastPartLabel: "Invoice Message Last Part",
      invoiceMessageLastPartValue: "Your order have been received !",
      printButtonLabel: "Print Button",
      printButtonValue: "Print Invoice",
      downloadButtonLabel: "Download Button",
      downloadButtonValue: "Download Invoice",
      dashboardLabel: "Dashboard",
      totalOrdersLabel: "Total Orders",
      pendingOrderLabel: "Pending Order",
      pendingOrderValue: "Pending Orders",
      processingOrderLabel: "Processing Order",
      processingOrderValue: "Processing Order",
      completeOrderLabel: "Complete Order",
      completeOrderValue: "Complete Orders",
      recentOrderLabel: "Recent Order",
      recentOrderValue: "Recent Orders",
      myOrderLabel: "My Order",
      myOrderValue: "My Orders",
    },
    updateProfile: {
      sectionTitleLabel: "Update Profile",
      sectionTitleValue: "Update Profile",
      fullNameLabel: "Full Name",
      addressLabel: "Address",
      phoneMobileLabel: "Phone/Mobile",
      emailAddressLabel: "Email Address",
      updateButtonLabel: "Update Button",
      updateButtonValue: "Update Profile",
      currentPasswordLabel: "Current Password",
      newPasswordLabel: "New Password",
      changePasswordLabel: "Change Password",
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

const WHATSAPP_LINK_ERROR_MESSAGE =
  "Invalid WhatsApp link. Use https://wa.me/... or https://api.whatsapp.com/...";

const isSafeWhatsAppLink = (value: unknown) => {
  const normalized = toText(value);
  if (!normalized) return true;
  const lowered = normalized.toLowerCase();
  return (
    lowered.startsWith("https://wa.me/") ||
    lowered.startsWith("https://api.whatsapp.com/send")
  );
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
      whatsAppLink: toText(headerSource.whatsAppLink, defaults.header.whatsAppLink),
      headerLogoUrl: toText(
        headerSource.headerLogoUrl ?? headerSource.logoDataUrl,
        defaults.header.headerLogoUrl
      ),
      logoDataUrl: toText(
        headerSource.logoDataUrl ?? headerSource.headerLogoUrl,
        defaults.header.logoDataUrl
      ),
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

const normalizeAboutUs = (root: Record<string, any>) => {
  const defaults = cloneDefaults().aboutUs;
  const source = isPlainObject(root.aboutUs) ? root.aboutUs : {};
  const pageHeaderSource = isPlainObject(source.pageHeader) ? source.pageHeader : {};
  const topContentLeftSource = isPlainObject(source.topContentLeft)
    ? source.topContentLeft
    : {};
  const topContentRightSource = isPlainObject(source.topContentRight)
    ? source.topContentRight
    : {};
  const contentSectionSource = isPlainObject(source.contentSection)
    ? source.contentSection
    : {};
  const ourTeamSource = isPlainObject(source.ourTeam) ? source.ourTeam : {};
  const boxOneSource = isPlainObject(topContentLeftSource.boxOne)
    ? topContentLeftSource.boxOne
    : {};
  const boxTwoSource = isPlainObject(topContentLeftSource.boxTwo)
    ? topContentLeftSource.boxTwo
    : {};
  const boxThreeSource = isPlainObject(topContentLeftSource.boxThree)
    ? topContentLeftSource.boxThree
    : {};
  const teamMembersSource = Array.isArray(ourTeamSource.members)
    ? ourTeamSource.members
    : [];

  return {
    ...defaults,
    ...source,
    pageHeader: {
      ...defaults.pageHeader,
      ...pageHeaderSource,
      enabled: toBool(pageHeaderSource.enabled, defaults.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeaderSource.backgroundImageDataUrl ?? pageHeaderSource.backgroundImage ?? "",
        ""
      ),
      pageTitle: toText(pageHeaderSource.pageTitle, defaults.pageHeader.pageTitle),
    },
    topContentLeft: {
      ...defaults.topContentLeft,
      ...topContentLeftSource,
      enabled: toBool(topContentLeftSource.enabled, defaults.topContentLeft.enabled),
      topTitle: toText(topContentLeftSource.topTitle, defaults.topContentLeft.topTitle),
      topDescription: toText(
        topContentLeftSource.topDescription,
        defaults.topContentLeft.topDescription
      ),
      boxOne: {
        ...defaults.topContentLeft.boxOne,
        ...boxOneSource,
        title: toText(boxOneSource.title, defaults.topContentLeft.boxOne.title),
        subtitle: toText(boxOneSource.subtitle, defaults.topContentLeft.boxOne.subtitle),
        description: toText(
          boxOneSource.description,
          defaults.topContentLeft.boxOne.description
        ),
      },
      boxTwo: {
        ...defaults.topContentLeft.boxTwo,
        ...boxTwoSource,
        title: toText(boxTwoSource.title, defaults.topContentLeft.boxTwo.title),
        subtitle: toText(boxTwoSource.subtitle, defaults.topContentLeft.boxTwo.subtitle),
        description: toText(
          boxTwoSource.description,
          defaults.topContentLeft.boxTwo.description
        ),
      },
      boxThree: {
        ...defaults.topContentLeft.boxThree,
        ...boxThreeSource,
        title: toText(boxThreeSource.title, defaults.topContentLeft.boxThree.title),
        subtitle: toText(
          boxThreeSource.subtitle,
          defaults.topContentLeft.boxThree.subtitle
        ),
        description: toText(
          boxThreeSource.description,
          defaults.topContentLeft.boxThree.description
        ),
      },
    },
    topContentRight: {
      ...defaults.topContentRight,
      ...topContentRightSource,
      enabled: toBool(topContentRightSource.enabled, defaults.topContentRight.enabled),
      imageDataUrl: toText(topContentRightSource.imageDataUrl ?? topContentRightSource.image ?? "", ""),
    },
    contentSection: {
      ...defaults.contentSection,
      ...contentSectionSource,
      enabled: toBool(contentSectionSource.enabled, defaults.contentSection.enabled),
      firstParagraph: toText(
        contentSectionSource.firstParagraph,
        defaults.contentSection.firstParagraph
      ),
      secondParagraph: toText(
        contentSectionSource.secondParagraph,
        defaults.contentSection.secondParagraph
      ),
      contentImageDataUrl: toText(
        contentSectionSource.contentImageDataUrl ?? contentSectionSource.imageDataUrl ?? "",
        ""
      ),
    },
    ourTeam: {
      ...defaults.ourTeam,
      ...ourTeamSource,
      enabled: toBool(ourTeamSource.enabled, defaults.ourTeam.enabled),
      title: toText(ourTeamSource.title, defaults.ourTeam.title),
      description: toText(ourTeamSource.description, defaults.ourTeam.description),
      members: defaults.ourTeam.members.map(
        (fallbackMember: Record<string, any>, index: number) => {
        const sourceMember =
          index < teamMembersSource.length && isPlainObject(teamMembersSource[index])
            ? teamMembersSource[index]
            : {};
        return {
          ...fallbackMember,
          ...sourceMember,
          imageDataUrl: toText(
            sourceMember.imageDataUrl ?? sourceMember.image ?? "",
            ""
          ),
          title: toText(sourceMember.title, fallbackMember.title),
          subTitle: toText(
            sourceMember.subTitle ?? sourceMember.subtitle,
            fallbackMember.subTitle
          ),
        };
      }
      ),
    },
  };
};

const normalizePolicyPage = (
  root: Record<string, any>,
  key: "privacyPolicy" | "termsAndConditions"
) => {
  const defaults = cloneDefaults()[key];
  const source = isPlainObject(root[key]) ? root[key] : {};

  return {
    ...defaults,
    ...source,
    enabled: toBool(source.enabled, defaults.enabled),
    pageHeaderBackgroundDataUrl: toText(
      source.pageHeaderBackgroundDataUrl ??
        source.backgroundImageDataUrl ??
        source.backgroundImage ??
        "",
      ""
    ),
    pageTitle: toText(source.pageTitle, defaults.pageTitle),
    pageTextHtml: toText(
      source.pageTextHtml ?? source.pageText ?? source.contentHtml ?? source.content ?? "",
      defaults.pageTextHtml
    ),
  };
};

const normalizeFaqs = (root: Record<string, any>) => {
  const defaults = cloneDefaults().faqs;
  const source = isPlainObject(root.faqs)
    ? root.faqs
    : isPlainObject(root.faqPage)
      ? root.faqPage
      : {};
  const pageHeaderSource = isPlainObject(source.pageHeader) ? source.pageHeader : {};
  const leftColumnSource = isPlainObject(source.leftColumn) ? source.leftColumn : {};
  const contentSource = isPlainObject(source.content) ? source.content : {};
  const itemsSource = Array.isArray(contentSource.items) ? contentSource.items : [];

  return {
    ...defaults,
    ...source,
    pageHeader: {
      ...defaults.pageHeader,
      ...pageHeaderSource,
      enabled: toBool(pageHeaderSource.enabled, defaults.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeaderSource.backgroundImageDataUrl ??
          pageHeaderSource.backgroundImage ??
          pageHeaderSource.imageDataUrl ??
          "",
        ""
      ),
      pageTitle: toText(pageHeaderSource.pageTitle, defaults.pageHeader.pageTitle),
    },
    leftColumn: {
      ...defaults.leftColumn,
      ...leftColumnSource,
      enabled: toBool(leftColumnSource.enabled, defaults.leftColumn.enabled),
      leftImageDataUrl: toText(
        leftColumnSource.leftImageDataUrl ??
          leftColumnSource.imageDataUrl ??
          leftColumnSource.leftImage ??
          leftColumnSource.image ??
          "",
        ""
      ),
    },
    content: {
      ...defaults.content,
      ...contentSource,
      enabled: toBool(contentSource.enabled, defaults.content.enabled),
      items: Array.from({ length: FAQS_ITEM_LENGTH }, (_, index) => {
        const fallbackItem = defaults.content.items[index];
        const sourceItem =
          index < itemsSource.length && isPlainObject(itemsSource[index])
            ? itemsSource[index]
            : {};
        return {
          ...fallbackItem,
          ...sourceItem,
          title: toText(
            sourceItem.title ?? sourceItem.question,
            fallbackItem.title
          ),
          description: toText(
            sourceItem.description ?? sourceItem.answer,
            fallbackItem.description
          ),
        };
      }),
    },
  };
};

const normalizeOffers = (root: Record<string, any>) => {
  const defaults = cloneDefaults().offers;
  const source = isPlainObject(root.offers) ? root.offers : {};
  const pageHeaderSource = isPlainObject(source.pageHeader) ? source.pageHeader : {};
  const superDiscountSource = isPlainObject(source.superDiscount)
    ? source.superDiscount
    : {};

  return {
    ...defaults,
    ...source,
    pageHeader: {
      ...defaults.pageHeader,
      ...pageHeaderSource,
      enabled: toBool(pageHeaderSource.enabled, defaults.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeaderSource.backgroundImageDataUrl ??
          pageHeaderSource.backgroundImage ??
          pageHeaderSource.imageDataUrl ??
          "",
        ""
      ),
      pageTitle: toText(pageHeaderSource.pageTitle, defaults.pageHeader.pageTitle),
    },
    superDiscount: {
      ...defaults.superDiscount,
      ...superDiscountSource,
      enabled: toBool(superDiscountSource.enabled, defaults.superDiscount.enabled),
      activeCouponCode: toText(
        superDiscountSource.activeCouponCode ?? superDiscountSource.couponCode ?? "",
        defaults.superDiscount.activeCouponCode
      ).toUpperCase(),
    },
  };
};

const normalizeContactUs = (root: Record<string, any>) => {
  const defaults = cloneDefaults().contactUs;
  const source = isPlainObject(root.contactUs) ? root.contactUs : {};
  const pageHeaderSource = isPlainObject(source.pageHeader) ? source.pageHeader : {};
  const emailBoxSource = isPlainObject(source.emailBox) ? source.emailBox : {};
  const callBoxSource = isPlainObject(source.callBox) ? source.callBox : {};
  const addressBoxSource = isPlainObject(source.addressBox) ? source.addressBox : {};
  const middleLeftColumnSource = isPlainObject(source.middleLeftColumn)
    ? source.middleLeftColumn
    : {};
  const contactFormSource = isPlainObject(source.contactForm) ? source.contactForm : {};

  return {
    ...defaults,
    ...source,
    pageHeader: {
      ...defaults.pageHeader,
      ...pageHeaderSource,
      enabled: toBool(pageHeaderSource.enabled, defaults.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeaderSource.backgroundImageDataUrl ??
          pageHeaderSource.backgroundImage ??
          pageHeaderSource.imageDataUrl ??
          "",
        ""
      ),
      pageTitle: toText(pageHeaderSource.pageTitle, defaults.pageHeader.pageTitle),
    },
    emailBox: {
      ...defaults.emailBox,
      ...emailBoxSource,
      enabled: toBool(emailBoxSource.enabled, defaults.emailBox.enabled),
      title: toText(emailBoxSource.title, defaults.emailBox.title),
      email: toText(emailBoxSource.email, defaults.emailBox.email),
      text: toText(emailBoxSource.text, defaults.emailBox.text),
    },
    callBox: {
      ...defaults.callBox,
      ...callBoxSource,
      enabled: toBool(callBoxSource.enabled, defaults.callBox.enabled),
      title: toText(callBoxSource.title, defaults.callBox.title),
      phone: toText(callBoxSource.phone, defaults.callBox.phone),
      text: toText(callBoxSource.text, defaults.callBox.text),
    },
    addressBox: {
      ...defaults.addressBox,
      ...addressBoxSource,
      enabled: toBool(addressBoxSource.enabled, defaults.addressBox.enabled),
      title: toText(addressBoxSource.title, defaults.addressBox.title),
      address: toText(addressBoxSource.address, defaults.addressBox.address),
    },
    middleLeftColumn: {
      ...defaults.middleLeftColumn,
      ...middleLeftColumnSource,
      enabled: toBool(
        middleLeftColumnSource.enabled,
        defaults.middleLeftColumn.enabled
      ),
      imageDataUrl: toText(
        middleLeftColumnSource.imageDataUrl ?? middleLeftColumnSource.image ?? "",
        ""
      ),
    },
    contactForm: {
      ...defaults.contactForm,
      ...contactFormSource,
      enabled: toBool(contactFormSource.enabled, defaults.contactForm.enabled),
      title: toText(contactFormSource.title, defaults.contactForm.title),
      description: toText(
        contactFormSource.description,
        defaults.contactForm.description
      ),
    },
  };
};

const normalizeCheckout = (root: Record<string, any>) => {
  const defaults = cloneDefaults().checkout;
  const source = isPlainObject(root.checkout) ? root.checkout : {};
  const personalDetailsSource = isPlainObject(source.personalDetails)
    ? source.personalDetails
    : {};
  const shippingDetailsSource = isPlainObject(source.shippingDetails)
    ? source.shippingDetails
    : {};
  const buttonsSource = isPlainObject(source.buttons) ? source.buttons : {};
  const cartItemSectionSource = isPlainObject(source.cartItemSection)
    ? source.cartItemSection
    : {};

  return {
    ...defaults,
    ...source,
    personalDetails: {
      ...defaults.personalDetails,
      ...personalDetailsSource,
      sectionTitle: toText(
        personalDetailsSource.sectionTitle,
        defaults.personalDetails.sectionTitle
      ),
      firstNameLabel: toText(
        personalDetailsSource.firstNameLabel,
        defaults.personalDetails.firstNameLabel
      ),
      lastNameLabel: toText(
        personalDetailsSource.lastNameLabel,
        defaults.personalDetails.lastNameLabel
      ),
      emailLabel: toText(
        personalDetailsSource.emailLabel,
        defaults.personalDetails.emailLabel
      ),
      phoneLabel: toText(
        personalDetailsSource.phoneLabel,
        defaults.personalDetails.phoneLabel
      ),
      firstNamePlaceholder: toText(
        personalDetailsSource.firstNamePlaceholder,
        defaults.personalDetails.firstNamePlaceholder
      ),
      lastNamePlaceholder: toText(
        personalDetailsSource.lastNamePlaceholder,
        defaults.personalDetails.lastNamePlaceholder
      ),
      emailPlaceholder: toText(
        personalDetailsSource.emailPlaceholder,
        defaults.personalDetails.emailPlaceholder
      ),
      phonePlaceholder: toText(
        personalDetailsSource.phonePlaceholder,
        defaults.personalDetails.phonePlaceholder
      ),
    },
    shippingDetails: {
      ...defaults.shippingDetails,
      ...shippingDetailsSource,
      sectionTitle: toText(
        shippingDetailsSource.sectionTitle,
        defaults.shippingDetails.sectionTitle
      ),
      streetAddressLabel: toText(
        shippingDetailsSource.streetAddressLabel,
        defaults.shippingDetails.streetAddressLabel
      ),
      cityLabel: toText(shippingDetailsSource.cityLabel, defaults.shippingDetails.cityLabel),
      countryLabel: toText(
        shippingDetailsSource.countryLabel,
        defaults.shippingDetails.countryLabel
      ),
      zipLabel: toText(shippingDetailsSource.zipLabel, defaults.shippingDetails.zipLabel),
      streetAddressPlaceholder: toText(
        shippingDetailsSource.streetAddressPlaceholder,
        defaults.shippingDetails.streetAddressPlaceholder
      ),
      cityPlaceholder: toText(
        shippingDetailsSource.cityPlaceholder,
        defaults.shippingDetails.cityPlaceholder
      ),
      countryPlaceholder: toText(
        shippingDetailsSource.countryPlaceholder,
        defaults.shippingDetails.countryPlaceholder
      ),
      zipPlaceholder: toText(
        shippingDetailsSource.zipPlaceholder,
        defaults.shippingDetails.zipPlaceholder
      ),
      shippingCostLabel: toText(
        shippingDetailsSource.shippingCostLabel,
        defaults.shippingDetails.shippingCostLabel
      ),
      shippingOneNameLabel: toText(
        shippingDetailsSource.shippingOneNameLabel,
        defaults.shippingDetails.shippingOneNameLabel
      ),
      shippingOneNameDefault: toText(
        shippingDetailsSource.shippingOneNameDefault,
        defaults.shippingDetails.shippingOneNameDefault
      ),
      shippingOneDescriptionLabel: toText(
        shippingDetailsSource.shippingOneDescriptionLabel,
        defaults.shippingDetails.shippingOneDescriptionLabel
      ),
      shippingOneDescriptionDefault: toText(
        shippingDetailsSource.shippingOneDescriptionDefault,
        defaults.shippingDetails.shippingOneDescriptionDefault
      ),
      shippingOneCostLabel: toText(
        shippingDetailsSource.shippingOneCostLabel,
        defaults.shippingDetails.shippingOneCostLabel
      ),
      shippingOneCostDefault: toText(
        shippingDetailsSource.shippingOneCostDefault,
        defaults.shippingDetails.shippingOneCostDefault
      ),
      shippingTwoNameLabel: toText(
        shippingDetailsSource.shippingTwoNameLabel,
        defaults.shippingDetails.shippingTwoNameLabel
      ),
      shippingTwoNameDefault: toText(
        shippingDetailsSource.shippingTwoNameDefault,
        defaults.shippingDetails.shippingTwoNameDefault
      ),
      shippingTwoDescriptionLabel: toText(
        shippingDetailsSource.shippingTwoDescriptionLabel,
        defaults.shippingDetails.shippingTwoDescriptionLabel
      ),
      shippingTwoDescriptionDefault: toText(
        shippingDetailsSource.shippingTwoDescriptionDefault,
        defaults.shippingDetails.shippingTwoDescriptionDefault
      ),
      shippingTwoCostLabel: toText(
        shippingDetailsSource.shippingTwoCostLabel,
        defaults.shippingDetails.shippingTwoCostLabel
      ),
      shippingTwoCostDefault: toText(
        shippingDetailsSource.shippingTwoCostDefault,
        defaults.shippingDetails.shippingTwoCostDefault
      ),
      paymentMethodLabel: toText(
        shippingDetailsSource.paymentMethodLabel,
        defaults.shippingDetails.paymentMethodLabel
      ),
      paymentMethodPlaceholder: toText(
        shippingDetailsSource.paymentMethodPlaceholder,
        defaults.shippingDetails.paymentMethodPlaceholder
      ),
    },
    buttons: {
      ...defaults.buttons,
      ...buttonsSource,
      continueButtonLabel: toText(
        buttonsSource.continueButtonLabel,
        defaults.buttons.continueButtonLabel
      ),
      confirmButtonLabel: toText(
        buttonsSource.confirmButtonLabel,
        defaults.buttons.confirmButtonLabel
      ),
    },
    cartItemSection: {
      ...defaults.cartItemSection,
      ...cartItemSectionSource,
      sectionTitle: toText(
        cartItemSectionSource.sectionTitle,
        defaults.cartItemSection.sectionTitle
      ),
      orderSummaryLabel: toText(
        cartItemSectionSource.orderSummaryLabel,
        defaults.cartItemSection.orderSummaryLabel
      ),
      applyButtonLabel: toText(
        cartItemSectionSource.applyButtonLabel,
        defaults.cartItemSection.applyButtonLabel
      ),
      subTotalLabel: toText(
        cartItemSectionSource.subTotalLabel,
        defaults.cartItemSection.subTotalLabel
      ),
      discountLabel: toText(
        cartItemSectionSource.discountLabel,
        defaults.cartItemSection.discountLabel
      ),
      totalCostLabel: toText(
        cartItemSectionSource.totalCostLabel,
        defaults.cartItemSection.totalCostLabel
      ),
    },
  };
};

const normalizeDashboardSetting = (root: Record<string, any>) => {
  const defaults = cloneDefaults().dashboardSetting;
  const source = isPlainObject(root.dashboardSetting) ? root.dashboardSetting : {};
  const dashboardSource = isPlainObject(source.dashboard) ? source.dashboard : {};
  const updateProfileSource = isPlainObject(source.updateProfile)
    ? source.updateProfile
    : {};

  return {
    ...defaults,
    ...source,
    dashboard: {
      ...defaults.dashboard,
      ...dashboardSource,
      sectionTitle: toText(
        dashboardSource.sectionTitle,
        defaults.dashboard.sectionTitle
      ),
      invoiceMessageFirstPartLabel: toText(
        dashboardSource.invoiceMessageFirstPartLabel,
        defaults.dashboard.invoiceMessageFirstPartLabel
      ),
      invoiceMessageFirstPartValue: toText(
        dashboardSource.invoiceMessageFirstPartValue,
        defaults.dashboard.invoiceMessageFirstPartValue
      ),
      invoiceMessageLastPartLabel: toText(
        dashboardSource.invoiceMessageLastPartLabel,
        defaults.dashboard.invoiceMessageLastPartLabel
      ),
      invoiceMessageLastPartValue: toText(
        dashboardSource.invoiceMessageLastPartValue,
        defaults.dashboard.invoiceMessageLastPartValue
      ),
      printButtonLabel: toText(
        dashboardSource.printButtonLabel,
        defaults.dashboard.printButtonLabel
      ),
      printButtonValue: toText(
        dashboardSource.printButtonValue,
        defaults.dashboard.printButtonValue
      ),
      downloadButtonLabel: toText(
        dashboardSource.downloadButtonLabel,
        defaults.dashboard.downloadButtonLabel
      ),
      downloadButtonValue: toText(
        dashboardSource.downloadButtonValue,
        defaults.dashboard.downloadButtonValue
      ),
      dashboardLabel: toText(
        dashboardSource.dashboardLabel,
        defaults.dashboard.dashboardLabel
      ),
      totalOrdersLabel: toText(
        dashboardSource.totalOrdersLabel,
        defaults.dashboard.totalOrdersLabel
      ),
      pendingOrderLabel: toText(
        dashboardSource.pendingOrderLabel,
        defaults.dashboard.pendingOrderLabel
      ),
      pendingOrderValue: toText(
        dashboardSource.pendingOrderValue,
        defaults.dashboard.pendingOrderValue
      ),
      processingOrderLabel: toText(
        dashboardSource.processingOrderLabel,
        defaults.dashboard.processingOrderLabel
      ),
      processingOrderValue: toText(
        dashboardSource.processingOrderValue,
        defaults.dashboard.processingOrderValue
      ),
      completeOrderLabel: toText(
        dashboardSource.completeOrderLabel,
        defaults.dashboard.completeOrderLabel
      ),
      completeOrderValue: toText(
        dashboardSource.completeOrderValue,
        defaults.dashboard.completeOrderValue
      ),
      recentOrderLabel: toText(
        dashboardSource.recentOrderLabel,
        defaults.dashboard.recentOrderLabel
      ),
      recentOrderValue: toText(
        dashboardSource.recentOrderValue,
        defaults.dashboard.recentOrderValue
      ),
      myOrderLabel: toText(
        dashboardSource.myOrderLabel,
        defaults.dashboard.myOrderLabel
      ),
      myOrderValue: toText(
        dashboardSource.myOrderValue,
        defaults.dashboard.myOrderValue
      ),
    },
    updateProfile: {
      ...defaults.updateProfile,
      ...updateProfileSource,
      sectionTitleLabel: toText(
        updateProfileSource.sectionTitleLabel,
        defaults.updateProfile.sectionTitleLabel
      ),
      sectionTitleValue: toText(
        updateProfileSource.sectionTitleValue,
        defaults.updateProfile.sectionTitleValue
      ),
      fullNameLabel: toText(
        updateProfileSource.fullNameLabel,
        defaults.updateProfile.fullNameLabel
      ),
      addressLabel: toText(
        updateProfileSource.addressLabel,
        defaults.updateProfile.addressLabel
      ),
      phoneMobileLabel: toText(
        updateProfileSource.phoneMobileLabel,
        defaults.updateProfile.phoneMobileLabel
      ),
      emailAddressLabel: toText(
        updateProfileSource.emailAddressLabel,
        defaults.updateProfile.emailAddressLabel
      ),
      updateButtonLabel: toText(
        updateProfileSource.updateButtonLabel,
        defaults.updateProfile.updateButtonLabel
      ),
      updateButtonValue: toText(
        updateProfileSource.updateButtonValue,
        defaults.updateProfile.updateButtonValue
      ),
      currentPasswordLabel: toText(
        updateProfileSource.currentPasswordLabel,
        defaults.updateProfile.currentPasswordLabel
      ),
      newPasswordLabel: toText(
        updateProfileSource.newPasswordLabel,
        defaults.updateProfile.newPasswordLabel
      ),
      changePasswordLabel: toText(
        updateProfileSource.changePasswordLabel,
        defaults.updateProfile.changePasswordLabel
      ),
    },
  };
};

export const sanitizeCustomization = (rawData: unknown) => {
  const source = isPlainObject(rawData) ? rawData : {};
  const merged = mergeDeep(cloneDefaults(), source);
  const normalizedHome = normalizeHome(source);
  const normalizedProductSlugPage = normalizeProductSlugPage(source);
  const normalizedAboutUs = normalizeAboutUs(source);
  const normalizedPrivacyPolicy = normalizePolicyPage(source, "privacyPolicy");
  const normalizedTermsAndConditions = normalizePolicyPage(
    source,
    "termsAndConditions"
  );
  const normalizedFaqs = normalizeFaqs(source);
  const normalizedOffers = normalizeOffers(source);
  const normalizedContactUs = normalizeContactUs(source);
  const normalizedCheckout = normalizeCheckout(source);
  const normalizedDashboardSetting = normalizeDashboardSetting(source);
  const normalizedSeoSettings = normalizeSeoSettings(source);
  const output = {
    ...merged,
    home: normalizedHome,
    productSlugPage: normalizedProductSlugPage,
    aboutUs: normalizedAboutUs,
    privacyPolicy: normalizedPrivacyPolicy,
    termsAndConditions: normalizedTermsAndConditions,
    faqs: normalizedFaqs,
    offers: normalizedOffers,
    contactUs: normalizedContactUs,
    checkout: normalizedCheckout,
    dashboardSetting: normalizedDashboardSetting,
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

const extractHeaderSettings = (
  lang: string,
  customization: Record<string, any>,
  updatedAt?: string | null
) => {
  const defaults = cloneDefaults().home.header;
  const headerSource = isPlainObject(customization?.home?.header)
    ? customization.home.header
    : {};
  const headerLogoUrl = toText(
    headerSource.headerLogoUrl ?? headerSource.logoDataUrl,
    defaults.headerLogoUrl
  );

  return {
    language: lang,
    headerText: toText(headerSource.headerText, defaults.headerText),
    phoneNumber: toText(headerSource.phoneNumber, defaults.phoneNumber),
    whatsAppLink: toText(headerSource.whatsAppLink, defaults.whatsAppLink),
    headerLogoUrl,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString(),
  };
};

const headerLogoUploadDir = path.resolve(process.cwd(), "uploads", "store");
fs.mkdirSync(headerLogoUploadDir, { recursive: true });

const headerLogoMulter = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, headerLogoUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
      const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
      const fileName = `header-logo-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}${safeExt}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const acceptedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!acceptedMimeTypes.has(String(file.mimetype || "").toLowerCase())) {
      cb(new Error("Only PNG, JPEG, and WEBP images are allowed."));
      return;
    }
    cb(null, true);
  },
  limits: {
    fileSize: 1024 * 1024, // 1MB
  },
});

// GET /api/admin/store/customization/header?lang=en
// Response contract: { success: true, data: { language, headerText, phoneNumber, whatsAppLink, headerLogoUrl, updatedAt } }
router.get("/header", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.query?.lang);

    let row = await getCustomizationRow(lang);
    let payload = row ? parseRowData(row.data) : sanitizeCustomization({});

    if (!row) {
      await upsertCustomization(lang, payload);
      row = await getCustomizationRow(lang);
      payload = row ? parseRowData(row.data) : payload;
    }

    return res.json({
      success: true,
      data: extractHeaderSettings(lang, payload, row?.updatedAt),
    });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/admin/store/customization/header
// Accepts language from body.language or query.lang (defaults to "en" when empty)
router.put("/header", async (req, res, next) => {
  try {
    await ensureStoreCustomizationsTable();
    const lang = normalizeLang(req.body?.language ?? req.query?.lang);
    const rawPayload = isPlainObject(req.body?.header) ? req.body.header : req.body;

    if (!isPlainObject(rawPayload)) {
      return res.status(400).json({
        success: false,
        message: "Body must be an object",
      });
    }

    const existing = await getCustomizationRow(lang);
    const existingPayload = existing ? parseRowData(existing.data) : sanitizeCustomization({});
    const defaults = cloneDefaults().home.header;
    const hasWhatsAppLinkField = Object.prototype.hasOwnProperty.call(
      rawPayload,
      "whatsAppLink"
    );
    const nextWhatsAppLink = hasWhatsAppLinkField
      ? toText(rawPayload.whatsAppLink)
      : toText(
          existingPayload?.home?.header?.whatsAppLink,
          defaults.whatsAppLink
        );
    if (!isSafeWhatsAppLink(nextWhatsAppLink)) {
      return res.status(400).json({
        success: false,
        message: WHATSAPP_LINK_ERROR_MESSAGE,
      });
    }
    const headerLogoUrl = toText(
      rawPayload.headerLogoUrl ?? rawPayload.logoDataUrl,
      toText(existingPayload?.home?.header?.headerLogoUrl ?? existingPayload?.home?.header?.logoDataUrl, defaults.headerLogoUrl)
    );
    const nextPayload = sanitizeCustomization({
      ...existingPayload,
      home: {
        ...existingPayload.home,
        header: {
          ...existingPayload.home?.header,
          headerText: toText(
            rawPayload.headerText,
            toText(existingPayload?.home?.header?.headerText, defaults.headerText)
          ),
          phoneNumber: toText(
            rawPayload.phoneNumber,
            toText(existingPayload?.home?.header?.phoneNumber, defaults.phoneNumber)
          ),
          whatsAppLink: nextWhatsAppLink,
          headerLogoUrl,
          logoDataUrl: headerLogoUrl,
        },
      },
    });
    await upsertCustomization(lang, nextPayload);
    const updatedRow = await getCustomizationRow(lang);

    return res.json({
      success: true,
      data: extractHeaderSettings(lang, nextPayload, updatedRow?.updatedAt),
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/admin/store/customization/header/logo
router.post("/header/logo", (req, res, next) => {
  headerLogoMulter.single("file")(req, res, async (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error?.message || "Failed to upload logo.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    const lang = normalizeLang(req.body?.language ?? req.query?.lang);
    const headerLogoUrl = `/uploads/store/${req.file.filename}`;
    try {
      await ensureStoreCustomizationsTable();
      const existing = await getCustomizationRow(lang);
      const existingPayload = existing ? parseRowData(existing.data) : sanitizeCustomization({});
      const nextPayload = sanitizeCustomization({
        ...existingPayload,
        home: {
          ...existingPayload.home,
          header: {
            ...existingPayload.home?.header,
            headerLogoUrl,
            logoDataUrl: headerLogoUrl,
          },
        },
      });
      await upsertCustomization(lang, nextPayload);
      const updatedRow = await getCustomizationRow(lang);

      return res.json({
        success: true,
        data: extractHeaderSettings(lang, nextPayload, updatedRow?.updatedAt),
      });
    } catch (uploadPersistError) {
      return next(uploadPersistError);
    }
  });
});

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
    const lang = normalizeLang(req.body?.language ?? req.query?.lang);
    const rawPayload = isPlainObject(req.body?.customization)
      ? req.body.customization
      : req.body;

    if (!isPlainObject(rawPayload)) {
      return res.status(400).json({
        success: false,
        message: "Body must be an object",
      });
    }
    if (
      isPlainObject(rawPayload.home) &&
      isPlainObject(rawPayload.home.header) &&
      Object.prototype.hasOwnProperty.call(rawPayload.home.header, "whatsAppLink")
    ) {
      const nextWhatsAppLink = toText(rawPayload.home.header.whatsAppLink);
      if (!isSafeWhatsAppLink(nextWhatsAppLink)) {
        return res.status(400).json({
          success: false,
          message: WHATSAPP_LINK_ERROR_MESSAGE,
        });
      }
      rawPayload.home.header.whatsAppLink = nextWhatsAppLink;
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

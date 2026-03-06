import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Plus, Settings, Upload, X } from "lucide-react";
import {
  fetchAdminLanguages,
  fetchAdminCoupons,
  createAdminLanguage,
  fetchAdminStoreCustomization,
  uploadAdminStoreHeaderLogo,
  updateAdminStoreCustomization,
} from "../../lib/adminApi.js";
import {
  fileToDataUrl,
  validateCustomizationLogoFile,
} from "../../utils/fileToDataUrl.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

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

const STORE_CUSTOMIZATION_PATH = "/admin/store/customization";
const ABOUT_US_CUSTOMIZATION_PATH = "/admin/customization";
const DEFAULT_TAB_KEY = "home";
const STORE_TAB_BY_KEY = {
  home: "home-settings",
  productSlugPage: "single-setting",
  aboutUs: "about-us-setting",
  privacyPolicyTerms: "privacy-setting",
  faqs: "FAQ-setting",
  offers: "offers-setting",
  contactUs: "contact-us-setting",
  checkout: "checkout-setting",
  dashboardSetting: "dashboard-setting",
  seoSettings: "seo-settings",
};
const KEY_BY_STORE_TAB = Object.fromEntries(
  Object.entries(STORE_TAB_BY_KEY).map(([tabKey, storeTab]) => [storeTab, tabKey])
);
const normalizeRoutePath = (pathname) => {
  if (!pathname) return STORE_CUSTOMIZATION_PATH;
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
};
const getDefaultTabKeyByPath = (pathname) =>
  normalizeRoutePath(pathname) === ABOUT_US_CUSTOMIZATION_PATH
    ? "aboutUs"
    : DEFAULT_TAB_KEY;
const getCanonicalStoreTab = (storeTabFromUrl, pathname) => {
  const normalizedStoreTab = String(storeTabFromUrl || "").trim();
  if (KEY_BY_STORE_TAB[normalizedStoreTab]) return normalizedStoreTab;
  const fallbackTabKey = getDefaultTabKeyByPath(pathname);
  return STORE_TAB_BY_KEY[fallbackTabKey];
};
const getPathByTabKey = (tabKey) =>
  tabKey === "aboutUs" ? ABOUT_US_CUSTOMIZATION_PATH : STORE_CUSTOMIZATION_PATH;
const getUrlByTabKey = (tabKey) => {
  const safeTabKey = STORE_TAB_BY_KEY[tabKey] ? tabKey : DEFAULT_TAB_KEY;
  const storeTab = STORE_TAB_BY_KEY[safeTabKey];
  const path = getPathByTabKey(safeTabKey);
  return `${path}?storeTab=${encodeURIComponent(storeTab)}`;
};

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
const ABOUT_US_MEMBER_LENGTH = 6;
const FAQS_ITEM_LENGTH = 8;
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
const FAQ_ITEM_ORDINALS = [
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
];
const DASHBOARD_SETTING_DASHBOARD_FIELDS = [
  { field: "invoiceMessageFirstPartValue", label: "Invoice Message First Part" },
  { field: "invoiceMessageLastPartValue", label: "Invoice Message Last Part" },
  { field: "printButtonValue", label: "Print Button" },
  { field: "downloadButtonValue", label: "Download Button" },
  { field: "dashboardLabel", label: "Dashboard" },
  { field: "totalOrdersLabel", label: "Total Orders" },
  { field: "pendingOrderValue", label: "Pending Order" },
  { field: "processingOrderValue", label: "Processing Order" },
  { field: "completeOrderValue", label: "Complete Order" },
  { field: "recentOrderValue", label: "Recent Order" },
  { field: "myOrderValue", label: "My Order" },
];
const DASHBOARD_SETTING_UPDATE_PROFILE_FIELDS = [
  { field: "fullNameLabel", label: "Full Name" },
  { field: "addressLabel", label: "Address" },
  { field: "phoneMobileLabel", label: "Phone/Mobile" },
  { field: "emailAddressLabel", label: "Email Address" },
  { field: "updateButtonLabel", label: "Update Button Label" },
  { field: "updateButtonValue", label: "Update Button" },
  { field: "currentPasswordLabel", label: "Current Password" },
  { field: "newPasswordLabel", label: "New Password" },
  { field: "changePasswordLabel", label: "Change Password" },
];

const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const sectionCard =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]";
const textAreaBase =
  "mt-2 min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const ABOUT_US_MEMBER_TABS = Array.from({ length: ABOUT_US_MEMBER_LENGTH }, (_, index) => ({
  key: `member-${index}`,
  index,
  label: `Member ${index + 1}`,
}));
const ABOUT_US_IMAGE_FIELD_KEYS = {
  pageHeaderBackground: "pageHeaderBackground",
  topContentRightImage: "topContentRightImage",
  contentSectionImage: "contentSectionImage",
};
const getAboutUsMemberImageFieldKey = (memberIndex) => `teamMemberImage-${memberIndex}`;
const POLICY_IMAGE_FIELD_KEYS = {
  privacyPolicyBackground: "privacyPolicyBackground",
  termsAndConditionsBackground: "termsAndConditionsBackground",
};
const POLICY_FIELD_KEY_BY_IMAGE_FIELD = {
  [POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground]: "privacyPolicy",
  [POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground]: "termsAndConditions",
};
const FAQS_IMAGE_FIELD_KEYS = {
  pageHeaderBackground: "pageHeaderBackground",
  leftColumnImage: "leftColumnImage",
};
const OFFERS_IMAGE_FIELD_KEYS = {
  pageHeaderBackground: "pageHeaderBackground",
};
const CONTACT_US_IMAGE_FIELD_KEYS = {
  pageHeaderBackground: "pageHeaderBackground",
  middleLeftColumnImage: "middleLeftColumnImage",
};
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

const getDefaultCustomization = () => ({
  home: {
    header: {
      headerText: "We are available 24/7, Need help??",
      phoneNumber: "565555",
      whatsAppLink: "",
      headerLogoUrl: "",
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
      members: Array.from({ length: ABOUT_US_MEMBER_LENGTH }, (_, index) => ({
        imageDataUrl: "",
        title: `Name ${index + 1}`,
        subTitle: `Role ${index + 1}`,
      })),
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

const withVersion = (url, version) => {
  const normalizedUrl = toText(url);
  const normalizedVersion = toText(version);
  if (!normalizedUrl || !normalizedVersion) return normalizedUrl;
  const separator = normalizedUrl.includes("?") ? "&" : "?";
  return `${normalizedUrl}${separator}v=${encodeURIComponent(normalizedVersion)}`;
};

const isHttpUrl = (value) => /^https?:\/\//i.test(toText(value));

const buildPublicUrl = (pathOrUrl) => {
  const normalized = toText(pathOrUrl);
  if (!normalized) return "";
  if (isHttpUrl(normalized)) return normalized;
  if (/^[a-z]+:/i.test(normalized)) return "";
  const relativePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (typeof window === "undefined") return relativePath;
  return `${window.location.origin}${relativePath}`;
};

const getUrlPathname = (value) => {
  const normalized = toText(value);
  if (!normalized) return "";
  try {
    return new URL(normalized).pathname || "";
  } catch {
    return normalized.split("#")[0].split("?")[0];
  }
};

const getSafeImageExt = (value) => {
  const pathname = getUrlPathname(value).toLowerCase();
  const rawExt = pathname.split(".").pop() || "";
  const normalizedExt = rawExt === "jpg" ? "jpg" : rawExt;
  const allowed = new Set(["png", "webp", "jpg", "jpeg"]);
  return allowed.has(normalizedExt) ? normalizedExt : "png";
};

const readImageDimensions = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const cleanup = () => URL.revokeObjectURL(objectUrl);

    image.onload = () => {
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      cleanup();
      if (!width || !height) {
        reject(new Error("Cannot read image dimensions."));
        return;
      }
      resolve({
        width,
        height,
        ratio: width / height,
      });
    };

    image.onerror = () => {
      cleanup();
      reject(new Error("Cannot read image dimensions."));
    };

    image.src = objectUrl;
  });

const getLogoDimensionFeedback = (meta) => {
  if (!meta) return { message: "", level: "info" };
  const { width, height, ratio } = meta;
  const nearRecommendedHeight =
    Math.abs(height - 64) <= 8 || Math.abs(height - 80) <= 10;

  if (width < 200 || height < 40) {
    return {
      message:
        "Warning: Resolusi terlalu kecil, logo bisa blur. Recommended ~240x64 atau 300x80.",
      level: "warn",
    };
  }

  if (ratio < 2.5) {
    return {
      message:
        "Warning: Logo terlalu kotak/tinggi. Gunakan logo horizontal (~3.5-4:1).",
      level: "warn",
    };
  }

  if (ratio > 6) {
    return {
      message:
        "Warning: Logo terlalu panjang, pastikan teks/logo tetap terbaca di header.",
      level: "warn",
    };
  }

  if (ratio < 3 || ratio > 5) {
    return {
      message:
        "Info: Rasio di luar range aman (3-5:1). Periksa lagi agar tidak terlalu tinggi/panjang.",
      level: "warn",
    };
  }

  if (ratio < 3.5 || ratio > 4.5 || !nearRecommendedHeight) {
    return {
      message:
        "Info: Masih aman, tetapi belum ideal. Rekomendasi ratio ~3.5-4.5:1 (240x64 atau 300x80).",
      level: "info",
    };
  }

  return { message: "", level: "info" };
};

const isSafeWhatsAppLink = (value) => {
  const normalized = toText(value);
  if (!normalized) return true;
  const lowered = normalized.toLowerCase();
  return (
    lowered.startsWith("https://wa.me/") ||
    lowered.startsWith("https://api.whatsapp.com/")
  );
};

const buildWhatsAppLinkFromPhone = (value) => {
  const raw = toText(value);
  if (!raw) {
    return { link: "", error: "Phone number is invalid" };
  }

  const keepsPlus = raw.replace(/[^\d+]/g, "");
  const hasLeadingPlus = keepsPlus.startsWith("+");
  let digits = keepsPlus.replace(/\D/g, "");

  if (!digits) {
    return { link: "", error: "Phone number is invalid" };
  }

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("62")) {
    // already normalized
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  } else if (hasLeadingPlus && digits.startsWith("62")) {
    // handles +62...
  } else {
    return { link: "", error: "Phone number is invalid" };
  }

  if (!/^\d+$/.test(digits) || digits.length < 8) {
    return { link: "", error: "Phone number is invalid" };
  }

  return { link: `https://wa.me/${digits}`, error: "" };
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

const normalizeAboutUsMembers = (value, fallback = []) => {
  const rawItems = Array.isArray(value) ? value : [];
  return fallback.map((fallbackItem, index) => {
    const sourceItem =
      index < rawItems.length && isPlainObject(rawItems[index]) ? rawItems[index] : {};
    return {
      ...fallbackItem,
      ...sourceItem,
      imageDataUrl: toText(sourceItem.imageDataUrl ?? sourceItem.image ?? "", ""),
      title: toText(sourceItem.title, fallbackItem.title),
      subTitle: toText(sourceItem.subTitle ?? sourceItem.subtitle, fallbackItem.subTitle),
    };
  });
};

const normalizePolicyPage = (source, defaults) => {
  const policySource = isPlainObject(source) ? source : {};
  return {
    ...defaults,
    ...policySource,
    enabled: toBool(policySource.enabled, defaults.enabled),
    pageHeaderBackgroundDataUrl: toText(
      policySource.pageHeaderBackgroundDataUrl ??
        policySource.backgroundImageDataUrl ??
        policySource.backgroundImage ??
        "",
      ""
    ),
    pageTitle: toText(policySource.pageTitle, defaults.pageTitle),
    pageTextHtml: toText(
      policySource.pageTextHtml ??
        policySource.pageText ??
        policySource.contentHtml ??
        policySource.content ??
        "",
      defaults.pageTextHtml
    ),
  };
};

const normalizeFaqItems = (value, fallback = []) => {
  const rawItems = Array.isArray(value) ? value : [];
  return Array.from({ length: FAQS_ITEM_LENGTH }, (_, index) => {
    const fallbackItem = fallback[index] || { title: "", description: "" };
    const sourceItem =
      index < rawItems.length && isPlainObject(rawItems[index]) ? rawItems[index] : {};
    return {
      ...fallbackItem,
      ...sourceItem,
      title: toText(sourceItem.title ?? sourceItem.question, fallbackItem.title),
      description: toText(
        sourceItem.description ?? sourceItem.answer,
        fallbackItem.description
      ),
    };
  });
};

const normalizeFaqs = (source, defaults) => {
  const faqsSource = isPlainObject(source) ? source : {};
  const pageHeaderSource = isPlainObject(faqsSource.pageHeader) ? faqsSource.pageHeader : {};
  const leftColumnSource = isPlainObject(faqsSource.leftColumn) ? faqsSource.leftColumn : {};
  const contentSource = isPlainObject(faqsSource.content) ? faqsSource.content : {};

  return {
    ...defaults,
    ...faqsSource,
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
      items: normalizeFaqItems(contentSource.items, defaults.content.items),
    },
  };
};

const normalizeOffers = (source, defaults) => {
  const offersSource = isPlainObject(source) ? source : {};
  const pageHeaderSource = isPlainObject(offersSource.pageHeader)
    ? offersSource.pageHeader
    : {};
  const superDiscountSource = isPlainObject(offersSource.superDiscount)
    ? offersSource.superDiscount
    : {};

  return {
    ...defaults,
    ...offersSource,
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

const normalizeContactUs = (source, defaults) => {
  const contactSource = isPlainObject(source) ? source : {};
  const pageHeaderSource = isPlainObject(contactSource.pageHeader)
    ? contactSource.pageHeader
    : {};
  const emailBoxSource = isPlainObject(contactSource.emailBox) ? contactSource.emailBox : {};
  const callBoxSource = isPlainObject(contactSource.callBox) ? contactSource.callBox : {};
  const addressBoxSource = isPlainObject(contactSource.addressBox)
    ? contactSource.addressBox
    : {};
  const middleLeftColumnSource = isPlainObject(contactSource.middleLeftColumn)
    ? contactSource.middleLeftColumn
    : {};
  const contactFormSource = isPlainObject(contactSource.contactForm)
    ? contactSource.contactForm
    : {};

  return {
    ...defaults,
    ...contactSource,
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

const normalizeCheckout = (source, defaults) => {
  const checkoutSource = isPlainObject(source) ? source : {};
  const personalDetailsSource = isPlainObject(checkoutSource.personalDetails)
    ? checkoutSource.personalDetails
    : {};
  const shippingDetailsSource = isPlainObject(checkoutSource.shippingDetails)
    ? checkoutSource.shippingDetails
    : {};
  const buttonsSource = isPlainObject(checkoutSource.buttons)
    ? checkoutSource.buttons
    : {};
  const cartItemSectionSource = isPlainObject(checkoutSource.cartItemSection)
    ? checkoutSource.cartItemSection
    : {};

  return {
    ...defaults,
    ...checkoutSource,
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

const normalizeDashboardSetting = (source, defaults) => {
  const dashboardSettingSource = isPlainObject(source) ? source : {};
  const dashboardSource = isPlainObject(dashboardSettingSource.dashboard)
    ? dashboardSettingSource.dashboard
    : {};
  const updateProfileSource = isPlainObject(dashboardSettingSource.updateProfile)
    ? dashboardSettingSource.updateProfile
    : {};

  return {
    ...defaults,
    ...dashboardSettingSource,
    dashboard: {
      ...defaults.dashboard,
      ...dashboardSource,
      sectionTitle: toText(dashboardSource.sectionTitle, defaults.dashboard.sectionTitle),
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
      dashboardLabel: toText(dashboardSource.dashboardLabel, defaults.dashboard.dashboardLabel),
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
      myOrderLabel: toText(dashboardSource.myOrderLabel, defaults.dashboard.myOrderLabel),
      myOrderValue: toText(dashboardSource.myOrderValue, defaults.dashboard.myOrderValue),
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
      addressLabel: toText(updateProfileSource.addressLabel, defaults.updateProfile.addressLabel),
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
  const aboutUsSource = isPlainObject(source.aboutUs) ? source.aboutUs : {};
  const aboutUsPageHeaderSource = isPlainObject(aboutUsSource.pageHeader)
    ? aboutUsSource.pageHeader
    : {};
  const aboutUsTopContentLeftSource = isPlainObject(aboutUsSource.topContentLeft)
    ? aboutUsSource.topContentLeft
    : {};
  const aboutUsTopContentRightSource = isPlainObject(aboutUsSource.topContentRight)
    ? aboutUsSource.topContentRight
    : {};
  const aboutUsContentSectionSource = isPlainObject(aboutUsSource.contentSection)
    ? aboutUsSource.contentSection
    : {};
  const aboutUsOurTeamSource = isPlainObject(aboutUsSource.ourTeam)
    ? aboutUsSource.ourTeam
    : {};
  const aboutUsBoxOneSource = isPlainObject(aboutUsTopContentLeftSource.boxOne)
    ? aboutUsTopContentLeftSource.boxOne
    : {};
  const aboutUsBoxTwoSource = isPlainObject(aboutUsTopContentLeftSource.boxTwo)
    ? aboutUsTopContentLeftSource.boxTwo
    : {};
  const aboutUsBoxThreeSource = isPlainObject(aboutUsTopContentLeftSource.boxThree)
    ? aboutUsTopContentLeftSource.boxThree
    : {};
  const privacyPolicySource = isPlainObject(source.privacyPolicy) ? source.privacyPolicy : {};
  const termsAndConditionsSource = isPlainObject(source.termsAndConditions)
    ? source.termsAndConditions
    : {};
  const faqsSource = isPlainObject(source.faqs)
    ? source.faqs
    : isPlainObject(source.faqPage)
      ? source.faqPage
      : {};
  const offersSource = isPlainObject(source.offers) ? source.offers : {};
  const contactUsSource = isPlainObject(source.contactUs) ? source.contactUs : {};
  const checkoutSource = isPlainObject(source.checkout) ? source.checkout : {};
  const dashboardSettingSource = isPlainObject(source.dashboardSetting)
    ? source.dashboardSetting
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
  const defaultsAboutUs = defaults.aboutUs;
  const defaultsPrivacyPolicy = defaults.privacyPolicy;
  const defaultsTermsAndConditions = defaults.termsAndConditions;
  const defaultsFaqs = defaults.faqs;
  const defaultsOffers = defaults.offers;
  const defaultsContactUs = defaults.contactUs;
  const defaultsCheckout = defaults.checkout;
  const defaultsDashboardSetting = defaults.dashboardSetting;
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
        whatsAppLink: toText(
          headerSource.whatsAppLink,
          defaultsHome.header.whatsAppLink
        ),
        headerLogoUrl: toText(
          headerSource.headerLogoUrl ?? headerSource.logoDataUrl,
          defaultsHome.header.headerLogoUrl
        ),
        logoDataUrl: toText(
          headerSource.logoDataUrl ?? headerSource.headerLogoUrl,
          defaultsHome.header.logoDataUrl
        ),
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
    aboutUs: {
      ...defaultsAboutUs,
      ...aboutUsSource,
      pageHeader: {
        ...defaultsAboutUs.pageHeader,
        ...aboutUsPageHeaderSource,
        enabled: toBool(aboutUsPageHeaderSource.enabled, defaultsAboutUs.pageHeader.enabled),
        backgroundImageDataUrl: toText(
          aboutUsPageHeaderSource.backgroundImageDataUrl ??
            aboutUsPageHeaderSource.backgroundImage ??
            "",
          ""
        ),
        pageTitle: toText(aboutUsPageHeaderSource.pageTitle, defaultsAboutUs.pageHeader.pageTitle),
      },
      topContentLeft: {
        ...defaultsAboutUs.topContentLeft,
        ...aboutUsTopContentLeftSource,
        enabled: toBool(
          aboutUsTopContentLeftSource.enabled,
          defaultsAboutUs.topContentLeft.enabled
        ),
        topTitle: toText(
          aboutUsTopContentLeftSource.topTitle,
          defaultsAboutUs.topContentLeft.topTitle
        ),
        topDescription: toText(
          aboutUsTopContentLeftSource.topDescription,
          defaultsAboutUs.topContentLeft.topDescription
        ),
        boxOne: {
          ...defaultsAboutUs.topContentLeft.boxOne,
          ...aboutUsBoxOneSource,
          title: toText(aboutUsBoxOneSource.title, defaultsAboutUs.topContentLeft.boxOne.title),
          subtitle: toText(
            aboutUsBoxOneSource.subtitle,
            defaultsAboutUs.topContentLeft.boxOne.subtitle
          ),
          description: toText(
            aboutUsBoxOneSource.description,
            defaultsAboutUs.topContentLeft.boxOne.description
          ),
        },
        boxTwo: {
          ...defaultsAboutUs.topContentLeft.boxTwo,
          ...aboutUsBoxTwoSource,
          title: toText(aboutUsBoxTwoSource.title, defaultsAboutUs.topContentLeft.boxTwo.title),
          subtitle: toText(
            aboutUsBoxTwoSource.subtitle,
            defaultsAboutUs.topContentLeft.boxTwo.subtitle
          ),
          description: toText(
            aboutUsBoxTwoSource.description,
            defaultsAboutUs.topContentLeft.boxTwo.description
          ),
        },
        boxThree: {
          ...defaultsAboutUs.topContentLeft.boxThree,
          ...aboutUsBoxThreeSource,
          title: toText(
            aboutUsBoxThreeSource.title,
            defaultsAboutUs.topContentLeft.boxThree.title
          ),
          subtitle: toText(
            aboutUsBoxThreeSource.subtitle,
            defaultsAboutUs.topContentLeft.boxThree.subtitle
          ),
          description: toText(
            aboutUsBoxThreeSource.description,
            defaultsAboutUs.topContentLeft.boxThree.description
          ),
        },
      },
      topContentRight: {
        ...defaultsAboutUs.topContentRight,
        ...aboutUsTopContentRightSource,
        enabled: toBool(
          aboutUsTopContentRightSource.enabled,
          defaultsAboutUs.topContentRight.enabled
        ),
        imageDataUrl: toText(
          aboutUsTopContentRightSource.imageDataUrl ?? aboutUsTopContentRightSource.image ?? "",
          ""
        ),
      },
      contentSection: {
        ...defaultsAboutUs.contentSection,
        ...aboutUsContentSectionSource,
        enabled: toBool(
          aboutUsContentSectionSource.enabled,
          defaultsAboutUs.contentSection.enabled
        ),
        firstParagraph: toText(
          aboutUsContentSectionSource.firstParagraph,
          defaultsAboutUs.contentSection.firstParagraph
        ),
        secondParagraph: toText(
          aboutUsContentSectionSource.secondParagraph,
          defaultsAboutUs.contentSection.secondParagraph
        ),
        contentImageDataUrl: toText(
          aboutUsContentSectionSource.contentImageDataUrl ??
            aboutUsContentSectionSource.imageDataUrl ??
            "",
          ""
        ),
      },
      ourTeam: {
        ...defaultsAboutUs.ourTeam,
        ...aboutUsOurTeamSource,
        enabled: toBool(aboutUsOurTeamSource.enabled, defaultsAboutUs.ourTeam.enabled),
        title: toText(aboutUsOurTeamSource.title, defaultsAboutUs.ourTeam.title),
        description: toText(
          aboutUsOurTeamSource.description,
          defaultsAboutUs.ourTeam.description
        ),
        members: normalizeAboutUsMembers(
          aboutUsOurTeamSource.members,
          defaultsAboutUs.ourTeam.members
        ),
      },
    },
    privacyPolicy: normalizePolicyPage(privacyPolicySource, defaultsPrivacyPolicy),
    termsAndConditions: normalizePolicyPage(
      termsAndConditionsSource,
      defaultsTermsAndConditions
    ),
    faqs: normalizeFaqs(faqsSource, defaultsFaqs),
    offers: normalizeOffers(offersSource, defaultsOffers),
    contactUs: normalizeContactUs(contactUsSource, defaultsContactUs),
    checkout: normalizeCheckout(checkoutSource, defaultsCheckout),
    dashboardSetting: normalizeDashboardSetting(
      dashboardSettingSource,
      defaultsDashboardSetting
    ),
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

function RichTextEditor({ id, label, value, onChange }) {
  const editorRef = useRef(null);
  const [linkInput, setLinkInput] = useState("");
  const [imageInput, setImageInput] = useState("");

  useEffect(() => {
    if (!editorRef.current) return;
    const nextValue = String(value || "");
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue || "<p></p>";
    }
  }, [value]);

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML || "");
  };

  const applyCommand = (command, commandValue) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-2">
          <button
            type="button"
            onClick={() => applyCommand("bold")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Bold
          </button>
          <button
            type="button"
            onClick={() => applyCommand("italic")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Italic
          </button>
          <button
            type="button"
            onClick={() => applyCommand("underline")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Underline
          </button>
          <button
            type="button"
            onClick={() => applyCommand("formatBlock", "<h2>")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => applyCommand("formatBlock", "<h3>")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => applyCommand("insertUnorderedList")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Bullet
          </button>
          <button
            type="button"
            onClick={() => applyCommand("insertOrderedList")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Number
          </button>
          <button
            type="button"
            onClick={() => applyCommand("fontSize", "3")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            A
          </button>
          <button
            type="button"
            onClick={() => applyCommand("fontSize", "5")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => applyCommand("undo")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => applyCommand("redo")}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Redo
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-slate-200 bg-white p-2 lg:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={linkInput}
              onChange={(event) => setLinkInput(event.target.value)}
              placeholder="https://example.com"
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!linkInput.trim()) return;
                applyCommand("createLink", linkInput.trim());
                setLinkInput("");
              }}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Link
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={imageInput}
              onChange={(event) => setImageInput(event.target.value)}
              placeholder="Image URL or Data URL"
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!imageInput.trim()) return;
                applyCommand("insertImage", imageInput.trim());
                setImageInput("");
              }}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Image
            </button>
          </div>
        </div>

        <div
          id={id}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          className="min-h-[220px] w-full px-4 py-3 text-sm text-slate-700 focus:outline-none"
        />
      </div>
    </div>
  );
}

function ImageUploadField({
  id,
  label,
  error,
  dropActive,
  onDropActiveChange,
  onInputChange,
  onDrop,
  previewDataUrl,
  onRemove,
  previewAlt,
  previewClassName = "h-20 w-24",
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        id={id}
        type="file"
        accept=".png,.jpeg,.jpg,.webp"
        onChange={onInputChange}
        className="hidden"
      />
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          onDropActiveChange(true);
        }}
        onDragLeave={() => onDropActiveChange(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dropActive
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-300 bg-white hover:border-slate-400"
        }`}
      >
        <Upload className="h-5 w-5 text-slate-500" />
        <p className="mt-2 text-sm font-medium text-slate-700">Drag your images here</p>
        <p className="mt-1 text-xs text-slate-500">
          (Only *.jpeg, *.webp and *.png images will be accepted)
        </p>
      </label>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {previewDataUrl ? (
        <div className="relative inline-flex rounded-xl border border-slate-200 bg-white p-2">
          <img
            src={previewDataUrl}
            alt={previewAlt}
            className={`${previewClassName} rounded-md object-cover`}
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function StoreCustomizationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const presetRef = useRef(null);
  const tabContentRef = useRef(null);
  const fileInputRef = useRef(null);
  const quickDeliveryFileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("home");
  const [activeMainSliderTab, setActiveMainSliderTab] = useState("slider-0");
  const [activeAboutUsMemberTab, setActiveAboutUsMemberTab] = useState("member-0");
  const [lang, setLang] = useState(getStoredAdminLanguageIso);
  const activeLangRef = useRef(lang);
  const [homeState, setHomeState] = useState(() => getDefaultCustomization().home);
  const [productSlugPageState, setProductSlugPageState] = useState(
    () => getDefaultCustomization().productSlugPage
  );
  const [aboutUsState, setAboutUsState] = useState(() => getDefaultCustomization().aboutUs);
  const [privacyPolicyState, setPrivacyPolicyState] = useState(
    () => getDefaultCustomization().privacyPolicy
  );
  const [termsAndConditionsState, setTermsAndConditionsState] = useState(
    () => getDefaultCustomization().termsAndConditions
  );
  const [faqsState, setFaqsState] = useState(() => getDefaultCustomization().faqs);
  const [offersState, setOffersState] = useState(() => getDefaultCustomization().offers);
  const [contactUsState, setContactUsState] = useState(
    () => getDefaultCustomization().contactUs
  );
  const [checkoutState, setCheckoutState] = useState(
    () => getDefaultCustomization().checkout
  );
  const [dashboardSettingState, setDashboardSettingState] = useState(
    () => getDefaultCustomization().dashboardSetting
  );
  const [seoSettingsState, setSeoSettingsState] = useState(
    () => getDefaultCustomization().seoSettings
  );
  const [notice, setNotice] = useState(null);
  const [whatsAppLinkServerError, setWhatsAppLinkServerError] = useState("");
  const [whatsAppLinkHelperError, setWhatsAppLinkHelperError] = useState("");
  const [headerLogoPreviewVersion, setHeaderLogoPreviewVersion] = useState("");
  const [logoMeta, setLogoMeta] = useState(null);
  const [logoWarning, setLogoWarning] = useState("");
  const [logoWarningLevel, setLogoWarningLevel] = useState("info");
  const [logoActionFeedback, setLogoActionFeedback] = useState("");
  const [logoActionFeedbackType, setLogoActionFeedbackType] = useState("info");
  const [logoError, setLogoError] = useState("");
  const [isDropActive, setIsDropActive] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
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
  const [aboutUsImageErrors, setAboutUsImageErrors] = useState({});
  const [aboutUsDropActive, setAboutUsDropActive] = useState({});
  const [policyImageErrors, setPolicyImageErrors] = useState({});
  const [policyDropActive, setPolicyDropActive] = useState({});
  const [faqsImageErrors, setFaqsImageErrors] = useState({});
  const [faqsDropActive, setFaqsDropActive] = useState({});
  const [offersImageErrors, setOffersImageErrors] = useState({});
  const [offersDropActive, setOffersDropActive] = useState({});
  const [contactUsImageErrors, setContactUsImageErrors] = useState({});
  const [contactUsDropActive, setContactUsDropActive] = useState({});

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const storeTabFromUrl = params.get("storeTab");
    const canonicalStoreTab = getCanonicalStoreTab(storeTabFromUrl, location.pathname);

    if (storeTabFromUrl !== canonicalStoreTab) {
      const canonicalTabKey = KEY_BY_STORE_TAB[canonicalStoreTab] || DEFAULT_TAB_KEY;
      navigate(getUrlByTabKey(canonicalTabKey), { replace: true });
      return;
    }

    const nextTabKey =
      KEY_BY_STORE_TAB[canonicalStoreTab] || getDefaultTabKeyByPath(location.pathname);
    setActiveTab((previousTab) => (previousTab === nextTabKey ? previousTab : nextTabKey));
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const contentElement = tabContentRef.current;
      if (!contentElement) return;

      try {
        contentElement.focus({ preventScroll: true });
      } catch {
        contentElement.focus();
      }

      if (window.innerWidth < 768) {
        contentElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab]);

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

  useEffect(() => {
    activeLangRef.current = lang;
  }, [lang]);

  const customizationQuery = useQuery({
    queryKey: ["admin-store-customization", lang],
    enabled: Boolean(lang),
    queryFn: () => fetchAdminStoreCustomization(lang),
    placeholderData: (previousData) => previousData,
  });

  const offersCouponsQuery = useQuery({
    queryKey: ["admin-coupons", "offers-select"],
    enabled: activeTab === "offers",
    staleTime: 60_000,
    queryFn: () => fetchAdminCoupons({ page: 1, limit: 100 }),
  });

  useEffect(() => {
    const payload = customizationQuery.data?.customization || customizationQuery.data;
    if (!payload) return;
    const normalized = normalizeCustomizationPayload(payload);
    setHomeState(normalized.home);
    setProductSlugPageState(normalized.productSlugPage);
    setAboutUsState(normalized.aboutUs);
    setPrivacyPolicyState(normalized.privacyPolicy);
    setTermsAndConditionsState(normalized.termsAndConditions);
    setFaqsState(normalized.faqs);
    setOffersState(normalized.offers);
    setContactUsState(normalized.contactUs);
    setCheckoutState(normalized.checkout);
    setDashboardSettingState(normalized.dashboardSetting);
    setSeoSettingsState(normalized.seoSettings);
    setLogoError("");
    setIsUploadingLogo(false);
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
    setAboutUsImageErrors({});
    setAboutUsDropActive({});
    setPolicyImageErrors({});
    setPolicyDropActive({});
    setFaqsImageErrors({});
    setFaqsDropActive({});
    setOffersImageErrors({});
    setOffersDropActive({});
    setContactUsImageErrors({});
    setContactUsDropActive({});
    setHeaderLogoPreviewVersion(toText(customizationQuery.data?.updatedAt));
    setWhatsAppLinkServerError("");
    setWhatsAppLinkHelperError("");
    setActiveAboutUsMemberTab("member-0");
  }, [customizationQuery.data]);

  const updateMutation = useMutation({
    mutationFn: ({ language, payload }) =>
      updateAdminStoreCustomization(language, payload),
    onMutate: () => {
      setNotice({
        type: "success",
        message: `Updating customization for ${String(lang || "en").toUpperCase()}...`,
      });
    },
    onSuccess: async (data) => {
      const payload = data?.customization || data;
      const normalized = normalizeCustomizationPayload(payload);
      setHomeState(normalized.home);
      setProductSlugPageState(normalized.productSlugPage);
      setAboutUsState(normalized.aboutUs);
      setPrivacyPolicyState(normalized.privacyPolicy);
      setTermsAndConditionsState(normalized.termsAndConditions);
      setFaqsState(normalized.faqs);
      setOffersState(normalized.offers);
      setContactUsState(normalized.contactUs);
      setCheckoutState(normalized.checkout);
      setDashboardSettingState(normalized.dashboardSetting);
      setSeoSettingsState(normalized.seoSettings);
      setWhatsAppLinkServerError("");
      setWhatsAppLinkHelperError("");
      setNotice({
        type: "success",
        message: `Store customization updated for ${String(lang || "en").toUpperCase()}.`,
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-store-customization", lang],
      });
    },
    onError: (error) => {
      const serverMessage =
        error?.response?.data?.message || error?.message || "";
      const isWhatsAppError = String(serverMessage)
        .toLowerCase()
        .includes("invalid whatsapp link");
      if (isWhatsAppError) {
        setWhatsAppLinkServerError("WhatsApp link must be wa.me or api.whatsapp.com");
      }
      setNotice({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          `Failed to update customization for ${String(lang || "en").toUpperCase()}.`,
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
    if (!logoActionFeedback) return undefined;
    const timer = setTimeout(() => {
      setLogoActionFeedback("");
      setLogoActionFeedbackType("info");
    }, 1800);
    return () => clearTimeout(timer);
  }, [logoActionFeedback]);

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
  const headerLogoSourceUrl = toText(
    homeState?.header?.headerLogoUrl ?? homeState?.header?.logoDataUrl
  );
  const headerLogoPreviewUrl = resolveAssetUrl(headerLogoSourceUrl);
  const headerLogoFrameSrc = withVersion(
    headerLogoPreviewUrl,
    headerLogoPreviewVersion
  );
  const publicLogoUrlCandidate = withVersion(
    buildPublicUrl(headerLogoSourceUrl),
    headerLogoPreviewVersion
  );
  const publicLogoUrl = isHttpUrl(publicLogoUrlCandidate) ? publicLogoUrlCandidate : "";
  const logoMetaText = logoMeta
    ? `Detected: ${logoMeta.width}x${logoMeta.height} (ratio ${logoMeta.ratio.toFixed(2)}:1)`
    : "";
  const isLoadingHeader = customizationQuery.isFetching;
  const isSaving = updateMutation.isPending;
  const showFullCustomizationLoader =
    customizationQuery.isLoading && !customizationQuery.data;
  const showCustomizationError =
    customizationQuery.isError && !customizationQuery.data;
  const headerWhatsAppLink = toText(homeState?.header?.whatsAppLink);
  const whatsAppLinkError = headerWhatsAppLink && !isSafeWhatsAppLink(headerWhatsAppLink)
    ? "WhatsApp link must be wa.me or api.whatsapp.com"
    : whatsAppLinkHelperError || whatsAppLinkServerError;

  const onSave = () => {
    if (!lang || isLoadingHeader || isSaving || isUploadingLogo) return;
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
      aboutUs: {
        ...currentCustomization.aboutUs,
        pageHeader: {
          ...currentCustomization.aboutUs?.pageHeader,
          ...aboutUsState?.pageHeader,
          enabled: Boolean(aboutUsState?.pageHeader?.enabled),
          backgroundImageDataUrl: toText(aboutUsState?.pageHeader?.backgroundImageDataUrl),
          pageTitle: toText(aboutUsState?.pageHeader?.pageTitle),
        },
        topContentLeft: {
          ...currentCustomization.aboutUs?.topContentLeft,
          ...aboutUsState?.topContentLeft,
          enabled: Boolean(aboutUsState?.topContentLeft?.enabled),
          topTitle: toText(aboutUsState?.topContentLeft?.topTitle),
          topDescription: toText(aboutUsState?.topContentLeft?.topDescription),
          boxOne: {
            ...currentCustomization.aboutUs?.topContentLeft?.boxOne,
            ...aboutUsState?.topContentLeft?.boxOne,
            title: toText(aboutUsState?.topContentLeft?.boxOne?.title),
            subtitle: toText(aboutUsState?.topContentLeft?.boxOne?.subtitle),
            description: toText(aboutUsState?.topContentLeft?.boxOne?.description),
          },
          boxTwo: {
            ...currentCustomization.aboutUs?.topContentLeft?.boxTwo,
            ...aboutUsState?.topContentLeft?.boxTwo,
            title: toText(aboutUsState?.topContentLeft?.boxTwo?.title),
            subtitle: toText(aboutUsState?.topContentLeft?.boxTwo?.subtitle),
            description: toText(aboutUsState?.topContentLeft?.boxTwo?.description),
          },
          boxThree: {
            ...currentCustomization.aboutUs?.topContentLeft?.boxThree,
            ...aboutUsState?.topContentLeft?.boxThree,
            title: toText(aboutUsState?.topContentLeft?.boxThree?.title),
            subtitle: toText(aboutUsState?.topContentLeft?.boxThree?.subtitle),
            description: toText(aboutUsState?.topContentLeft?.boxThree?.description),
          },
        },
        topContentRight: {
          ...currentCustomization.aboutUs?.topContentRight,
          ...aboutUsState?.topContentRight,
          enabled: Boolean(aboutUsState?.topContentRight?.enabled),
          imageDataUrl: toText(aboutUsState?.topContentRight?.imageDataUrl),
        },
        contentSection: {
          ...currentCustomization.aboutUs?.contentSection,
          ...aboutUsState?.contentSection,
          enabled: Boolean(aboutUsState?.contentSection?.enabled),
          firstParagraph: toText(aboutUsState?.contentSection?.firstParagraph),
          secondParagraph: toText(aboutUsState?.contentSection?.secondParagraph),
          contentImageDataUrl: toText(aboutUsState?.contentSection?.contentImageDataUrl),
        },
        ourTeam: {
          ...currentCustomization.aboutUs?.ourTeam,
          ...aboutUsState?.ourTeam,
          enabled: Boolean(aboutUsState?.ourTeam?.enabled),
          title: toText(aboutUsState?.ourTeam?.title),
          description: toText(aboutUsState?.ourTeam?.description),
          members: normalizeAboutUsMembers(
            aboutUsState?.ourTeam?.members,
            getDefaultCustomization().aboutUs.ourTeam.members
          ).map((member) => ({
            imageDataUrl: toText(member?.imageDataUrl),
            title: toText(member?.title),
            subTitle: toText(member?.subTitle),
          })),
        },
      },
      privacyPolicy: {
        ...currentCustomization.privacyPolicy,
        ...privacyPolicyState,
        enabled: Boolean(privacyPolicyState?.enabled),
        pageHeaderBackgroundDataUrl: toText(
          privacyPolicyState?.pageHeaderBackgroundDataUrl
        ),
        pageTitle: toText(privacyPolicyState?.pageTitle),
        pageTextHtml: toText(
          privacyPolicyState?.pageTextHtml,
          getDefaultCustomization().privacyPolicy.pageTextHtml
        ),
      },
      termsAndConditions: {
        ...currentCustomization.termsAndConditions,
        ...termsAndConditionsState,
        enabled: Boolean(termsAndConditionsState?.enabled),
        pageHeaderBackgroundDataUrl: toText(
          termsAndConditionsState?.pageHeaderBackgroundDataUrl
        ),
        pageTitle: toText(termsAndConditionsState?.pageTitle),
        pageTextHtml: toText(
          termsAndConditionsState?.pageTextHtml,
          getDefaultCustomization().termsAndConditions.pageTextHtml
        ),
      },
      faqs: {
        ...currentCustomization.faqs,
        ...faqsState,
        pageHeader: {
          ...currentCustomization.faqs?.pageHeader,
          ...faqsState?.pageHeader,
          enabled: Boolean(faqsState?.pageHeader?.enabled),
          backgroundImageDataUrl: toText(
            faqsState?.pageHeader?.backgroundImageDataUrl
          ),
          pageTitle: toText(faqsState?.pageHeader?.pageTitle),
        },
        leftColumn: {
          ...currentCustomization.faqs?.leftColumn,
          ...faqsState?.leftColumn,
          enabled: Boolean(faqsState?.leftColumn?.enabled),
          leftImageDataUrl: toText(faqsState?.leftColumn?.leftImageDataUrl),
        },
        content: {
          ...currentCustomization.faqs?.content,
          ...faqsState?.content,
          enabled: Boolean(faqsState?.content?.enabled),
          items: normalizeFaqItems(
            faqsState?.content?.items,
            getDefaultCustomization().faqs.content.items
          ).map((item) => ({
            title: toText(item?.title),
            description: toText(item?.description),
          })),
        },
      },
      offers: {
        ...currentCustomization.offers,
        ...offersState,
        pageHeader: {
          ...currentCustomization.offers?.pageHeader,
          ...offersState?.pageHeader,
          enabled: Boolean(offersState?.pageHeader?.enabled),
          backgroundImageDataUrl: toText(
            offersState?.pageHeader?.backgroundImageDataUrl
          ),
          pageTitle: toText(offersState?.pageHeader?.pageTitle),
        },
        superDiscount: {
          ...currentCustomization.offers?.superDiscount,
          ...offersState?.superDiscount,
          enabled: Boolean(offersState?.superDiscount?.enabled),
          activeCouponCode: toText(
            offersState?.superDiscount?.activeCouponCode,
            "ALL"
          ).toUpperCase(),
        },
      },
      contactUs: {
        ...currentCustomization.contactUs,
        ...contactUsState,
        pageHeader: {
          ...currentCustomization.contactUs?.pageHeader,
          ...contactUsState?.pageHeader,
          enabled: Boolean(contactUsState?.pageHeader?.enabled),
          backgroundImageDataUrl: toText(
            contactUsState?.pageHeader?.backgroundImageDataUrl
          ),
          pageTitle: toText(contactUsState?.pageHeader?.pageTitle),
        },
        emailBox: {
          ...currentCustomization.contactUs?.emailBox,
          ...contactUsState?.emailBox,
          enabled: Boolean(contactUsState?.emailBox?.enabled),
          title: toText(contactUsState?.emailBox?.title),
          email: toText(contactUsState?.emailBox?.email),
          text: toText(contactUsState?.emailBox?.text),
        },
        callBox: {
          ...currentCustomization.contactUs?.callBox,
          ...contactUsState?.callBox,
          enabled: Boolean(contactUsState?.callBox?.enabled),
          title: toText(contactUsState?.callBox?.title),
          phone: toText(contactUsState?.callBox?.phone),
          text: toText(contactUsState?.callBox?.text),
        },
        addressBox: {
          ...currentCustomization.contactUs?.addressBox,
          ...contactUsState?.addressBox,
          enabled: Boolean(contactUsState?.addressBox?.enabled),
          title: toText(contactUsState?.addressBox?.title),
          address: toText(contactUsState?.addressBox?.address),
        },
        middleLeftColumn: {
          ...currentCustomization.contactUs?.middleLeftColumn,
          ...contactUsState?.middleLeftColumn,
          enabled: Boolean(contactUsState?.middleLeftColumn?.enabled),
          imageDataUrl: toText(contactUsState?.middleLeftColumn?.imageDataUrl),
        },
        contactForm: {
          ...currentCustomization.contactUs?.contactForm,
          ...contactUsState?.contactForm,
          enabled: Boolean(contactUsState?.contactForm?.enabled),
          title: toText(contactUsState?.contactForm?.title),
          description: toText(contactUsState?.contactForm?.description),
        },
      },
      checkout: {
        ...currentCustomization.checkout,
        ...checkoutState,
        personalDetails: {
          ...currentCustomization.checkout?.personalDetails,
          ...checkoutState?.personalDetails,
          sectionTitle: toText(checkoutState?.personalDetails?.sectionTitle),
          firstNameLabel: toText(checkoutState?.personalDetails?.firstNameLabel),
          lastNameLabel: toText(checkoutState?.personalDetails?.lastNameLabel),
          emailLabel: toText(checkoutState?.personalDetails?.emailLabel),
          phoneLabel: toText(checkoutState?.personalDetails?.phoneLabel),
          firstNamePlaceholder: toText(
            checkoutState?.personalDetails?.firstNamePlaceholder
          ),
          lastNamePlaceholder: toText(checkoutState?.personalDetails?.lastNamePlaceholder),
          emailPlaceholder: toText(checkoutState?.personalDetails?.emailPlaceholder),
          phonePlaceholder: toText(checkoutState?.personalDetails?.phonePlaceholder),
        },
        shippingDetails: {
          ...currentCustomization.checkout?.shippingDetails,
          ...checkoutState?.shippingDetails,
          sectionTitle: toText(checkoutState?.shippingDetails?.sectionTitle),
          streetAddressLabel: toText(checkoutState?.shippingDetails?.streetAddressLabel),
          cityLabel: toText(checkoutState?.shippingDetails?.cityLabel),
          countryLabel: toText(checkoutState?.shippingDetails?.countryLabel),
          zipLabel: toText(checkoutState?.shippingDetails?.zipLabel),
          streetAddressPlaceholder: toText(
            checkoutState?.shippingDetails?.streetAddressPlaceholder
          ),
          cityPlaceholder: toText(checkoutState?.shippingDetails?.cityPlaceholder),
          countryPlaceholder: toText(checkoutState?.shippingDetails?.countryPlaceholder),
          zipPlaceholder: toText(checkoutState?.shippingDetails?.zipPlaceholder),
          shippingCostLabel: toText(checkoutState?.shippingDetails?.shippingCostLabel),
          shippingOneNameLabel: toText(
            checkoutState?.shippingDetails?.shippingOneNameLabel
          ),
          shippingOneNameDefault: toText(
            checkoutState?.shippingDetails?.shippingOneNameDefault
          ),
          shippingOneDescriptionLabel: toText(
            checkoutState?.shippingDetails?.shippingOneDescriptionLabel
          ),
          shippingOneDescriptionDefault: toText(
            checkoutState?.shippingDetails?.shippingOneDescriptionDefault
          ),
          shippingOneCostLabel: toText(
            checkoutState?.shippingDetails?.shippingOneCostLabel
          ),
          shippingOneCostDefault: toText(
            checkoutState?.shippingDetails?.shippingOneCostDefault
          ),
          shippingTwoNameLabel: toText(
            checkoutState?.shippingDetails?.shippingTwoNameLabel
          ),
          shippingTwoNameDefault: toText(
            checkoutState?.shippingDetails?.shippingTwoNameDefault
          ),
          shippingTwoDescriptionLabel: toText(
            checkoutState?.shippingDetails?.shippingTwoDescriptionLabel
          ),
          shippingTwoDescriptionDefault: toText(
            checkoutState?.shippingDetails?.shippingTwoDescriptionDefault
          ),
          shippingTwoCostLabel: toText(
            checkoutState?.shippingDetails?.shippingTwoCostLabel
          ),
          shippingTwoCostDefault: toText(
            checkoutState?.shippingDetails?.shippingTwoCostDefault
          ),
          paymentMethodLabel: toText(checkoutState?.shippingDetails?.paymentMethodLabel),
          paymentMethodPlaceholder: toText(
            checkoutState?.shippingDetails?.paymentMethodPlaceholder
          ),
        },
        buttons: {
          ...currentCustomization.checkout?.buttons,
          ...checkoutState?.buttons,
          continueButtonLabel: toText(checkoutState?.buttons?.continueButtonLabel),
          confirmButtonLabel: toText(checkoutState?.buttons?.confirmButtonLabel),
        },
        cartItemSection: {
          ...currentCustomization.checkout?.cartItemSection,
          ...checkoutState?.cartItemSection,
          sectionTitle: toText(checkoutState?.cartItemSection?.sectionTitle),
          orderSummaryLabel: toText(checkoutState?.cartItemSection?.orderSummaryLabel),
          applyButtonLabel: toText(checkoutState?.cartItemSection?.applyButtonLabel),
          subTotalLabel: toText(checkoutState?.cartItemSection?.subTotalLabel),
          discountLabel: toText(checkoutState?.cartItemSection?.discountLabel),
          totalCostLabel: toText(checkoutState?.cartItemSection?.totalCostLabel),
        },
      },
      dashboardSetting: {
        ...currentCustomization.dashboardSetting,
        ...dashboardSettingState,
        dashboard: {
          ...currentCustomization.dashboardSetting?.dashboard,
          ...dashboardSettingState?.dashboard,
          sectionTitle: toText(dashboardSettingState?.dashboard?.sectionTitle),
          invoiceMessageFirstPartLabel: toText(
            dashboardSettingState?.dashboard?.invoiceMessageFirstPartLabel
          ),
          invoiceMessageFirstPartValue: toText(
            dashboardSettingState?.dashboard?.invoiceMessageFirstPartValue
          ),
          invoiceMessageLastPartLabel: toText(
            dashboardSettingState?.dashboard?.invoiceMessageLastPartLabel
          ),
          invoiceMessageLastPartValue: toText(
            dashboardSettingState?.dashboard?.invoiceMessageLastPartValue
          ),
          printButtonLabel: toText(dashboardSettingState?.dashboard?.printButtonLabel),
          printButtonValue: toText(dashboardSettingState?.dashboard?.printButtonValue),
          downloadButtonLabel: toText(dashboardSettingState?.dashboard?.downloadButtonLabel),
          downloadButtonValue: toText(dashboardSettingState?.dashboard?.downloadButtonValue),
          dashboardLabel: toText(dashboardSettingState?.dashboard?.dashboardLabel),
          totalOrdersLabel: toText(dashboardSettingState?.dashboard?.totalOrdersLabel),
          pendingOrderLabel: toText(dashboardSettingState?.dashboard?.pendingOrderLabel),
          pendingOrderValue: toText(dashboardSettingState?.dashboard?.pendingOrderValue),
          processingOrderLabel: toText(
            dashboardSettingState?.dashboard?.processingOrderLabel
          ),
          processingOrderValue: toText(
            dashboardSettingState?.dashboard?.processingOrderValue
          ),
          completeOrderLabel: toText(dashboardSettingState?.dashboard?.completeOrderLabel),
          completeOrderValue: toText(dashboardSettingState?.dashboard?.completeOrderValue),
          recentOrderLabel: toText(dashboardSettingState?.dashboard?.recentOrderLabel),
          recentOrderValue: toText(dashboardSettingState?.dashboard?.recentOrderValue),
          myOrderLabel: toText(dashboardSettingState?.dashboard?.myOrderLabel),
          myOrderValue: toText(dashboardSettingState?.dashboard?.myOrderValue),
        },
        updateProfile: {
          ...currentCustomization.dashboardSetting?.updateProfile,
          ...dashboardSettingState?.updateProfile,
          sectionTitleLabel: toText(
            dashboardSettingState?.updateProfile?.sectionTitleLabel
          ),
          sectionTitleValue: toText(
            dashboardSettingState?.updateProfile?.sectionTitleValue
          ),
          fullNameLabel: toText(dashboardSettingState?.updateProfile?.fullNameLabel),
          addressLabel: toText(dashboardSettingState?.updateProfile?.addressLabel),
          phoneMobileLabel: toText(
            dashboardSettingState?.updateProfile?.phoneMobileLabel
          ),
          emailAddressLabel: toText(
            dashboardSettingState?.updateProfile?.emailAddressLabel
          ),
          updateButtonLabel: toText(dashboardSettingState?.updateProfile?.updateButtonLabel),
          updateButtonValue: toText(dashboardSettingState?.updateProfile?.updateButtonValue),
          currentPasswordLabel: toText(
            dashboardSettingState?.updateProfile?.currentPasswordLabel
          ),
          newPasswordLabel: toText(dashboardSettingState?.updateProfile?.newPasswordLabel),
          changePasswordLabel: toText(
            dashboardSettingState?.updateProfile?.changePasswordLabel
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
    if (field === "whatsAppLink") {
      setWhatsAppLinkServerError("");
      setWhatsAppLinkHelperError("");
    }
    if (field === "phoneNumber") {
      setWhatsAppLinkHelperError("");
    }
    setHomeState((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        [field]: value,
      },
    }));
  };

  const onSelectTab = (tabKey) => {
    const safeTabKey = STORE_TAB_BY_KEY[tabKey] ? tabKey : DEFAULT_TAB_KEY;
    if (safeTabKey === activeTab) return;
    const canonicalUrl = getUrlByTabKey(safeTabKey);
    const currentUrl = `${location.pathname}${location.search}`;
    if (currentUrl === canonicalUrl) return;
    navigate(canonicalUrl, { replace: false });
  };

  const onGenerateWhatsAppLink = () => {
    const result = buildWhatsAppLinkFromPhone(homeState?.header?.phoneNumber);
    if (result.error) {
      setWhatsAppLinkHelperError(result.error);
      return;
    }
    setWhatsAppLinkHelperError("");
    onChangeHeaderField("whatsAppLink", result.link);
  };

  const onTestWhatsAppLink = () => {
    const link = toText(homeState?.header?.whatsAppLink);
    if (!link || !isSafeWhatsAppLink(link)) return;
    window.open(link, "_blank", "noopener,noreferrer");
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
    if (isLoadingHeader || isSaving || isUploadingLogo) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setLogoError(validation.error);
      return;
    }

    try {
      const nextLogoMeta = await readImageDimensions(file);
      const feedback = getLogoDimensionFeedback(nextLogoMeta);
      setLogoMeta(nextLogoMeta);
      setLogoWarning(feedback.message);
      setLogoWarningLevel(feedback.level);
    } catch {
      setLogoMeta(null);
      setLogoWarning("Warning: Cannot read image dimensions.");
      setLogoWarningLevel("warn");
    }

    try {
      const activeLang = String(lang || "en").trim().toLowerCase() || "en";
      setIsUploadingLogo(true);
      const uploadResult = await uploadAdminStoreHeaderLogo(file, activeLang);
      const uploadedLogoUrl = toText(
        uploadResult?.headerLogoUrl ?? uploadResult?.url
      );
      if (!uploadedLogoUrl) {
        throw new Error("Upload succeeded but no logo URL was returned.");
      }
      if (
        (String(activeLangRef.current || "en").trim().toLowerCase() || "en") !==
        activeLang
      ) {
        return;
      }
      setLogoError("");
      onChangeHeaderField("headerLogoUrl", uploadedLogoUrl);
      onChangeHeaderField("logoDataUrl", uploadedLogoUrl);
      setHeaderLogoPreviewVersion(toText(uploadResult?.updatedAt));
      setNotice({
        type: "success",
        message: `Logo uploaded for ${activeLang.toUpperCase()}. Click Update to save other changes.`,
      });
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to process image.";
      setLogoError(errorMessage);
      setNotice({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const onLogoInputChange = async (event) => {
    if (isUploadingLogo || isLoadingHeader || isSaving) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    await onHandleLogoFile(file);
    event.target.value = "";
  };

  const onRemoveLogo = () => {
    setLogoError("");
    setHeaderLogoPreviewVersion("");
    setLogoMeta(null);
    setLogoWarning("");
    setLogoWarningLevel("info");
    setLogoActionFeedback("");
    setLogoActionFeedbackType("info");
    onChangeHeaderField("headerLogoUrl", "");
    onChangeHeaderField("logoDataUrl", "");
  };

  const onCopyPublicLogoUrl = async () => {
    if (!publicLogoUrl) return;
    let copied = false;

    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      try {
        await navigator.clipboard.writeText(publicLogoUrl);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied && typeof document !== "undefined") {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = publicLogoUrl;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        copied = document.execCommand("copy");
        textArea.remove();
      } catch {
        copied = false;
      }
    }

    setLogoActionFeedback(copied ? "Copied!" : "Copy failed.");
    setLogoActionFeedbackType(copied ? "info" : "warn");
  };

  const onOpenPublicLogoUrl = () => {
    if (!publicLogoUrl || typeof window === "undefined") return;
    window.open(publicLogoUrl, "_blank", "noreferrer");
  };

  const onDownloadPublicLogoUrl = () => {
    if (!publicLogoUrl || typeof document === "undefined") return;
    const extension = getSafeImageExt(publicLogoUrl);
    const normalizedLang = toText(lang, "en")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") || "en";
    const fileName = `store-header-logo_${normalizedLang}.${extension}`;
    const anchor = document.createElement("a");
    anchor.href = publicLogoUrl;
    anchor.download = fileName;
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setLogoActionFeedback("Download started.");
    setLogoActionFeedbackType("info");
  };

  const onDropLogo = async (event) => {
    event.preventDefault();
    setIsDropActive(false);
    if (isUploadingLogo || isLoadingHeader || isSaving) return;
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

  const onChangeAboutUsBlockEnabled = (blockKey, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      [blockKey]: {
        ...prev?.[blockKey],
        enabled: Boolean(value),
      },
    }));
  };

  const onChangeAboutUsPageHeaderField = (field, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      pageHeader: {
        ...prev?.pageHeader,
        [field]: value,
      },
    }));
  };

  const onChangeAboutUsTopContentLeftField = (field, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      topContentLeft: {
        ...prev?.topContentLeft,
        [field]: value,
      },
    }));
  };

  const onChangeAboutUsTopContentLeftBoxField = (boxKey, field, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      topContentLeft: {
        ...prev?.topContentLeft,
        [boxKey]: {
          ...prev?.topContentLeft?.[boxKey],
          [field]: value,
        },
      },
    }));
  };

  const onChangeAboutUsContentSectionField = (field, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      contentSection: {
        ...prev?.contentSection,
        [field]: value,
      },
    }));
  };

  const onChangeAboutUsOurTeamField = (field, value) => {
    setAboutUsState((prev) => ({
      ...prev,
      ourTeam: {
        ...prev?.ourTeam,
        [field]: value,
      },
    }));
  };

  const onChangeAboutUsMemberField = (memberIndex, field, value) => {
    setAboutUsState((prev) => {
      const fallbackMembers = getDefaultCustomization().aboutUs.ourTeam.members;
      const members = normalizeAboutUsMembers(prev?.ourTeam?.members, fallbackMembers);
      const current = members[memberIndex] || fallbackMembers[memberIndex];
      members[memberIndex] = {
        ...current,
        [field]: value,
      };
      return {
        ...prev,
        ourTeam: {
          ...prev?.ourTeam,
          members,
        },
      };
    });
  };

  const setAboutUsDropActiveField = (fieldKey, value) => {
    setAboutUsDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onChangeAboutUsImageField = (fieldKey, dataUrl) => {
    if (fieldKey === ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground) {
      onChangeAboutUsPageHeaderField("backgroundImageDataUrl", dataUrl);
      return;
    }
    if (fieldKey === ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage) {
      setAboutUsState((prev) => ({
        ...prev,
        topContentRight: {
          ...prev?.topContentRight,
          imageDataUrl: dataUrl,
        },
      }));
      return;
    }
    if (fieldKey === ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage) {
      onChangeAboutUsContentSectionField("contentImageDataUrl", dataUrl);
      return;
    }
    if (String(fieldKey).startsWith("teamMemberImage-")) {
      const memberIndex = Number(String(fieldKey).replace("teamMemberImage-", ""));
      if (Number.isInteger(memberIndex) && memberIndex >= 0) {
        onChangeAboutUsMemberField(memberIndex, "imageDataUrl", dataUrl);
      }
    }
  };

  const onHandleAboutUsImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setAboutUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setAboutUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangeAboutUsImageField(fieldKey, dataUrl);
    } catch (error) {
      setAboutUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onAboutUsImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleAboutUsImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropAboutUsImage = async (fieldKey, event) => {
    event.preventDefault();
    setAboutUsDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleAboutUsImage(fieldKey, file);
  };

  const onRemoveAboutUsImage = (fieldKey) => {
    setAboutUsImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangeAboutUsImageField(fieldKey, "");
  };

  const updatePolicyState = (policyKey, updater) => {
    if (policyKey === "termsAndConditions") {
      setTermsAndConditionsState((prev) =>
        updater(prev || getDefaultCustomization().termsAndConditions)
      );
      return;
    }
    setPrivacyPolicyState((prev) =>
      updater(prev || getDefaultCustomization().privacyPolicy)
    );
  };

  const onChangePolicyEnabled = (policyKey, value) => {
    updatePolicyState(policyKey, (prev) => ({
      ...prev,
      enabled: Boolean(value),
    }));
  };

  const onChangePolicyField = (policyKey, field, value) => {
    updatePolicyState(policyKey, (prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const setPolicyDropActiveField = (fieldKey, value) => {
    setPolicyDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onChangePolicyImageField = (fieldKey, dataUrl) => {
    const policyKey = POLICY_FIELD_KEY_BY_IMAGE_FIELD[fieldKey];
    if (!policyKey) return;
    onChangePolicyField(policyKey, "pageHeaderBackgroundDataUrl", dataUrl);
  };

  const onHandlePolicyImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setPolicyImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setPolicyImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangePolicyImageField(fieldKey, dataUrl);
    } catch (error) {
      setPolicyImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onPolicyImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandlePolicyImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropPolicyImage = async (fieldKey, event) => {
    event.preventDefault();
    setPolicyDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandlePolicyImage(fieldKey, file);
  };

  const onRemovePolicyImage = (fieldKey) => {
    setPolicyImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangePolicyImageField(fieldKey, "");
  };

  const onChangeFaqsBlockEnabled = (blockKey, value) => {
    setFaqsState((prev) => ({
      ...prev,
      [blockKey]: {
        ...prev?.[blockKey],
        enabled: Boolean(value),
      },
    }));
  };

  const onChangeFaqsPageHeaderField = (field, value) => {
    setFaqsState((prev) => ({
      ...prev,
      pageHeader: {
        ...prev?.pageHeader,
        [field]: value,
      },
    }));
  };

  const onChangeFaqsLeftColumnField = (field, value) => {
    setFaqsState((prev) => ({
      ...prev,
      leftColumn: {
        ...prev?.leftColumn,
        [field]: value,
      },
    }));
  };

  const onChangeFaqsItemField = (index, field, value) => {
    setFaqsState((prev) => {
      const defaults = getDefaultCustomization().faqs.content.items;
      const nextItems = normalizeFaqItems(prev?.content?.items, defaults);
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };
      return {
        ...prev,
        content: {
          ...prev?.content,
          items: normalizeFaqItems(nextItems, defaults),
        },
      };
    });
  };

  const setFaqsDropActiveField = (fieldKey, value) => {
    setFaqsDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onChangeFaqsImageField = (fieldKey, dataUrl) => {
    if (fieldKey === FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground) {
      onChangeFaqsPageHeaderField("backgroundImageDataUrl", dataUrl);
      return;
    }
    if (fieldKey === FAQS_IMAGE_FIELD_KEYS.leftColumnImage) {
      onChangeFaqsLeftColumnField("leftImageDataUrl", dataUrl);
    }
  };

  const onHandleFaqsImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setFaqsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setFaqsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangeFaqsImageField(fieldKey, dataUrl);
    } catch (error) {
      setFaqsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onFaqsImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleFaqsImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropFaqsImage = async (fieldKey, event) => {
    event.preventDefault();
    setFaqsDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleFaqsImage(fieldKey, file);
  };

  const onRemoveFaqsImage = (fieldKey) => {
    setFaqsImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangeFaqsImageField(fieldKey, "");
  };

  const onChangeOffersBlockEnabled = (blockKey, value) => {
    setOffersState((prev) => ({
      ...prev,
      [blockKey]: {
        ...prev?.[blockKey],
        enabled: Boolean(value),
      },
    }));
  };

  const onChangeOffersPageHeaderField = (field, value) => {
    setOffersState((prev) => ({
      ...prev,
      pageHeader: {
        ...prev?.pageHeader,
        [field]: value,
      },
    }));
  };

  const onChangeOffersSuperDiscountField = (field, value) => {
    setOffersState((prev) => ({
      ...prev,
      superDiscount: {
        ...prev?.superDiscount,
        [field]: field === "activeCouponCode" ? String(value || "").toUpperCase() : value,
      },
    }));
  };

  const setOffersDropActiveField = (fieldKey, value) => {
    setOffersDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onChangeOffersImageField = (fieldKey, dataUrl) => {
    if (fieldKey !== OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground) return;
    onChangeOffersPageHeaderField("backgroundImageDataUrl", dataUrl);
  };

  const onHandleOffersImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setOffersImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setOffersImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangeOffersImageField(fieldKey, dataUrl);
    } catch (error) {
      setOffersImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onOffersImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleOffersImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropOffersImage = async (fieldKey, event) => {
    event.preventDefault();
    setOffersDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleOffersImage(fieldKey, file);
  };

  const onRemoveOffersImage = (fieldKey) => {
    setOffersImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangeOffersImageField(fieldKey, "");
  };

  const onChangeContactUsSectionEnabled = (sectionKey, value) => {
    setContactUsState((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev?.[sectionKey],
        enabled: Boolean(value),
      },
    }));
  };

  const onChangeContactUsSectionField = (sectionKey, field, value) => {
    setContactUsState((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev?.[sectionKey],
        [field]: value,
      },
    }));
  };

  const setContactUsDropActiveField = (fieldKey, value) => {
    setContactUsDropActive((prev) => ({
      ...prev,
      [fieldKey]: Boolean(value),
    }));
  };

  const onChangeContactUsImageField = (fieldKey, dataUrl) => {
    if (fieldKey === CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground) {
      onChangeContactUsSectionField("pageHeader", "backgroundImageDataUrl", dataUrl);
      return;
    }
    if (fieldKey === CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage) {
      onChangeContactUsSectionField("middleLeftColumn", "imageDataUrl", dataUrl);
    }
  };

  const onHandleContactUsImage = async (fieldKey, file) => {
    if (!file) return;
    const validation = validateCustomizationLogoFile(file);
    if (!validation.valid) {
      setContactUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: validation.error,
      }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setContactUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: "",
      }));
      onChangeContactUsImageField(fieldKey, dataUrl);
    } catch (error) {
      setContactUsImageErrors((prev) => ({
        ...prev,
        [fieldKey]: error?.message || "Failed to process image.",
      }));
    }
  };

  const onContactUsImageInputChange = async (fieldKey, event) => {
    const file = event.target.files?.[0];
    await onHandleContactUsImage(fieldKey, file);
    event.target.value = "";
  };

  const onDropContactUsImage = async (fieldKey, event) => {
    event.preventDefault();
    setContactUsDropActiveField(fieldKey, false);
    const file = event.dataTransfer?.files?.[0];
    await onHandleContactUsImage(fieldKey, file);
  };

  const onRemoveContactUsImage = (fieldKey) => {
    setContactUsImageErrors((prev) => ({
      ...prev,
      [fieldKey]: "",
    }));
    onChangeContactUsImageField(fieldKey, "");
  };

  const onChangeCheckoutField = (sectionKey, field, value) => {
    setCheckoutState((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev?.[sectionKey],
        [field]: value,
      },
    }));
  };

  const onChangeDashboardSettingField = (sectionKey, field, value) => {
    setDashboardSettingState((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev?.[sectionKey],
        [field]: value,
      },
    }));
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
  const aboutUsDefaults = getDefaultCustomization().aboutUs;
  const aboutUs = {
    ...aboutUsDefaults,
    ...(aboutUsState || {}),
    pageHeader: {
      ...aboutUsDefaults.pageHeader,
      ...(aboutUsState?.pageHeader || {}),
      enabled: Boolean(aboutUsState?.pageHeader?.enabled),
      backgroundImageDataUrl: toText(aboutUsState?.pageHeader?.backgroundImageDataUrl, ""),
      pageTitle: toText(aboutUsState?.pageHeader?.pageTitle, ""),
    },
    topContentLeft: {
      ...aboutUsDefaults.topContentLeft,
      ...(aboutUsState?.topContentLeft || {}),
      enabled: Boolean(aboutUsState?.topContentLeft?.enabled),
      topTitle: toText(aboutUsState?.topContentLeft?.topTitle, ""),
      topDescription: toText(aboutUsState?.topContentLeft?.topDescription, ""),
      boxOne: {
        ...aboutUsDefaults.topContentLeft.boxOne,
        ...(aboutUsState?.topContentLeft?.boxOne || {}),
      },
      boxTwo: {
        ...aboutUsDefaults.topContentLeft.boxTwo,
        ...(aboutUsState?.topContentLeft?.boxTwo || {}),
      },
      boxThree: {
        ...aboutUsDefaults.topContentLeft.boxThree,
        ...(aboutUsState?.topContentLeft?.boxThree || {}),
      },
    },
    topContentRight: {
      ...aboutUsDefaults.topContentRight,
      ...(aboutUsState?.topContentRight || {}),
      enabled: Boolean(aboutUsState?.topContentRight?.enabled),
      imageDataUrl: toText(aboutUsState?.topContentRight?.imageDataUrl, ""),
    },
    contentSection: {
      ...aboutUsDefaults.contentSection,
      ...(aboutUsState?.contentSection || {}),
      enabled: Boolean(aboutUsState?.contentSection?.enabled),
      firstParagraph: toText(aboutUsState?.contentSection?.firstParagraph, ""),
      secondParagraph: toText(aboutUsState?.contentSection?.secondParagraph, ""),
      contentImageDataUrl: toText(aboutUsState?.contentSection?.contentImageDataUrl, ""),
    },
    ourTeam: {
      ...aboutUsDefaults.ourTeam,
      ...(aboutUsState?.ourTeam || {}),
      enabled: Boolean(aboutUsState?.ourTeam?.enabled),
      title: toText(aboutUsState?.ourTeam?.title, ""),
      description: toText(aboutUsState?.ourTeam?.description, ""),
      members: normalizeAboutUsMembers(
        aboutUsState?.ourTeam?.members,
        aboutUsDefaults.ourTeam.members
      ),
    },
  };
  const privacyPolicyDefaults = getDefaultCustomization().privacyPolicy;
  const privacyPolicy = {
    ...privacyPolicyDefaults,
    ...(privacyPolicyState || {}),
    enabled: Boolean(privacyPolicyState?.enabled),
    pageHeaderBackgroundDataUrl: toText(
      privacyPolicyState?.pageHeaderBackgroundDataUrl,
      ""
    ),
    pageTitle: toText(privacyPolicyState?.pageTitle, privacyPolicyDefaults.pageTitle),
    pageTextHtml: toText(
      privacyPolicyState?.pageTextHtml,
      privacyPolicyDefaults.pageTextHtml
    ),
  };
  const termsAndConditionsDefaults = getDefaultCustomization().termsAndConditions;
  const termsAndConditions = {
    ...termsAndConditionsDefaults,
    ...(termsAndConditionsState || {}),
    enabled: Boolean(termsAndConditionsState?.enabled),
    pageHeaderBackgroundDataUrl: toText(
      termsAndConditionsState?.pageHeaderBackgroundDataUrl,
      ""
    ),
    pageTitle: toText(
      termsAndConditionsState?.pageTitle,
      termsAndConditionsDefaults.pageTitle
    ),
    pageTextHtml: toText(
      termsAndConditionsState?.pageTextHtml,
      termsAndConditionsDefaults.pageTextHtml
    ),
  };
  const faqsDefaults = getDefaultCustomization().faqs;
  const faqs = {
    ...faqsDefaults,
    ...(faqsState || {}),
    pageHeader: {
      ...faqsDefaults.pageHeader,
      ...(faqsState?.pageHeader || {}),
      enabled: Boolean(faqsState?.pageHeader?.enabled),
      backgroundImageDataUrl: toText(faqsState?.pageHeader?.backgroundImageDataUrl, ""),
      pageTitle: toText(faqsState?.pageHeader?.pageTitle, faqsDefaults.pageHeader.pageTitle),
    },
    leftColumn: {
      ...faqsDefaults.leftColumn,
      ...(faqsState?.leftColumn || {}),
      enabled: Boolean(faqsState?.leftColumn?.enabled),
      leftImageDataUrl: toText(faqsState?.leftColumn?.leftImageDataUrl, ""),
    },
    content: {
      ...faqsDefaults.content,
      ...(faqsState?.content || {}),
      enabled: Boolean(faqsState?.content?.enabled),
      items: normalizeFaqItems(faqsState?.content?.items, faqsDefaults.content.items),
    },
  };
  const offersDefaults = getDefaultCustomization().offers;
  const offers = {
    ...offersDefaults,
    ...(offersState || {}),
    pageHeader: {
      ...offersDefaults.pageHeader,
      ...(offersState?.pageHeader || {}),
      enabled: Boolean(offersState?.pageHeader?.enabled),
      backgroundImageDataUrl: toText(offersState?.pageHeader?.backgroundImageDataUrl, ""),
      pageTitle: toText(offersState?.pageHeader?.pageTitle, offersDefaults.pageHeader.pageTitle),
    },
    superDiscount: {
      ...offersDefaults.superDiscount,
      ...(offersState?.superDiscount || {}),
      enabled: Boolean(offersState?.superDiscount?.enabled),
      activeCouponCode: toText(
        offersState?.superDiscount?.activeCouponCode,
        offersDefaults.superDiscount.activeCouponCode
      ).toUpperCase(),
    },
  };
  const contactUsDefaults = getDefaultCustomization().contactUs;
  const contactUs = {
    ...contactUsDefaults,
    ...(contactUsState || {}),
    pageHeader: {
      ...contactUsDefaults.pageHeader,
      ...(contactUsState?.pageHeader || {}),
      enabled: Boolean(contactUsState?.pageHeader?.enabled),
      backgroundImageDataUrl: toText(contactUsState?.pageHeader?.backgroundImageDataUrl, ""),
      pageTitle: toText(
        contactUsState?.pageHeader?.pageTitle,
        contactUsDefaults.pageHeader.pageTitle
      ),
    },
    emailBox: {
      ...contactUsDefaults.emailBox,
      ...(contactUsState?.emailBox || {}),
      enabled: Boolean(contactUsState?.emailBox?.enabled),
      title: toText(contactUsState?.emailBox?.title, contactUsDefaults.emailBox.title),
      email: toText(contactUsState?.emailBox?.email, contactUsDefaults.emailBox.email),
      text: toText(contactUsState?.emailBox?.text, contactUsDefaults.emailBox.text),
    },
    callBox: {
      ...contactUsDefaults.callBox,
      ...(contactUsState?.callBox || {}),
      enabled: Boolean(contactUsState?.callBox?.enabled),
      title: toText(contactUsState?.callBox?.title, contactUsDefaults.callBox.title),
      phone: toText(contactUsState?.callBox?.phone, contactUsDefaults.callBox.phone),
      text: toText(contactUsState?.callBox?.text, contactUsDefaults.callBox.text),
    },
    addressBox: {
      ...contactUsDefaults.addressBox,
      ...(contactUsState?.addressBox || {}),
      enabled: Boolean(contactUsState?.addressBox?.enabled),
      title: toText(contactUsState?.addressBox?.title, contactUsDefaults.addressBox.title),
      address: toText(contactUsState?.addressBox?.address, contactUsDefaults.addressBox.address),
    },
    middleLeftColumn: {
      ...contactUsDefaults.middleLeftColumn,
      ...(contactUsState?.middleLeftColumn || {}),
      enabled: Boolean(contactUsState?.middleLeftColumn?.enabled),
      imageDataUrl: toText(contactUsState?.middleLeftColumn?.imageDataUrl, ""),
    },
    contactForm: {
      ...contactUsDefaults.contactForm,
      ...(contactUsState?.contactForm || {}),
      enabled: Boolean(contactUsState?.contactForm?.enabled),
      title: toText(contactUsState?.contactForm?.title, contactUsDefaults.contactForm.title),
      description: toText(
        contactUsState?.contactForm?.description,
        contactUsDefaults.contactForm.description
      ),
    },
  };
  const checkoutDefaults = getDefaultCustomization().checkout;
  const checkout = {
    ...checkoutDefaults,
    ...(checkoutState || {}),
    personalDetails: {
      ...checkoutDefaults.personalDetails,
      ...(checkoutState?.personalDetails || {}),
      sectionTitle: toText(
        checkoutState?.personalDetails?.sectionTitle,
        checkoutDefaults.personalDetails.sectionTitle
      ),
      firstNameLabel: toText(
        checkoutState?.personalDetails?.firstNameLabel,
        checkoutDefaults.personalDetails.firstNameLabel
      ),
      lastNameLabel: toText(
        checkoutState?.personalDetails?.lastNameLabel,
        checkoutDefaults.personalDetails.lastNameLabel
      ),
      emailLabel: toText(
        checkoutState?.personalDetails?.emailLabel,
        checkoutDefaults.personalDetails.emailLabel
      ),
      phoneLabel: toText(
        checkoutState?.personalDetails?.phoneLabel,
        checkoutDefaults.personalDetails.phoneLabel
      ),
      firstNamePlaceholder: toText(
        checkoutState?.personalDetails?.firstNamePlaceholder,
        checkoutDefaults.personalDetails.firstNamePlaceholder
      ),
      lastNamePlaceholder: toText(
        checkoutState?.personalDetails?.lastNamePlaceholder,
        checkoutDefaults.personalDetails.lastNamePlaceholder
      ),
      emailPlaceholder: toText(
        checkoutState?.personalDetails?.emailPlaceholder,
        checkoutDefaults.personalDetails.emailPlaceholder
      ),
      phonePlaceholder: toText(
        checkoutState?.personalDetails?.phonePlaceholder,
        checkoutDefaults.personalDetails.phonePlaceholder
      ),
    },
    shippingDetails: {
      ...checkoutDefaults.shippingDetails,
      ...(checkoutState?.shippingDetails || {}),
      sectionTitle: toText(
        checkoutState?.shippingDetails?.sectionTitle,
        checkoutDefaults.shippingDetails.sectionTitle
      ),
      streetAddressLabel: toText(
        checkoutState?.shippingDetails?.streetAddressLabel,
        checkoutDefaults.shippingDetails.streetAddressLabel
      ),
      cityLabel: toText(
        checkoutState?.shippingDetails?.cityLabel,
        checkoutDefaults.shippingDetails.cityLabel
      ),
      countryLabel: toText(
        checkoutState?.shippingDetails?.countryLabel,
        checkoutDefaults.shippingDetails.countryLabel
      ),
      zipLabel: toText(
        checkoutState?.shippingDetails?.zipLabel,
        checkoutDefaults.shippingDetails.zipLabel
      ),
      streetAddressPlaceholder: toText(
        checkoutState?.shippingDetails?.streetAddressPlaceholder,
        checkoutDefaults.shippingDetails.streetAddressPlaceholder
      ),
      cityPlaceholder: toText(
        checkoutState?.shippingDetails?.cityPlaceholder,
        checkoutDefaults.shippingDetails.cityPlaceholder
      ),
      countryPlaceholder: toText(
        checkoutState?.shippingDetails?.countryPlaceholder,
        checkoutDefaults.shippingDetails.countryPlaceholder
      ),
      zipPlaceholder: toText(
        checkoutState?.shippingDetails?.zipPlaceholder,
        checkoutDefaults.shippingDetails.zipPlaceholder
      ),
      shippingCostLabel: toText(
        checkoutState?.shippingDetails?.shippingCostLabel,
        checkoutDefaults.shippingDetails.shippingCostLabel
      ),
      shippingOneNameLabel: toText(
        checkoutState?.shippingDetails?.shippingOneNameLabel,
        checkoutDefaults.shippingDetails.shippingOneNameLabel
      ),
      shippingOneNameDefault: toText(
        checkoutState?.shippingDetails?.shippingOneNameDefault,
        checkoutDefaults.shippingDetails.shippingOneNameDefault
      ),
      shippingOneDescriptionLabel: toText(
        checkoutState?.shippingDetails?.shippingOneDescriptionLabel,
        checkoutDefaults.shippingDetails.shippingOneDescriptionLabel
      ),
      shippingOneDescriptionDefault: toText(
        checkoutState?.shippingDetails?.shippingOneDescriptionDefault,
        checkoutDefaults.shippingDetails.shippingOneDescriptionDefault
      ),
      shippingOneCostLabel: toText(
        checkoutState?.shippingDetails?.shippingOneCostLabel,
        checkoutDefaults.shippingDetails.shippingOneCostLabel
      ),
      shippingOneCostDefault: toText(
        checkoutState?.shippingDetails?.shippingOneCostDefault,
        checkoutDefaults.shippingDetails.shippingOneCostDefault
      ),
      shippingTwoNameLabel: toText(
        checkoutState?.shippingDetails?.shippingTwoNameLabel,
        checkoutDefaults.shippingDetails.shippingTwoNameLabel
      ),
      shippingTwoNameDefault: toText(
        checkoutState?.shippingDetails?.shippingTwoNameDefault,
        checkoutDefaults.shippingDetails.shippingTwoNameDefault
      ),
      shippingTwoDescriptionLabel: toText(
        checkoutState?.shippingDetails?.shippingTwoDescriptionLabel,
        checkoutDefaults.shippingDetails.shippingTwoDescriptionLabel
      ),
      shippingTwoDescriptionDefault: toText(
        checkoutState?.shippingDetails?.shippingTwoDescriptionDefault,
        checkoutDefaults.shippingDetails.shippingTwoDescriptionDefault
      ),
      shippingTwoCostLabel: toText(
        checkoutState?.shippingDetails?.shippingTwoCostLabel,
        checkoutDefaults.shippingDetails.shippingTwoCostLabel
      ),
      shippingTwoCostDefault: toText(
        checkoutState?.shippingDetails?.shippingTwoCostDefault,
        checkoutDefaults.shippingDetails.shippingTwoCostDefault
      ),
      paymentMethodLabel: toText(
        checkoutState?.shippingDetails?.paymentMethodLabel,
        checkoutDefaults.shippingDetails.paymentMethodLabel
      ),
      paymentMethodPlaceholder: toText(
        checkoutState?.shippingDetails?.paymentMethodPlaceholder,
        checkoutDefaults.shippingDetails.paymentMethodPlaceholder
      ),
    },
    buttons: {
      ...checkoutDefaults.buttons,
      ...(checkoutState?.buttons || {}),
      continueButtonLabel: toText(
        checkoutState?.buttons?.continueButtonLabel,
        checkoutDefaults.buttons.continueButtonLabel
      ),
      confirmButtonLabel: toText(
        checkoutState?.buttons?.confirmButtonLabel,
        checkoutDefaults.buttons.confirmButtonLabel
      ),
    },
    cartItemSection: {
      ...checkoutDefaults.cartItemSection,
      ...(checkoutState?.cartItemSection || {}),
      sectionTitle: toText(
        checkoutState?.cartItemSection?.sectionTitle,
        checkoutDefaults.cartItemSection.sectionTitle
      ),
      orderSummaryLabel: toText(
        checkoutState?.cartItemSection?.orderSummaryLabel,
        checkoutDefaults.cartItemSection.orderSummaryLabel
      ),
      applyButtonLabel: toText(
        checkoutState?.cartItemSection?.applyButtonLabel,
        checkoutDefaults.cartItemSection.applyButtonLabel
      ),
      subTotalLabel: toText(
        checkoutState?.cartItemSection?.subTotalLabel,
        checkoutDefaults.cartItemSection.subTotalLabel
      ),
      discountLabel: toText(
        checkoutState?.cartItemSection?.discountLabel,
        checkoutDefaults.cartItemSection.discountLabel
      ),
      totalCostLabel: toText(
        checkoutState?.cartItemSection?.totalCostLabel,
        checkoutDefaults.cartItemSection.totalCostLabel
      ),
    },
  };
  const dashboardSettingDefaults = getDefaultCustomization().dashboardSetting;
  const dashboardSetting = {
    ...dashboardSettingDefaults,
    ...(dashboardSettingState || {}),
    dashboard: {
      ...dashboardSettingDefaults.dashboard,
      ...(dashboardSettingState?.dashboard || {}),
      sectionTitle: toText(
        dashboardSettingState?.dashboard?.sectionTitle,
        dashboardSettingDefaults.dashboard.sectionTitle
      ),
      invoiceMessageFirstPartLabel: toText(
        dashboardSettingState?.dashboard?.invoiceMessageFirstPartLabel,
        dashboardSettingDefaults.dashboard.invoiceMessageFirstPartLabel
      ),
      invoiceMessageFirstPartValue: toText(
        dashboardSettingState?.dashboard?.invoiceMessageFirstPartValue,
        dashboardSettingDefaults.dashboard.invoiceMessageFirstPartValue
      ),
      invoiceMessageLastPartLabel: toText(
        dashboardSettingState?.dashboard?.invoiceMessageLastPartLabel,
        dashboardSettingDefaults.dashboard.invoiceMessageLastPartLabel
      ),
      invoiceMessageLastPartValue: toText(
        dashboardSettingState?.dashboard?.invoiceMessageLastPartValue,
        dashboardSettingDefaults.dashboard.invoiceMessageLastPartValue
      ),
      printButtonLabel: toText(
        dashboardSettingState?.dashboard?.printButtonLabel,
        dashboardSettingDefaults.dashboard.printButtonLabel
      ),
      printButtonValue: toText(
        dashboardSettingState?.dashboard?.printButtonValue,
        dashboardSettingDefaults.dashboard.printButtonValue
      ),
      downloadButtonLabel: toText(
        dashboardSettingState?.dashboard?.downloadButtonLabel,
        dashboardSettingDefaults.dashboard.downloadButtonLabel
      ),
      downloadButtonValue: toText(
        dashboardSettingState?.dashboard?.downloadButtonValue,
        dashboardSettingDefaults.dashboard.downloadButtonValue
      ),
      dashboardLabel: toText(
        dashboardSettingState?.dashboard?.dashboardLabel,
        dashboardSettingDefaults.dashboard.dashboardLabel
      ),
      totalOrdersLabel: toText(
        dashboardSettingState?.dashboard?.totalOrdersLabel,
        dashboardSettingDefaults.dashboard.totalOrdersLabel
      ),
      pendingOrderLabel: toText(
        dashboardSettingState?.dashboard?.pendingOrderLabel,
        dashboardSettingDefaults.dashboard.pendingOrderLabel
      ),
      pendingOrderValue: toText(
        dashboardSettingState?.dashboard?.pendingOrderValue,
        dashboardSettingDefaults.dashboard.pendingOrderValue
      ),
      processingOrderLabel: toText(
        dashboardSettingState?.dashboard?.processingOrderLabel,
        dashboardSettingDefaults.dashboard.processingOrderLabel
      ),
      processingOrderValue: toText(
        dashboardSettingState?.dashboard?.processingOrderValue,
        dashboardSettingDefaults.dashboard.processingOrderValue
      ),
      completeOrderLabel: toText(
        dashboardSettingState?.dashboard?.completeOrderLabel,
        dashboardSettingDefaults.dashboard.completeOrderLabel
      ),
      completeOrderValue: toText(
        dashboardSettingState?.dashboard?.completeOrderValue,
        dashboardSettingDefaults.dashboard.completeOrderValue
      ),
      recentOrderLabel: toText(
        dashboardSettingState?.dashboard?.recentOrderLabel,
        dashboardSettingDefaults.dashboard.recentOrderLabel
      ),
      recentOrderValue: toText(
        dashboardSettingState?.dashboard?.recentOrderValue,
        dashboardSettingDefaults.dashboard.recentOrderValue
      ),
      myOrderLabel: toText(
        dashboardSettingState?.dashboard?.myOrderLabel,
        dashboardSettingDefaults.dashboard.myOrderLabel
      ),
      myOrderValue: toText(
        dashboardSettingState?.dashboard?.myOrderValue,
        dashboardSettingDefaults.dashboard.myOrderValue
      ),
    },
    updateProfile: {
      ...dashboardSettingDefaults.updateProfile,
      ...(dashboardSettingState?.updateProfile || {}),
      sectionTitleLabel: toText(
        dashboardSettingState?.updateProfile?.sectionTitleLabel,
        dashboardSettingDefaults.updateProfile.sectionTitleLabel
      ),
      sectionTitleValue: toText(
        dashboardSettingState?.updateProfile?.sectionTitleValue,
        dashboardSettingDefaults.updateProfile.sectionTitleValue
      ),
      fullNameLabel: toText(
        dashboardSettingState?.updateProfile?.fullNameLabel,
        dashboardSettingDefaults.updateProfile.fullNameLabel
      ),
      addressLabel: toText(
        dashboardSettingState?.updateProfile?.addressLabel,
        dashboardSettingDefaults.updateProfile.addressLabel
      ),
      phoneMobileLabel: toText(
        dashboardSettingState?.updateProfile?.phoneMobileLabel,
        dashboardSettingDefaults.updateProfile.phoneMobileLabel
      ),
      emailAddressLabel: toText(
        dashboardSettingState?.updateProfile?.emailAddressLabel,
        dashboardSettingDefaults.updateProfile.emailAddressLabel
      ),
      updateButtonLabel: toText(
        dashboardSettingState?.updateProfile?.updateButtonLabel,
        dashboardSettingDefaults.updateProfile.updateButtonLabel
      ),
      updateButtonValue: toText(
        dashboardSettingState?.updateProfile?.updateButtonValue,
        dashboardSettingDefaults.updateProfile.updateButtonValue
      ),
      currentPasswordLabel: toText(
        dashboardSettingState?.updateProfile?.currentPasswordLabel,
        dashboardSettingDefaults.updateProfile.currentPasswordLabel
      ),
      newPasswordLabel: toText(
        dashboardSettingState?.updateProfile?.newPasswordLabel,
        dashboardSettingDefaults.updateProfile.newPasswordLabel
      ),
      changePasswordLabel: toText(
        dashboardSettingState?.updateProfile?.changePasswordLabel,
        dashboardSettingDefaults.updateProfile.changePasswordLabel
      ),
    },
  };
  const offersCouponItems = Array.isArray(offersCouponsQuery.data?.data?.items)
    ? offersCouponsQuery.data.data.items
    : [];
  const offersCouponOptions = Array.from(
    new Map(
      offersCouponItems
        .map((coupon) => {
          const code = toText(coupon?.code, "").toUpperCase();
          if (!code) return null;
          const discountType = toText(coupon?.discountType, "");
          const amount = Number(coupon?.amount ?? 0);
          const amountLabel =
            discountType === "percent"
              ? `${Number.isFinite(amount) ? amount : 0}%`
              : Number.isFinite(amount)
                ? amount.toString()
                : "";
          const nameLabel = amountLabel ? ` - ${amountLabel}` : "";
          return [code, `${code}${nameLabel}`];
        })
        .filter(Boolean)
    )
  ).map(([value, label]) => ({ value, label }));
  const selectedOfferCouponCode = offers.superDiscount.activeCouponCode || "ALL";
  const hasSelectedOfferCouponOption =
    selectedOfferCouponCode === "ALL" ||
    offersCouponOptions.some((item) => item.value === selectedOfferCouponCode);
  const activeAboutUsMemberMeta =
    ABOUT_US_MEMBER_TABS.find((tab) => tab.key === activeAboutUsMemberTab) ||
    ABOUT_US_MEMBER_TABS[0];
  const activeAboutUsMemberIndex = Number(activeAboutUsMemberMeta?.index ?? 0);
  const activeAboutUsMember =
    aboutUs.ourTeam.members?.[activeAboutUsMemberIndex] ||
    aboutUsDefaults.ourTeam.members[activeAboutUsMemberIndex];
  const activeAboutUsMemberImageField = getAboutUsMemberImageFieldKey(
    activeAboutUsMemberIndex
  );

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
              disabled={isSaving || isUploadingLogo}
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
            disabled={isSaving || isLoadingHeader || isUploadingLogo || !lang}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Updating..." : "Update"}
          </button>
        </div>
      </div>

      {isLoadingHeader && customizationQuery.data ? (
        <p className="text-xs text-slate-500">
          Loading {String(lang || "en").toUpperCase()} customization...
        </p>
      ) : null}

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
              onClick={() => onSelectTab(tab.key)}
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

      <div
        ref={tabContentRef}
        tabIndex={-1}
        aria-label="Store customization tab content"
        className="focus:outline-none"
      >
        {showFullCustomizationLoader ? (
          <div className={sectionCard}>Loading customization data...</div>
        ) : showCustomizationError ? (
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
      ) : activeTab === "aboutUs" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">About Us</h2>
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Page Header
            </p>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(aboutUs.pageHeader.enabled)}
                  onChange={(value) => onChangeAboutUsBlockEnabled("pageHeader", value)}
                />
              </div>
              <ImageUploadField
                id="about-us-page-header-background-image-input"
                label="Page Header Background"
                error={aboutUsImageErrors[ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground]}
                dropActive={Boolean(
                  aboutUsDropActive[ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground]
                )}
                onDropActiveChange={(value) =>
                  setAboutUsDropActiveField(
                    ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    value
                  )
                }
                onInputChange={(event) =>
                  onAboutUsImageInputChange(
                    ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropAboutUsImage(
                    ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    event
                  )
                }
                previewDataUrl={aboutUs.pageHeader.backgroundImageDataUrl}
                onRemove={() =>
                  onRemoveAboutUsImage(ABOUT_US_IMAGE_FIELD_KEYS.pageHeaderBackground)
                }
                previewAlt="About Us page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={aboutUs.pageHeader.pageTitle}
                  onChange={(event) =>
                    onChangeAboutUsPageHeaderField("pageTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                About Page Top Content Left
              </h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(aboutUs.topContentLeft.enabled)}
                  onChange={(value) => onChangeAboutUsBlockEnabled("topContentLeft", value)}
                />
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top Title
                </span>
                <input
                  type="text"
                  value={aboutUs.topContentLeft.topTitle}
                  onChange={(event) =>
                    onChangeAboutUsTopContentLeftField("topTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Top Description
                </span>
                <textarea
                  value={aboutUs.topContentLeft.topDescription}
                  onChange={(event) =>
                    onChangeAboutUsTopContentLeftField("topDescription", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {[
                  { key: "boxOne", label: "Box One" },
                  { key: "boxTwo", label: "Box Two" },
                  { key: "boxThree", label: "Box Three" },
                ].map((box) => {
                  const boxValue = aboutUs.topContentLeft?.[box.key] || {};
                  return (
                    <div
                      key={box.key}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {box.label}
                      </p>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Title
                          </span>
                          <input
                            type="text"
                            value={boxValue.title || ""}
                            onChange={(event) =>
                              onChangeAboutUsTopContentLeftBoxField(
                                box.key,
                                "title",
                                event.target.value
                              )
                            }
                            className={`${inputBase} mt-2`}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sub Title
                          </span>
                          <input
                            type="text"
                            value={boxValue.subtitle || ""}
                            onChange={(event) =>
                              onChangeAboutUsTopContentLeftBoxField(
                                box.key,
                                "subtitle",
                                event.target.value
                              )
                            }
                            className={`${inputBase} mt-2`}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Description
                          </span>
                          <textarea
                            value={boxValue.description || ""}
                            onChange={(event) =>
                              onChangeAboutUsTopContentLeftBoxField(
                                box.key,
                                "description",
                                event.target.value
                              )
                            }
                            className={textAreaBase}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Page Top Content Right
              </h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(aboutUs.topContentRight.enabled)}
                  onChange={(value) => onChangeAboutUsBlockEnabled("topContentRight", value)}
                />
              </div>
              <ImageUploadField
                id="about-us-top-content-right-image-input"
                label="Top Content Right Image"
                error={aboutUsImageErrors[ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage]}
                dropActive={Boolean(
                  aboutUsDropActive[ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage]
                )}
                onDropActiveChange={(value) =>
                  setAboutUsDropActiveField(
                    ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage,
                    value
                  )
                }
                onInputChange={(event) =>
                  onAboutUsImageInputChange(ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage, event)
                }
                onDrop={(event) =>
                  onDropAboutUsImage(ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage, event)
                }
                previewDataUrl={aboutUs.topContentRight.imageDataUrl}
                onRemove={() =>
                  onRemoveAboutUsImage(ABOUT_US_IMAGE_FIELD_KEYS.topContentRightImage)
                }
                previewAlt="About Us top content right"
              />
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Content Section</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(aboutUs.contentSection.enabled)}
                  onChange={(value) => onChangeAboutUsBlockEnabled("contentSection", value)}
                />
              </div>
              <ImageUploadField
                id="about-us-content-image-input"
                label="Content Image"
                error={aboutUsImageErrors[ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage]}
                dropActive={Boolean(
                  aboutUsDropActive[ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage]
                )}
                onDropActiveChange={(value) =>
                  setAboutUsDropActiveField(
                    ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage,
                    value
                  )
                }
                onInputChange={(event) =>
                  onAboutUsImageInputChange(ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage, event)
                }
                onDrop={(event) =>
                  onDropAboutUsImage(ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage, event)
                }
                previewDataUrl={aboutUs.contentSection.contentImageDataUrl}
                onRemove={() =>
                  onRemoveAboutUsImage(ABOUT_US_IMAGE_FIELD_KEYS.contentSectionImage)
                }
                previewAlt="About Us content section image"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  First Paragraph
                </span>
                <textarea
                  value={aboutUs.contentSection.firstParagraph}
                  onChange={(event) =>
                    onChangeAboutUsContentSectionField("firstParagraph", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Second Paragraph
                </span>
                <textarea
                  value={aboutUs.contentSection.secondParagraph}
                  onChange={(event) =>
                    onChangeAboutUsContentSectionField("secondParagraph", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Our Team</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(aboutUs.ourTeam.enabled)}
                  onChange={(value) => onChangeAboutUsBlockEnabled("ourTeam", value)}
                />
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Our Team Title
                </span>
                <input
                  type="text"
                  value={aboutUs.ourTeam.title}
                  onChange={(event) =>
                    onChangeAboutUsOurTeamField("title", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Our Team Description
                </span>
                <textarea
                  value={aboutUs.ourTeam.description}
                  onChange={(event) =>
                    onChangeAboutUsOurTeamField("description", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
                  {ABOUT_US_MEMBER_TABS.map((memberTab) => (
                    <button
                      key={memberTab.key}
                      type="button"
                      onClick={() => setActiveAboutUsMemberTab(memberTab.key)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        activeAboutUsMemberTab === memberTab.key
                          ? "border border-slate-200 bg-white text-emerald-700 shadow-sm"
                          : "text-slate-600 hover:bg-white"
                      }`}
                    >
                      {memberTab.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
                    <ImageUploadField
                      id={`about-us-team-member-image-input-${activeAboutUsMemberIndex}`}
                      label={`Our Team ${activeAboutUsMemberIndex + 1} Image`}
                      error={aboutUsImageErrors[activeAboutUsMemberImageField]}
                      dropActive={Boolean(aboutUsDropActive[activeAboutUsMemberImageField])}
                      onDropActiveChange={(value) =>
                        setAboutUsDropActiveField(activeAboutUsMemberImageField, value)
                      }
                      onInputChange={(event) =>
                        onAboutUsImageInputChange(activeAboutUsMemberImageField, event)
                      }
                      onDrop={(event) =>
                        onDropAboutUsImage(activeAboutUsMemberImageField, event)
                      }
                      previewDataUrl={activeAboutUsMember.imageDataUrl}
                      onRemove={() => onRemoveAboutUsImage(activeAboutUsMemberImageField)}
                      previewAlt={`About Us team member ${activeAboutUsMemberIndex + 1}`}
                    />

                    <div className="grid grid-cols-1 gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Our Team {activeAboutUsMemberIndex + 1} Title
                        </span>
                        <input
                          type="text"
                          value={activeAboutUsMember.title || ""}
                          onChange={(event) =>
                            onChangeAboutUsMemberField(
                              activeAboutUsMemberIndex,
                              "title",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Our Team {activeAboutUsMemberIndex + 1} Sub Title
                        </span>
                        <input
                          type="text"
                          value={activeAboutUsMember.subTitle || ""}
                          onChange={(event) =>
                            onChangeAboutUsMemberField(
                              activeAboutUsMemberIndex,
                              "subTitle",
                              event.target.value
                            )
                          }
                          className={`${inputBase} mt-2`}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === "privacyPolicyTerms" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Privacy Policy</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(privacyPolicy.enabled)}
                  onChange={(value) => onChangePolicyEnabled("privacyPolicy", value)}
                />
              </div>
              <ImageUploadField
                id="privacy-policy-background-image-input"
                label="Page Header Background"
                error={policyImageErrors[POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground]}
                dropActive={Boolean(
                  policyDropActive[POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground]
                )}
                onDropActiveChange={(value) =>
                  setPolicyDropActiveField(
                    POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground,
                    value
                  )
                }
                onInputChange={(event) =>
                  onPolicyImageInputChange(
                    POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropPolicyImage(POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground, event)
                }
                previewDataUrl={privacyPolicy.pageHeaderBackgroundDataUrl}
                onRemove={() =>
                  onRemovePolicyImage(POLICY_IMAGE_FIELD_KEYS.privacyPolicyBackground)
                }
                previewAlt="Privacy policy page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={privacyPolicy.pageTitle}
                  onChange={(event) =>
                    onChangePolicyField("privacyPolicy", "pageTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <div className="xl:col-span-2">
                <RichTextEditor
                  id="privacy-policy-page-text-editor"
                  label="Page Text"
                  value={privacyPolicy.pageTextHtml}
                  onChange={(nextValue) =>
                    onChangePolicyField("privacyPolicy", "pageTextHtml", nextValue)
                  }
                />
              </div>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Terms & Conditions
              </h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(termsAndConditions.enabled)}
                  onChange={(value) => onChangePolicyEnabled("termsAndConditions", value)}
                />
              </div>
              <ImageUploadField
                id="terms-and-conditions-background-image-input"
                label="Page Header Background"
                error={
                  policyImageErrors[POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground]
                }
                dropActive={Boolean(
                  policyDropActive[POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground]
                )}
                onDropActiveChange={(value) =>
                  setPolicyDropActiveField(
                    POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground,
                    value
                  )
                }
                onInputChange={(event) =>
                  onPolicyImageInputChange(
                    POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropPolicyImage(
                    POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground,
                    event
                  )
                }
                previewDataUrl={termsAndConditions.pageHeaderBackgroundDataUrl}
                onRemove={() =>
                  onRemovePolicyImage(POLICY_IMAGE_FIELD_KEYS.termsAndConditionsBackground)
                }
                previewAlt="Terms and conditions page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={termsAndConditions.pageTitle}
                  onChange={(event) =>
                    onChangePolicyField("termsAndConditions", "pageTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <div className="xl:col-span-2">
                <RichTextEditor
                  id="terms-and-conditions-page-text-editor"
                  label="Page Text"
                  value={termsAndConditions.pageTextHtml}
                  onChange={(nextValue) =>
                    onChangePolicyField("termsAndConditions", "pageTextHtml", nextValue)
                  }
                />
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === "faqs" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">FAQs Page Header</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(faqs.pageHeader.enabled)}
                  onChange={(value) => onChangeFaqsBlockEnabled("pageHeader", value)}
                />
              </div>
              <ImageUploadField
                id="faqs-page-header-background-image-input"
                label="Page Header Background"
                error={faqsImageErrors[FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground]}
                dropActive={Boolean(
                  faqsDropActive[FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground]
                )}
                onDropActiveChange={(value) =>
                  setFaqsDropActiveField(FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground, value)
                }
                onInputChange={(event) =>
                  onFaqsImageInputChange(FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground, event)
                }
                onDrop={(event) =>
                  onDropFaqsImage(FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground, event)
                }
                previewDataUrl={faqs.pageHeader.backgroundImageDataUrl}
                onRemove={() =>
                  onRemoveFaqsImage(FAQS_IMAGE_FIELD_KEYS.pageHeaderBackground)
                }
                previewAlt="FAQs page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={faqs.pageHeader.pageTitle}
                  onChange={(event) =>
                    onChangeFaqsPageHeaderField("pageTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">FAQs Left Column</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(faqs.leftColumn.enabled)}
                  onChange={(value) => onChangeFaqsBlockEnabled("leftColumn", value)}
                />
              </div>
              <ImageUploadField
                id="faqs-left-column-image-input"
                label="Left Image"
                error={faqsImageErrors[FAQS_IMAGE_FIELD_KEYS.leftColumnImage]}
                dropActive={Boolean(faqsDropActive[FAQS_IMAGE_FIELD_KEYS.leftColumnImage])}
                onDropActiveChange={(value) =>
                  setFaqsDropActiveField(FAQS_IMAGE_FIELD_KEYS.leftColumnImage, value)
                }
                onInputChange={(event) =>
                  onFaqsImageInputChange(FAQS_IMAGE_FIELD_KEYS.leftColumnImage, event)
                }
                onDrop={(event) =>
                  onDropFaqsImage(FAQS_IMAGE_FIELD_KEYS.leftColumnImage, event)
                }
                previewDataUrl={faqs.leftColumn.leftImageDataUrl}
                onRemove={() => onRemoveFaqsImage(FAQS_IMAGE_FIELD_KEYS.leftColumnImage)}
                previewAlt="FAQs left column image"
              />
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">FAQs</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(faqs.content.enabled)}
                  onChange={(value) => onChangeFaqsBlockEnabled("content", value)}
                />
              </div>

              {faqs.content.items.map((item, index) => (
                <div
                  key={`faqs-item-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Faq Title {FAQ_ITEM_ORDINALS[index] || index + 1}
                    </span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(event) =>
                        onChangeFaqsItemField(index, "title", event.target.value)
                      }
                      className={`${inputBase} mt-2`}
                    />
                  </label>
                  <label className="mt-4 block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Faq Description {FAQ_ITEM_ORDINALS[index] || index + 1}
                    </span>
                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        onChangeFaqsItemField(index, "description", event.target.value)
                      }
                      className={textAreaBase}
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : activeTab === "offers" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Page Header</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(offers.pageHeader.enabled)}
                  onChange={(value) => onChangeOffersBlockEnabled("pageHeader", value)}
                />
              </div>
              <ImageUploadField
                id="offers-page-header-background-image-input"
                label="Page Header Background"
                error={offersImageErrors[OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground]}
                dropActive={Boolean(
                  offersDropActive[OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground]
                )}
                onDropActiveChange={(value) =>
                  setOffersDropActiveField(
                    OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    value
                  )
                }
                onInputChange={(event) =>
                  onOffersImageInputChange(
                    OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropOffersImage(OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground, event)
                }
                previewDataUrl={offers.pageHeader.backgroundImageDataUrl}
                onRemove={() =>
                  onRemoveOffersImage(OFFERS_IMAGE_FIELD_KEYS.pageHeaderBackground)
                }
                previewAlt="Offers page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={offers.pageHeader.pageTitle}
                  onChange={(event) =>
                    onChangeOffersPageHeaderField("pageTitle", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">
                Super Discount Active Coupon Code
              </h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(offers.superDiscount.enabled)}
                  onChange={(value) => onChangeOffersBlockEnabled("superDiscount", value)}
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Super Discount Active Coupon Code
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={selectedOfferCouponCode}
                      onChange={(event) =>
                        onChangeOffersSuperDiscountField(
                          "activeCouponCode",
                          event.target.value
                        )
                      }
                      className={`${inputBase} appearance-none pr-9`}
                    >
                      <option value="ALL">All items are selected.</option>
                      {offersCouponOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      {!hasSelectedOfferCouponOption &&
                      selectedOfferCouponCode !== "ALL" ? (
                        <option value={selectedOfferCouponCode}>
                          {selectedOfferCouponCode}
                        </option>
                      ) : null}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeOffersSuperDiscountField("activeCouponCode", "ALL")
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Clear selected coupon"
                    disabled={selectedOfferCouponCode === "ALL"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {offersCouponsQuery.isLoading ? (
                  <p className="text-xs text-slate-500">Loading coupons...</p>
                ) : null}
                {offersCouponsQuery.isError ? (
                  <p className="text-xs text-rose-600">
                    Failed to load coupons list. You can still save the selected code.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === "contactUs" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Page Header</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.pageHeader.enabled)}
                  onChange={(value) =>
                    onChangeContactUsSectionEnabled("pageHeader", value)
                  }
                />
              </div>
              <ImageUploadField
                id="contact-us-page-header-background-image-input"
                label="Page Header Background"
                error={contactUsImageErrors[CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground]}
                dropActive={Boolean(
                  contactUsDropActive[CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground]
                )}
                onDropActiveChange={(value) =>
                  setContactUsDropActiveField(
                    CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    value
                  )
                }
                onInputChange={(event) =>
                  onContactUsImageInputChange(
                    CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropContactUsImage(
                    CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground,
                    event
                  )
                }
                previewDataUrl={contactUs.pageHeader.backgroundImageDataUrl}
                onRemove={() =>
                  onRemoveContactUsImage(CONTACT_US_IMAGE_FIELD_KEYS.pageHeaderBackground)
                }
                previewAlt="Contact Us page header background"
              />
              <label className="block xl:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Page Title
                </span>
                <input
                  type="text"
                  value={contactUs.pageHeader.pageTitle}
                  onChange={(event) =>
                    onChangeContactUsSectionField(
                      "pageHeader",
                      "pageTitle",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Email Us Box</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.emailBox.enabled)}
                  onChange={(value) => onChangeContactUsSectionEnabled("emailBox", value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={contactUs.emailBox.title}
                  onChange={(event) =>
                    onChangeContactUsSectionField("emailBox", "title", event.target.value)
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
                  value={contactUs.emailBox.email}
                  onChange={(event) =>
                    onChangeContactUsSectionField("emailBox", "email", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Text
                </span>
                <textarea
                  value={contactUs.emailBox.text}
                  onChange={(event) =>
                    onChangeContactUsSectionField("emailBox", "text", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Call Us Box</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.callBox.enabled)}
                  onChange={(value) => onChangeContactUsSectionEnabled("callBox", value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={contactUs.callBox.title}
                  onChange={(event) =>
                    onChangeContactUsSectionField("callBox", "title", event.target.value)
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
                  value={contactUs.callBox.phone}
                  onChange={(event) =>
                    onChangeContactUsSectionField("callBox", "phone", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Text
                </span>
                <textarea
                  value={contactUs.callBox.text}
                  onChange={(event) =>
                    onChangeContactUsSectionField("callBox", "text", event.target.value)
                  }
                  className={textAreaBase}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Address Box</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.addressBox.enabled)}
                  onChange={(value) => onChangeContactUsSectionEnabled("addressBox", value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title
                </span>
                <input
                  type="text"
                  value={contactUs.addressBox.title}
                  onChange={(event) =>
                    onChangeContactUsSectionField("addressBox", "title", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Address
                </span>
                <textarea
                  value={contactUs.addressBox.address}
                  onChange={(event) =>
                    onChangeContactUsSectionField(
                      "addressBox",
                      "address",
                      event.target.value
                    )
                  }
                  className={textAreaBase}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Middle Left Column</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.middleLeftColumn.enabled)}
                  onChange={(value) =>
                    onChangeContactUsSectionEnabled("middleLeftColumn", value)
                  }
                />
              </div>
              <ImageUploadField
                id="contact-us-middle-left-image-input"
                label="Middle Left Image"
                error={contactUsImageErrors[CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage]}
                dropActive={Boolean(
                  contactUsDropActive[CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage]
                )}
                onDropActiveChange={(value) =>
                  setContactUsDropActiveField(
                    CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage,
                    value
                  )
                }
                onInputChange={(event) =>
                  onContactUsImageInputChange(
                    CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage,
                    event
                  )
                }
                onDrop={(event) =>
                  onDropContactUsImage(
                    CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage,
                    event
                  )
                }
                previewDataUrl={contactUs.middleLeftColumn.imageDataUrl}
                onRemove={() =>
                  onRemoveContactUsImage(CONTACT_US_IMAGE_FIELD_KEYS.middleLeftColumnImage)
                }
                previewAlt="Contact Us middle left image"
              />
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Contact Form</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enable This Block
                </p>
                <SegmentedToggle
                  value={Boolean(contactUs.contactForm.enabled)}
                  onChange={(value) => onChangeContactUsSectionEnabled("contactForm", value)}
                />
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact Form Title
                </span>
                <input
                  type="text"
                  value={contactUs.contactForm.title}
                  onChange={(event) =>
                    onChangeContactUsSectionField("contactForm", "title", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact Form Description
                </span>
                <textarea
                  value={contactUs.contactForm.description}
                  onChange={(event) =>
                    onChangeContactUsSectionField(
                      "contactForm",
                      "description",
                      event.target.value
                    )
                  }
                  className={textAreaBase}
                />
              </label>
            </div>
          </section>
        </div>
      ) : activeTab === "checkout" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Personal Details</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.sectionTitle}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "sectionTitle",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  First Name Label
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.firstNameLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "firstNameLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  First Name Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.firstNamePlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "firstNamePlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last Name Label
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.lastNameLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "lastNameLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last Name Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.lastNamePlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "lastNamePlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email Label
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.emailLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "emailLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.emailPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "emailPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Label
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.phoneLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "phoneLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.personalDetails.phonePlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "personalDetails",
                      "phonePlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Shipping Details</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.sectionTitle}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "sectionTitle",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Street Address Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.streetAddressLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "streetAddressLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Street Address Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.streetAddressPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "streetAddressPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  City Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.cityLabel}
                  onChange={(event) =>
                    onChangeCheckoutField("shippingDetails", "cityLabel", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  City Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.cityPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "cityPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Country Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.countryLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "countryLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Country Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.countryPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "countryPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Zip / Postal Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.zipLabel}
                  onChange={(event) =>
                    onChangeCheckoutField("shippingDetails", "zipLabel", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Zip Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.zipPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "zipPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shipping Cost Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.shippingCostLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "shippingCostLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Shipping One</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Name Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneNameLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneNameLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Name Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneNameDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneNameDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Description Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneDescriptionLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneDescriptionLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Description Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneDescriptionDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneDescriptionDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Cost Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneCostLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneCostLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping One Cost Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingOneCostDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingOneCostDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Shipping Two</h3>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Name Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoNameLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoNameLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Name Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoNameDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoNameDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Description Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoDescriptionLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoDescriptionLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Description Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoDescriptionDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoDescriptionDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Cost Label
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoCostLabel}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoCostLabel",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Shipping Two Cost Default
                  </span>
                  <input
                    type="text"
                    value={checkout.shippingDetails.shippingTwoCostDefault}
                    onChange={(event) =>
                      onChangeCheckoutField(
                        "shippingDetails",
                        "shippingTwoCostDefault",
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment Method Label
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.paymentMethodLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "paymentMethodLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment Method Placeholder
                </span>
                <input
                  type="text"
                  value={checkout.shippingDetails.paymentMethodPlaceholder}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "shippingDetails",
                      "paymentMethodPlaceholder",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Buttons</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Continue Button Label
                </span>
                <input
                  type="text"
                  value={checkout.buttons.continueButtonLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "buttons",
                      "continueButtonLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Confirm Button Label
                </span>
                <input
                  type="text"
                  value={checkout.buttons.confirmButtonLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "buttons",
                      "confirmButtonLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Cart Item Section</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.sectionTitle}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "sectionTitle",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Order Summary Label
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.orderSummaryLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "orderSummaryLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Apply Button Label
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.applyButtonLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "applyButtonLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sub Total Label
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.subTotalLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "subTotalLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Discount Label
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.discountLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "discountLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Cost Label
                </span>
                <input
                  type="text"
                  value={checkout.cartItemSection.totalCostLabel}
                  onChange={(event) =>
                    onChangeCheckoutField(
                      "cartItemSection",
                      "totalCostLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>
          </section>
        </div>
      ) : activeTab === "dashboardSetting" ? (
        <div className="flex flex-col gap-5">
          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Dashboard</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="block md:col-span-2 xl:col-span-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title
                </span>
                <input
                  type="text"
                  value={dashboardSetting.dashboard.sectionTitle}
                  onChange={(event) =>
                    onChangeDashboardSettingField(
                      "dashboard",
                      "sectionTitle",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              {DASHBOARD_SETTING_DASHBOARD_FIELDS.map((field) => (
                <label key={field.field} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </span>
                  <input
                    type="text"
                    value={toText(dashboardSetting.dashboard?.[field.field], "")}
                    onChange={(event) =>
                      onChangeDashboardSettingField(
                        "dashboard",
                        field.field,
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={sectionCard}>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">Update Profile</h2>
            </div>
            <div className="mt-4 h-px w-full bg-slate-200" />

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {dashboardSetting.updateProfile.sectionTitleLabel}
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title Value
                </span>
                <input
                  type="text"
                  value={dashboardSetting.updateProfile.sectionTitleValue}
                  onChange={(event) =>
                    onChangeDashboardSettingField(
                      "updateProfile",
                      "sectionTitleValue",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Section Title Label
                </span>
                <input
                  type="text"
                  value={dashboardSetting.updateProfile.sectionTitleLabel}
                  onChange={(event) =>
                    onChangeDashboardSettingField(
                      "updateProfile",
                      "sectionTitleLabel",
                      event.target.value
                    )
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>
              {DASHBOARD_SETTING_UPDATE_PROFILE_FIELDS.map((field) => (
                <label key={field.field} className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </span>
                  <input
                    type="text"
                    value={toText(dashboardSetting.updateProfile?.[field.field], "")}
                    onChange={(event) =>
                      onChangeDashboardSettingField(
                        "updateProfile",
                        field.field,
                        event.target.value
                      )
                    }
                    className={`${inputBase} mt-2`}
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

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Header Text
                </span>
                <input
                  type="text"
                  value={homeState.header.headerText}
                  disabled={isLoadingHeader || isSaving}
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
                  disabled={isLoadingHeader || isSaving}
                  onChange={(event) =>
                    onChangeHeaderField("phoneNumber", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  WhatsApp Link
                </span>
                <input
                  type="url"
                  value={homeState.header.whatsAppLink}
                  placeholder="https://wa.me/628xxxxxxxxxx"
                  disabled={isLoadingHeader || isSaving}
                  onChange={(event) =>
                    onChangeHeaderField("whatsAppLink", event.target.value)
                  }
                  className={`${inputBase} mt-2`}
                />
                <p className="mt-1 text-xs text-slate-500">Leave empty if not used.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onGenerateWhatsAppLink}
                    disabled={isLoadingHeader || isSaving}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Generate WA Link
                  </button>
                  {headerWhatsAppLink && isSafeWhatsAppLink(headerWhatsAppLink) ? (
                    <button
                      type="button"
                      onClick={onTestWhatsAppLink}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Test Link
                    </button>
                  ) : null}
                </div>
                {whatsAppLinkError ? (
                  <p className="mt-1 text-xs text-rose-600">{whatsAppLinkError}</p>
                ) : null}
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
                  disabled={isUploadingLogo || isLoadingHeader || isSaving}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (isUploadingLogo || isLoadingHeader || isSaving) return;
                    setIsDropActive(true);
                  }}
                  onDragLeave={() => setIsDropActive(false)}
                  onDrop={onDropLogo}
                  className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                    isDropActive
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  } ${isUploadingLogo || isLoadingHeader || isSaving ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <Upload className="h-5 w-5 text-slate-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {isUploadingLogo ? "Uploading image..." : "Drag your images here"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </button>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p>Recommended size: 240x64px (or 300x80px for sharper display)</p>
                  <p>Aspect ratio: horizontal (~3.5-4:1)</p>
                  <p>Format: transparent PNG / WEBP</p>
                  <p>Safe padding: 8-12px left/right</p>
                  <p>
                    Logo is rendered inside a ~40-48px height container on the storefront
                    header.
                  </p>
                </div>

                {logoError ? (
                  <p className="text-xs text-rose-600">{logoError}</p>
                ) : null}

                {logoMetaText ? (
                  <p className="text-xs text-slate-600">{logoMetaText}</p>
                ) : null}

                {logoWarning ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      logoWarningLevel === "warn"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                    }`}
                  >
                    {logoWarning}
                  </div>
                ) : null}

                <div className="w-full rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Logo Preview (Client Frame)
                    </p>
                    {headerLogoPreviewUrl ? (
                      <button
                        type="button"
                        onClick={onRemoveLogo}
                        disabled={isUploadingLogo || isLoadingHeader || isSaving}
                        className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Remove logo"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="relative flex h-10 items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 px-2 sm:h-11 sm:px-3 md:h-12">
                    {headerLogoFrameSrc ? (
                      <img
                        src={headerLogoFrameSrc}
                        alt="Header logo preview"
                        className="max-h-full w-auto max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-xs text-slate-500">No logo uploaded yet</p>
                    )}
                    <div className="pointer-events-none absolute inset-0 p-2 sm:p-3">
                      <div className="h-full w-full rounded-sm border border-dashed border-slate-300" />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onCopyPublicLogoUrl}
                      disabled={!publicLogoUrl}
                      className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Copy URL
                    </button>
                    <button
                      type="button"
                      onClick={onOpenPublicLogoUrl}
                      disabled={!publicLogoUrl}
                      className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={onDownloadPublicLogoUrl}
                      disabled={!publicLogoUrl}
                      className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Download
                    </button>
                  </div>

                  {logoActionFeedback ? (
                    <p
                      className={`mt-2 text-xs ${
                        logoActionFeedbackType === "warn"
                          ? "text-amber-700"
                          : "text-slate-600"
                      }`}
                    >
                      {logoActionFeedback}
                    </p>
                  ) : null}
                </div>
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
      </div>

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

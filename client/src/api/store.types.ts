export type StoreCategory = {
  id: number;
  name: string;
  slug: string;
  code?: string;
  image?: string | null;
  parentId?: number | null;
  parent_id?: number | null;
  published?: boolean;
};

export type StoreProductCategory = {
  id: number;
  name: string;
  slug: string;
};

export type StoreProduct = {
  id: number;
  name: string;
  price: number;
  slug?: string;
  routeSlug?: string | null;
  productHref?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  originalPrice?: number | null;
  salePrice?: number | null;
  discountPercent?: number | null;
  ratingAvg?: number | null;
  reviewCount?: number | null;
  unit?: string | null;
  categoryId?: number | null;
  category?: StoreProductCategory | null;
  stock?: number | null;
  preOrder?: boolean;
  preorderDays?: number | null;
  weight?: number | null;
  condition?: string | null;
  variations?: any;
  status?: string | null;
  published?: boolean;
};

export type StorefrontProductSellerInfo = {
  storeId: number | null;
  name: string;
  slug: string;
  logoUrl: string | null;
  shortDescription: string | null;
  status?: {
    code: string;
    label: string;
    tone: string;
  } | null;
  operationalReadiness?: {
    code: string;
    label: string;
    tone: string;
    description: string | null;
    isReady: boolean;
  } | null;
  productCount: number | null;
  ratingAverage: number | null;
  ratingCount: number | null;
  followerCount: number | null;
  responseRate: number | null;
  responseTimeLabel: string | null;
  joinedAt: string | null;
  canVisitStore: boolean;
  visitStoreHref: string | null;
  canChat: boolean;
  chatMode: "enabled" | "contact_fallback" | "disabled";
  chatHref: string | null;
  chatLabel: string;
  chatHelper: string | null;
};

export type StoreProductDetail = StoreProduct & {
  slug?: string;
  description?: string | null;
  salePrice?: string | number | null;
  sellerInfo?: StorefrontProductSellerInfo | null;
};

export type StoreCoupon = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  amount: number;
  minSpend: number;
  scopeType?: "PLATFORM" | "STORE";
  startsAt?: string | null;
  expiresAt?: string | null;
};

export type StoreCouponQuoteResponse = {
  valid: boolean;
  reason?:
    | "not_found"
    | "inactive"
    | "not_started"
    | "expired"
    | "minSpend"
    | "invalid_input"
    | "scope_required"
    | "scope_mismatch";
  message?: string;
  code: string | null;
  discount: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
  minSpend: number;
  scopeType: "PLATFORM" | "STORE" | null;
  storeId: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  subtotal: number;
  shipping: number;
  total: number;
};

export type StoreShippingDetails = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  streetName: string;
  building?: string;
  houseNumber: string;
  otherDetails?: string;
  markAs?: "HOME" | "OFFICE";
};

export type StoreCheckoutPreviewItem = {
  productId: number;
  productName: string;
  slug: string;
  qty: number;
  price: number;
  lineTotal: number;
  image?: string | null;
  stock?: number | null;
  category?: StoreProductCategory | null;
};

export type StoreCheckoutPreviewGroup = {
  storeId: number;
  storeName: string;
  storeSlug?: string;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  paymentAvailable: boolean;
  paymentMethod: "QRIS" | null;
  paymentProfileStatus: "ACTIVE" | "PENDING" | "REJECTED" | "INACTIVE" | "MISSING" | string;
  merchantName?: string | null;
  accountName?: string | null;
  qrisImageUrl?: string | null;
  qrisPayload?: string | null;
  paymentInstruction?: string | null;
  warning?: string | null;
  items: StoreCheckoutPreviewItem[];
};

export type StoreCheckoutPreviewResponse = {
  success: boolean;
  data: {
    checkoutMode: "SINGLE_STORE" | "MULTI_STORE";
    summary: {
      totalItems: number;
      subtotalAmount: number;
      shippingAmount: number;
      grandTotal: number;
      invalidItemCount?: number;
    };
    groups: StoreCheckoutPreviewGroup[];
    invalidItems: Array<{
      productId: number;
      productName: string;
      reason: string;
      available?: number | null;
      requested?: number | null;
    }>;
  };
  message?: string;
};

export type StoreCustomizationResponse = {
  success: boolean;
  lang: string;
  customization: {
    home?: Record<string, any>;
    aboutUs?: Record<string, any>;
    privacyPolicy?: Record<string, any>;
    termsAndConditions?: Record<string, any>;
    faqs?: Record<string, any>;
    offers?: Record<string, any>;
    contactUs?: Record<string, any>;
    checkout?: Record<string, any>;
    dashboardSetting?: Record<string, any>;
  };
};

export type StoreHeaderCustomization = {
  language: string;
  headerText: string;
  phoneNumber: string;
  whatsAppLink: string;
  headerLogoUrl: string;
  updatedAt: string;
  contract?: {
    authoritativeFields?: Record<string, string>;
    fallbackOrder?: Record<string, string[]>;
    notes?: string[];
  };
};

export type StoreHeaderCustomizationResponse = {
  success: boolean;
  data?: StoreHeaderCustomization;
};

export type PublicStoreIdentity = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  websiteUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt?: string;
  updatedAt: string;
  summary?: {
    status?: {
      code?: string;
      label?: string;
      tone?: string;
    };
    productCount?: number | null;
    ratingAverage?: number | null;
    ratingCount?: number | null;
    followerCount?: number | null;
    responseRate?: number | null;
    responseTimeLabel?: string | null;
    joinedAt?: string;
    chatMode?: "enabled" | "contact_fallback" | "disabled";
    canChat?: boolean;
    canContact?: boolean;
  };
  contract?: {
    authoritativeSource?: string;
    sellerOwnedFields?: string[];
    adminManagedSurfaces?: string[];
    notes?: string[];
  };
};

export type PublicStoreIdentityResponse = {
  success: boolean;
  data?: PublicStoreIdentity;
};

export type StoreMicrositeRichAbout = {
  title: string;
  body: string;
  hasContent: boolean;
};

export type EffectiveStoreMicrositeRichAbout = {
  title: string;
  body: string;
  source: string;
};

export type StoreMicrositeRichAboutResponse = {
  success: boolean;
  data?: {
    storeSlug: string;
    lang: string;
    richAbout: StoreMicrositeRichAbout;
    effective?: EffectiveStoreMicrositeRichAbout;
    contract?: {
      authoritativeSource?: string;
      fallbackOrder?: Record<string, string[]>;
      notes?: string[];
    };
    updatedAt: string;
  };
};

export type PublicStoreSettings = {
  payments: {
    cashOnDeliveryEnabled: boolean;
    stripeEnabled: boolean;
    razorPayEnabled: boolean;
    stripeKey: string;
  };
  socialLogin: {
    googleEnabled: boolean;
    githubEnabled: boolean;
    facebookEnabled: boolean;
    googleClientId: string;
    githubId: string;
    facebookId: string;
  };
  analytics: {
    googleAnalyticsEnabled: boolean;
    googleAnalyticKey: string;
  };
  chat: {
    tawkEnabled: boolean;
    tawkPropertyId: string;
    tawkWidgetId: string;
  };
  branding: {
    clientLogoUrl: string;
    adminLogoUrl: string;
    sellerLogoUrl: string;
    workspaceBrandName: string;
  };
};

export type StoreSettingsResponse = {
  success: boolean;
  data?: {
    storeSettings?: PublicStoreSettings;
  };
};

export type StoreProductsResponse = {
  data: {
    items: StoreProduct[];
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
};

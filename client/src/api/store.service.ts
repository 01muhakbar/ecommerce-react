import { api } from "./axios";
import {
  normalizeStorefrontCategoriesResponse,
  normalizeStorefrontProductDetailResponse,
  normalizeStorefrontProductsResponse,
} from "../utils/storefrontCatalog.ts";

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

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

export type StoreProductDetail = StoreProduct & {
  slug?: string;
  description?: string | null;
  salePrice?: number | null;
  sellerInfo?: StorefrontProductSellerInfo | null;
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

export type StoreCoupon = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  amount: number;
  minSpend: number;
  expiresAt?: string | null;
};

export type StoreCouponQuoteResponse = {
  valid: boolean;
  reason?: "not_found" | "inactive" | "expired" | "minSpend" | "invalid_input";
  message?: string;
  code: string | null;
  discount: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
  minSpend: number;
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
    }>;
  };
  message?: string;
};

export type StoreCustomizationResponse = {
  success: boolean;
  lang: string;
  customization: {
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
  id: number | null;
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

export const fetchStoreCategories = async () => {
  const { data } = await api.get<{ data: StoreCategory[] }>("/store/categories");
  return normalizeStorefrontCategoriesResponse(data);
};

export const fetchStoreProducts = async (params?: {
  search?: string;
  q?: string;
  category?: string | number;
  storeSlug?: string;
  page?: number;
  limit?: number;
}) => {
  const query = {
    search: params?.search ?? params?.q,
    category: params?.category,
    storeSlug: params?.storeSlug,
    page: params?.page,
    limit: params?.limit,
  };
  const { data } = await api.get<StoreProductsResponse>("/store/products", { params: query });
  return normalizeStorefrontProductsResponse(data);
};

export const fetchStoreProductById = async (
  id: string | number,
  params?: { storeSlug?: string }
) => {
  const query = params?.storeSlug ? { storeSlug: params.storeSlug } : undefined;
  const { data } = await api.get<{ data: StoreProductDetail }>(`/store/products/${id}`, {
    params: query,
  });
  return normalizeStorefrontProductDetailResponse(data);
};

export const fetchStoreOrder = async (ref: string) => {
  const { data } = await api.get<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      totalAmount: number;
      paymentMethod?: string | null;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      couponCode?: string | null;
      createdAt: string;
      customerName?: string | null;
      customerPhone?: string | null;
      customerAddress?: string | null;
      shippingDetails?: StoreShippingDetails | null;
      items: Array<{
        id: number;
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
    };
  }>(`/store/orders/${encodeURIComponent(ref)}`);
  return data;
};

export const fetchStoreMyOrders = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get("/store/my/orders", { params });
  return data;
};

export const createStoreOrder = async (payload: {
  customer: { name: string; phone: string; address: string; notes?: string };
  paymentMethod: "COD";
  items: { productId: number; qty: number }[];
  couponCode?: string;
  useDefaultShipping?: boolean;
  shippingDetails?: StoreShippingDetails;
}) => {
  const url = "/store/orders";
  if (isDev) {
    console.log("[createStoreOrder] url", url);
  }
  const { data } = await api.post<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      totalAmount: number;
      createdAt: string;
      items: Array<{
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      total: number;
      useDefaultShipping?: boolean;
      shippingDetails?: StoreShippingDetails | null;
      paymentMethod: "COD";
    };
  }>(url, payload, { withCredentials: true });
  return data;
};

export const createMultiStoreCheckoutOrder = async (payload?: {
  cartId?: number;
  shippingAddressId?: number;
  useDefaultShipping?: boolean;
  customer?: { name?: string; phone?: string; address?: string; notes?: string };
  shippingDetails?: StoreShippingDetails;
  couponCode?: string | null;
}) => {
  const { data } = await api.post("/checkout/create-multi-store", payload ?? {}, {
    withCredentials: true,
  });
  return data;
};

export const previewCheckoutByStore = async (payload?: {
  cartId?: number;
  shippingAddressId?: number;
}) => {
  const { data } = await api.post<StoreCheckoutPreviewResponse>(
    "/checkout/preview",
    payload ?? {},
    { withCredentials: true }
  );
  return data;
};

export const fetchStoreCoupons = async () => {
  const { data } = await api.get<{ data: StoreCoupon[] }>("/store/coupons");
  return data;
};

export const getStoreCustomization = async (params?: {
  lang?: string;
  include?: string;
}) => {
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const include = String(params?.include || "").trim();
  const query: Record<string, string> = { lang: normalizedLang };
  if (include) {
    query.include = include;
  }

  const { data } = await api.get<StoreCustomizationResponse>("/store/customization", {
    params: query,
  });
  return data;
};

export const fetchStoreCustomization = async (lang = "en") => {
  const normalizedLang = String(lang || "en").trim().toLowerCase() || "en";
  return getStoreCustomization({ lang: normalizedLang });
};

export const getStoreHeaderCustomization = async (params?: { lang?: string }) => {
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const { data } = await api.get<StoreHeaderCustomizationResponse>(
    "/store/customization/header",
    {
      params: { lang: normalizedLang },
    }
  );
  return data;
};

export const getStorePublicIdentity = async () => {
  const { data } = await api.get<PublicStoreIdentityResponse>("/store/customization/identity");
  return data;
};

export const getStorePublicIdentityBySlug = async (slug: string) => {
  const normalizedSlug = String(slug || "").trim();
  const { data } = await api.get<PublicStoreIdentityResponse>(
    `/store/customization/identity/${encodeURIComponent(normalizedSlug)}`
  );
  return data;
};

export const getStoreMicrositeRichAboutBySlug = async (
  slug: string,
  params?: { lang?: string }
) => {
  const normalizedSlug = String(slug || "").trim();
  const normalizedLang = String(params?.lang || "en").trim().toLowerCase() || "en";
  const { data } = await api.get<StoreMicrositeRichAboutResponse>(
    `/store/customization/microsites/${encodeURIComponent(normalizedSlug)}/rich-about`,
    {
      params: { lang: normalizedLang },
    }
  );
  return data;
};

export const getStoreSettings = async () => {
  const { data } = await api.get<StoreSettingsResponse>("/store/settings");
  return data;
};

export const validateStoreCoupon = async (payload: { code: string; subtotal: number }) => {
  const response = await api.post<{
    data: {
      valid: boolean;
      code: string | null;
      discountAmount: number;
      message: string;
    };
  }>("/store/coupons/validate", payload);
  return response;
};

export const quoteStoreCoupon = async (payload: {
  code: string;
  subtotal: number;
  shipping?: number;
}) => {
  const { data } = await api.post<StoreCouponQuoteResponse>("/store/coupons/quote", payload);
  return data;
};

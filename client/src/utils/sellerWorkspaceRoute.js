import { useOutletContext, useParams } from "react-router-dom";

const SELLER_STORE_ROUTE_PATTERN = /^\/seller\/stores\/[^/]+/;

export const normalizeSellerStoreParam = (value) => String(value || "").trim();

export const isLegacySellerStoreIdParam = (value) => /^\d+$/.test(normalizeSellerStoreParam(value));

export const resolveSellerWorkspaceRouteParam = (value) => {
  if (value && typeof value === "object") {
    const slug = normalizeSellerStoreParam(value.slug);
    if (slug) {
      return slug;
    }

    const storeId = Number(value.id || value.storeId || 0);
    return Number.isInteger(storeId) && storeId > 0 ? String(storeId) : "";
  }

  return normalizeSellerStoreParam(value);
};

export const buildSellerWorkspacePath = (storeSlug, suffix = "") => {
  const normalizedStoreSlug = resolveSellerWorkspaceRouteParam(storeSlug);
  if (!normalizedStoreSlug) {
    return "/seller/stores";
  }
  const encodedStoreSlug = encodeURIComponent(normalizedStoreSlug);
  const normalizedSuffix = suffix
    ? suffix.startsWith("/")
      ? suffix
      : `/${suffix}`
    : "";

  return `/seller/stores/${encodedStoreSlug}${normalizedSuffix}`;
};

export const replaceSellerWorkspaceStorePath = (pathname, storeSlug) =>
  String(pathname || "").replace(
    SELLER_STORE_ROUTE_PATTERN,
    buildSellerWorkspacePath(storeSlug)
  );

export const createSellerWorkspaceRoutes = (storeSlug) => ({
  home: () => buildSellerWorkspacePath(storeSlug),
  storeProfile: () => buildSellerWorkspacePath(storeSlug, "/store-profile"),
  shippingSetup: () => `${buildSellerWorkspacePath(storeSlug, "/store-profile")}#shipping-setup`,
  profile: () => buildSellerWorkspacePath(storeSlug, "/store-profile"),
  catalog: () => buildSellerWorkspacePath(storeSlug, "/catalog/products"),
  productCreate: () => buildSellerWorkspacePath(storeSlug, "/catalog/products/new"),
  productDetail: (productId) =>
    buildSellerWorkspacePath(
      storeSlug,
      `/catalog/products/${encodeURIComponent(String(productId))}`
    ),
  productEdit: (productId) =>
    buildSellerWorkspacePath(
      storeSlug,
      `/catalog/products/${encodeURIComponent(String(productId))}/edit`
    ),
  orders: () => buildSellerWorkspacePath(storeSlug, "/orders"),
  orderDetail: (suborderId) =>
    buildSellerWorkspacePath(storeSlug, `/orders/${encodeURIComponent(String(suborderId))}`),
  paymentReview: () => buildSellerWorkspacePath(storeSlug, "/payment-review"),
  paymentProfile: () => buildSellerWorkspacePath(storeSlug, "/payment-profile"),
  coupons: () => buildSellerWorkspacePath(storeSlug, "/catalog/coupons"),
  team: () => buildSellerWorkspacePath(storeSlug, "/team"),
  teamAudit: () => buildSellerWorkspacePath(storeSlug, "/team/audit"),
  memberLifecycle: (memberId) =>
    buildSellerWorkspacePath(storeSlug, `/team/${encodeURIComponent(String(memberId))}`),
  path: (suffix = "") => buildSellerWorkspacePath(storeSlug, suffix),
});

export const useSellerWorkspaceRoute = () => {
  const params = useParams();
  const outletContext = useOutletContext() || {};
  const sellerContext = outletContext?.sellerContext || null;
  const routeStoreSlug = normalizeSellerStoreParam(params.storeSlug ?? params.storeId);
  const workspaceStoreId = Number(sellerContext?.store?.id || 0) || null;
  const workspaceStoreSlug =
    normalizeSellerStoreParam(sellerContext?.store?.slug) || routeStoreSlug;
  const workspaceRoutes = createSellerWorkspaceRoutes(workspaceStoreSlug);

  return {
    ...outletContext,
    sellerContext,
    routeStoreSlug,
    workspaceStoreId,
    workspaceStoreSlug,
    workspaceRoutes,
    buildWorkspacePath: workspaceRoutes.path,
  };
};

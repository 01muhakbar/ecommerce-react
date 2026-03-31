import { Coupon, Product, Suborder, SuborderItem } from "../models/index.js";
import { getCouponTimeWindow } from "./sharedContracts/couponGovernance.js";
import { buildProductVisibilitySnapshot } from "./productVisibility.js";
import { sellerHasPermission } from "./seller/resolveSellerAccess.js";
import {
  emptyProductPipelineSummary,
  loadProductPipelineSummaryByStoreIds,
} from "./sellerWorkspaceReadiness.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toUpper = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const getDiscountAmount = (suborder: any) => {
  const subtotal = toNumber(getAttr(suborder, "subtotalAmount"));
  const shipping = toNumber(getAttr(suborder, "shippingAmount"));
  const serviceFee = toNumber(getAttr(suborder, "serviceFeeAmount"));
  const total = toNumber(getAttr(suborder, "totalAmount"));
  return Math.max(0, subtotal + shipping + serviceFee - total);
};

const normalizeCouponScopeType = (value: unknown) => {
  const normalized = toUpper(value);
  return normalized === "PLATFORM" || normalized === "STORE" ? normalized : "UNKNOWN";
};

const buildCouponAttributionSnapshot = (input: {
  visible: boolean;
  orderVisible: boolean;
  suborders: any[];
}) => {
  if (!input.visible) {
    return {
      visible: false,
      level: "HIDDEN",
      label: "Hidden",
      tone: "stone",
      summary: "Coupon attribution snapshot is visible only to seller roles with COUPON_VIEW.",
      attributedSuborders: 0,
      attributedPaidSuborders: 0,
      unattributedDiscountedSuborders: 0,
      totalDiscountAmount: 0,
      paidDiscountAmount: 0,
      topCouponCodes: [],
      scopeBreakdown: [],
      coverage: {
        discountedSuborders: 0,
        attributedDiscountedSuborders: 0,
        attributedCoveragePercent: 0,
        note: "Coupon attribution snapshot stays hidden when coupon visibility is outside the current seller role.",
      },
      boundaryNote:
        "This snapshot stays tenant-scoped to the active seller store and never changes public coupon validation or admin governance.",
    };
  }

  if (!input.orderVisible) {
    return {
      visible: false,
      level: "ORDER_VISIBILITY_REQUIRED",
      label: "Order visibility required",
      tone: "stone",
      summary:
        "Coupon inventory is visible, but attribution snapshot needs seller order visibility because it is derived from store-owned suborders.",
      attributedSuborders: 0,
      attributedPaidSuborders: 0,
      unattributedDiscountedSuborders: 0,
      totalDiscountAmount: 0,
      paidDiscountAmount: 0,
      topCouponCodes: [],
      scopeBreakdown: [],
      coverage: {
        discountedSuborders: 0,
        attributedDiscountedSuborders: 0,
        attributedCoveragePercent: 0,
        note: "Coupon attribution snapshot follows both coupon and order visibility in seller workspace.",
      },
      boundaryNote:
        "Attribution snapshot is hidden until the current seller role can read store-owned suborders.",
    };
  }

  const discountedSuborders = input.suborders.filter((suborder) => getDiscountAmount(suborder) > 0);
  const attributedSuborders = discountedSuborders.filter((suborder) =>
    Boolean(String(getAttr(suborder, "appliedCouponCode") || "").trim())
  );
  const attributedPaidSuborders = attributedSuborders.filter(
    (suborder) =>
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID" &&
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") !== "CANCELLED"
  );
  const unattributedDiscountedSuborders = Math.max(
    0,
    discountedSuborders.length - attributedSuborders.length
  );
  const totalDiscountAmount = attributedSuborders.reduce(
    (sum, suborder) => sum + getDiscountAmount(suborder),
    0
  );
  const paidDiscountAmount = attributedPaidSuborders.reduce(
    (sum, suborder) => sum + getDiscountAmount(suborder),
    0
  );
  const attributedCoveragePercent =
    discountedSuborders.length > 0
      ? Math.round((attributedSuborders.length / discountedSuborders.length) * 100)
      : 0;

  const topCouponCodeMap = new Map<
    string,
    {
      code: string;
      scopeType: string;
      attributedSuborders: number;
      attributedPaidSuborders: number;
      totalDiscountAmount: number;
      paidDiscountAmount: number;
    }
  >();
  const scopeMap = new Map<
    string,
    {
      scopeType: string;
      attributedSuborders: number;
      attributedPaidSuborders: number;
      totalDiscountAmount: number;
      paidDiscountAmount: number;
    }
  >();

  for (const suborder of attributedSuborders) {
    const code = String(getAttr(suborder, "appliedCouponCode") || "").trim().toUpperCase();
    if (!code) continue;
    const scopeType = normalizeCouponScopeType(getAttr(suborder, "appliedCouponScopeType"));
    const discountAmount = getDiscountAmount(suborder);
    const isPaid =
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID" &&
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") !== "CANCELLED";

    const currentCode = topCouponCodeMap.get(code) || {
      code,
      scopeType,
      attributedSuborders: 0,
      attributedPaidSuborders: 0,
      totalDiscountAmount: 0,
      paidDiscountAmount: 0,
    };
    currentCode.attributedSuborders += 1;
    currentCode.totalDiscountAmount += discountAmount;
    if (isPaid) {
      currentCode.attributedPaidSuborders += 1;
      currentCode.paidDiscountAmount += discountAmount;
    }
    topCouponCodeMap.set(code, currentCode);

    const currentScope = scopeMap.get(scopeType) || {
      scopeType,
      attributedSuborders: 0,
      attributedPaidSuborders: 0,
      totalDiscountAmount: 0,
      paidDiscountAmount: 0,
    };
    currentScope.attributedSuborders += 1;
    currentScope.totalDiscountAmount += discountAmount;
    if (isPaid) {
      currentScope.attributedPaidSuborders += 1;
      currentScope.paidDiscountAmount += discountAmount;
    }
    scopeMap.set(scopeType, currentScope);
  }

  const topCouponCodes = Array.from(topCouponCodeMap.values())
    .sort((left, right) => {
      if (right.attributedSuborders !== left.attributedSuborders) {
        return right.attributedSuborders - left.attributedSuborders;
      }
      if (right.totalDiscountAmount !== left.totalDiscountAmount) {
        return right.totalDiscountAmount - left.totalDiscountAmount;
      }
      return left.code.localeCompare(right.code);
    })
    .slice(0, 5);

  const scopeBreakdown = Array.from(scopeMap.values()).sort((left, right) => {
    if (right.attributedSuborders !== left.attributedSuborders) {
      return right.attributedSuborders - left.attributedSuborders;
    }
    return left.scopeType.localeCompare(right.scopeType);
  });

  const hasDiscountActivity = discountedSuborders.length > 0;
  const level = !hasDiscountActivity
    ? "NO_ACTIVITY"
    : unattributedDiscountedSuborders > 0
      ? "PARTIAL"
      : "READY";
  const label =
    level === "READY"
      ? "Suborder-attributed"
      : level === "PARTIAL"
        ? "Partial coverage"
        : "No attributed activity yet";
  const tone = level === "READY" ? "emerald" : level === "PARTIAL" ? "sky" : "stone";
  const summary = !hasDiscountActivity
    ? "No discounted suborder is visible yet for the active seller scope, so attribution snapshot has no operational activity to summarize."
    : unattributedDiscountedSuborders > 0
      ? "Most coupon attribution now comes from checkout-created suborders, but some discounted suborders still do not carry coupon metadata and stay outside per-code attribution."
      : "Discounted suborders in the current seller scope already carry coupon code and scope, so per-code attribution snapshot is available for the visible modern path.";

  const coverageNote = !hasDiscountActivity
    ? "Coverage is neutral until the store records discounted suborder activity."
    : unattributedDiscountedSuborders > 0
      ? `${attributedSuborders.length} of ${discountedSuborders.length} discounted suborder(s) currently carry coupon metadata. Older or legacy data can still stay outside this snapshot.`
      : `All ${discountedSuborders.length} discounted suborder(s) in the current seller scope carry coupon metadata inside the visible modern path.`;

  return {
    visible: true,
    level,
    label,
    tone,
    summary,
    attributedSuborders: attributedSuborders.length,
    attributedPaidSuborders: attributedPaidSuborders.length,
    unattributedDiscountedSuborders,
    totalDiscountAmount,
    paidDiscountAmount,
    topCouponCodes,
    scopeBreakdown,
    coverage: {
      discountedSuborders: discountedSuborders.length,
      attributedDiscountedSuborders: attributedSuborders.length,
      attributedCoveragePercent,
      note: coverageNote,
    },
    boundaryNote:
      "This seller snapshot stays tenant-scoped to the active store and only covers coupon attribution that can be derived safely from visible suborders.",
  };
};

const buildStoreSummary = (sellerAccess: any) => ({
  id: Number(sellerAccess?.store?.id || 0),
  name: String(sellerAccess?.store?.name || ""),
  slug: String(sellerAccess?.store?.slug || ""),
  status: String(sellerAccess?.store?.status || "ACTIVE"),
  roleCode: String(sellerAccess?.roleCode || ""),
  accessMode: String(sellerAccess?.accessMode || ""),
  membershipStatus: String(sellerAccess?.membershipStatus || ""),
});

const buildOrderSnapshot = (suborders: any[], visible: boolean) => {
  if (!visible) {
    return {
      visible: false,
      totalOrders: 0,
      paidOrders: 0,
      processingOrders: 0,
      completedOrders: 0,
      pendingPaymentOrders: 0,
      exceptionOrders: 0,
      hint: "Order analytics are visible only to seller roles with ORDER_VIEW.",
    };
  }

  const paidOrders = suborders.filter(
    (suborder) =>
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID" &&
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") !== "CANCELLED"
  );
  const processingOrders = paidOrders.filter((suborder) =>
    ["PROCESSING", "SHIPPED"].includes(
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED")
    )
  );
  const completedOrders = paidOrders.filter(
    (suborder) => toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") === "DELIVERED"
  );
  const pendingPaymentOrders = suborders.filter((suborder) =>
    ["UNPAID", "PENDING_CONFIRMATION"].includes(
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID")
    )
  );
  const exceptionOrders = suborders.filter((suborder) => {
    const paymentStatus = toUpper(getAttr(suborder, "paymentStatus"), "UNPAID");
    const fulfillmentStatus = toUpper(
      getAttr(suborder, "fulfillmentStatus"),
      "UNFULFILLED"
    );
    return (
      ["FAILED", "EXPIRED", "CANCELLED"].includes(paymentStatus) ||
      fulfillmentStatus === "CANCELLED"
    );
  });

  return {
    visible: true,
    totalOrders: suborders.length,
    paidOrders: paidOrders.length,
    processingOrders: processingOrders.length,
    completedOrders: completedOrders.length,
    pendingPaymentOrders: pendingPaymentOrders.length,
    exceptionOrders: exceptionOrders.length,
    hint:
      suborders.length > 0
        ? "Order analytics are derived from store-owned suborders only."
        : "No store-owned suborders are visible for the active seller scope yet.",
  };
};

const buildRevenueSnapshot = (suborders: any[], visible: boolean) => {
  if (!visible) {
    return {
      visible: false,
      paidGrossAmount: 0,
      averageOrderValue: 0,
      processingGrossAmount: 0,
      completedGrossAmount: 0,
      hint: "Revenue baseline is visible only to seller roles with ORDER_VIEW.",
      boundaryNote:
        "This seller baseline is operational only and does not replace admin payout or settlement authority.",
    };
  }

  const paidOrders = suborders.filter(
    (suborder) =>
      toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID" &&
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") !== "CANCELLED"
  );
  const processingOrders = paidOrders.filter((suborder) =>
    ["PROCESSING", "SHIPPED"].includes(
      toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED")
    )
  );
  const completedOrders = paidOrders.filter(
    (suborder) => toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") === "DELIVERED"
  );
  const paidGrossAmount = paidOrders.reduce(
    (sum, suborder) => sum + toNumber(getAttr(suborder, "totalAmount")),
    0
  );

  return {
    visible: true,
    paidGrossAmount,
    averageOrderValue: paidOrders.length > 0 ? paidGrossAmount / paidOrders.length : 0,
    processingGrossAmount: processingOrders.reduce(
      (sum, suborder) => sum + toNumber(getAttr(suborder, "totalAmount")),
      0
    ),
    completedGrossAmount: completedOrders.reduce(
      (sum, suborder) => sum + toNumber(getAttr(suborder, "totalAmount")),
      0
    ),
    hint:
      paidOrders.length > 0
        ? "Revenue baseline follows paid store-owned suborders after existing checkout discounts."
        : "No paid store-owned suborder is available for revenue baseline yet.",
    boundaryNote:
      "This seller baseline is operational only and does not replace admin payout, refund, dispute, or settlement authority.",
  };
};

const buildCouponSnapshot = (input: {
  coupons: any[];
  suborders: any[];
  visible: boolean;
  orderVisible: boolean;
}) => {
  if (!input.visible) {
    return {
      visible: false,
      totalCoupons: 0,
      activeCoupons: 0,
      scheduledCoupons: 0,
      expiredCoupons: 0,
      inactiveCoupons: 0,
      discountedOrders: 0,
      discountedPaidOrders: 0,
      hint: "Coupon analytics are visible only to seller roles with COUPON_VIEW.",
      boundaryNote:
        "This baseline tracks store coupon inventory and discounted-order activity only.",
    };
  }

  let activeCoupons = 0;
  let scheduledCoupons = 0;
  let expiredCoupons = 0;
  let inactiveCoupons = 0;

  for (const coupon of input.coupons) {
    const active = Boolean(getAttr(coupon, "active"));
    const { started, expired } = getCouponTimeWindow(coupon);

    if (!active) {
      inactiveCoupons += 1;
      continue;
    }

    if (!started) {
      scheduledCoupons += 1;
      continue;
    }

    if (expired) {
      expiredCoupons += 1;
      continue;
    }

    activeCoupons += 1;
  }

  const discountedOrders = input.orderVisible
    ? input.suborders.filter((suborder) => getDiscountAmount(suborder) > 0).length
    : 0;
  const discountedPaidOrders = input.orderVisible
    ? input.suborders.filter(
        (suborder) =>
          getDiscountAmount(suborder) > 0 &&
          toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") === "PAID" &&
          toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") !== "CANCELLED"
      ).length
    : 0;

  return {
    visible: true,
    totalCoupons: input.coupons.length,
    activeCoupons,
    scheduledCoupons,
    expiredCoupons,
    inactiveCoupons,
    discountedOrders,
    discountedPaidOrders,
    hint:
      input.coupons.length > 0
        ? "Coupon baseline tracks store-scoped coupon inventory plus discounted order activity inside the active seller scope."
        : "No store-scoped coupon exists for the active seller scope yet.",
    boundaryNote: input.orderVisible
      ? "Discounted-order counts are reliable. Modern checkout persists coupon code and scope per suborder, but legacy order paths still rely on parent-order coupon metadata only."
      : "Discounted-order counts are hidden unless the seller role can also view orders.",
  };
};

const buildTopProducts = (items: any[]) => {
  const map = new Map<
    number,
    {
      productId: number;
      name: string;
      slug: string | null;
      status: string;
      stock: number;
      qtySold: number;
      revenueAmount: number;
      storefrontVisible: boolean;
    }
  >();

  for (const item of items) {
    const suborder = getAttr(item, "suborder");
    if (!suborder) continue;

    if (toUpper(getAttr(suborder, "paymentStatus"), "UNPAID") !== "PAID") continue;
    if (toUpper(getAttr(suborder, "fulfillmentStatus"), "UNFULFILLED") === "CANCELLED") {
      continue;
    }

    const productId = toNumber(getAttr(item, "productId"));
    if (!productId) continue;

    const product = getAttr(item, "product");
    const current = map.get(productId) || {
      productId,
      name: String(getAttr(item, "productNameSnapshot") || `Product #${productId}`),
      slug: product ? String(getAttr(product, "slug") || "") || null : null,
      status: product ? String(getAttr(product, "status") || "unknown") : "snapshot_only",
      stock: product ? toNumber(getAttr(product, "stock")) : 0,
      qtySold: 0,
      revenueAmount: 0,
      storefrontVisible: false,
    };

    if (product) {
      const visibility = buildProductVisibilitySnapshot({
        isPublished: Boolean(getAttr(product, "isPublished")),
        status: getAttr(product, "status"),
        submissionStatus: getAttr(product, "sellerSubmissionStatus"),
        storeStatus: getAttr(getAttr(product, "store"), "status"),
        storeId: getAttr(product, "storeId"),
      });
      current.storefrontVisible = Boolean(visibility.storefrontVisible);
    }

    current.qtySold += toNumber(getAttr(item, "qty"));
    current.revenueAmount += toNumber(getAttr(item, "totalPrice"));
    map.set(productId, current);
  }

  return Array.from(map.values())
    .sort((left, right) => {
      if (right.revenueAmount !== left.revenueAmount) {
        return right.revenueAmount - left.revenueAmount;
      }
      return right.qtySold - left.qtySold;
    })
    .slice(0, 5);
};

const buildProductSnapshot = (input: {
  visible: boolean;
  orderVisible: boolean;
  productSummary: ReturnType<typeof emptyProductPipelineSummary>;
  topProductRows: any[];
}) => {
  if (!input.visible) {
    return {
      visible: false,
      totalProducts: 0,
      activeProducts: 0,
      draftProducts: 0,
      storefrontVisibleProducts: 0,
      reviewQueue: 0,
      topProducts: [],
      hint: "Product analytics are visible only to seller roles with PRODUCT_VIEW.",
    };
  }

  return {
    visible: true,
    totalProducts: input.productSummary.totalProducts,
    activeProducts: input.productSummary.active,
    draftProducts: input.productSummary.drafts,
    storefrontVisibleProducts: input.productSummary.storefrontVisible,
    reviewQueue: input.productSummary.reviewQueue,
    topProducts: input.orderVisible ? buildTopProducts(input.topProductRows) : [],
    hint: input.orderVisible
      ? "Top products are ranked from paid store-owned suborder items only."
      : "Catalog counts are visible, but top products are hidden until the seller role can also view orders.",
  };
};

const buildAnalyticsInsights = (input: {
  orderSnapshot: ReturnType<typeof buildOrderSnapshot>;
  revenueSnapshot: ReturnType<typeof buildRevenueSnapshot>;
  couponSnapshot: ReturnType<typeof buildCouponSnapshot>;
  couponAttributionSnapshot: ReturnType<typeof buildCouponAttributionSnapshot>;
  productSnapshot: ReturnType<typeof buildProductSnapshot>;
}) => {
  const insights = [];

  if (input.orderSnapshot.visible && input.orderSnapshot.pendingPaymentOrders > 0) {
    insights.push({
      code: "FOLLOW_PENDING_PAYMENTS",
      lane: "ORDERS",
      tone: "amber",
      label: `${input.orderSnapshot.pendingPaymentOrders} order(s) still wait for payment progress`,
      description:
        "Review pending and confirmation-stage suborders so they do not stall before fulfillment starts.",
    });
  }

  if (input.orderSnapshot.visible && input.orderSnapshot.processingOrders > 0) {
    insights.push({
      code: "MOVE_PROCESSING_ORDERS",
      lane: "ORDERS",
      tone: "emerald",
      label: `${input.orderSnapshot.processingOrders} paid order(s) still need fulfillment movement`,
      description:
        "Use the seller order lane to keep paid suborders moving from processing into shipped or delivered.",
    });
  }

  if (input.productSnapshot.visible && input.productSnapshot.reviewQueue > 0) {
    insights.push({
      code: "CLEAR_PRODUCT_QUEUE",
      lane: "CATALOG",
      tone: "sky",
      label: `${input.productSnapshot.reviewQueue} product(s) are still in the review queue`,
      description:
        "Catalog follow-up is still needed before these products become fully operational in the storefront.",
    });
  }

  if (
    input.couponSnapshot.visible &&
    input.couponSnapshot.totalCoupons > 0 &&
    input.couponSnapshot.activeCoupons === 0
  ) {
    insights.push({
      code: "ACTIVATE_STORE_COUPON",
      lane: "COUPONS",
      tone: "amber",
      label: "No store coupon is currently live",
      description:
        "The store already has coupon inventory, but none of it is active in the current validation window.",
    });
  }

  if (
    input.couponSnapshot.visible &&
    input.couponSnapshot.discountedPaidOrders > 0 &&
    input.revenueSnapshot.visible
  ) {
    insights.push({
      code: "CHECK_DISCOUNTED_PAID_ORDERS",
      lane: "COUPONS",
      tone: "sky",
      label: `${input.couponSnapshot.discountedPaidOrders} paid discounted order(s) already show promo activity`,
      description:
        "Discount activity is visible, and checkout-created suborders now persist coupon metadata. Legacy order paths still need a compatibility bridge before attribution can be treated as complete.",
    });
  }

  if (
    input.couponAttributionSnapshot.visible &&
    Array.isArray(input.couponAttributionSnapshot.topCouponCodes) &&
    input.couponAttributionSnapshot.topCouponCodes.length > 0
  ) {
    const topCoupon = input.couponAttributionSnapshot.topCouponCodes[0];
    insights.push({
      code: "WATCH_TOP_ATTRIBUTED_COUPON",
      lane: "COUPONS",
      tone: "sky",
      label: `${topCoupon.code} is the current top attributed coupon`,
      description: `It appears in ${topCoupon.attributedSuborders} visible discounted suborder(s) for the active store.`,
    });
  }

  if (
    input.productSnapshot.visible &&
    Array.isArray(input.productSnapshot.topProducts) &&
    input.productSnapshot.topProducts.length > 0
  ) {
    const topProduct = input.productSnapshot.topProducts[0];
    insights.push({
      code: "WATCH_TOP_PRODUCT",
      lane: "CATALOG",
      tone: "emerald",
      label: `${topProduct.name} is the current top paid product`,
      description: `It has already sold ${topProduct.qtySold} item(s) and leads the current paid product snapshot.`,
    });
  }

  if (!insights.length) {
    insights.push({
      code: "MONITOR_ANALYTICS_BASELINE",
      lane: "HOME",
      tone: "stone",
      label: "No urgent analytics follow-up is derived right now",
      description:
        "Use this baseline as a simple operational check-in for the active store, not as a BI or settlement report.",
    });
  }

  return insights.slice(0, 4);
};

const buildCouponAttributionReadiness = (input: {
  visible: boolean;
  orderVisible: boolean;
  couponSnapshot: ReturnType<typeof buildCouponSnapshot>;
  couponAttributionSnapshot: ReturnType<typeof buildCouponAttributionSnapshot>;
}) => {
  if (!input.visible) {
    return {
      visible: false,
      level: "HIDDEN",
      label: "Hidden",
      tone: "stone",
      summary: "Coupon attribution readiness is visible only to seller roles with COUPON_VIEW.",
      signals: [],
      recommendedNextStep: null,
      boundaryNote:
        "Coupon attribution readiness stays hidden when coupon visibility is outside the current seller role.",
    };
  }

  const canSeeDiscountActivity = input.orderVisible;
  const snapshot = input.couponAttributionSnapshot;

  return {
    visible: true,
    level: canSeeDiscountActivity ? "PARTIAL" : "FOUNDATION_ONLY",
    label: canSeeDiscountActivity ? "Partial readiness" : "Foundation only",
    tone: canSeeDiscountActivity ? "sky" : "stone",
    summary: canSeeDiscountActivity
      ? "Store coupon inventory and discounted-order activity are visible, and checkout-created suborders now keep coupon code plus scope. Legacy order paths still keep attribution partially at parent-order level."
      : "Coupon inventory is visible, but discounted-order attribution stays hidden until the seller role can also view orders.",
    signals: [
      {
        key: "single_store_order_coupon_code",
        label: "Single-store order coupon code",
        status: "READY",
        description:
          "Single-store order-level coupon code already persists on the parent order path.",
      },
      {
        key: "split_checkout_parent_coupon_code",
        label: "Multi-store parent order coupon code",
        status: "PARTIAL",
        description:
          "Split checkout can keep a parent-order coupon signal, but that is not enough for store-level seller attribution.",
      },
      {
        key: "split_checkout_suborder_coupon_code",
        label: "Multi-store suborder coupon code",
        status: "READY",
        description:
          "Checkout-created suborders now persist applied coupon code, scope, and coupon reference per store group.",
      },
      {
        key: "seller_snapshot_coverage",
        label: "Seller snapshot coverage",
        status:
          snapshot.visible && snapshot.unattributedDiscountedSuborders === 0
            ? "READY"
            : snapshot.visible && snapshot.attributedSuborders > 0
              ? "PARTIAL"
              : "FOUNDATION",
        description:
          snapshot.coverage?.note ||
          "Coverage is still limited until checkout-created suborders carry coupon metadata consistently.",
      },
    ],
    recommendedNextStep:
      "Backfill or bridge legacy order paths that only keep Order.couponCode, then expose a seller-safe coupon attribution snapshot from suborder-level metadata.",
    boundaryNote:
      "This readiness block is a technical attribution note only. It does not change public coupon validation or admin coupon governance today.",
  };
};

export const loadSellerWorkspaceAnalyticsSummary = async (input: {
  storeId: number;
  sellerAccess: any;
}) => {
  const { storeId, sellerAccess } = input;
  const canViewOrders = sellerHasPermission(sellerAccess, "ORDER_VIEW");
  const canViewProducts = sellerHasPermission(sellerAccess, "PRODUCT_VIEW");
  const canViewCoupons = sellerHasPermission(sellerAccess, "COUPON_VIEW");

  const [suborders, coupons, productSummaryMap, topProductRows] = await Promise.all([
    canViewOrders
      ? Suborder.findAll({
          where: { storeId },
          attributes: [
            "id",
            "storeId",
            "appliedCouponId",
            "appliedCouponCode",
            "appliedCouponScopeType",
            "subtotalAmount",
            "shippingAmount",
            "serviceFeeAmount",
            "totalAmount",
            "paymentStatus",
            "fulfillmentStatus",
            "createdAt",
          ],
          order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
          ],
        })
      : Promise.resolve([]),
    canViewCoupons
      ? Coupon.findAll({
          where: {
            scopeType: "STORE",
            storeId,
          },
          attributes: [
            "id",
            "code",
            "active",
            "startsAt",
            "expiresAt",
            "storeId",
            "scopeType",
            "createdAt",
          ],
          order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
          ],
        })
      : Promise.resolve([]),
    canViewProducts
      ? loadProductPipelineSummaryByStoreIds([storeId])
      : Promise.resolve(new Map()),
    canViewOrders && canViewProducts
      ? SuborderItem.findAll({
          where: { storeId },
          attributes: [
            "id",
            "productId",
            "productNameSnapshot",
            "qty",
            "totalPrice",
            "createdAt",
          ],
          include: [
            {
              model: Suborder,
              as: "suborder",
              attributes: ["id", "paymentStatus", "fulfillmentStatus"],
              required: true,
            },
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "slug",
                "status",
                "stock",
                "isPublished",
                "sellerSubmissionStatus",
                "storeId",
              ],
              include: [
                {
                  association: "store",
                  attributes: ["id", "status"],
                  required: false,
                },
              ],
              required: false,
            },
          ],
          order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
          ],
        })
      : Promise.resolve([]),
  ]);

  const productSummary =
    (canViewProducts ? productSummaryMap.get(storeId) : null) || emptyProductPipelineSummary();
  const orderSnapshot = buildOrderSnapshot(suborders, canViewOrders);
  const revenueSnapshot = buildRevenueSnapshot(suborders, canViewOrders);
  const couponSnapshot = buildCouponSnapshot({
    coupons,
    suborders,
    visible: canViewCoupons,
    orderVisible: canViewOrders,
  });
  const couponAttributionSnapshot = buildCouponAttributionSnapshot({
    visible: canViewCoupons,
    orderVisible: canViewOrders,
    suborders,
  });
  const productSnapshot = buildProductSnapshot({
    visible: canViewProducts,
    orderVisible: canViewOrders,
    productSummary,
    topProductRows,
  });
  const insights = buildAnalyticsInsights({
    orderSnapshot,
    revenueSnapshot,
    couponSnapshot,
    couponAttributionSnapshot,
    productSnapshot,
  });
  const couponAttributionReadiness = buildCouponAttributionReadiness({
    visible: canViewCoupons,
    orderVisible: canViewOrders,
    couponSnapshot,
    couponAttributionSnapshot,
  });

  return {
    store: buildStoreSummary(sellerAccess),
    orderSnapshot,
    revenueSnapshot,
    couponSnapshot,
    couponAttributionSnapshot,
    productSnapshot,
    insights,
    couponAttributionReadiness,
    boundaries: {
      tenantScope:
        "Seller analytics is strictly tenant-scoped to the active seller store from the route context.",
      adminAuthority:
        "Admin remains the authority for cross-store reporting, finance governance, and any future payout or BI interpretation beyond this seller baseline.",
      storefrontBoundary:
        "Storefront availability, coupon validation, and order creation still follow their own source-of-truth backend contracts. This page is only a seller read model.",
    },
  };
};

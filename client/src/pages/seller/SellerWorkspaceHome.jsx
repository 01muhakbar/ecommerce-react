import { Component, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CreditCard,
  FolderPlus,
  Lock,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  WalletCards,
} from "lucide-react";
import KPIOverviewCards from "../../components/dashboard/KPIOverviewCards.jsx";
import OrderStatusCards from "../../components/dashboard/OrderStatusCards.jsx";
import {
  getSellerAnalyticsSummary,
  getSellerFinanceSummary,
  getSellerWorkspaceReadiness,
} from "../../api/sellerWorkspace.ts";
import { getSellerProductAuthoringMeta } from "../../api/sellerProducts.ts";
import { getSellerSuborders } from "../../api/sellerOrders.ts";
import {
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceSectionCard,
  SellerWorkspaceStatePanel,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { formatCurrency } from "../../utils/format.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import "../Dashboard.css";
import WeeklySalesCard from "../../components/dashboard/WeeklySalesCard.jsx";
import BestSellingCard from "../../components/dashboard/BestSellingCard.jsx";

const joinClassNames = (...items) => items.filter(Boolean).join(" ");
const SELLER_WEEKLY_WINDOW_DAYS = 7;
const SELLER_WEEKLY_QUERY_LIMIT = 200;
const SELLER_PAID_PAYMENT_CODES = new Set(["PAID"]);
const SELLER_SHORT_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const heroPrimaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100";

const heroSecondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white transition hover:bg-white/15";

const SELLER_OVERVIEW_LABEL_MAP = {
  today: "Paid Revenue",
  yesterday: "Eligible Paid Gross",
  "this-month": "Completed Revenue",
  "last-month": "In-Flight Revenue",
  "all-time": "Average Order Value",
};

const SELLER_OVERVIEW_STATUS_LABEL_MAP = {
  total: "Total Orders",
  pending: "Awaiting Review",
  processing: "Processing / Shipped",
  completed: "Orders Delivered",
};

const priorityToneClass = (tone) =>
  tone === "emerald"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50"
        : tone === "sky"
          ? "border-sky-200 bg-sky-50"
          : "border-slate-200 bg-slate-50";

const routeByLane = (workspaceRoutes, lane) => {
  if (lane === "PAYMENT_PROFILE") return workspaceRoutes.paymentProfile();
  if (lane === "PAYMENT_REVIEW") return workspaceRoutes.paymentReview();
  if (lane === "ORDERS") return workspaceRoutes.orders();
  if (lane === "CATALOG") return workspaceRoutes.catalog();
  if (lane === "COUPONS") return workspaceRoutes.coupons();
  if (lane === "STORE_PROFILE") return workspaceRoutes.storeProfile();
  return workspaceRoutes.home();
};

const toDateKey = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString().slice(0, 10);
};

const getRecentDayBuckets = (days = SELLER_WEEKLY_WINDOW_DAYS) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: SELLER_SHORT_DAY_FORMATTER.format(date),
    };
  });
};

const buildSellerWeeklyTrendSeries = (items = []) => {
  const buckets = getRecentDayBuckets();
  const salesByDay = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const ordersByDay = new Map(buckets.map((bucket) => [bucket.key, 0]));

  items.forEach((item) => {
    const createdKey = toDateKey(item?.createdAt || item?.order?.createdAt);
    if (createdKey && ordersByDay.has(createdKey)) {
      ordersByDay.set(createdKey, Number(ordersByDay.get(createdKey) || 0) + 1);
    }

    const paymentCode = String(item?.paymentSummary?.status || item?.paymentStatus || "")
      .trim()
      .toUpperCase();
    if (!SELLER_PAID_PAYMENT_CODES.has(paymentCode)) return;

    const paidKey = toDateKey(item?.paymentSummary?.paidAt || item?.paidAt || item?.createdAt);
    if (paidKey && salesByDay.has(paidKey)) {
      salesByDay.set(
        paidKey,
        Number(salesByDay.get(paidKey) || 0) + Number(item?.totalAmount || 0)
      );
    }
  });

  return {
    sales: buckets.map((bucket) => ({
      name: bucket.key,
      label: bucket.label,
      value: Number(salesByDay.get(bucket.key) || 0),
    })),
    orders: buckets.map((bucket) => ({
      name: bucket.key,
      label: bucket.label,
      value: Number(ordersByDay.get(bucket.key) || 0),
    })),
  };
};

const getRoleFocusLabel = ({
  canViewOrders,
  canViewPaymentReview,
  canViewPaymentProfile,
  canCreateProduct,
  canEditStore,
}) => {
  if (canViewOrders && canViewPaymentReview && canViewPaymentProfile) {
    return "Full seller command view";
  }
  if (canViewOrders && canViewPaymentReview) {
    return "Orders and payment review";
  }
  if (canViewOrders) {
    return "Order operations";
  }
  if (canViewPaymentProfile) {
    return "Finance setup visibility";
  }
  if (canCreateProduct) {
    return "Catalog execution";
  }
  if (canEditStore) {
    return "Store identity and storefront";
  }
  return "Store overview";
};

const getPrimaryFocus = ({
  canViewOrders,
  canViewPaymentReview,
  canViewPaymentProfile,
  canEditStore,
  paymentReadiness,
  paymentReviewCounts,
  eligiblePaidSummary,
  suborderSummary,
}) => {
  if ((paymentReviewCounts?.awaitingReview || 0) > 0 && canViewPaymentReview) {
    return {
      label: "Review incoming payment proofs",
      hint: `${paymentReviewCounts.awaitingReview} record(s) still need attention today.`,
      tone: "amber",
    };
  }

  if (
    canViewPaymentProfile &&
    paymentReadiness?.visible &&
    !paymentReadiness?.isReady &&
    paymentReadiness?.nextStep?.label
  ) {
    return {
      label: paymentReadiness.nextStep.label,
      hint:
        paymentReadiness.nextStep.description ||
        paymentReadiness.description ||
        "Payment setup still needs follow-up.",
      tone: paymentReadiness.tone || "amber",
    };
  }

  if ((eligiblePaidSummary?.awaitingFulfillmentCount || 0) > 0 && canViewOrders) {
    return {
      label: "Follow up paid store splits",
      hint: `${eligiblePaidSummary.awaitingFulfillmentCount} paid store split(s) are still waiting for fulfillment progress.`,
      tone: "amber",
    };
  }

  if ((suborderSummary?.pendingConfirmationCount || 0) > 0 && canViewOrders) {
    return {
      label: "Watch payment confirmations",
      hint: `${suborderSummary.pendingConfirmationCount} order(s) are still waiting for payment confirmation.`,
      tone: "amber",
    };
  }

  if (!canViewOrders && !canViewPaymentProfile && canEditStore) {
    return {
      label: "Keep store details up to date",
      hint: "This role mainly supports store identity and storefront information.",
      tone: "sky",
    };
  }

  return {
    label: "Monitor the active store",
    hint: "No urgent issue is showing right now. Use this page as your quick seller check-in.",
    tone: "sky",
  };
};

const getFallbackActions = ({
  canViewStore,
  canViewOrders,
  canViewPaymentReview,
  canViewPaymentProfile,
  canCreateProduct,
  canEditStore,
  workspaceRoutes,
  paymentReadiness,
}) => {
  const actions = [];

  if (!canViewOrders && !canViewPaymentProfile && canEditStore) {
    actions.push({
      code: "STORE_PROFILE_FOCUS",
      label: "Review store profile",
      description:
        "Your role is centered on store identity and storefront information. Keep those details complete and current.",
      tone: "sky",
      priority: "today",
      to: workspaceRoutes.storeProfile(),
    });
  }

  if (
    canViewPaymentProfile &&
    paymentReadiness?.visible &&
    ["NOT_CONFIGURED", "INCOMPLETE", "REJECTED", "INACTIVE"].includes(
      paymentReadiness.code
    )
  ) {
    actions.push({
      code: "PAYMENT_SETUP_FOCUS",
      label: paymentReadiness.nextStep?.label || "Review payment setup",
      description:
        paymentReadiness.nextStep?.description ||
        paymentReadiness.description ||
        "Open the payment setup page to understand what is still blocking readiness.",
      tone: paymentReadiness.tone || "amber",
      priority: "today",
      to: workspaceRoutes.paymentProfile(),
    });
  }

  if (canViewPaymentReview) {
    actions.push({
      code: "PAYMENT_REVIEW_MONITOR",
      label: "Open payment review lane",
      description:
        "Check new buyer payment proofs as they come in for the active store.",
      tone: "amber",
      priority: "monitor",
      to: workspaceRoutes.paymentReview(),
    });
  }

  if (canViewOrders) {
    actions.push({
      code: "ORDERS_MONITOR",
      label: "Check current orders",
      description:
        "Track payment progress and fulfillment movement for store-owned suborders.",
      tone: "emerald",
      priority: "monitor",
      to: workspaceRoutes.orders(),
    });
  }

  if (canCreateProduct) {
    actions.push({
      code: "NEW_PRODUCT",
      label: "Add a new product",
      description:
        "Open the product authoring flow if the store needs a new catalog draft.",
      tone: "sky",
      priority: "optional",
      to: workspaceRoutes.productCreate(),
    });
  }

  if (canViewStore && actions.length === 0) {
    actions.push({
      code: "STORE_HOME_MONITOR",
      label: "Review this store snapshot",
      description:
        "Use the quick links below to move into the seller lanes available to your role.",
      tone: "sky",
      priority: "monitor",
      to: workspaceRoutes.home(),
    });
  }

  return actions;
};

const getQuickLinks = ({
  canViewStore,
  canEditStore,
  canViewCatalog,
  canCreateProduct,
  canViewOrders,
  canViewPaymentReview,
  canViewPaymentProfile,
  workspaceRoutes,
}) => [
  {
    key: "orders",
    label: "Orders",
    description: "Track paid, pending, and fulfilled store orders.",
    to: workspaceRoutes.orders(),
    enabled: canViewOrders,
    Icon: ShoppingBag,
    reason: "Order handling is reserved for roles with order access.",
  },
  {
    key: "payment-review",
    label: "Payment Review",
    description: "Review buyer payment proofs for the active store.",
    to: workspaceRoutes.paymentReview(),
    enabled: canViewPaymentReview,
    Icon: BadgeCheck,
    reason: "Payment review is limited to roles with order and finance review access.",
  },
  {
    key: "payment-profile",
    label: "Payment Setup",
    description: "See whether store payment setup is ready to operate.",
    to: workspaceRoutes.paymentProfile(),
    enabled: canViewPaymentProfile,
    Icon: CreditCard,
    reason: "Payment setup visibility is limited to finance-capable roles.",
  },
  {
    key: "catalog",
    label: "Catalog",
    description: "Open the current product list for this store.",
    to: workspaceRoutes.catalog(),
    enabled: canViewCatalog,
    Icon: Package,
    reason: "Catalog visibility belongs to product-capable roles.",
  },
  {
    key: "new-product",
    label: "New Product",
    description: "Start a fresh product draft in seller workspace.",
    to: workspaceRoutes.productCreate(),
    enabled: canCreateProduct,
    Icon: FolderPlus,
    reason: "Product creation is limited to catalog-capable roles.",
  },
  {
    key: "store-profile",
    label: "Store Profile",
    description: canEditStore
      ? "Update store identity, contact, and profile details."
      : "Review store identity, contact, and profile details.",
    to: workspaceRoutes.storeProfile(),
    enabled: canViewStore,
    Icon: Store,
    reason: "Store profile is available only when store visibility is granted.",
  },
];

function EmptyStateNotice({ title, description, ctaLabel, to, type = "info" }) {
  return (
    <SellerWorkspaceNotice type={type}>
      <div className="space-y-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 leading-6">{description}</p>
        </div>
        {to && ctaLabel ? (
          <Link
            to={to}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 underline"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </SellerWorkspaceNotice>
  );
}

class SellerWorkspaceHomeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("SellerWorkspaceHome crashed", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SellerWorkspaceStatePanel
          title="Seller overview is temporarily unavailable"
          description="The dashboard hit a render error. Reload the page to try again."
          tone="error"
          Icon={Store}
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={sellerSecondaryButtonClass}
            >
              Reload dashboard
            </button>
          }
        />
      );
    }

    return this.props.children;
  }
}

function SellerWorkspaceHomeContent() {
  const { sellerContext, workspaceStoreId: storeId, workspaceRoutes } =
    useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const hasPermission = (permissionKey) => permissionKeys.includes(permissionKey);
  const canViewStore = hasPermission("STORE_VIEW");
  const canEditStore = hasPermission("STORE_EDIT");
  const canViewCatalog = hasPermission("PRODUCT_VIEW");
  const canCreateProduct = hasPermission("PRODUCT_CREATE");
  const canViewCoupons = hasPermission("COUPON_VIEW");
  const canViewOrders = hasPermission("ORDER_VIEW");
  const canViewPaymentReview = canViewOrders && hasPermission("PAYMENT_STATUS_VIEW");
  const canViewPaymentProfile = hasPermission("PAYMENT_PROFILE_VIEW");
  const hasOperationalAccess =
    canViewOrders || canViewPaymentReview || canViewPaymentProfile;

  const financeSummaryQuery = useQuery({
    queryKey: ["seller", "workspace", "finance-summary", storeId],
    queryFn: () => getSellerFinanceSummary(storeId),
    enabled: Boolean(storeId) && canViewStore,
    retry: false,
  });

  const readinessQuery = useQuery({
    queryKey: ["seller", "workspace", "readiness", storeId],
    queryFn: () => getSellerWorkspaceReadiness(storeId),
    enabled: Boolean(storeId) && canViewStore,
    retry: false,
  });

  const analyticsQuery = useQuery({
    queryKey: ["seller", "workspace", "analytics-summary", storeId],
    queryFn: () => getSellerAnalyticsSummary(storeId),
    enabled: Boolean(storeId) && canViewStore,
    retry: false,
  });

  const weeklySalesQuery = useQuery({
    queryKey: ["seller", "workspace", "weekly-sales-panel", storeId],
    queryFn: () =>
      getSellerSuborders(storeId, {
        page: 1,
        limit: SELLER_WEEKLY_QUERY_LIMIT,
      }),
    enabled: Boolean(storeId) && canViewOrders,
    retry: false,
  });

  const productAuthoringQuery = useQuery({
    queryKey: ["seller", "workspace", "product-authoring-meta", storeId],
    queryFn: () => getSellerProductAuthoringMeta(storeId),
    enabled: Boolean(storeId) && canViewCatalog && canCreateProduct,
    retry: false,
  });

  const canCreateProductDraft =
    canCreateProduct &&
    Boolean(productAuthoringQuery.data?.governance?.authoring?.canCreateDraft);

  const quickLinkCatalog = useMemo(
    () =>
      getQuickLinks({
        canViewStore,
        canEditStore,
        canViewCatalog,
        canCreateProduct: canCreateProductDraft,
        canViewOrders,
        canViewPaymentReview,
        canViewPaymentProfile,
        workspaceRoutes,
      }),
    [
      canCreateProductDraft,
      canEditStore,
      canViewCatalog,
      canViewOrders,
      canViewPaymentProfile,
      canViewPaymentReview,
      canViewStore,
      workspaceRoutes,
    ]
  );

  const summary = financeSummaryQuery.data;
  const readiness = readinessQuery.data;
  const analytics = analyticsQuery.data;
  const readinessSummary = readiness?.summary;
  const readinessChecklist = Array.isArray(readiness?.checklist) ? readiness.checklist : [];
  const readinessNextStep = readiness?.nextStep;
  const storeProfileChecklist = readinessChecklist.find((item) => item.key === "store_profile");
  const shippingSetupChecklist = readinessChecklist.find((item) => item.key === "shipping_setup");
  const paymentChecklist = readinessChecklist.find((item) => item.key === "payment_profile");
  const productChecklist = readinessChecklist.find((item) => item.key === "products");
  const paymentReadiness = summary?.paymentProfileReadiness;
  const paymentReviewCounts = summary?.paymentReviewCounts;
  const suborderSummary = summary?.suborderPaymentSummary;
  const eligiblePaidSummary = summary?.eligiblePaidSubordersSummary;
  const analyticsOrderSnapshot = analytics?.orderSnapshot;
  const analyticsRevenueSnapshot = analytics?.revenueSnapshot;
  const analyticsCouponSnapshot = analytics?.couponSnapshot;
  const analyticsCouponAttributionSnapshot = analytics?.couponAttributionSnapshot;
  const analyticsProductSnapshot = analytics?.productSnapshot;
  const couponAttributionReadiness = analytics?.couponAttributionReadiness;
  const backendActions = Array.isArray(summary?.nextActions) ? summary.nextActions : [];
  const weeklyPanelItems = Array.isArray(weeklySalesQuery.data?.items) ? weeklySalesQuery.data.items : [];
  const primaryFocus = getPrimaryFocus({
    canViewOrders,
    canViewPaymentReview,
    canViewPaymentProfile,
    canEditStore,
    paymentReadiness,
    paymentReviewCounts,
    eligiblePaidSummary,
    suborderSummary,
  });
  const roleFocusLabel = getRoleFocusLabel({
    canViewOrders,
    canViewPaymentReview,
    canViewPaymentProfile,
    canCreateProduct: canCreateProductDraft,
    canEditStore,
  });

  const priorityActions = useMemo(() => {
    const readinessActions =
      readinessNextStep && readinessNextStep.code !== "NO_ACTION_REQUIRED"
        ? [
            {
              code: `WORKSPACE_${readinessNextStep.code}`,
              lane: readinessNextStep.lane,
              priority: "high",
              tone: readinessSummary?.tone || "sky",
              label: readinessNextStep.label,
              description: readinessNextStep.description,
            },
          ]
        : [];

    const normalized = [...readinessActions, ...backendActions]
      .map((action) => ({
        ...action,
        priority: action.priority || "today",
        to: routeByLane(workspaceRoutes, action.lane),
      }))
      .filter(Boolean);

    const fallback = getFallbackActions({
      canViewStore,
      canViewOrders,
      canViewPaymentReview,
      canViewPaymentProfile,
      canCreateProduct: canCreateProductDraft,
      canEditStore,
      workspaceRoutes,
      paymentReadiness,
    });

    const unique = [];
    const seen = new Set();
    for (const item of [...normalized, ...fallback]) {
      if (!item?.code || seen.has(item.code)) continue;
      seen.add(item.code);
      unique.push(item);
    }

    return unique.slice(0, 4);
  }, [
    backendActions,
    canCreateProductDraft,
    canEditStore,
    canViewOrders,
    canViewPaymentProfile,
    canViewPaymentReview,
    canViewStore,
    readinessNextStep,
    readinessSummary?.tone,
    paymentReadiness,
    workspaceRoutes,
  ]);

  const sellerOverviewPrimaryItems = useMemo(
    () => [
      {
        id: "today",
        label: "Paid Revenue",
        variant: "teal",
        icon: WalletCards,
        value: analyticsRevenueSnapshot?.paidGrossAmount || 0,
        displayValue: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "Unavailable"
            : analyticsRevenueSnapshot?.visible
              ? undefined
              : "Limited",
      },
      {
        id: "yesterday",
        label: "Eligible Paid Gross",
        variant: "orange",
        icon: CreditCard,
        value: eligiblePaidSummary?.grossAmount || 0,
        displayValue: analyticsQuery.isLoading
          ? "..."
          : eligiblePaidSummary?.visible
            ? undefined
            : canViewOrders
              ? formatCurrency(eligiblePaidSummary?.grossAmount || 0)
              : "Limited",
      },
      {
        id: "this-month",
        label: "Completed Revenue",
        variant: "blue",
        icon: BadgeCheck,
        value: analyticsRevenueSnapshot?.completedGrossAmount || 0,
        displayValue: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "Unavailable"
            : analyticsRevenueSnapshot?.visible
              ? undefined
              : "Limited",
      },
      {
        id: "last-month",
        label: "In-Flight Revenue",
        variant: "teal-light",
        icon: ShoppingBag,
        value: analyticsRevenueSnapshot?.processingGrossAmount || 0,
        displayValue: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "Unavailable"
            : analyticsRevenueSnapshot?.visible
              ? undefined
              : "Limited",
      },
      {
        id: "all-time",
        label: "Average Order Value",
        variant: "green",
        icon: BarChart3,
        value: analyticsRevenueSnapshot?.averageOrderValue || 0,
        displayValue: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "Unavailable"
            : analyticsRevenueSnapshot?.visible
              ? undefined
              : "Limited",
      },
    ],
    [
      analyticsQuery.isError,
      analyticsQuery.isLoading,
      analyticsRevenueSnapshot,
      canViewOrders,
      eligiblePaidSummary,
    ]
  );

  const sellerOverviewStatusItems = useMemo(
    () => [
      {
        id: "total",
        label: "Total Orders",
        count: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "—"
            : analyticsOrderSnapshot?.visible
              ? String(analyticsOrderSnapshot.totalOrders || 0)
              : "—",
      },
      {
        id: "pending",
        label: "Awaiting Review",
        count: financeSummaryQuery.isLoading
          ? "..."
          : canViewPaymentReview
            ? String(paymentReviewCounts?.awaitingReview || 0)
            : "—",
      },
      {
        id: "processing",
        label: "Processing / Shipped",
        count: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "—"
            : analyticsOrderSnapshot?.visible
              ? String(analyticsOrderSnapshot.processingOrders || 0)
              : "—",
      },
      {
        id: "completed",
        label: "Orders Delivered",
        count: analyticsQuery.isLoading
          ? "..."
          : analyticsQuery.isError
            ? "—"
            : analyticsOrderSnapshot?.visible
              ? String(analyticsOrderSnapshot.completedOrders || 0)
              : "—",
      },
    ],
    [
      analyticsOrderSnapshot,
      analyticsQuery.isError,
      analyticsQuery.isLoading,
      canViewPaymentReview,
      financeSummaryQuery.isLoading,
      paymentReviewCounts,
    ]
  );

  const sellerWeeklySeries = useMemo(
    () => buildSellerWeeklyTrendSeries(weeklyPanelItems),
    [weeklyPanelItems]
  );

  const sellerBestSellingItems = useMemo(
    () =>
      analyticsProductSnapshot?.visible
        ? (analyticsProductSnapshot.topProducts || []).slice(0, 5).map((product) => ({
            name: product.name || `Product #${product.productId || "-"}`,
            value: Number(product.qtySold || 0),
            revenue: Number(product.revenueAmount || 0),
          }))
        : [],
    [analyticsProductSnapshot]
  );

  const sellerWeeklySalesError = !canViewOrders
    ? "Weekly sales follow seller order visibility."
    : weeklySalesQuery.isError
      ? getSellerRequestErrorMessage(weeklySalesQuery.error, {
          permissionMessage: "Weekly sales are outside the current seller role.",
          fallbackMessage: "Failed to load weekly sales.",
        })
      : "";

  const sellerBestSellingError = analyticsQuery.isError
    ? getSellerRequestErrorMessage(analyticsQuery.error, {
        permissionMessage: "Best selling products are outside the current seller role.",
        fallbackMessage: "Failed to load best selling products.",
      })
    : !analyticsProductSnapshot?.visible
      ? "Best selling products follow seller catalog visibility."
      : "";

  if (!canViewStore) {
    return (
      <SellerWorkspaceStatePanel
        title="Workspace overview is unavailable"
        description="Your current seller access does not include store overview visibility."
        tone="error"
        Icon={Store}
      />
    );
  }

  if (financeSummaryQuery.isLoading || readinessQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading seller workspace home"
        description="Fetching the current store summary so you can see what needs attention first."
        Icon={Store}
      />
    );
  }

  if (financeSummaryQuery.isError || readinessQuery.isError) {
    const error = financeSummaryQuery.error || readinessQuery.error;
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller workspace home"
        description={getSellerRequestErrorMessage(error, {
          permissionMessage:
            "Your current seller access does not include seller workspace home visibility.",
          fallbackMessage: "Failed to load seller workspace home.",
        })}
        tone="error"
        Icon={Store}
      />
    );
  }

  const enabledQuickLinks = quickLinkCatalog.filter((entry) => entry.enabled);
  const lockedQuickLinks = quickLinkCatalog
    .filter((entry) => !entry.enabled)
    .slice(0, enabledQuickLinks.length >= 4 ? 0 : Math.min(2, 4 - enabledQuickLinks.length));
  const quickLinksToRender = [...enabledQuickLinks, ...lockedQuickLinks];

  return (
    <div className="space-y-5">
      <section className="dashboard dashboard--seller">
        <div className="dashboard-shell-header">
          <div className="dashboard-shell-header__copy">
            <h1>Dashboard Overview</h1>
          </div>
        </div>

        <KPIOverviewCards
          items={sellerOverviewPrimaryItems}
          labelMap={SELLER_OVERVIEW_LABEL_MAP}
          formatMoney={formatCurrency}
        />

        <OrderStatusCards
          items={sellerOverviewStatusItems}
          labelMap={SELLER_OVERVIEW_STATUS_LABEL_MAP}
          iconStyle="admin-acuan"
        />
      </section>

      <section className="dashboard-charts seller-analytics-panels">
        <WeeklySalesCard
          salesData={sellerWeeklySeries.sales}
          ordersData={sellerWeeklySeries.orders}
          isLoading={weeklySalesQuery.isLoading}
          error={sellerWeeklySalesError}
          formatMoney={formatCurrency}
        />
        <BestSellingCard
          items={sellerBestSellingItems}
          isLoading={analyticsQuery.isLoading}
          error={sellerBestSellingError}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {canEditStore ? (
          <Link to={workspaceRoutes.storeProfile()} className={sellerPrimaryButtonClass}>
            <Store className="h-4 w-4" />
            Complete Profile
          </Link>
        ) : (
          <div className={`${sellerSecondaryButtonClass} opacity-60`}>
            <Store className="h-4 w-4" />
            Complete Profile
          </div>
        )}
        {canViewPaymentProfile ? (
          <Link to={workspaceRoutes.paymentProfile()} className={sellerSecondaryButtonClass}>
            <CreditCard className="h-4 w-4" />
            Setup Payment
          </Link>
        ) : (
          <div className={`${sellerSecondaryButtonClass} opacity-60`}>
            <CreditCard className="h-4 w-4" />
            Setup Payment
          </div>
        )}
        {canCreateProductDraft ? (
          <Link to={workspaceRoutes.productCreate()} className={sellerSecondaryButtonClass}>
            <FolderPlus className="h-4 w-4" />
            Add Product
          </Link>
        ) : (
          <div className={`${sellerSecondaryButtonClass} opacity-60`}>
            <FolderPlus className="h-4 w-4" />
            Add Product
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SellerWorkspacePanel className="overflow-hidden border-slate-900 bg-[linear-gradient(135deg,#0f172a_0%,#111827_52%,#164e63_100%)] px-4 py-4 text-white sm:px-5">
          <div className="flex h-full flex-col justify-between gap-5">
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <SellerWorkspaceBadge
                  label="Seller Home"
                  tone="stone"
                  className="border-white/10 bg-white/10 text-white"
                />
                <SellerWorkspaceBadge
                  label={summary?.store?.status || sellerContext?.store?.status || "ACTIVE"}
                  tone="stone"
                  className="border-white/10 bg-white/10 text-white"
                />
                {readinessSummary ? (
                  <SellerWorkspaceBadge
                    label={readinessSummary.label}
                    tone="stone"
                    className="border-white/10 bg-white/10 text-white"
                  />
                ) : null}
                <SellerWorkspaceBadge
                  label={summary?.store?.roleCode || sellerContext?.access?.roleCode || "SELLER"}
                  tone="stone"
                  className="border-white/10 bg-white/10 text-white"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/60">
                  Command Center
                </p>
                <h2 className="mt-2 text-[1.9rem] font-semibold tracking-tight">
                  {summary?.store?.name || sellerContext?.store?.name || "Seller Workspace"}
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Payment Setup
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {paymentReadiness?.label || primaryFocus.label}
                    </p>
                    {canViewPaymentProfile ? (
                      <Link to={workspaceRoutes.paymentProfile()} className="text-xs font-semibold text-white/80 hover:text-white">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Role
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {summary?.store?.roleCode || sellerContext?.access?.roleCode || roleFocusLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Scope
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {summary?.store?.slug || sellerContext?.store?.slug || "store"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {canViewOrders ? (
                <Link to={workspaceRoutes.orders()} className={heroPrimaryButtonClass}>
                  <ShoppingBag className="h-4 w-4" />
                  Open Orders
                </Link>
              ) : null}
              {canViewPaymentReview ? (
                <Link to={workspaceRoutes.paymentReview()} className={heroSecondaryButtonClass}>
                  <BadgeCheck className="h-4 w-4" />
                  Review Payments
                </Link>
              ) : null}
              {!canViewOrders && canEditStore ? (
                <Link to={workspaceRoutes.storeProfile()} className={heroPrimaryButtonClass}>
                  <Store className="h-4 w-4" />
                  Review Store Profile
                </Link>
              ) : null}
            </div>
          </div>
        </SellerWorkspacePanel>

        <SellerWorkspaceSectionCard
          title="What needs attention"
          Icon={ShieldCheck}
        >
          <div className="space-y-3">
            {priorityActions.map((action, index) => (
              <Link
                key={action.code}
                to={action.to}
                className={joinClassNames(
                  "block rounded-2xl border px-4 py-4 transition hover:border-slate-300",
                  priorityToneClass(action.tone)
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {action.label}
                      </p>
                      <SellerWorkspaceBadge label={action.priority} tone={action.tone} />
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <SellerWorkspaceSectionCard
          title="Workspace readiness"
          Icon={ShieldCheck}
          actions={[
            <SellerWorkspaceBadge
              key="readiness-status"
              label={readinessSummary?.label || "In progress"}
              tone={readinessSummary?.tone || "stone"}
            />,
            <SellerWorkspaceBadge
              key="readiness-progress"
              label={`${readinessSummary?.completedItems || 0}/${readinessSummary?.totalItems || 0} ready`}
              tone={readinessSummary?.completionPercent === 100 ? "emerald" : "sky"}
            />,
          ]}
        >
          <p className="text-[2rem] font-semibold leading-none text-slate-900">
            {readinessSummary?.completionPercent || 0}%
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">ready</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SellerWorkspaceDetailItem
              label="Store Profile"
              value={storeProfileChecklist?.status?.label || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Shipping Setup"
              value={shippingSetupChecklist?.status?.label || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Payment Profile"
              value={paymentChecklist?.status?.label || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Products"
              value={productChecklist?.status?.label || "-"}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Onboarding checklist"
          Icon={Store}
        >
          <div className="space-y-3">
            {readinessChecklist.map((item, index) => {
              const to = item?.cta ? routeByLane(workspaceRoutes, item.cta.lane) : workspaceRoutes.home();
              return (
                <div
                  key={item.key || index}
                  className={joinClassNames(
                    "rounded-2xl border px-4 py-4",
                    priorityToneClass(item.status?.tone)
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.label}
                        </p>
                        <SellerWorkspaceBadge
                          label={item.status?.label || "Unknown"}
                          tone={item.status?.tone || "stone"}
                        />
                        {item.infoOnly ? (
                          <SellerWorkspaceBadge label="Info only" tone="sky" />
                        ) : null}
                      </div>
                      {item.progress?.total ? (
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          {item.progress.completed}/{item.progress.total}
                        </p>
                      ) : null}
                    </div>
                    {item.cta ? (
                      <Link
                        to={to}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        {item.cta.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="space-y-5">
        <SellerWorkspaceSectionCard
          title="Analytics baseline"
          Icon={BarChart3}
          actions={[
            <SellerWorkspaceBadge
              key="analytics-scope"
              label={analytics?.store?.slug || summary?.store?.slug || sellerContext?.store?.slug || "store"}
              tone="sky"
            />,
          ]}
        >
          {analyticsQuery.isLoading ? (
            <SellerWorkspaceNotice type="info">
              Loading seller analytics baseline for the active store.
            </SellerWorkspaceNotice>
          ) : analyticsQuery.isError ? (
            <SellerWorkspaceNotice type="warning">
              {getSellerRequestErrorMessage(analyticsQuery.error, {
                permissionMessage:
                  "Your current seller access does not include analytics baseline visibility.",
                fallbackMessage: "Failed to load seller analytics baseline.",
              })}
            </SellerWorkspaceNotice>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
                <SellerWorkspaceStatCard
                  label="Orders"
                  value={
                    analyticsOrderSnapshot?.visible
                      ? String(analyticsOrderSnapshot.totalOrders || 0)
                      : canViewOrders
                        ? "0"
                        : "Role limited"
                  }
                  Icon={ShoppingBag}
                  tone={(analyticsOrderSnapshot?.totalOrders || 0) > 0 ? "emerald" : "stone"}
                />
                <SellerWorkspaceStatCard
                  label="Revenue"
                  value={
                    analyticsRevenueSnapshot?.visible
                      ? formatCurrency(analyticsRevenueSnapshot.paidGrossAmount || 0)
                      : "Role limited"
                  }
                  Icon={WalletCards}
                  tone={
                    (analyticsRevenueSnapshot?.paidGrossAmount || 0) > 0 ? "emerald" : "stone"
                  }
                />
                <SellerWorkspaceStatCard
                  label="AOV"
                  value={
                    analyticsRevenueSnapshot?.visible
                      ? formatCurrency(analyticsRevenueSnapshot.averageOrderValue || 0)
                      : "Role limited"
                  }
                  Icon={BarChart3}
                  tone={
                    (analyticsRevenueSnapshot?.averageOrderValue || 0) > 0 ? "sky" : "stone"
                  }
                />
                <SellerWorkspaceStatCard
                  label="Coupons"
                  value={
                    analyticsCouponSnapshot?.visible
                      ? String(analyticsCouponSnapshot.activeCoupons || 0)
                      : canViewCoupons
                        ? "0"
                        : "Role limited"
                  }
                  Icon={TicketPercent}
                  tone={
                    (analyticsCouponSnapshot?.activeCoupons || 0) > 0 ? "amber" : "stone"
                  }
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <SellerWorkspaceSectionCard
                  title="Operational snapshot"
                  Icon={ShoppingBag}
                >
                  {analyticsOrderSnapshot?.visible && analyticsRevenueSnapshot?.visible ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SellerWorkspaceDetailItem
                          label="Paid Store Splits"
                          value={String(analyticsOrderSnapshot.paidOrders || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Processing / Shipped"
                          value={String(analyticsOrderSnapshot.processingOrders || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Completed"
                          value={String(analyticsOrderSnapshot.completedOrders || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Waiting Payment"
                          value={String(analyticsOrderSnapshot.pendingPaymentOrders || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Exceptions"
                          value={String(analyticsOrderSnapshot.exceptionOrders || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Completed Revenue"
                          value={formatCurrency(analyticsRevenueSnapshot.completedGrossAmount || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="In-flight Revenue"
                          value={formatCurrency(analyticsRevenueSnapshot.processingGrossAmount || 0)}
                        />
                        <SellerWorkspaceDetailItem
                          label="Average Order Value"
                          value={formatCurrency(analyticsRevenueSnapshot.averageOrderValue || 0)}
                        />
                      </div>
                    </>
                  ) : (
                    <EmptyStateNotice
                      title="Order analytics are outside this role"
                      description="This baseline follows the same order visibility boundary as the seller orders lane."
                      ctaLabel={canViewOrders ? "Open orders" : undefined}
                      to={canViewOrders ? workspaceRoutes.orders() : undefined}
                      type="warning"
                    />
                  )}
                </SellerWorkspaceSectionCard>

                <SellerWorkspaceSectionCard
                  title="Coupon attribution"
                  Icon={Package}
                >
                  <div className="space-y-5">
                    {analyticsCouponSnapshot?.visible ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SellerWorkspaceDetailItem
                            label="Attributed Orders"
                            value={String(analyticsCouponAttributionSnapshot?.attributedSuborders || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Attributed Discount"
                            value={formatCurrency(analyticsCouponAttributionSnapshot?.paidDiscountAmount || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Coverage"
                            value={`${String(analyticsCouponAttributionSnapshot?.coverage?.attributedCoveragePercent || 0)}%`}
                          />
                          <SellerWorkspaceDetailItem
                            label="Status"
                            value={analyticsCouponAttributionSnapshot?.label || "No data"}
                          />
                        </div>
                        {analyticsCouponAttributionSnapshot?.visible ? (
                          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                              Deep analytics
                            </summary>
                            <div className="mt-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                Coupon attribution snapshot
                              </p>
                              <SellerWorkspaceBadge
                                label={
                                  analyticsCouponAttributionSnapshot.label || "No attributed activity yet"
                                }
                                tone={analyticsCouponAttributionSnapshot.tone || "stone"}
                              />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {analyticsCouponAttributionSnapshot.summary ||
                                "Coupon attribution snapshot is not available for this role."}
                            </p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <SellerWorkspaceDetailItem
                                label="Attributed Suborders"
                                value={String(
                                  analyticsCouponAttributionSnapshot.attributedSuborders || 0
                                )}
                              />
                              <SellerWorkspaceDetailItem
                                label="Attributed Paid Suborders"
                                value={String(
                                  analyticsCouponAttributionSnapshot.attributedPaidSuborders || 0
                                )}
                              />
                              <SellerWorkspaceDetailItem
                                label="Attributed Discount"
                                value={formatCurrency(
                                  analyticsCouponAttributionSnapshot.totalDiscountAmount || 0
                                )}
                                hint="Discount total derived only from suborders that carry coupon metadata."
                              />
                              <SellerWorkspaceDetailItem
                                label="Paid Attributed Discount"
                                value={formatCurrency(
                                  analyticsCouponAttributionSnapshot.paidDiscountAmount || 0
                                )}
                              />
                              <SellerWorkspaceDetailItem
                                label="Coverage"
                                value={`${String(
                                  analyticsCouponAttributionSnapshot.coverage
                                    ?.attributedCoveragePercent || 0
                                )}%`}
                                hint={`${String(
                                  analyticsCouponAttributionSnapshot.coverage
                                    ?.attributedDiscountedSuborders || 0
                                )} of ${String(
                                  analyticsCouponAttributionSnapshot.coverage
                                    ?.discountedSuborders || 0
                                )} discounted suborder(s) currently carry coupon metadata.`}
                              />
                              <SellerWorkspaceDetailItem
                                label="Unattributed Discounted"
                                value={String(
                                  analyticsCouponAttributionSnapshot.unattributedDiscountedSuborders ||
                                    0
                                )}
                              />
                            </div>
                            {analyticsCouponAttributionSnapshot.topCouponCodes?.length ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      Top attributed coupon codes
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Ranked from visible discounted suborders that already carry coupon metadata.
                                    </p>
                                  </div>
                                  {canViewCoupons ? (
                                    <Link
                                      to={workspaceRoutes.coupons()}
                                      className="text-sm font-semibold text-slate-900 underline"
                                    >
                                      Open coupons
                                    </Link>
                                  ) : null}
                                </div>
                                <div className="mt-4 space-y-3">
                                  {analyticsCouponAttributionSnapshot.topCouponCodes.map((entry) => (
                                    <div
                                      key={entry.code}
                                      className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-900">
                                            {entry.code}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            Used in {entry.attributedSuborders} attributed suborder(s) • Paid{" "}
                                            {entry.attributedPaidSuborders}
                                          </p>
                                        </div>
                                        <SellerWorkspaceBadge
                                          label={entry.scopeType === "STORE" ? "Store scope" : entry.scopeType}
                                          tone={entry.scopeType === "STORE" ? "emerald" : "sky"}
                                        />
                                      </div>
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <SellerWorkspaceDetailItem
                                          label="Attributed Discount"
                                          value={formatCurrency(entry.totalDiscountAmount || 0)}
                                        />
                                        <SellerWorkspaceDetailItem
                                          label="Paid Attributed Discount"
                                          value={formatCurrency(entry.paidDiscountAmount || 0)}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {analyticsCouponAttributionSnapshot.scopeBreakdown?.length ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  Scope usage summary
                                </p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  {analyticsCouponAttributionSnapshot.scopeBreakdown.map((entry) => (
                                    <div
                                      key={entry.scopeType}
                                      className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {entry.scopeType === "STORE"
                                            ? "Store-scoped"
                                            : entry.scopeType === "PLATFORM"
                                              ? "Platform-scoped"
                                              : entry.scopeType}
                                        </p>
                                        <SellerWorkspaceBadge
                                          label={`${entry.attributedSuborders} use`}
                                          tone={entry.scopeType === "STORE" ? "emerald" : "sky"}
                                        />
                                      </div>
                                      <p className="mt-2 text-xs text-slate-500">
                                        Paid attributed suborders {entry.attributedPaidSuborders}
                                      </p>
                                      <p className="mt-2 text-sm font-semibold text-slate-900">
                                        {formatCurrency(entry.totalDiscountAmount || 0)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {analyticsCouponAttributionSnapshot.coverage?.note ? (
                              <SellerWorkspaceNotice type="warning" className="mt-4">
                                {analyticsCouponAttributionSnapshot.coverage.note}
                              </SellerWorkspaceNotice>
                            ) : null}
                            {analyticsCouponAttributionSnapshot.boundaryNote ? (
                              <SellerWorkspaceNotice type="info" className="mt-4">
                                {analyticsCouponAttributionSnapshot.boundaryNote}
                              </SellerWorkspaceNotice>
                            ) : null}
                            </div>
                          </details>
                        ) : analyticsCouponSnapshot?.visible ? (
                          <SellerWorkspaceNotice type="warning" className="mt-4">
                            Coupon attribution snapshot follows both coupon and order visibility, so it stays hidden for roles that cannot read store-owned suborders.
                          </SellerWorkspaceNotice>
                        ) : null}
                        {couponAttributionReadiness?.visible ? (
                          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                              Attribution readiness
                            </summary>
                            <div className="mt-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                Coupon attribution readiness
                              </p>
                              <SellerWorkspaceBadge
                                label={couponAttributionReadiness.label || "Hidden"}
                                tone={couponAttributionReadiness.tone || "stone"}
                              />
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {couponAttributionReadiness.summary ||
                                "Coupon attribution readiness is not available for this role."}
                            </p>
                            {couponAttributionReadiness.signals?.length ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {couponAttributionReadiness.signals.map((signal) => (
                                  <div
                                    key={signal.key}
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {signal.label}
                                      </p>
                                      <SellerWorkspaceBadge
                                        label={signal.status}
                                        tone={
                                          signal.status === "READY"
                                            ? "emerald"
                                            : signal.status === "PARTIAL"
                                              ? "amber"
                                              : "stone"
                                        }
                                      />
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                      {signal.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {couponAttributionReadiness.recommendedNextStep ? (
                              <SellerWorkspaceNotice type="warning" className="mt-4">
                                {couponAttributionReadiness.recommendedNextStep}
                              </SellerWorkspaceNotice>
                            ) : null}
                            </div>
                          </details>
                        ) : null}
                      </>
                    ) : (
                      <EmptyStateNotice
                        title="Coupon analytics are outside this role"
                        description="Coupon inventory and discounted-order activity follow seller coupon visibility."
                        ctaLabel={canViewCoupons ? "Open coupons" : undefined}
                        to={canViewCoupons ? workspaceRoutes.coupons() : undefined}
                        type="warning"
                      />
                    )}

                    {analyticsProductSnapshot?.visible ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <SellerWorkspaceDetailItem
                            label="Total Products"
                            value={String(analyticsProductSnapshot.totalProducts || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Storefront Visible"
                            value={String(analyticsProductSnapshot.storefrontVisibleProducts || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Active"
                            value={String(analyticsProductSnapshot.activeProducts || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Drafts"
                            value={String(analyticsProductSnapshot.draftProducts || 0)}
                          />
                          <SellerWorkspaceDetailItem
                            label="Review Queue"
                            value={String(analyticsProductSnapshot.reviewQueue || 0)}
                          />
                        </div>

                        {analyticsProductSnapshot.topProducts?.length ? (
                          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                              Top products
                            </summary>
                            <div className="mt-4">
                            <div className="flex items-center justify-between gap-3">
                              <div />
                              {canViewCatalog ? (
                                <Link
                                  to={workspaceRoutes.catalog()}
                                  className="text-sm font-semibold text-slate-900 underline"
                                >
                                  Open catalog
                                </Link>
                              ) : null}
                            </div>
                            <div className="mt-4 space-y-3">
                              {analyticsProductSnapshot.topProducts.map((product, index) => {
                                const productTo = canViewCatalog
                                  ? workspaceRoutes.productDetail(product.productId)
                                  : null;
                                const body = (
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">
                                        {index + 1}. {product.name}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {product.qtySold} sold • {formatCurrency(product.revenueAmount || 0)}
                                      </p>
                                    </div>
                                    <SellerWorkspaceBadge
                                      label={product.storefrontVisible ? "Visible" : "Internal"}
                                      tone={product.storefrontVisible ? "emerald" : "stone"}
                                    />
                                  </div>
                                );

                                return productTo ? (
                                  <Link
                                    key={product.productId}
                                    to={productTo}
                                    className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition hover:border-slate-300"
                                  >
                                    {body}
                                  </Link>
                                ) : (
                                  <div
                                    key={product.productId}
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"
                                  >
                                    {body}
                                  </div>
                                );
                              })}
                            </div>
                            </div>
                          </details>
                        ) : (
                          <EmptyStateNotice
                            title="No top product signal yet"
                            description={
                              analyticsProductSnapshot.hint ||
                              "Top products will appear after this store records paid order activity."
                            }
                            ctaLabel={canViewCatalog ? "Open catalog" : undefined}
                            to={canViewCatalog ? workspaceRoutes.catalog() : undefined}
                          />
                        )}
                      </>
                    ) : (
                      <EmptyStateNotice
                        title="Product analytics are outside this role"
                        description="Catalog counts and top products follow seller product visibility."
                        ctaLabel={canViewCatalog ? "Open catalog" : undefined}
                        to={canViewCatalog ? workspaceRoutes.catalog() : undefined}
                        type="warning"
                      />
                    )}
                  </div>
                </SellerWorkspaceSectionCard>
              </div>
            </div>
          )}
        </SellerWorkspaceSectionCard>
      </section>

      {hasOperationalAccess ? (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <SellerWorkspaceSectionCard
              title="Payment review"
              Icon={BadgeCheck}
            >
              {canViewPaymentReview ? (
                paymentReviewCounts?.totalRecords > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SellerWorkspaceDetailItem
                      label="Visible Records"
                      value={String(paymentReviewCounts.totalRecords || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Need Review"
                      value={String(paymentReviewCounts.awaitingReview || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Backend Paid"
                      value={String(paymentReviewCounts.settled || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Rejected / Problem"
                      value={String(
                        (paymentReviewCounts.rejected || 0) +
                          (paymentReviewCounts.exceptionCount || 0)
                      )}
                    />
                  </div>
                ) : (
                  <EmptyStateNotice
                    title="No pending"
                    description="Nothing to review right now."
                    ctaLabel="Open payment review"
                    to={workspaceRoutes.paymentReview()}
                  />
                )
              ) : (
                <EmptyStateNotice
                  title="Payment review is outside this role"
                  description="This role can use the home page, but payment proof review belongs to seller roles with order and finance review visibility."
                  type="warning"
                />
              )}
            </SellerWorkspaceSectionCard>

            <SellerWorkspaceSectionCard
              title="Orders"
              Icon={ShoppingBag}
            >
              {canViewOrders ? (
                suborderSummary?.totalSuborders > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SellerWorkspaceDetailItem
                      label="Total Store Splits"
                      value={String(suborderSummary.totalSuborders || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Unpaid"
                      value={String(suborderSummary.unpaidCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Waiting Confirmation"
                      value={String(suborderSummary.pendingConfirmationCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Paid Store Splits"
                      value={String(suborderSummary.paidCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Issue Count"
                      value={String(suborderSummary.exceptionCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Paid Gross"
                      value={formatCurrency(suborderSummary.paidGrossAmount || 0)}
                    />
                  </div>
                ) : (
                  <EmptyStateNotice
                    title="No orders"
                    description="No store orders yet."
                    ctaLabel="Open orders"
                    to={workspaceRoutes.orders()}
                  />
                )
              ) : (
                <EmptyStateNotice
                  title="Order signals are outside this role"
                  description="This role can still use the workspace home, but order operations are handled by seller roles with order access."
                  type="warning"
                />
              )}
            </SellerWorkspaceSectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <SellerWorkspaceSectionCard
              title="Payment setup readiness"
              Icon={CreditCard}
              actions={[
                <SellerWorkspaceBadge
                  key="status"
                  label={paymentReadiness?.label || "Not visible"}
                  tone={paymentReadiness?.visible ? paymentReadiness.tone : "stone"}
                />,
                paymentReadiness?.reviewStatus ? (
                  <SellerWorkspaceBadge
                    key="review"
                    label={paymentReadiness.reviewStatus.label}
                    tone={paymentReadiness.reviewStatus.tone || "stone"}
                  />
                ) : null,
              ].filter(Boolean)}
            >
              {canViewPaymentProfile ? (
                paymentReadiness?.visible ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SellerWorkspaceDetailItem
                        label="Required Fields"
                        value={`${paymentReadiness.completedFields || 0}/${paymentReadiness.totalFields || 0}`}
                      />
                      <SellerWorkspaceDetailItem
                        label="Status"
                        value={paymentReadiness.nextStep?.label || paymentReadiness.label || "-"}
                      />
                      <SellerWorkspaceDetailItem
                        label="Provider"
                        value={paymentReadiness.profile?.providerCode || "-"}
                      />
                      <SellerWorkspaceDetailItem
                        label="Payment Type"
                        value={paymentReadiness.profile?.paymentType || "-"}
                      />
                    </div>

                    {paymentReadiness.missingFields?.length ? (
                      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                          Missing
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-amber-900">
                          {paymentReadiness.missingFields.map((field) => (
                            <li key={field.label}>- {field.label}</li>
                          ))}
                        </ul>
                      </div>
                    ) : paymentReadiness.isReady ? (
                      <SellerWorkspaceNotice type="success" className="mt-5">
                        Payment setup is ready.
                      </SellerWorkspaceNotice>
                    ) : null}
                  </>
                ) : (
                  <EmptyStateNotice
                    title="Payment setup details are not available"
                    description="This seller role can open the home page, but the detailed payment setup snapshot is not available here."
                    type="warning"
                  />
                )
              ) : (
                <EmptyStateNotice
                  title="Payment setup is not part of this role"
                  description="Payment setup visibility belongs to finance-capable roles such as store owner, store admin, or finance viewer."
                  type="warning"
                />
              )}
            </SellerWorkspaceSectionCard>

            <SellerWorkspaceSectionCard
              title="Paid orders snapshot"
              Icon={WalletCards}
              actions={[
                <SellerWorkspaceBadge
                  key="eligible-count"
                  label={`${eligiblePaidSummary?.count || 0} order(s)`}
                  tone={(eligiblePaidSummary?.count || 0) > 0 ? "emerald" : "stone"}
                />,
              ]}
            >
              {canViewOrders ? (
                eligiblePaidSummary?.count > 0 ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SellerWorkspaceDetailItem
                        label="Estimated Count"
                        value={String(eligiblePaidSummary.count || 0)}
                      />
                      <SellerWorkspaceDetailItem
                        label="Estimated Gross"
                        value={formatCurrency(eligiblePaidSummary.grossAmount || 0)}
                      />
                      <SellerWorkspaceDetailItem
                        label="Waiting Fulfillment"
                        value={String(eligiblePaidSummary.awaitingFulfillmentCount || 0)}
                      />
                      <SellerWorkspaceDetailItem
                        label="In Progress"
                        value={String(eligiblePaidSummary.inProgressCount || 0)}
                      />
                    <SellerWorkspaceDetailItem
                      label="Delivered"
                      value={String(eligiblePaidSummary.deliveredCount || 0)}
                    />
                  </div>
                </>
              ) : (
                <EmptyStateNotice
                    title="No paid orders"
                    description="No paid snapshot yet."
                    ctaLabel="Open orders"
                    to={workspaceRoutes.orders()}
                  />
                )
              ) : (
                <EmptyStateNotice
                  title="Paid-order snapshot is not part of this role"
                  description="This estimate is only shown to seller roles that can see store orders."
                  type="warning"
                />
              )}
            </SellerWorkspaceSectionCard>
          </section>
        </>
      ) : (
        <SellerWorkspaceSectionCard
          title="Role focus"
          Icon={ShieldCheck}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <SellerWorkspaceDetailItem label="Main Role Focus" value={roleFocusLabel} />
              <SellerWorkspaceDetailItem
                label="Recommended Lane"
                value={canEditStore ? "Store Profile" : "Workspace Overview"}
              />
            </div>
            {canEditStore ? (
              <Link
                to={workspaceRoutes.storeProfile()}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 underline"
              >
                Open store profile
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </SellerWorkspaceSectionCard>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <SellerWorkspaceSectionCard
          title="Store context"
          Icon={Store}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SellerWorkspaceDetailItem label="Store" value={summary?.store?.name} />
            <SellerWorkspaceDetailItem label="Status" value={summary?.store?.status} />
            <SellerWorkspaceDetailItem label="Role" value={summary?.store?.roleCode || "-"} />
            <SellerWorkspaceDetailItem label="Mode" value={summary?.store?.accessMode || "-"} />
            <SellerWorkspaceDetailItem label="Scope" value={summary?.store?.slug} />
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <SellerWorkspaceSectionCard
        title="Quick links"
        Icon={Package}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinksToRender.map((entry) =>
            entry.enabled ? (
              <Link
                key={entry.key}
                to={entry.to}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <entry.Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-base font-semibold text-slate-900">{entry.label}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ) : (
              <div
                key={entry.key}
                className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-slate-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-700">{entry.label}</p>
                      <SellerWorkspaceBadge label="Role limited" tone="stone" />
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </SellerWorkspaceSectionCard>
    </div>
  );
}

export default function SellerWorkspaceHome() {
  return (
    <SellerWorkspaceHomeErrorBoundary>
      <SellerWorkspaceHomeContent />
    </SellerWorkspaceHomeErrorBoundary>
  );
}

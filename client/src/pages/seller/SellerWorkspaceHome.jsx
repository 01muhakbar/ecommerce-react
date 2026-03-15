import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FolderPlus,
  Lock,
  Package,
  ShieldCheck,
  ShoppingBag,
  Store,
  WalletCards,
} from "lucide-react";
import { getSellerFinanceSummary } from "../../api/sellerWorkspace.ts";
import { getSellerProductAuthoringMeta } from "../../api/sellerProducts.ts";
import {
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceSectionCard,
  SellerWorkspaceStatePanel,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { formatCurrency } from "../../utils/format.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const joinClassNames = (...items) => items.filter(Boolean).join(" ");

const heroPrimaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100";

const heroSecondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white transition hover:bg-white/15";

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
  if (lane === "STORE_PROFILE") return workspaceRoutes.profile();
  return workspaceRoutes.home();
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
      label: "Follow up paid orders",
      hint: `${eligiblePaidSummary.awaitingFulfillmentCount} paid order(s) are still waiting for fulfillment progress.`,
      tone: "emerald",
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
      to: workspaceRoutes.profile(),
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
    to: workspaceRoutes.profile(),
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

export default function SellerWorkspaceHome() {
  const { sellerContext, workspaceStoreId: storeId, workspaceRoutes } =
    useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const hasPermission = (permissionKey) => permissionKeys.includes(permissionKey);
  const canViewStore = hasPermission("STORE_VIEW");
  const canEditStore = hasPermission("STORE_EDIT");
  const canViewCatalog = hasPermission("PRODUCT_VIEW");
  const canCreateProduct = hasPermission("PRODUCT_CREATE");
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
  const paymentReadiness = summary?.paymentProfileReadiness;
  const paymentReviewCounts = summary?.paymentReviewCounts;
  const suborderSummary = summary?.suborderPaymentSummary;
  const eligiblePaidSummary = summary?.eligiblePaidSubordersSummary;
  const backendActions = Array.isArray(summary?.nextActions) ? summary.nextActions : [];
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
    const normalized = backendActions
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
    paymentReadiness,
    workspaceRoutes,
  ]);

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

  if (financeSummaryQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading seller workspace home"
        description="Fetching the current store summary so you can see what needs attention first."
        Icon={Store}
      />
    );
  }

  if (financeSummaryQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller workspace home"
        description={getSellerRequestErrorMessage(financeSummaryQuery.error, {
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
                <p className="mt-2.5 max-w-2xl text-sm leading-5 text-white/72">
                  Start here to see what needs attention first for the active store, then jump
                  straight into orders, payment review, payment setup, or store profile.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Main Focus
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{primaryFocus.label}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{primaryFocus.hint}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Your View
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">{roleFocusLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    This page only shows what your current seller role can safely access.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Store Scope
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {summary?.store?.slug || sellerContext?.store?.slug || "store"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    Everything below belongs to this active store only.
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
                <Link to={workspaceRoutes.profile()} className={heroPrimaryButtonClass}>
                  <Store className="h-4 w-4" />
                  Review Store Profile
                </Link>
              ) : null}
            </div>
          </div>
        </SellerWorkspacePanel>

        <SellerWorkspaceSectionCard
          title="What needs attention"
          hint="The highest-priority seller tasks come first."
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {action.label}
                      </p>
                      <SellerWorkspaceBadge label={action.priority} tone={action.tone} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {action.description || "Open this seller lane for the next step."}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <SellerWorkspaceStatCard
          label="Payment Setup"
          value={
            paymentReadiness?.visible
              ? paymentReadiness.label
              : canViewPaymentProfile
                ? "Not ready"
                : "Role limited"
          }
          hint={
            paymentReadiness?.visible
              ? paymentReadiness.description
              : "Payment setup details are limited to finance-capable roles."
          }
          Icon={CreditCard}
          tone={paymentReadiness?.visible ? paymentReadiness.tone : "stone"}
        />
        <SellerWorkspaceStatCard
          label="Awaiting Review"
          value={String(paymentReviewCounts?.awaitingReview || 0)}
          hint={
            canViewPaymentReview
              ? (paymentReviewCounts?.awaitingReview || 0) > 0
                ? "Buyer payment proofs still need review."
                : "Nothing is waiting for payment review right now."
              : "Payment review counts are not part of this role."
          }
          Icon={BadgeCheck}
          tone={(paymentReviewCounts?.awaitingReview || 0) > 0 ? "amber" : "stone"}
        />
        <SellerWorkspaceStatCard
          label="Paid Orders"
          value={String(suborderSummary?.paidCount || 0)}
          hint={
            canViewOrders
              ? "Store-owned orders already marked as paid."
              : "Order payment signals are not part of this role."
          }
          Icon={ShoppingBag}
          tone={(suborderSummary?.paidCount || 0) > 0 ? "emerald" : "stone"}
        />
        <SellerWorkspaceStatCard
          label="Estimated Paid Total"
          value={formatCurrency(eligiblePaidSummary?.grossAmount || 0)}
          hint={
            canViewOrders
              ? "A quick paid-order snapshot, not a payout total."
              : "This estimate only appears for roles with order visibility."
          }
          Icon={WalletCards}
          tone={(eligiblePaidSummary?.grossAmount || 0) > 0 ? "emerald" : "stone"}
        />
      </section>

      {hasOperationalAccess ? (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <SellerWorkspaceSectionCard
              title="Payment review"
              hint="Use this to see whether buyer proof review needs attention today."
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
                      label="Paid"
                      value={String(paymentReviewCounts.settled || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Rejected / Problem"
                      value={String(
                        (paymentReviewCounts.rejected || 0) +
                          (paymentReviewCounts.exceptionCount || 0)
                      )}
                      hint="Includes rejected, failed, and expired latest payment records."
                    />
                  </div>
                ) : (
                  <EmptyStateNotice
                    title="No buyer payment proof is waiting yet"
                    description="This store does not have visible payment review records right now. New proof submissions will appear here as buyers complete payment."
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
              title="Order payment snapshot"
              hint="A fast view of store-owned orders and their payment state."
              Icon={ShoppingBag}
            >
              {canViewOrders ? (
                suborderSummary?.totalSuborders > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SellerWorkspaceDetailItem
                      label="Total Orders"
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
                      label="Paid"
                      value={String(suborderSummary.paidCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Issue Count"
                      value={String(suborderSummary.exceptionCount || 0)}
                    />
                    <SellerWorkspaceDetailItem
                      label="Paid Gross"
                      value={formatCurrency(suborderSummary.paidGrossAmount || 0)}
                      hint="This is the gross total of store orders already marked as paid."
                    />
                  </div>
                ) : (
                  <EmptyStateNotice
                    title="No store orders are visible yet"
                    description="Once this store receives orders, their payment progress will appear here so the team can monitor what is still unpaid, waiting, or already settled."
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
              hint="A simple check of whether the store payment destination is ready."
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
                        label="Next Step"
                        value={paymentReadiness.nextStep?.label || "-"}
                        hint={paymentReadiness.nextStep?.description || paymentReadiness.description}
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
                      <SellerWorkspaceNotice type="warning" className="mt-5">
                        Missing setup fields:{" "}
                        {paymentReadiness.missingFields.map((field) => field.label).join(", ")}.
                      </SellerWorkspaceNotice>
                    ) : paymentReadiness.isReady ? (
                      <SellerWorkspaceNotice type="success" className="mt-5">
                        Payment setup is ready. The next day-to-day focus usually shifts to orders
                        and payment review.
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
              title="Estimated paid orders snapshot"
              hint="A quick paid-order snapshot to support follow-up, not a withdrawal total."
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
                    <SellerWorkspaceNotice type="warning" className="mt-5">
                      {eligiblePaidSummary.boundaryNote ||
                        "This is only a paid-order snapshot and not a final payout total."}
                    </SellerWorkspaceNotice>
                  </>
                ) : (
                  <EmptyStateNotice
                    title="No paid order matches this snapshot yet"
                    description="Paid store orders will appear here after payment is settled and the order still fits the current snapshot rules. This helps the team follow up fulfillment, not request payout."
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
          title="What this role is meant to handle"
          hint="The active seller role has a focused scope inside the workspace."
          Icon={ShieldCheck}
        >
          <div className="space-y-4">
            <SellerWorkspaceNotice type="info">
              This role does not manage order handling or finance review. The most useful next
              step here is usually keeping the store profile and storefront-facing details current.
            </SellerWorkspaceNotice>
            <div className="grid gap-3 sm:grid-cols-2">
              <SellerWorkspaceDetailItem label="Main Role Focus" value={roleFocusLabel} />
              <SellerWorkspaceDetailItem
                label="Recommended Lane"
                value={canEditStore ? "Store Profile" : "Workspace Overview"}
                hint={
                  canEditStore
                    ? "Use Store Profile to review seller-managed identity, contact, and profile details."
                    : "This role has a narrower read-only seller scope."
                }
              />
            </div>
            {canEditStore ? (
              <Link
                to={workspaceRoutes.profile()}
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
          hint="Reference details for the active store."
          Icon={Store}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SellerWorkspaceDetailItem label="Store" value={summary?.store?.name} />
            <SellerWorkspaceDetailItem label="Slug" value={summary?.store?.slug} />
            <SellerWorkspaceDetailItem label="Store Status" value={summary?.store?.status} />
            <SellerWorkspaceDetailItem label="Role" value={summary?.store?.roleCode || "-"} />
            <SellerWorkspaceDetailItem
              label="Access Mode"
              value={summary?.store?.accessMode || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Membership"
              value={summary?.store?.membershipStatus || "-"}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="How to read this page"
          hint="Simple boundaries so the summary stays clear and safe."
          Icon={ShieldCheck}
        >
          <div className="space-y-3">
            <SellerWorkspaceNotice type="info">
              {summary?.boundaries?.tenantScope ||
                "Everything on this page belongs to the active store only."}
            </SellerWorkspaceNotice>
            <SellerWorkspaceNotice type="warning">
              {summary?.boundaries?.payoutDisclaimer ||
                "Paid-order estimates here are not payout or withdrawal totals."}
            </SellerWorkspaceNotice>
            <SellerWorkspaceNotice type="info">
              {summary?.boundaries?.adminAuthority ||
                "Admin payment review and payment audit still remain the main finance authority."}
            </SellerWorkspaceNotice>
          </div>
        </SellerWorkspaceSectionCard>
      </section>

      <SellerWorkspaceSectionCard
        title="Quick links"
        hint="Jump straight into the seller lanes that matter for this role."
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
                    <p className="mt-2 text-sm leading-6 text-slate-500">{entry.description}</p>
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
                    <p className="mt-2 text-sm leading-6 text-slate-500">{entry.reason}</p>
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

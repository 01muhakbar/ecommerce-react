import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle,
  Eye,
  RotateCw,
  ShoppingCart,
  Store,
  Truck,
} from "lucide-react";
import { api } from "../../api/axios.ts";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { listSellerWorkspaceStores } from "../../api/sellerWorkspace.ts";
import { getCurrentUserStoreApplication } from "../../api/userStoreApplications.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  getOrderStatusBadgeClass,
} from "../../utils/orderStatus.js";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";
import {
  buildPublicOrderTrackingPath,
  resolvePublicOrderReference,
} from "../../utils/publicOrderReference.js";
import { normalizeDashboardSettingCopy } from "../../utils/dashboardSettingCopy.js";
import { getOrderTruthStatus } from "../../utils/orderTruth.js";
import {
  getStoreOnboardingPrimaryAction,
  presentStoreApplicationStatus,
  presentStoreReadiness,
} from "../../utils/storeOnboardingPresentation.ts";

const fetchOrders = async () => {
  const { data } = await api.get("/store/my/orders");
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
};

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.orderTime || null;

const getOrderTimestamp = (order) => {
  const value = getOrderDateValue(order);
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getPublicOrderRef = (order) =>
  resolvePublicOrderReference(order?.invoiceNo, order?.ref, order?.invoice, order?.orderRef);

const ONBOARDING_TONE = {
  stone: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-700",
  warning: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

const resolveDashboardOnboardingState = ({ application, ownerStore, fallbackStore }) => {
  const applicationStatus = application
    ? presentStoreApplicationStatus(application.statusMeta, application.status)
    : null;
  const readinessStatus = presentStoreReadiness({
    storeStatus: ownerStore?.store?.status || application?.activation?.storeStatus || null,
    hasStore: Boolean(ownerStore || fallbackStore || application?.activation?.storeId),
    sellerAccessReady: Boolean(application?.activation?.sellerAccessReady),
  });
  const completionText = application
    ? `${application.completeness?.completedFields || 0} of ${
        application.completeness?.totalFields || 0
      } fields completed`
    : "No application started";

  if (ownerStore) {
    return {
      title: "Start Selling",
      description:
        readinessStatus.code === "active"
          ? "Seller access is ready. Open the workspace to manage your store."
          : "Seller access is ready. Public activity still depends on store readiness.",
      applicationBadge: applicationStatus,
      readinessBadge: readinessStatus,
      ctaLabel: "Go to Seller Workspace",
      href: createSellerWorkspaceRoutes(ownerStore.store).home(),
      progress: `Store @${ownerStore.store.slug}`,
      meta: completionText,
      icon: Store,
    };
  }

  if (!application) {
    return {
      title: "Start Selling",
      description: "Complete your store details and submit for review.",
      applicationBadge: null,
      readinessBadge: readinessStatus,
      ctaLabel: "Start Application",
      href: "/user/store-application",
      progress: "No active application",
      meta: "The store is not public yet.",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "draft") {
    return {
      title: "Start Selling",
      description: "Finish the missing details and submit when you are ready.",
      applicationBadge: applicationStatus,
      readinessBadge: readinessStatus,
      ctaLabel: getStoreOnboardingPrimaryAction(application.status, false),
      href: "/user/store-application",
      progress: completionText,
      meta: application.currentStepMeta?.label || "Owner Details",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "submitted" || application.status === "under_review") {
    return {
      title: "Start Selling",
      description: applicationStatus?.description || "Your application is being reviewed.",
      applicationBadge: applicationStatus,
      readinessBadge: readinessStatus,
      ctaLabel: getStoreOnboardingPrimaryAction(application.status, false),
      href: "/user/store-application",
      progress: completionText,
      meta: application.submittedAt
        ? `Submitted ${formatDate(application.submittedAt)}`
        : application.currentStepMeta?.label || "Review",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "revision_requested") {
    return {
      title: "Start Selling",
      description: application.revisionNote || applicationStatus?.description,
      applicationBadge: applicationStatus,
      readinessBadge: readinessStatus,
      ctaLabel: getStoreOnboardingPrimaryAction(application.status, false),
      href: "/user/store-application",
      progress: completionText,
      meta: "Update the requested fields and submit again.",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "approved") {
    return {
      title: "Start Selling",
      description: fallbackStore
        ? "Seller access is approved. Open the workspace to continue setup."
        : "Seller access is approved. Store setup may still be syncing.",
      applicationBadge: applicationStatus,
      readinessBadge: presentStoreReadiness({
        storeStatus: fallbackStore?.store?.status || application?.activation?.storeStatus || null,
        hasStore: Boolean(fallbackStore || application?.activation?.storeId),
        sellerAccessReady: Boolean(application?.activation?.sellerAccessReady),
      }),
      ctaLabel: getStoreOnboardingPrimaryAction(application.status, Boolean(fallbackStore)),
      href: fallbackStore
        ? createSellerWorkspaceRoutes(fallbackStore.store).home()
        : "/user/store-application",
      progress: completionText,
      meta: application.reviewedAt ? `Reviewed ${formatDate(application.reviewedAt)}` : "Approved",
      icon: CheckCircle,
    };
  }

  if (application.status === "rejected") {
    return {
      title: "Start Selling",
      description:
        application.rejectReason ||
        applicationStatus?.description ||
        "Start a new application when you are ready.",
      applicationBadge: applicationStatus,
      readinessBadge: readinessStatus,
      ctaLabel: getStoreOnboardingPrimaryAction(application.status, false),
      href: "/user/store-application",
      progress: completionText,
      meta: application.reviewedAt ? `Reviewed ${formatDate(application.reviewedAt)}` : "Closed",
      icon: BriefcaseBusiness,
    };
  }

  return {
    title: "Start Selling",
    description: applicationStatus?.description || "Start a new application when you are ready.",
    applicationBadge: applicationStatus,
    readinessBadge: readinessStatus,
    ctaLabel: getStoreOnboardingPrimaryAction(application.status, false),
    href: "/user/store-application",
    progress: completionText,
    meta: application.updatedAt ? `Updated ${formatDate(application.updatedAt)}` : "Cancelled",
    icon: BriefcaseBusiness,
  };
};

export default function AccountDashboardPage() {
  const { user } = useOutletContext() || {};
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const dashboardCopy = dashboardSettingCopy.dashboard;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account", "orders", "my"],
    queryFn: () => fetchOrders(),
  });
  const storeApplicationQuery = useQuery({
    queryKey: ["user", "store-application", "current"],
    queryFn: getCurrentUserStoreApplication,
    retry: false,
  });
  const sellerStoresQuery = useQuery({
    queryKey: ["seller", "workspace", "stores"],
    queryFn: listSellerWorkspaceStores,
    retry: false,
  });

  const orders = data?.data || [];
  const orderSnapshots = useMemo(
    () =>
      orders.map((order) => ({
        order,
        truthStatus: getOrderTruthStatus(order),
      })),
    [orders]
  );
  const totalOrders = orderSnapshots.length;
  const pendingOrders = orderSnapshots.filter(
    ({ truthStatus }) => truthStatus.bucket === "pending"
  ).length;
  const processingOrders = orderSnapshots.filter(
    ({ truthStatus }) =>
      truthStatus.bucket === "processing" || truthStatus.bucket === "shipping"
  ).length;
  const completeOrders = orderSnapshots.filter(
    ({ truthStatus }) => truthStatus.bucket === "complete"
  ).length;
  const closedOrders = orderSnapshots.filter(
    ({ truthStatus }) => truthStatus.bucket === "cancelled"
  ).length;

  const statCards = [
    {
      label: dashboardCopy.totalOrdersLabel,
      value: totalOrders,
      Icon: ShoppingCart,
      tone: "bg-slate-100 text-slate-600",
      hint:
        closedOrders > 0
          ? `${closedOrders} closed/problem order(s) stay outside active progress counts.`
          : "Uses the latest backend order truth across your visible buyer orders.",
    },
    {
      label: dashboardCopy.pendingOrderValue,
      value: pendingOrders,
      Icon: RotateCw,
      tone: "bg-amber-100 text-amber-600",
      hint: "Includes awaiting payment, review, or other action-required states.",
    },
    {
      label: dashboardCopy.processingOrderValue,
      value: processingOrders,
      Icon: Truck,
      tone: "bg-sky-100 text-sky-600",
      hint: "Includes processing and shipping states that are still moving.",
    },
    {
      label: dashboardCopy.completeOrderValue,
      value: completeOrders,
      Icon: CheckCircle,
      tone: "bg-emerald-100 text-emerald-600",
      hint: "Final-positive only. Closed/problem orders stay outside this count.",
    },
  ];

  const recentOrders = [...orderSnapshots]
    .sort((a, b) => getOrderTimestamp(b.order) - getOrderTimestamp(a.order))
    .slice(0, 5);
  const sellerStores = Array.isArray(sellerStoresQuery.data) ? sellerStoresQuery.data : [];
  const ownerStore = useMemo(() => {
    const owned = sellerStores.filter((entry) => entry?.access?.isOwner);
    return (
      owned.sort((left, right) => {
        const leftActive = String(left?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        const rightActive =
          String(right?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        if (leftActive !== rightActive) return rightActive - leftActive;
        return String(left?.store?.name || "").localeCompare(String(right?.store?.name || ""));
      })[0] || null
    );
  }, [sellerStores]);
  const onboardingCard = resolveDashboardOnboardingState({
    application: storeApplicationQuery.data || null,
    ownerStore,
    fallbackStore: sellerStores[0] || null,
  });
  const OnboardingIcon = onboardingCard.icon;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {dashboardCopy.sectionTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.name ? `Welcome back, ${user.name}.` : "Welcome back."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.tone}`}>
              <card.Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              {card.hint ? (
                <p className="mt-1 text-xs leading-5 text-slate-500">{card.hint}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {storeApplicationQuery.isError || sellerStoresQuery.isError ? (
          <div className="p-5 text-sm text-rose-600">
            {storeApplicationQuery.error?.response?.data?.message ||
              sellerStoresQuery.error?.response?.data?.message ||
              "Failed to load store onboarding status."}
          </div>
        ) : storeApplicationQuery.isLoading || sellerStoresQuery.isLoading ? (
          <div className="p-5 text-sm text-slate-500">Loading store onboarding status...</div>
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <OnboardingIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">{onboardingCard.title}</h2>
                  {onboardingCard.applicationBadge ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        ONBOARDING_TONE[onboardingCard.applicationBadge.tone] || ONBOARDING_TONE.stone
                      }`}
                    >
                      {onboardingCard.applicationBadge.label}
                    </span>
                  ) : null}
                  {onboardingCard.readinessBadge ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        ONBOARDING_TONE[onboardingCard.readinessBadge.tone] || ONBOARDING_TONE.stone
                      }`}
                    >
                      {onboardingCard.readinessBadge.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  {onboardingCard.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {onboardingCard.progress}
                  </span>
                  <span>{onboardingCard.meta}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-start lg:justify-end">
              <Link
                to={onboardingCard.href}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {onboardingCard.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {dashboardCopy.recentOrderValue}
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white">
          {isLoading ? (
            <div className="p-4 text-sm text-slate-500">Loading...</div>
          ) : isError ? (
            <div className="p-4 text-sm text-rose-600">
              {error?.response?.status === 401
                ? "Please login to see your orders."
                : "Failed to load orders."}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">You do not have any orders yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">OrderTime</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Shipping</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(({ order, truthStatus }) => {
                    const publicOrderRef = getPublicOrderRef(order);
                    const trackingPath = buildPublicOrderTrackingPath(publicOrderRef);
                    const shippingAmount =
                      order.shipping ?? order.shippingAmount ?? order.deliveryFee ?? null;
                    return (
                      <tr
                        key={order.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {publicOrderRef || `#${order.id}`}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(getOrderDateValue(order))}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {order.paymentMethod || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getOrderStatusBadgeClass(
                              truthStatus.bucket
                            )}`}
                          >
                            {truthStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {shippingAmount != null && shippingAmount !== ""
                            ? money(shippingAmount)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {money(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {trackingPath ? (
                            <Link
                              to={trackingPath}
                              className="inline-flex items-center justify-center text-emerald-700 hover:text-emerald-900"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View order</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

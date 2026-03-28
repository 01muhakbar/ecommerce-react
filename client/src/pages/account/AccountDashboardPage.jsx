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
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "../../utils/orderStatus.js";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";

const fetchOrders = async () => {
  const { data } = await api.get("/store/my/orders");
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.orderTime || null;

const getOrderTimestamp = (order) => {
  const value = getOrderDateValue(order);
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getOrderRef = (order) => order?.invoiceNo || order?.orderId || order?.id || null;

const toText = (value, fallback) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const ONBOARDING_TONE = {
  stone: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-700",
  warning: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

const resolveStoreStatusTone = (status) =>
  String(status || "").toUpperCase() === "ACTIVE" ? "emerald" : "stone";

const resolveDashboardOnboardingState = ({ application, ownerStore, fallbackStore }) => {
  if (ownerStore) {
    const storeStatus = String(ownerStore.store.status || "INACTIVE").toUpperCase();
    return {
      title: "Seller Workspace Sudah Tersedia",
      description:
        storeStatus === "ACTIVE"
          ? "Akun ini sudah terhubung dengan store dan seller workspace siap dipakai."
          : "Akun ini sudah terhubung dengan seller workspace. Operasional publik store tetap mengikuti status store dan readiness backend.",
      badge: {
        label: storeStatus,
        tone: resolveStoreStatusTone(storeStatus),
      },
      ctaLabel: "Masuk ke Seller Workspace",
      href: createSellerWorkspaceRoutes(ownerStore.store).home(),
      meta: `@${ownerStore.store.slug}`,
      icon: Store,
    };
  }

  if (!application) {
    return {
      title: "Mulai Jualan di Platform Kami",
      description:
        "Ajukan pembukaan toko untuk mulai menjual produk Anda. Lengkapi data toko dan verifikasi identitas agar tim admin dapat meninjau pengajuan Anda.",
      badge: null,
      ctaLabel: "Ajukan Pembukaan Toko",
      href: "/user/store-application",
      meta: "Belum ada pengajuan aktif",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "draft") {
    return {
      title: "Mulai Jualan di Platform Kami",
      description:
        "Draft pengajuan toko sudah tersimpan. Lanjutkan pengisian data dan ringkasan sebelum dikirim ke admin.",
      badge: {
        label: application.statusMeta?.label || "Draft",
        tone: application.statusMeta?.tone || "stone",
      },
      ctaLabel: "Lanjutkan Pengajuan Toko",
      href: "/user/store-application",
      meta: `${application.completeness?.completedFields || 0}/${
        application.completeness?.totalFields || 0
      } field backend lengkap`,
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "submitted" || application.status === "under_review") {
    return {
      title: "Pengajuan Sedang Ditinjau",
      description:
        application.statusMeta?.description ||
        "Pengajuan toko sedang diproses admin. Status akan diperbarui dari backend setelah review berjalan.",
      badge: {
        label: "Pengajuan Sedang Ditinjau",
        tone: application.statusMeta?.tone || "sky",
      },
      ctaLabel: "Lihat Status Pengajuan",
      href: "/user/store-application",
      meta: application.currentStepMeta?.label || "Review",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "revision_requested") {
    return {
      title: "Perlu Revisi",
      description:
        application.revisionNote ||
        "Admin meminta perbaikan data. Perbarui pengajuan yang sama lalu kirim ulang.",
      badge: {
        label: "Perlu Revisi",
        tone: application.statusMeta?.tone || "rose",
      },
      ctaLabel: "Perbaiki Pengajuan",
      href: "/user/store-application",
      meta: application.currentStepMeta?.label || "Review",
      icon: BriefcaseBusiness,
    };
  }

  if (application.status === "approved") {
    return {
      title: "Pengajuan Disetujui",
      description: fallbackStore
        ? "Pengajuan sudah approved dan seller workspace tersedia untuk akun ini."
        : "Pengajuan sudah approved. Jika workspace belum muncul, muat ulang dashboard untuk sinkronisasi boundary seller dari backend.",
      badge: {
        label: application.statusMeta?.label || "Approved",
        tone: application.statusMeta?.tone || "emerald",
      },
      ctaLabel: "Masuk ke Seller Workspace",
      href: fallbackStore
        ? createSellerWorkspaceRoutes(fallbackStore.store).home()
        : "/user/store-application",
      meta: application.reviewedAt ? `Direview ${formatDate(application.reviewedAt)}` : "Approved",
      icon: CheckCircle,
    };
  }

  if (application.status === "rejected") {
    return {
      title: "Pengajuan Ditolak",
      description:
        application.rejectReason ||
        application.statusMeta?.description ||
        "Pengajuan ditutup. Anda dapat membuat pengajuan baru dari halaman onboarding.",
      badge: {
        label: "Pengajuan Ditolak",
        tone: application.statusMeta?.tone || "rose",
      },
      ctaLabel: "Ajukan Ulang",
      href: "/user/store-application",
      meta: application.reviewedAt ? `Direview ${formatDate(application.reviewedAt)}` : "Closed",
      icon: BriefcaseBusiness,
    };
  }

  return {
    title: "Pengajuan Dibatalkan",
    description:
      application.statusMeta?.description ||
      "Pengajuan dibatalkan. Anda dapat memulai pengajuan baru saat sudah siap.",
    badge: {
      label: application.statusMeta?.label || "Cancelled",
      tone: application.statusMeta?.tone || "stone",
    },
    ctaLabel: "Ajukan Pembukaan Toko",
    href: "/user/store-application",
    meta: application.updatedAt ? `Diperbarui ${formatDate(application.updatedAt)}` : "Cancelled",
    icon: BriefcaseBusiness,
  };
};

const normalizeDashboardSettingCopy = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? source.dashboard : {};
  return {
    dashboardLabel: toText(dashboard.dashboardLabel, "Dashboard"),
    totalOrdersLabel: toText(dashboard.totalOrdersLabel, "Total Orders"),
    pendingOrderValue: toText(dashboard.pendingOrderValue, "Pending Orders"),
    processingOrderValue: toText(dashboard.processingOrderValue, "Processing Orders"),
    completeOrderValue: toText(dashboard.completeOrderValue, "Complete Orders"),
    recentOrderValue: toText(dashboard.recentOrderValue, "Recent Orders"),
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
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "pending"
  ).length;
  const processingOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "processing"
  ).length;
  const completeOrders = orders.filter(
    (order) => normalizeOrderStatus(order.status) === "complete"
  ).length;

  const statCards = [
    {
      label: dashboardSettingCopy.totalOrdersLabel,
      value: totalOrders,
      Icon: ShoppingCart,
      tone: "bg-rose-100 text-rose-600",
    },
    {
      label: dashboardSettingCopy.pendingOrderValue,
      value: pendingOrders,
      Icon: RotateCw,
      tone: "bg-amber-100 text-amber-600",
    },
    {
      label: dashboardSettingCopy.processingOrderValue,
      value: processingOrders,
      Icon: Truck,
      tone: "bg-sky-100 text-sky-600",
    },
    {
      label: dashboardSettingCopy.completeOrderValue,
      value: completeOrders,
      Icon: CheckCircle,
      tone: "bg-emerald-100 text-emerald-600",
    },
  ];

  const recentOrders = [...orders]
    .sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a))
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
          {dashboardSettingCopy.dashboardLabel}
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
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <OnboardingIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">{onboardingCard.title}</h2>
                  {onboardingCard.badge ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        ONBOARDING_TONE[onboardingCard.badge.tone] || ONBOARDING_TONE.stone
                      }`}
                    >
                      {onboardingCard.badge.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {onboardingCard.description}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {onboardingCard.meta}
                </p>
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
          {dashboardSettingCopy.recentOrderValue}
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
                    <th className="px-4 py-3">Shipping Cost</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const orderRef = getOrderRef(order);
                    const statusLabel = getOrderStatusLabel(order.status);
                    return (
                      <tr
                        key={order.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {orderRef || `#${order.id}`}
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
                              order.status
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">-</td>
                        <td className="px-4 py-3 text-slate-600">-</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {money(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {orderRef ? (
                            <Link
                              to={`/order/${encodeURIComponent(orderRef)}`}
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

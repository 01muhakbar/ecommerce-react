import React, { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { formatIDR } from "@/utils/currency";
import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { cn } from "@/utils/cn";

const WeeklySalesCard = lazy(() =>
  import("@/components/admin/charts/WeeklySalesCard").then((m) => ({
    default: m.WeeklySalesCard,
  }))
);
const BestSellingCard = lazy(() =>
  import("@/components/admin/charts/BestSellingCard").then((m) => ({
    default: m.BestSellingCard,
  }))
);

type EBProps = { fallback: React.ReactNode; children: React.ReactNode };
type EBState = { hasError: boolean };
class CardErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return <>{this.props.fallback}</>;
    return this.props.children as React.ReactElement;
  }
}

const CardSkeleton = ({ className }: { className?: string }) => (
  <div
    className={cn("rounded-xl border border-slate-200 bg-white p-5", className)}
  >
    <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
    <div className="mt-4 h-8 w-1/4 animate-pulse rounded bg-slate-200" />
    <div className="mt-6 h-40 w-full animate-pulse rounded bg-slate-200" />
  </div>
);

const EmptyWeeklyCard = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-2 text-base font-semibold">Weekly Sales</div>
    <p className="text-slate-500">
      Belum ada penjualan minggu ini.{" "}
      <Link className="text-emerald-600 underline" to="/admin/orders">
        Buat order
      </Link>
    </p>
  </div>
);

const EmptyBestSellingCard = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-2 text-base font-semibold">Best Selling Products</div>
    <p className="text-slate-500">
      Belum ada produk terlaris.{" "}
      <Link className="text-emerald-600 underline" to="/admin/catalog/products">
        Tambah produk
      </Link>
    </p>
  </div>
);

const DEFAULT_STATS = {
  todayOrders: 0,
  yesterdayOrders: 0,
  thisMonth: 0,
  lastMonth: 0,
  allTimeSales: 0,
  totalOrders: 0,
  pending: 0,
  processing: 0,
  delivered: 0,
};

export default function AdminDashboardPage() {
  const {
    data: rawStats,
    isLoading: statsLoading,
    isError: statsError,
  } = useAdminStats();

  const stats = useMemo(() => {
    if (!rawStats || statsError) return DEFAULT_STATS;
    return {
      todayOrders: Number(rawStats.todayAmount ?? 0),
      yesterdayOrders: Number(rawStats.yesterdayAmount ?? 0),
      thisMonth: Number(rawStats.thisMonthAmount ?? 0),
      lastMonth: Number(rawStats.lastMonthAmount ?? 0),
      allTimeSales: Number(rawStats.allTimeAmount ?? 0),
      totalOrders: Number(rawStats.totalOrders ?? 0),
      pending: Number(rawStats.ordersPending ?? 0),
      processing: Number(rawStats.ordersProcessing ?? 0),
      delivered: Number(rawStats.ordersDelivered ?? 0),
    };
  }, [rawStats, statsError]);

  return (
    <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard Overview</h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          title="Today Orders"
          value={formatIDR(stats.todayOrders)}
          tone="emerald"
          loading={statsLoading}
        />
        <KpiCard
          title="Yesterday Orders"
          value={formatIDR(stats.yesterdayOrders)}
          tone="orange"
          loading={statsLoading}
        />
        <KpiCard
          title="This Month"
          value={formatIDR(stats.thisMonth)}
          tone="emerald"
          loading={statsLoading}
        />
        <KpiCard
          title="Last Month"
          value={formatIDR(stats.lastMonth)}
          tone="blue"
          loading={statsLoading}
        />
        <KpiCard
          title="All-Time Sales"
          value={formatIDR(stats.allTimeSales)}
          tone="teal"
          loading={statsLoading}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatBox
          label="Total Order"
          value={stats.totalOrders}
          loading={statsLoading}
        />
        <StatBox
          label="Orders Pending"
          value={stats.pending}
          loading={statsLoading}
        />
        <StatBox
          label="Orders Processing"
          value={stats.processing}
          loading={statsLoading}
        />
        <StatBox
          label="Orders Delivered"
          value={stats.delivered}
          loading={statsLoading}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardErrorBoundary fallback={<EmptyWeeklyCard />}>
          <Suspense fallback={<CardSkeleton />}>
            <WeeklySalesCard defaultDays={7} />
          </Suspense>
        </CardErrorBoundary>

        <CardErrorBoundary fallback={<EmptyBestSellingCard />}>
          <Suspense fallback={<CardSkeleton />}>
            <BestSellingCard limit={5} />
          </Suspense>
        </CardErrorBoundary>
      </section>
    </main>
  );
}

function KpiCard({
  title,
  value,
  tone = "emerald",
  loading,
}: {
  title: string;
  value: string | number;
  tone?: "emerald" | "orange" | "blue" | "teal";
  loading?: boolean;
}) {
  if (loading) return <CardSkeleton />;

  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-600",
    orange: "bg-orange-500",
    blue: "bg-blue-600",
    teal: "bg-teal-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div
        className={cn(
          "mb-3 inline-block rounded-md px-2 py-1 text-white text-xs",
          toneMap[tone]
        )}
      >
        {title}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">
        Semua akun (super admin)
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-7 w-10 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

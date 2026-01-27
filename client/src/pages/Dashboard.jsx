import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { Toaster, toast } from "react-hot-toast";
import { statCards, orderStatusStats } from "../data/dashboardStats.js";
import { analyticsService, orderService } from "../api/index.ts";
import { useAuth } from "../auth/useAuth.js";
import KPIOverviewCards from "../components/dashboard/KPIOverviewCards.jsx";
import OrderStatusCards from "../components/dashboard/OrderStatusCards.jsx";
import WeeklySalesCard from "../components/dashboard/WeeklySalesCard.jsx";
import BestSellingCard from "../components/dashboard/BestSellingCard.jsx";
import RecentOrdersTable from "../components/dashboard/RecentOrdersTable.jsx";
import { formatCurrency } from "../utils/format.js";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, role } = useAuth();
  const currentRole = role || user?.role;
  const isAdmin =
    currentRole === "admin" || currentRole === "super_admin";
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [orderError, setOrderError] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [salesData, setSalesData] = useState({ sales: [], orders: [] });
  const [salesError, setSalesError] = useState("");
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [bestSelling, setBestSelling] = useState([]);
  const [bestSellingError, setBestSellingError] = useState("");
  const [isLoadingBestSelling, setIsLoadingBestSelling] = useState(true);
  const overviewToastShown = useRef(false);
  const statLabelMap = {
    today: "Today Orders",
    yesterday: "Yesterday Orders",
    "this-month": "This Month",
    "last-month": "Last Month",
    "all-time": "All-Time Sales",
  };

  const statusLabelMap = {
    total: "Total Order",
    pending: "Orders Pending",
    processing: "Orders Processing",
    completed: "Orders Delivered",
  };

  const loadOverview = async (isActive) => {
    setIsLoadingOverview(true);
    setOverviewError("");
    try {
      const data = await analyticsService.getOverview();
      if (!isActive()) return;
      setOverview(data);
    } catch (err) {
      if (!isActive()) return;
      setOverviewError("Failed to load overview.");
      if (!overviewToastShown.current) {
        toast.error("Failed to load dashboard data.");
        overviewToastShown.current = true;
      }
    } finally {
      if (isActive()) {
        setIsLoadingOverview(false);
      }
    }
  };

  const loadSummary = async (isActive) => {
    setIsLoadingSummary(true);
    setSummaryError("");
    try {
      const data = await analyticsService.getSummary(7);
      if (!isActive()) return;
      setSummary(data?.data || null);
    } catch (err) {
      if (!isActive()) return;
      setSummaryError("Failed to load summary.");
    } finally {
      if (isActive()) {
        setIsLoadingSummary(false);
      }
    }
  };

  const loadSales = async (isActive) => {
    setIsLoadingSales(true);
    setSalesError("");
    try {
      const data = await analyticsService.getWeeklySales(7);
      if (!isActive()) return;
      const series = data?.data || [];
      setSalesData({
        sales: series.map((item) => ({
          date: item.date,
          value: Number(item.sales) || 0,
        })),
        orders: series.map((item) => ({
          date: item.date,
          value: Number(item.orders) || 0,
        })),
      });
    } catch (err) {
      if (!isActive()) return;
      setSalesError("Failed to load sales data.");
    } finally {
      if (isActive()) {
        setIsLoadingSales(false);
      }
    }
  };

  const loadBestSelling = async (isActive) => {
    setIsLoadingBestSelling(true);
    setBestSellingError("");
    try {
      const data = await analyticsService.getBestSelling(7, 5);
      if (!isActive()) return;
      setBestSelling(data?.data || []);
    } catch (err) {
      if (!isActive()) return;
      setBestSellingError("Failed to load best selling.");
    } finally {
      if (isActive()) {
        setIsLoadingBestSelling(false);
      }
    }
  };

  const loadRecentOrders = async (isActive) => {
    setIsLoadingOrders(true);
    setOrderError("");
    try {
      const result = await orderService.listOrders({
        page: 1,
        pageSize: 10,
        sort: "createdAt",
        order: "desc",
      });
      if (!isActive()) return;
      setRecentOrders(result?.data || []);
    } catch (err) {
      if (!isActive()) return;
      setOrderError("Failed to load recent orders.");
    } finally {
      if (isActive()) {
        setIsLoadingOrders(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    loadRecentOrders(isActive);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    loadOverview(isActive);
    loadSummary(isActive);
    loadSales(isActive);
    loadBestSelling(isActive);
    return () => {
      active = false;
    };
  }, []);

  const handleStatusChange = async (order, status) => {
    if (!isAdmin) {
      return;
    }
    try {
      await orderService.updateOrderStatus(order.id, { status });
      setRecentOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, status } : item
        )
      );
      toast.success("Status updated");
      await loadRecentOrders(() => true);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Failed to update status.";
      toast.error(message);
    }
  };

  const handleInvoiceAction = () => {
    toast("Not implemented yet");
  };

  const breakdowns = useMemo(() => {
    if (summary?.today || summary?.yesterday) {
      return {
        today: { byMethod: summary?.today?.byMethod || {} },
        yesterday: { byMethod: summary?.yesterday?.byMethod || {} },
      };
    }
    return {};
  }, [summary]);

  const kpiItems = useMemo(() => {
    const todayTotal = Number(summary?.today?.total) || 0;
    const yesterdayTotal = Number(summary?.yesterday?.total) || 0;
    const thisMonthTotal = Number(summary?.thisMonth?.total) || 0;
    const lastMonthTotal = Number(summary?.lastMonth?.total) || 0;
    const allTimeTotal = Number(summary?.allTime?.total) || 0;

    return statCards.map((card) => {
      const rawValue =
        card.id === "today"
          ? todayTotal
          : card.id === "yesterday"
            ? yesterdayTotal
            : card.id === "this-month"
              ? thisMonthTotal
              : card.id === "last-month"
                ? lastMonthTotal
                : card.id === "all-time"
                  ? allTimeTotal
                  : 0;
      return {
        ...card,
        value: rawValue,
        displayValue: formatCurrency(rawValue),
      };
    });
  }, [summary]);

  const statusCounts = overview?.statusCounts || {};
  const pendingAmount = overview?.kpis?.pendingAmount ?? 0;
  const pendingAmountValue = pendingAmount > 0 ? pendingAmount : null;
  const statusItems = useMemo(() => {
    return orderStatusStats.map((item) => ({
      ...item,
      count: statusCounts[item.id] ?? 0,
    }));
  }, [statusCounts]);

  const chartSales = useMemo(() => {
    return (salesData?.sales || []).map((item) => ({
      name: dayjs(item.date).isValid()
        ? dayjs(item.date).format("ddd")
        : item.date,
      value: Number(item.value) || 0,
    }));
  }, [salesData]);

  const chartOrders = useMemo(() => {
    return (salesData?.orders || []).map((item) => ({
      name: dayjs(item.date).isValid()
        ? dayjs(item.date).format("ddd")
        : item.date,
      value: Number(item.value) || 0,
    }));
  }, [salesData]);

  const bestSellingItems = useMemo(() => {
    return bestSelling.map((item) => ({
      name: item.name || "Unknown",
      value: Number(item.soldQty ?? item.qty) || 0,
      revenue: Number(item.revenue) || 0,
    }));
  }, [bestSelling]);

  return (
    <div className="dashboard">
      <Toaster position="top-right" />
      <div className="dashboard__header">
        <h1>Dashboard Overview</h1>
      </div>
      <KPIOverviewCards
        items={isLoadingSummary || summaryError ? statCards : kpiItems}
        labelMap={statLabelMap}
        breakdowns={breakdowns}
      />

      <OrderStatusCards
        items={isLoadingOverview || overviewError ? orderStatusStats : statusItems}
        labelMap={statusLabelMap}
        pendingAmount={pendingAmountValue}
      />

      <div className="dashboard-charts">
        <WeeklySalesCard
          salesData={chartSales}
          ordersData={chartOrders}
          isLoading={isLoadingSales}
          error={salesError}
        />
        <BestSellingCard
          items={bestSellingItems}
          isLoading={isLoadingBestSelling}
          error={bestSellingError}
        />
      </div>

      {isLoadingOrders && (
        <div className="dashboard-recent dashboard-recent--loading">
          Loading recent orders...
        </div>
      )}
      {!isLoadingOrders && orderError && (
        <div className="dashboard-recent dashboard-recent--error">
          {orderError}
        </div>
      )}
      {!isLoadingOrders && !orderError && recentOrders.length === 0 && (
        <div className="dashboard-recent dashboard-recent--empty">
          No data available
        </div>
      )}
      {!isLoadingOrders && !orderError && recentOrders.length > 0 && (
        <RecentOrdersTable
          orders={recentOrders}
          isAdmin={isAdmin}
          onStatusChange={handleStatusChange}
          onInvoiceAction={handleInvoiceAction}
        />
      )}
    </div>
  );
}

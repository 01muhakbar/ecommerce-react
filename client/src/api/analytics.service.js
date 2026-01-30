import { api } from "./axios";

const toYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLastSevenDates = () => {
  const today = new Date();
  const dates = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    dates.push(toYmd(d));
  }
  return dates;
};

export async function getOverview() {
  const { data } = await api.get("/admin/stats/overview");
  const statusCounts = data?.statusCounts || {};
  const delivered = Number(statusCounts.delivered || 0);
  const pending = Number(statusCounts.pending || 0);
  const processing = Number(statusCounts.processing || 0);
  const shipped = Number(statusCounts.shipped || 0);
  const cancelled = Number(statusCounts.cancelled || 0);
  const total =
    Number(data?.allTimeOrdersCount || 0) ||
    pending + processing + shipped + delivered + cancelled;

  return {
    ...data,
    statusCounts: {
      ...statusCounts,
      pending,
      processing,
      completed: delivered,
      delivered,
      shipped,
      cancelled,
      total,
    },
    kpis: {
      pendingAmount: 0,
    },
  };
}

export async function getSummary(_days = 7) {
  const { data } = await api.get("/admin/stats/overview");
  return {
    data: {
      today: { total: Number(data?.todayRevenue || 0), byMethod: {} },
      yesterday: { total: Number(data?.yesterdayRevenue || 0), byMethod: {} },
      thisMonth: { total: Number(data?.monthRevenue || 0) },
      lastMonth: { total: Number(data?.lastMonthRevenue || 0) },
      allTime: { total: Number(data?.allTimeRevenue || 0) },
    },
  };
}

export async function getWeeklySales(_days = 7) {
  const { data } = await api.get("/admin/stats/weekly");
  const rows = Array.isArray(data?.data) ? data.data : [];
  const rowByDate = new Map(
    rows.map((item) => [
      item.day || item.date,
      {
        sales: Number(item.sales || 0),
        orders: Number(item.orders || 0),
      },
    ])
  );
  const normalized = getLastSevenDates().map((date) => {
    const match = rowByDate.get(date) || { sales: 0, orders: 0 };
    return { date, sales: match.sales, orders: match.orders };
  });
  return {
    data: normalized,
  };
}

export async function getBestSelling(_days = 7, _limit = 5) {
  const { data } = await api.get("/admin/stats/best-sellers");
  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    data: rows
      .map((item) => ({
        name: item.name,
        qty: Number(item.qty || 0),
        revenue: 0,
      }))
      .slice(0, _limit),
  };
}

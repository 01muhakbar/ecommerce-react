import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import StatCard from "../components/StatCard"; // Assuming this is your StatCard component
import SalesChart from "../components/SalesChart"; // Assuming this is your SalesChart component
import BestSellersChart from "../components/BestSellersChart"; // Assuming this is your BestSellersChart component
import OrdersTable from "../components/OrdersTable"; // Import the new OrdersTable component

// --- Icon Components for StatCards ---
const DollarSignIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ShoppingCartIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const RefreshCwIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21.5 2v6h-6" />
    <path d="M2.5 22v-6h6" />
    <path d="M21.5 12c0 7-6.5 9-9 9s-9-2-9-9 6.5-9 9-9c1.8 0 3.5.2 5.1.7" />
  </svg>
);

// --- TYPE DEFINITIONS ---

interface SummaryStats {
  todaySales: number;
  yesterdaySales: number;
  thisMonthSales: number;
  lastMonthSales: number;
  allTimeSales: number;
}

interface OrderStatusCounts {
  total: number;
  pending: number;
  processing: number;
  delivered: number;
}

interface WeeklySalesData {
  date: string;
  sales: number;
}

interface BestSellingProduct {
  name: string;
  sales: number;
}

interface RecentOrder {
  invoiceNo: number;
  orderTime: string;
  status: "pending" | "processing" | "shipped" | "completed" | "cancelled";
  amount: number;
  User: { name: string };
}

interface DashboardData {
  summaryStats: SummaryStats;
  orderStatusCounts: OrderStatusCounts;
  weeklySalesData: WeeklySalesData;
  bestSellingProducts: BestSellingProduct[];
  recentOrders: RecentOrder[];
}

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const AdminDashboardPage: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ["adminDashboardStatistics"],
    queryFn: async () => {
      const response = await api.get("/admin/dashboard/statistics");
      return response.data.data; // Perbaikan: Akses objek 'data' di dalam respons
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-300 rounded-lg shadow-md"></div>
        ))}
        <div className="lg:col-span-2 h-80 bg-gray-300 rounded-lg shadow-md"></div>
        <div className="lg:col-span-2 h-80 bg-gray-300 rounded-lg shadow-md"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-red-600 bg-red-100 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
        <p>
          There was an error fetching dashboard data:{" "}
          {error?.message || "Unknown error"}
        </p>
      </div>
    );
  }

  // Debugging: Log the data before destructuring
  // console.log("Data from useQuery:", data);

  // Add a check for data being undefined or null
  if (!data) {
    return (
      <div className="p-6 text-red-600 bg-red-100 border border-red-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Error: Data is undefined</h2>
        <p>
          Dashboard data could not be loaded. Please check the network request
          and backend response.
        </p>
      </div>
    );
  }

  const {
    summaryStats,
    orderStatusCounts,
    weeklySalesData,
    bestSellingProducts,
    recentOrders,
  } = data;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Penjualan Hari Ini"
          value={formatCurrency(summaryStats.todaySales)}
          icon={<DollarSignIcon />}
          color="bg-blue-500"
        />
        <StatCard
          title="Penjualan Kemarin"
          value={formatCurrency(summaryStats.yesterdaySales)}
          icon={<DollarSignIcon />}
          color="bg-green-500"
        />
        <StatCard
          title="Pesanan Total"
          value={orderStatusCounts.total}
          icon={<ShoppingCartIcon />}
          color="bg-purple-500"
        />
        <StatCard
          title="Pesanan Selesai"
          value={orderStatusCounts.delivered}
          icon={<CheckCircleIcon />}
          color="bg-teal-500"
        />
      </div>

      {/* Monthly Sales & Order Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">
            Ringkasan Penjualan Bulanan
          </h3>
          <div className="space-y-2">
            <p>
              Penjualan Bulan Ini:{" "}
              <span className="font-bold text-gray-800">
                {formatCurrency(summaryStats.thisMonthSales)}
              </span>
            </p>
            <p>
              Penjualan Bulan Lalu:{" "}
              <span className="font-bold text-gray-800">
                {formatCurrency(summaryStats.lastMonthSales)}
              </span>
            </p>
            <p>
              Penjualan Sepanjang Waktu:{" "}
              <span className="font-bold text-gray-800">
                {formatCurrency(summaryStats.allTimeSales)}
              </span>
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Status Pesanan</h3>
          <div className="space-y-2">
            <p>
              Total Pesanan:{" "}
              <span className="font-bold">{orderStatusCounts.total}</span>
            </p>
            <p>
              Pending:{" "}
              <span className="font-bold text-yellow-600">
                {orderStatusCounts.pending}
              </span>
            </p>
            <p>
              Processing:{" "}
              <span className="font-bold text-blue-600">
                {orderStatusCounts.processing}
              </span>
            </p>
            <p>
              Delivered:{" "}
              <span className="font-bold text-green-600">
                {orderStatusCounts.delivered}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart data={weeklySalesData} />
        <BestSellersChart data={bestSellingProducts} />
      </div>

      {/* Recent Order Section */}
      <div className="mt-8">
        {recentOrders && (
          <OrdersTable title="Recent Orders" orders={recentOrders} />
        )}
      </div>
    </div>
  );
};

export default AdminDashboardPage;

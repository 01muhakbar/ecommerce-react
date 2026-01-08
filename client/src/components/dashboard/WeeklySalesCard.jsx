import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function WeeklySalesCard({
  salesData = [],
  ordersData = [],
  isLoading = false,
  error = "",
}) {
  const [activeTab, setActiveTab] = useState("sales");

  const data = useMemo(() => {
    return activeTab === "orders" ? ordersData : salesData;
  }, [activeTab, ordersData, salesData]);

  return (
    <div className="dashboard-card dashboard-card--chart">
      <div className="dashboard-card__header">
        <div>
          <h3 className="dashboard-card__title">Weekly Sales</h3>
          <span className="dashboard-card__hint">Last 7 days</span>
        </div>
        <div className="dashboard-tabs" role="tablist" aria-label="Sales Tabs">
          <button
            type="button"
            className={`dashboard-tab ${
              activeTab === "sales" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("sales")}
            role="tab"
            aria-selected={activeTab === "sales"}
          >
            Sales
          </button>
          <button
            type="button"
            className={`dashboard-tab ${
              activeTab === "orders" ? "is-active" : ""
            }`}
            onClick={() => setActiveTab("orders")}
            role="tab"
            aria-selected={activeTab === "orders"}
          >
            Orders
          </button>
        </div>
      </div>
      <div className="dashboard-chart">
        {isLoading ? (
          <div className="dashboard-chart__placeholder">Loading chart...</div>
        ) : error ? (
          <div className="dashboard-chart__placeholder">{error}</div>
        ) : data.length === 0 ? (
          <div className="dashboard-chart__placeholder">
            No data available. The chart will appear once data is available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
              <Tooltip cursor={{ stroke: "#cbd5f5", strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

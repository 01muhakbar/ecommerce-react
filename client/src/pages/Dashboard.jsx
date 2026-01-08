import { statCards, orderStatusStats } from "../data/dashboardStats.js";
import { orders } from "../data/orders.js";
import { formatCurrency } from "../utils/format.js";
import StatCard from "../components/Cards/StatCard.jsx";
import OrderStatusCard from "../components/Cards/OrderStatusCard.jsx";
import WeeklySalesChart from "../components/Charts/WeeklySalesChart.jsx";
import OrderTable from "../components/Tables/OrderTable.jsx";

import "./Dashboard.css";

export default function Dashboard() {
  const statLabelMap = {
    today: "Today Orders",
    yesterday: "Yesterday Orders",
    "this-month": "This Month",
    "last-month": "Last Month",
    "all-time": "All-Time Sales",
  };

  const statSubtitleMap = {
    today: "vs yesterday",
    "this-month": "MTD",
    "all-time": "Since launch",
  };

  const statHelperMap = {
    today: "+12% vs yesterday",
    yesterday: "Daily snapshot",
    "this-month": "Month-to-date",
    "last-month": "Previous period",
    "all-time": "Lifetime total",
  };

  const statusLabelMap = {
    total: "Total",
    pending: "Pending",
    processing: "Processing",
    delivered: "Delivered",
  };

  return (
    <div className="dashboard">
      {/* KPI cards */}
      <div className="dashboard__stats">
        {statCards.map((item) => (
          <StatCard
            key={item.id}
            title={statLabelMap[item.id] || item.label}
            value={item.value}
            subtitle={statSubtitleMap[item.id] || item.subtitle}
            helperText={statHelperMap[item.id]}
            color={item.variant}
            format={item.id === "all-time" ? formatCurrency : undefined}
          />
        ))}
      </div>

      {/* Sales overview + order status */}
      <div className="dashboard__grid">
        <WeeklySalesChart />

        <div className="status-card-group">
          <h3>Order Status</h3>

          <div className="status-card-group__items">
            {orderStatusStats.map((item) => (
              <OrderStatusCard
                key={item.id}
                title={statusLabelMap[item.id] || item.label}
                value={item.count}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Best selling + recent orders */}
      <div className="dashboard__grid">
        <div className="best-selling">
          <h3>Best Selling Products</h3>
          <p className="best-selling__empty">
            No data available. This section will show best selling products
            once data is available.
          </p>
        </div>

        <div className="recent-orders">
          <h3>Recent Orders</h3>
          <OrderTable orders={orders} />
        </div>
      </div>
    </div>
  );
}

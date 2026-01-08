import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9"];

export default function BestSellingCard({
  items = [],
  isLoading = false,
  error = "",
}) {
  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);
  const data = items.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
    percent: total ? Math.round((item.value / total) * 100) : 0,
  }));

  const hasData = data.length > 0 && data.some((item) => item.value > 0);

  return (
    <div className="dashboard-card dashboard-card--chart">
      <div className="dashboard-card__header">
        <div>
          <h3 className="dashboard-card__title">Best Selling Products</h3>
          <span className="dashboard-card__hint">Last 7 days</span>
        </div>
      </div>
      <div className="best-selling-card__content">
        <div className="best-selling-card__chart">
          {isLoading ? (
            <div className="best-selling-card__placeholder">
              Loading chart...
            </div>
          ) : error ? (
            <div className="best-selling-card__placeholder">{error}</div>
          ) : !hasData ? (
            <div className="best-selling-card__placeholder">
              No data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="best-selling-card__legend">
          {hasData
            ? data.map((item) => (
                <div key={item.name} className="best-selling-card__legend-item">
                  <span
                    className="best-selling-card__dot"
                    style={{ background: item.color }}
                    aria-hidden="true"
                  />
                  <span className="best-selling-card__name">{item.name}</span>
                  <span className="best-selling-card__value">
                    {item.percent}%
                  </span>
                </div>
              ))
            : null}
        </div>
      </div>
    </div>
  );
}

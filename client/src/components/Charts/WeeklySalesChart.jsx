import "./WeeklySalesChart.css";

export default function WeeklySalesChart() {
  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h3>Weekly Sales</h3>
        <span className="chart-card__hint">Last 7 days</span>
      </div>
      <div className="chart-card__placeholder">
        No data available. The chart will appear once data is available.
      </div>
    </div>
  );
}

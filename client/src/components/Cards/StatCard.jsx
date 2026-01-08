import "./StatCard.css";

export default function StatCard({
  title,
  value,
  subtitle,
  color,
  format,
  helperText,
}) {
  const displayValue = typeof format === "function" ? format(value) : value;
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__title">{title}</div>
      <div className="stat-card__value">{displayValue}</div>
      {subtitle && <div className="stat-card__subtitle">{subtitle}</div>}
      {helperText && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

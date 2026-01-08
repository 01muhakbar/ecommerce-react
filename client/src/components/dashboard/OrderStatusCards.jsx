const ICONS = {
  total: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10l-1 6H8L7 6Z" />
      <path d="M6 12v6h12v-6" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9" />
      <path d="M3 12h4" />
    </svg>
  ),
  processing: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h12l-1.5 5H5.5L4 7Z" />
      <path d="M8 12v6" />
      <path d="M12 12v6" />
    </svg>
  ),
  completed: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" />
    </svg>
  ),
};

const formatUSD = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function OrderStatusCards({ items, labelMap, pendingAmount }) {
  return (
    <div className="dashboard-status-row">
      {items.map((item) => (
        <div key={item.id} className="status-mini-card">
          <div className={`status-mini-card__icon status-mini-card__icon--${item.id}`}>
            {ICONS[item.id]}
          </div>
          <div>
            <div className="status-mini-card__label">
              {labelMap[item.id] || item.label}
            </div>
            {item.id === "pending" ? (
              <div className="status-mini-card__note">
                ({formatUSD(pendingAmount)})
              </div>
            ) : null}
            <div className="status-mini-card__value">{item.count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

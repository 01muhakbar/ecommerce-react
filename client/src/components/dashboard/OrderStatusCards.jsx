import { formatCurrency } from "../../utils/format.js";

const DEFAULT_ICONS = {
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

const ADMIN_ICONS = {
  total: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4l6 3.2-6 3.2-6-3.2L12 4Z" />
      <path d="M6 12.2 12 15.4l6-3.2" />
      <path d="M6 16.8 12 20l6-3.2" />
    </svg>
  ),
  pending: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v3" />
      <path d="M12 17v3" />
      <path d="M4 12h3" />
      <path d="M17 12h3" />
      <path d="m6.3 6.3 2.1 2.1" />
      <path d="m15.6 15.6 2.1 2.1" />
      <path d="m17.7 6.3-2.1 2.1" />
      <path d="m8.4 15.6-2.1 2.1" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  ),
  processing: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4l6 3.5v9L12 20l-6-3.5v-9L12 4Z" />
      <path d="M6 7.5 12 11l6-3.5" />
      <path d="M12 11v9" />
    </svg>
  ),
  completed: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.7 12.2 11 14.5l4.6-4.8" />
    </svg>
  ),
};

export default function OrderStatusCards({
  items,
  labelMap,
  pendingAmount,
  formatMoney,
  iconStyle = "default",
}) {
  const formatPendingAmount =
    typeof formatMoney === "function"
      ? formatMoney
      : (value) => formatCurrency(value);
  const icons = iconStyle === "admin-acuan" ? ADMIN_ICONS : DEFAULT_ICONS;

  return (
    <div className="dashboard-status-row">
      {items.map((item) => (
        <div key={item.id} className="status-mini-card">
          <div className="status-mini-card__top">
            <div className={`status-mini-card__icon status-mini-card__icon--${item.id}`}>
              {icons[item.id]}
            </div>
            {item.id === "pending" && pendingAmount ? (
              <div className="status-mini-card__note">
                {formatPendingAmount(pendingAmount)}
              </div>
            ) : null}
          </div>
          <div className="status-mini-card__content">
            <div className="status-mini-card__label">
              {labelMap[item.id] || item.label}
            </div>
            <div className="status-mini-card__value">{item.count}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

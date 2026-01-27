import { CreditCard, Layers, ShoppingCart } from "lucide-react";
import { formatCurrency } from "../../utils/format.js";

const ICON_MAP = {
  today: Layers,
  yesterday: Layers,
  "this-month": ShoppingCart,
  "last-month": CreditCard,
  "all-time": CreditCard,
};

export default function KPIOverviewCards({
  items,
  labelMap,
  breakdowns,
}) {
  return (
    <div className="dashboard-kpi">
      {items.map((item) => {
        const title = labelMap[item.id] || item.label;
        const value = item.displayValue ?? formatCurrency(item.value);
        const breakdown = breakdowns[item.id];
        const Icon = ICON_MAP[item.id] || Layers;
        const valueClass =
          item.id === "all-time" ? "kpi-card__value--wide" : "";
        const byMethod =
          breakdown?.byMethod && typeof breakdown.byMethod === "object"
            ? breakdown.byMethod
            : breakdown && typeof breakdown === "object"
              ? breakdown
              : null;
        const methodEntries = byMethod
          ? Object.entries(byMethod).filter(([, value]) => Number(value) > 0)
          : [];
        const methodList = methodEntries.slice(0, 3);

        return (
          <div key={item.id} className={`kpi-card kpi-card--${item.variant}`}>
            <div className="kpi-card__icon" aria-hidden="true">
              <Icon size={22} strokeWidth={2} />
            </div>
            <div className="kpi-card__title">{title}</div>
            <div
              className={`kpi-card__value ${valueClass}`}
              title={item.id === "all-time" ? String(value) : undefined}
            >
              {value}
            </div>
            {byMethod ? (
              <div className="kpi-card__breakdown">
                {methodList.length === 0 ? (
                  <div>
                    <span>—</span>
                    <strong>—</strong>
                  </div>
                ) : (
                  methodList.map(([method, value]) => (
                    <div key={method}>
                      <span>{method}</span>
                      <strong>{formatCurrency(Number(value) || 0)}</strong>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

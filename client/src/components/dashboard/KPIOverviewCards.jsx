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
            {breakdown ? (
              <div className="kpi-card__breakdown">
                <div>
                  <span>Cash</span>
                  <strong>
                    {typeof breakdown.cash === "string"
                      ? breakdown.cash
                      : formatCurrency(breakdown.cash)}
                  </strong>
                </div>
                <div>
                  <span>Card</span>
                  <strong>
                    {typeof breakdown.card === "string"
                      ? breakdown.card
                      : formatCurrency(breakdown.card)}
                  </strong>
                </div>
                <div>
                  <span>Credit</span>
                  <strong>
                    {typeof breakdown.credit === "string"
                      ? breakdown.credit
                      : formatCurrency(breakdown.credit)}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

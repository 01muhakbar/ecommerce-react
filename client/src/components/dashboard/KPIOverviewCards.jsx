import {
  Archive,
  CalendarDays,
  Clock3,
  ShoppingBag,
  TrendingUp,
  Layers3,
} from "lucide-react";
import { formatCurrency } from "../../utils/format.js";

const ICON_MAP = {
  today: ShoppingBag,
  yesterday: Archive,
  "this-month": CalendarDays,
  "last-month": Clock3,
  "all-time": TrendingUp,
};

export default function KPIOverviewCards({
  items,
  labelMap,
  formatMoney,
}) {
  return (
    <div className="dashboard-kpi">
      {items.map((item) => {
        const title = labelMap[item.id] || item.label;
        const value =
          item.displayValue ??
          (typeof formatMoney === "function"
            ? formatMoney(item.value)
            : formatCurrency(item.value));
        const Icon = item.icon || ICON_MAP[item.id] || Layers3;
        const isWideValue = String(value).length >= 11;
        const valueClass = isWideValue ? "kpi-card__value--wide" : "";

        return (
          <div key={item.id} className={`kpi-card kpi-card--${item.variant}`}>
            <div className="kpi-card__icon" aria-hidden="true">
              <Icon size={18} strokeWidth={1.9} />
            </div>
            <div
              className={`kpi-card__value ${valueClass}`}
              title={isWideValue ? String(value) : undefined}
            >
              {value}
            </div>
            <div className="kpi-card__title">{title}</div>
          </div>
        );
      })}
    </div>
  );
}

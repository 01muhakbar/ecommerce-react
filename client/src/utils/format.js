import { formatStoreMoney } from "./storeMoneyFormatters.js";

export function formatCurrency(value) {
  return formatStoreMoney(value);
}

export function formatPercent(value) {
  return `${value}%`;
}

import { formatCurrency } from "./format.js";

export const moneyIDR = (value) => formatCurrency(Number(value || 0));

// UI formatting helpers (keep data as numbers, format at render time)
export function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value) {
  return `${value}%`;
}

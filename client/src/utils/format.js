// UI formatting helpers (keep data as numbers, format at render time)
const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value) {
  const formatted = idrFormatter.format(Number(value || 0));
  return formatted.replace("Rp", "Rp ").replace(/\s+/g, " ").trim();
}

export function formatPercent(value) {
  return `${value}%`;
}

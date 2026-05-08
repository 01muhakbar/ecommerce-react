export const safeNumber = (n: unknown): number => {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
};

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatIDR = (n: unknown): string =>
  idrFormatter
    .format(safeNumber(n))
    .replace("Rp", "Rp ")
    .replace(/\s+/g, " ")
    .trim();

export const safeNumber = (n: unknown): number => {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : 0;
};

export const formatIDR = (n: unknown): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(safeNumber(n));

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export type WeeklyPoint = {
  /** tanggal dalam string (YYYY-MM-DD) atau label yang ingin ditampilkan */
  date: string;
  /** total penjualan (IDR) untuk hari tsb */
  sales: number;
  /** total jumlah order untuk hari tsb */
  orders: number;
  /** pembanding minggu lalu (opsional, bila backend kirim) */
  prevSales?: number;
  prevOrders?: number;
};

type BackendWeeklySalesResponse = {
  /** seri minggu ini; backend boleh pakai 'series' atau 'current' */
  series?: Array<any>;
  current?: Array<any>;
  /** seri minggu lalu (opsional) */
  prevSeries?: Array<any>;
};

/**
 * Ambil data weekly sales + orders untuk N hari ke belakang.
 * @param days 7 | 14 | 30
 * @param params opsional filter tambahan (mis. tz, from, to)
 */
export function useWeeklySales(
  days: 7 | 14 | 30 = 7,
  params?: Record<string, string | number | boolean | undefined>
) {
  return useQuery({
    queryKey: ["analytics-weekly", { days, params }],
    queryFn: async (): Promise<WeeklyPoint[]> => {
      const { data } = await axios.get<BackendWeeklySalesResponse>(
        "/api/admin/analytics/weekly-sales",
        {
          params: { days, ...(params || {}) },
          withCredentials: true,
        }
      );

      const currRaw = Array.isArray(data?.series)
        ? data.series
        : Array.isArray(data?.current)
        ? data.current
        : [];

      const prevRaw = Array.isArray(data?.prevSeries) ? data.prevSeries : [];

      // Normalisasi -> map ke shape yang konsisten
      const prevMap = new Map<string, { sales?: number; orders?: number }>();
      for (const d of prevRaw) {
        const key = String(d.date ?? d.day ?? d.label ?? "");
        if (!key) continue;
        prevMap.set(key, {
          sales: Number(d.sales ?? d.amount ?? d.total ?? 0),
          orders: Number(d.orders ?? d.count ?? 0),
        });
      }

      const normalized: WeeklyPoint[] = currRaw.map((d: any) => {
        const key = String(d.date ?? d.day ?? d.label ?? "");
        const pv = prevMap.get(key);
        return {
          date: key,
          sales: Number(d.sales ?? d.amount ?? d.total ?? 0),
          orders: Number(d.orders ?? d.count ?? 0),
          prevSales: pv?.sales,
          prevOrders: pv?.orders,
        };
      });

      return normalized;
    },
    placeholderData: [],
    staleTime: 60_000,        // data dianggap masih segar 1 menit
    refetchInterval: 60_000,  // auto refresh 1 menit
  });
}
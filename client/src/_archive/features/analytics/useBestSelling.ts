import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export type BestItem = {
  /** nama produk */
  name: string;
  /** total qty terjual pada periode (pcs) */
  qty: number;
  /** opsional: omzet IDR bila backend sediakan */
  sales?: number;
};

type BackendBestSellingResponse = {
  items?: Array<any>;
  data?: Array<any>;
};

/**
 * Ambil produk terlaris, default 5 item.
 * @param limit jumlah item
 * @param params opsional filter (mis. from, to, tz, categoryId)
 */
export function useBestSelling(
  limit = 5,
  params?: Record<string, string | number | boolean | undefined>
) {
  return useQuery({
    queryKey: ["analytics-best", { limit, params }],
    queryFn: async (): Promise<BestItem[]> => {
      const { data } = await axios.get<BackendBestSellingResponse>(
        "/api/admin/analytics/best-selling",
        {
          params: { limit, ...(params || {}) },
          withCredentials: true,
        }
      );

      const raw = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
        ? data.data
        : [];

      return raw.map((d: any) => ({
        name: String(d.name ?? d.product_name ?? d.title ?? ""),
        qty: Number(d.qty ?? d.quantity ?? d.count ?? 0),
        sales: d.sales != null ? Number(d.sales ?? d.amount ?? d.total) : undefined,
      }));
    },
    placeholderData: [],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
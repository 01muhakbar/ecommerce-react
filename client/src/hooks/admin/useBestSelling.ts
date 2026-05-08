import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";

export type BestSellingItem = {
  productId: number | string;
  name: string;
  sales: number;
  price?: number | string | null;
  slug?: string | null;
  mainImageUrl?: string | null;
};

const EMPTY: BestSellingItem[] = [];

export function useBestSelling(limit = 5) {
  return useQuery({
    queryKey: ["admin", "analytics", "best-selling", limit],
    queryFn: async (): Promise<BestSellingItem[]> => {
      try {
        const { data } = await api.get(`/admin/analytics/best-selling`, {
          params: { limit },
        });
        // Normalize: always return array
        return Array.isArray(data?.items) ? data.items : EMPTY;
      } catch (err: any) {
        // If not authenticated or not found, keep UI alive
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) return EMPTY;
        throw err;
      }
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

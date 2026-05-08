import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";
import { prevData } from "@/lib/rq";

export type WeeklySalesResponse = {
  sales: number[];
  orders: number[];
  prevSales: number;
};

export type WeeklySales = {
  sales: number[];
  orders: number[];
  prevSales: number;
};

const DEFAULT_WEEKLY: WeeklySales = {
  sales: [],
  orders: [],
  prevSales: 0,
};

export function useWeeklySales(days = 7, opts?: { enabled?: boolean }) {
  return useQuery<WeeklySalesResponse, unknown, WeeklySales>({
    queryKey: ["admin", "analytics", "weekly-sales", days],
    queryFn: async () => {
      const { data } = await api.get<WeeklySalesResponse>(
        "/admin/analytics/weekly-sales",
        { params: { days } }
      );
      return data;
    },
    select: (data): WeeklySales => ({
      sales: Array.isArray(data?.sales) ? data.sales : [],
      orders: Array.isArray(data?.orders) ? data.orders : [],
      prevSales:
        typeof data?.prevSales === "number" && Number.isFinite(data.prevSales)
          ? data.prevSales
          : 0,
    }),
    initialData: DEFAULT_WEEKLY,
    placeholderData: prevData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    throwOnError: false,
    enabled: opts?.enabled ?? true,
  });
}

export default useWeeklySales;

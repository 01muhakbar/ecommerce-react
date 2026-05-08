import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";
import { prevData } from "@/lib/rq";

export type AdminStatsResponse = {
  todayAmount?: number;
  yesterdayAmount?: number;
  thisMonthAmount?: number;
  lastMonthAmount?: number;
  allTimeAmount?: number;

  totalOrders?: number;
  ordersPending?: number;
  ordersProcessing?: number;
  ordersDelivered?: number;
};

export type AdminStats = Required<AdminStatsResponse>;

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const DEFAULT_STATS: AdminStats = {
  todayAmount: 0,
  yesterdayAmount: 0,
  thisMonthAmount: 0,
  lastMonthAmount: 0,
  allTimeAmount: 0,

  totalOrders: 0,
  ordersPending: 0,
  ordersProcessing: 0,
  ordersDelivered: 0,
};

export function useAdminStats(opts?: { enabled?: boolean }) {
  return useQuery<AdminStatsResponse, unknown, AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get<AdminStatsResponse>("/admin/stats");
      return data;
    },
    select: (data): AdminStats => ({
      todayAmount: n(data?.todayAmount),
      yesterdayAmount: n(data?.yesterdayAmount),
      thisMonthAmount: n(data?.thisMonthAmount),
      lastMonthAmount: n(data?.lastMonthAmount),
      allTimeAmount: n(data?.allTimeAmount),

      totalOrders: n(data?.totalOrders),
      ordersPending: n(data?.ordersPending),
      ordersProcessing: n(data?.ordersProcessing),
      ordersDelivered: n(data?.ordersDelivered),
    }),
    initialData: DEFAULT_STATS,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: prevData,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    throwOnError: false,
    enabled: opts?.enabled ?? true,
  });
}

export default useAdminStats;

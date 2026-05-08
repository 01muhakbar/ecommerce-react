import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data } = await axios.get("/api/admin/stats", { withCredentials: true });
      return data as {
        todayOrdersAmount: number; yesterdayOrdersAmount: number;
        thisMonthAmount: number;    lastMonthAmount: number;
        allTimeAmount: number;
        totalOrders: number; ordersPending: number;
        ordersProcessing: number; ordersDelivered: number;
        currency: "IDR";
      };
    },
    staleTime: 60_000,
  });
}
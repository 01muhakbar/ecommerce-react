import { useQuery } from "@tanstack/react-query";
import { prevData } from "@/lib/rq";
import { http } from "@/lib/http";

export function useOrders(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const { page = 1, pageSize = 10, q = "", status, sort, order } = params || {};
  return useQuery({
    queryKey: ["orders", { page, pageSize, q, status, sort, order }],
    placeholderData: prevData,
    queryFn: async () => {
      const r = await http<{
        data: any[];
        pagination: {
          page: number;
          pageSize: number;
          total: number;
          totalPages?: number;
        };
      }>(
        `/admin/orders?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(
          q
        )}${status ? `&status=${status}` : ""}${sort ? `&sort=${sort}` : ""}${
          order ? `&order=${order}` : ""
        }`
      );
      return {
        data: r.data,
        meta: {
          page: r.pagination.page,
          pageSize: r.pagination.pageSize,
          total: r.pagination.total,
          totalPages:
            r.pagination.totalPages ??
            Math.max(
              1,
              Math.ceil(r.pagination.total / Math.max(1, r.pagination.pageSize))
            ),
        },
      };
    },
  });
}

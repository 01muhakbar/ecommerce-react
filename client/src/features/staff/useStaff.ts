import { useQuery } from "@tanstack/react-query";
import { prevData } from "@/lib/rq";
import { http } from "@/lib/http";

export function useStaff(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  const { page = 1, pageSize = 10, q = "", sort, order } = params || {};
  return useQuery({
    queryKey: ["staff", { page, pageSize, q, sort, order }],
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
        `/admin/staff?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(
          q
        )}${sort ? `&sort=${sort}` : ""}${order ? `&order=${order}` : ""}`
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

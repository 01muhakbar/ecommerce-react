import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";

export type Product = { id: number | string; name: string; price: number };

type ApiRes = {
  items?: Product[];
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
};

type TableData = {
  rows: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// ⬇️ default aman (tidak pernah undefined)
const EMPTY_API: ApiRes = Object.freeze({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});

function adapt(r?: ApiRes): TableData {
  const res = r ?? EMPTY_API;
  return {
    rows: Array.isArray(res.items) ? res.items : [],
    page: Number.isFinite(res.page as number) ? (res.page as number) : 1,
    pageSize: Number.isFinite(res.pageSize as number)
      ? (res.pageSize as number)
      : 10,
    total: Number.isFinite(res.total as number) ? (res.total as number) : 0,
    totalPages: Number.isFinite(res.totalPages as number)
      ? (res.totalPages as number)
      : 0,
  };
}

export function useProducts(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  enabled?: boolean; // Tambahkan opsi enabled
}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      // PERBAIKAN: URL yang diminta frontend salah. Seharusnya tidak ada "/catalog".
      // Ubah dari "/api/admin/catalog/products" menjadi "/api/admin/products".
      const { data } = await api.get<ApiRes>("/admin/products", {
        params: { ...params, enabled: undefined }, // Hapus 'enabled' dari params API
      });
      return adapt(data);
    },
    // ⬇️ data awal tidak pernah undefined
    initialData: adapt(EMPTY_API),
    keepPreviousData: true,
    enabled: params.enabled, // Gunakan opsi enabled dari parameter
  });
}

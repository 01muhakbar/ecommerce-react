import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import { prevData } from "@/lib/rq";

export type ProductRow = {
  id: number;
  name: string;
  category: string;
  price: number;
  salePrice: number;
  stock: number;
  status: "selling" | "soldout";
  published: boolean;
  slug?: string;
};

export function useProducts(params: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const { page = 1, pageSize = 10, q = "" } = params || {};
  return useQuery({
    queryKey: ["products", { page, pageSize, q }],
    placeholderData: prevData, // keepPreviousData diganti dengan placeholderData di v5
    queryFn: async () => {
      const r = await http<{
        data: any[];
        pagination: { page: number; pageSize: number; total: number };
      }>(
        `/admin/products?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(
          q
        )}`
      );
      return {
        items: r.data,
        page: r.pagination.page,
        pageSize: r.pagination.pageSize,
        total: r.pagination.total,
      };
    },
    staleTime: 60_000,
  });
}

export function useTogglePublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) => {
      // Menggunakan http helper, bukan axios langsung
      return http(`/admin/products/${id}/published`, {
        method: "PATCH",
        body: JSON.stringify({ published }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useChangeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: "selling" | "soldout";
    }) => {
      return http(`/admin/products/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http(`/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

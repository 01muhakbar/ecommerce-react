import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/api/categories";

export function useCategories(params: Parameters<typeof svc.listCategories>[0]) {
  return useQuery({
    queryKey: ["categories", params],
    queryFn: () => svc.listCategories(params),
    placeholderData: (prev) => prev,
  });
}
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: any) => svc.updateCategory(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
export function useBulkCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.bulkCategories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}
export function useSetPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) => svc.setPublish(id, published),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

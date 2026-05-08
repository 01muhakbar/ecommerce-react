import { useQuery } from "@tanstack/react-query";
import { fetchStoreCategories } from "../api/public/storeProducts.ts";

export const STORE_CATEGORIES_QUERY_KEY = ["storeCategories"];

export function useStoreCategories(options?: { parentsOnly?: boolean }) {
  const parentsOnly = options?.parentsOnly === true;
  const query = useQuery({
    queryKey: [...STORE_CATEGORIES_QUERY_KEY, parentsOnly ? "parents-only" : "all"],
    queryFn: () => fetchStoreCategories({ parentsOnly }),
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data?.data?.items ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

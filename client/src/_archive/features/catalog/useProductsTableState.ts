import { useSearchParams } from "react-router-dom";
import { useMemo, useCallback } from "react";

/**
 * Tipe data untuk parameter state tabel.
 */
type TableParams = {
  page: number;
  pageSize: number;
  q: string;
  sort: string;
  order: "asc" | "desc";
};

/**
 * Tipe data untuk fungsi-fungsi yang mengubah state tabel.
 */
type TableActions = {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setQuery: (query: string) => void;
  setSort: (field: string, direction: "asc" | "desc") => void;
};

/**
 * Custom hook untuk mengelola state tabel produk yang disinkronkan dengan URL.
 * @returns {object} Objek berisi `params` (state saat ini) dan `actions` (fungsi untuk mengubah state).
 */
export function useProductsTableState(): {
  params: TableParams;
  actions: TableActions;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  // `useMemo` digunakan agar objek `params` hanya dihitung ulang saat URL berubah.
  const params = useMemo<TableParams>(() => {
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const q = searchParams.get("q") || "";
    const sort = searchParams.get("sort") || "createdAt";
    const order = (searchParams.get("order") as "asc" | "desc") || "desc";

    return {
      page: Math.max(1, page), // Pastikan halaman tidak kurang dari 1
      pageSize: Math.max(5, pageSize), // Pastikan ukuran halaman minimal 5
      q,
      sort,
      order,
    };
  }, [searchParams]);

  // `useCallback` digunakan untuk memastikan fungsi-fungsi ini tidak dibuat ulang di setiap render.
  const createSetter = useCallback(
    (newParams: Partial<TableParams>) => {
      const updated = new URLSearchParams(searchParams);
      Object.entries(newParams).forEach(([key, value]) => {
        updated.set(key, String(value));
      });
      // Saat query baru, selalu reset ke halaman 1
      if ("q" in newParams) {
        updated.set("page", "1");
      }
      setSearchParams(updated);
    },
    [searchParams, setSearchParams]
  );

  const actions = useMemo<TableActions>(
    () => ({
      setPage: (page: number) => createSetter({ page }),
      setPageSize: (pageSize: number) => createSetter({ pageSize, page: 1 }), // Reset ke halaman 1 saat ukuran halaman berubah
      setQuery: (q: string) => createSetter({ q }),
      setSort: (sort: string, order: "asc" | "desc") =>
        createSetter({ sort, order }),
    }),
    [createSetter]
  );

  return { params, actions };
}

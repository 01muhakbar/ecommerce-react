import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

function toInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export function useProductsTableState() {
  const [sp, setSp] = useSearchParams();

  const page = toInt(sp.get("page"), 1);
  const pageSize = toInt(sp.get("pageSize"), 10);
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "createdAt";
  const order = (sp.get("order") ?? "desc") as "asc" | "desc";

  const params = useMemo(
    () => ({ page, pageSize, q, sort, order }),
    [page, pageSize, q, sort, order]
  );

  const setParam = (key: string, value: string | number | undefined) => {
    const next = new URLSearchParams(sp);
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
    setSp(next, { replace: true });
  };

  const actions = {
    setPage: (v: number) => setParam("page", Math.max(1, v)),
    setPageSize: (v: number) => {
      setParam("pageSize", Math.max(1, v));
      setParam("page", 1); // reset halaman saat ganti pageSize
    },
    setQuery: (v: string) => {
      setParam("q", v);
      setParam("page", 1); // reset halaman saat cari
    },
    setSort: (field: string, dir: "asc" | "desc") => {
      setParam("sort", field);
      setParam("order", dir);
      setParam("page", 1);
    },
  };

  return { params, actions };
}

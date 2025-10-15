import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
function toInt(v, def) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : def;
}
export function useProductsTableState() {
    const [sp, setSp] = useSearchParams();
    const page = toInt(sp.get("page"), 1);
    const pageSize = toInt(sp.get("pageSize"), 10);
    const q = sp.get("q") ?? "";
    const sort = sp.get("sort") ?? "createdAt";
    const order = (sp.get("order") ?? "desc");
    const params = useMemo(() => ({ page, pageSize, q, sort, order }), [page, pageSize, q, sort, order]);
    const setParam = (key, value) => {
        const next = new URLSearchParams(sp);
        if (value === undefined || value === "")
            next.delete(key);
        else
            next.set(key, String(value));
        setSp(next, { replace: true });
    };
    const actions = {
        setPage: (v) => setParam("page", Math.max(1, v)),
        setPageSize: (v) => {
            setParam("pageSize", Math.max(1, v));
            setParam("page", 1); // reset halaman saat ganti pageSize
        },
        setQuery: (v) => {
            setParam("q", v);
            setParam("page", 1); // reset halaman saat cari
        },
        setSort: (field, dir) => {
            setParam("sort", field);
            setParam("order", dir);
            setParam("page", 1);
        },
    };
    return { params, actions };
}

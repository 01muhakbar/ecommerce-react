import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/axios";
// ⬇️ default aman (tidak pernah undefined)
const EMPTY_API = Object.freeze({
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
});
function adapt(r) {
    const res = r ?? EMPTY_API;
    return {
        rows: Array.isArray(res.items) ? res.items : [],
        page: Number.isFinite(res.page) ? res.page : 1,
        pageSize: Number.isFinite(res.pageSize)
            ? res.pageSize
            : 10,
        total: Number.isFinite(res.total) ? res.total : 0,
        totalPages: Number.isFinite(res.totalPages)
            ? res.totalPages
            : 0,
    };
}
export function useProducts(params) {
    return useQuery({
        queryKey: ["products", params],
        queryFn: async () => {
            // PERBAIKAN: URL yang diminta frontend salah. Seharusnya tidak ada "/catalog".
            // Ubah dari "/api/admin/catalog/products" menjadi "/api/admin/products".
            const { data } = await api.get("/admin/products", {
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

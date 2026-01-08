import { useState } from "react";
import {
  useTogglePublish, // unused
  useDeleteProduct,
} from "@/features/catalog/useProducts"; // Import hook terkait dari lokasi yang benar
import { formatIDR } from "@/utils/currency";
import { Link } from "react-router-dom";
import { useProducts } from "@/features/catalog/useProducts"; // Ganti ke hook yang benar

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | "">("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // PERBAIKAN: Gunakan hook yang benar dan pastikan params sesuai
  const { data, isLoading } = useProducts({
    page,
    pageSize,
    q,
  });

  const togglePublish = useTogglePublish();
  // const changeStatus = useChangeStatus(); // unused
  const del = useDeleteProduct();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <div className="flex gap-2">
          <button className="rounded-lg border px-3 py-2">Export</button>
          <button className="rounded-lg border px-3 py-2">Import</button>
          <Link
            // PERBAIKAN: Hapus /catalog dari path
            to="/admin/products/new"
            className="rounded-lg bg-emerald-600 text-white px-3 py-2"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Product"
            className="w-full outline-none"
          />
          <span>🔎</span>
        </div>
        <select
          value={categoryId ?? ""}
          onChange={(e) =>
            setCategoryId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="rounded-lg border px-3 py-2"
        >
          <option value="">Category</option>
          {/* TODO: isi dari useCategories hook */}
        </select>
        <select
          value={priceSort}
          onChange={(e) => setPriceSort(e.target.value as any)}
          className="rounded-lg border px-3 py-2"
        >
          <option value="">Price</option>
          <option value="asc">Termurah</option>
          <option value="desc">Termahal</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3 w-6">
                <input type="checkbox" />
              </th>
              <th className="text-left p-3">PRODUCT NAME</th>
              <th className="text-left p-3">CATEGORY</th>
              <th className="text-right p-3">PRICE</th>
              <th className="text-right p-3">SALE PRICE</th>
              <th className="text-right p-3">STOCK</th>
              <th className="text-center p-3">STATUS</th>
              <th className="text-center p-3">VIEW</th>
              <th className="text-center p-3">PUBLISHED</th>
              <th className="text-center p-3">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="p-6 text-center">
                  Memuat…
                </td>
              </tr>
            ) : (
              (data?.items ?? []).map((row: any) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <input type="checkbox" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-slate-200" />
                      <div className="font-medium">{row.name}</div>
                    </div>
                  </td>
                  <td className="p-3">{row.category}</td>
                  <td className="p-3 text-right">{formatIDR(row.price)}</td>
                  <td className="p-3 text-right">{formatIDR(row.salePrice)}</td>
                  <td className="p-3 text-right">{row.stock}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        row.status === "selling"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {row.status === "selling" ? "Selling" : "Sold Out"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Link
                      // PERBAIKAN: Hapus /catalog dari path
                      to={`/admin/products/${row.id}`}
                      className="underline text-emerald-600"
                    >
                      Detail
                    </Link>
                  </td>
                  <td className="p-3 text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={row.published}
                        onChange={(e) =>
                          togglePublish.mutate({
                            id: row.id,
                            published: e.target.checked,
                          })
                        }
                      />
                      <span className="h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-emerald-500 relative after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4"></span>
                    </label>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        // PERBAIKAN: Hapus /catalog dari path
                        to={`/admin/products/${row.id}/edit`}
                        className="rounded border px-2 py-1 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => del.mutate(row.id)}
                        className="rounded border px-2 py-1 hover:bg-red-50 text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!isLoading && (data?.items?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-500">
                  Tidak ada produk.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          Page {data?.page ?? 1} /{" "}
          {Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 10))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={(data?.page ?? 1) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={
              (data?.page ?? 1) * (data?.pageSize ?? 10) >= (data?.total ?? 0)
            }
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

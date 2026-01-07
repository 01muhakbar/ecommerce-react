import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCategories } from "@/hooks/admin/useCategories";
import * as catApi from "@/api/categories";
import { useBulkCategories, useDeleteCategory, useSetPublish } from "@/hooks/admin/useCategories";
import toast from "react-hot-toast";

function useQueryState() {
  const nav = useNavigate();
  const loc = useLocation();
  const sp = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const get = (k: string, d?: string) => sp.get(k) ?? d ?? "";
  const set = (obj: Record<string, any>) => {
    const n = new URLSearchParams(loc.search);
    Object.entries(obj).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") n.delete(k);
      else n.set(k, String(v));
    });
    nav({ search: n.toString() }, { replace: true });
  };
  return { get, set };
}

export default function AdminCategoriesPage() {
  const { get, set } = useQueryState();
  const [q, setQ] = useState(get("q", ""));
  const page = Math.max(1, parseInt(get("page", "1"), 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(get("pageSize", "10"), 10)));
  const parentsOnly = get("parentsOnly") === "true";
  const published = get("published");
  const sort = get("sort", "created_at:desc");

  const { data, isLoading } = useCategories({
    q,
    page,
    pageSize,
    parentsOnly,
    published: published === "" ? undefined : published === "true",
    sort,
  });

  useEffect(() => {
    const id = setTimeout(() => set({ q }), 400);
    return () => clearTimeout(id);
  }, [q]);

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  const [checked, setChecked] = useState<number[]>([]);
  const toggleChecked = (id: number) =>
    setChecked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  useEffect(() => setChecked([]), [page, pageSize, q, parentsOnly, published, sort]);

  const bulk = useBulkCategories();
  const del = useDeleteCategory();
  const setPub = useSetPublish();

  const doBulk = async (action: "publish" | "unpublish" | "delete") => {
    if (checked.length === 0) return;
    try {
      await bulk.mutateAsync({ action, ids: checked });
      toast.success(`Bulk ${action} success`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Bulk failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input
            placeholder="Search by Category name"
            className="rounded border px-3 py-2"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={parentsOnly}
              onChange={(e) => set({ parentsOnly: e.target.checked, page: 1 })}
            />
            Parents Only
          </label>
          <select
            className="rounded border px-2 py-2 text-sm"
            value={published}
            onChange={(e) => set({ published: e.target.value, page: 1 })}
          >
            <option value="">All</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
        </div>
        <div className="flex gap-2">
          <a
            href={catApi.exportCategoriesUrl()}
            className="rounded bg-slate-200 hover:bg-slate-300 px-3 py-2 text-sm"
          >
            Export
          </a>
          <label className="rounded bg-slate-200 hover:bg-slate-300 px-3 py-2 text-sm cursor-pointer">
            Import CSV
            <input
              type="file"
              accept="text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await catApi.importCategoriesCSV(file);
                  toast.success("Import success");
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || err?.message || "Import failed");
                }
              }}
            />
          </label>
          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() => doBulk("publish")}
            disabled={checked.length === 0}
          >
            Bulk Publish
          </button>
          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() => doBulk("unpublish")}
            disabled={checked.length === 0}
          >
            Bulk Unpublish
          </button>
          <button
            className="rounded border px-3 py-2 text-sm text-red-600"
            onClick={() => doBulk("delete")}
            disabled={checked.length === 0}
          >
            Bulk Delete
          </button>
          <a
            className="rounded bg-emerald-600 text-white px-3 py-2 text-sm"
            href="/admin/catalog/categories/new"
          >
            + Add Category
          </a>
        </div>
      </div>

      <div className="rounded border overflow-hidden">
        <table className="min-w-full table-auto text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={items.length > 0 && checked.length === items.length}
                  onChange={(e) => setChecked(e.target.checked ? items.map((i: any) => i.id) : [])}
                />
              </th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Icon</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-3 py-4" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                  No data
                </td>
              </tr>
            ) : (
              items.map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.includes(c.id)} onChange={() => toggleChecked(c.id)} />
                  </td>
                  <td className="px-3 py-2">{c.id}</td>
                  <td className="px-3 py-2">{c.code}</td>
                  <td className="px-3 py-2">
                    {c.icon ? (
                      /^(https?:)?\/\//.test(c.icon) ? (
                        <img src={c.icon} className="w-6 h-6 rounded" />
                      ) : (
                        <span className="text-lg">{c.icon}</span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.description || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!c.published}
                      onChange={async (e) => {
                        try {
                          await setPub.mutateAsync({ id: c.id, published: e.target.checked });
                          toast.success("Updated");
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message || err?.message || "Failed");
                        }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 flex gap-2">
                    <a className="underline text-sm" href={`/admin/catalog/categories/${c.id}/edit`}>
                      Edit
                    </a>
                    <button
                      className="underline text-sm text-red-600"
                      onClick={async () => {
                        if (!confirm(`Delete ${c.name}?`)) return;
                        try {
                          await del.mutateAsync(c.id);
                          toast.success("Deleted");
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message || err?.message || "Delete failed");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-600">Total: {total}</div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-3 py-1 text-sm"
            disabled={page <= 1}
            onClick={() => set({ page: Math.max(1, page - 1) })}
          >
            Prev
          </button>
          <span className="text-sm">Page {page}</span>
          <button
            className="rounded border px-3 py-1 text-sm"
            disabled={page * pageSize >= total}
            onClick={() => set({ page: page + 1 })}
          >
            Next
          </button>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => set({ pageSize: Number(e.target.value), page: 1 })}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}


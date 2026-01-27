import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  updateAdminCategory,
} from "../../lib/adminApi.js";

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", code: "" });

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const params = useMemo(
    () => ({ page, limit, q: debouncedSearch || undefined }),
    [page, limit, debouncedSearch]
  );

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories", params],
    queryFn: () => fetchAdminCategories(params),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice("Category created.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice("Category updated.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice("Category deleted.");
    },
  });

  const items = categoriesQuery.data?.data?.items || [];
  const meta = categoriesQuery.data?.data?.meta || { page: 1, limit, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "" });
    setIsFormOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setForm({ name: category.name || "", code: category.code || "" });
    setIsFormOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      code: form.code || undefined,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-slate-500">Organize your product catalog.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          New Category
        </button>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search categories"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
      </div>

      {categoriesQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading categories...
        </div>
      ) : categoriesQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {categoriesQuery.error?.response?.data?.message || "Failed to load categories."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No categories found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{category.name}</td>
                  <td className="px-4 py-3 text-slate-500">{category.code || category.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete ${category.name}?`)) {
                            deleteMutation.mutate(category.id);
                          }
                        }}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit Category" : "New Category"}
              </h2>
              <button type="button" onClick={() => setIsFormOpen(false)}>
                ✕
              </button>
            </div>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Code (optional)</label>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              {createMutation.isError || updateMutation.isError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {createMutation.error?.response?.data?.message ||
                    updateMutation.error?.response?.data?.message ||
                    "Failed to save category."}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
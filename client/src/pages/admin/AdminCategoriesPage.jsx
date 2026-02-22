import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Download,
  Filter,
  Image as ImageIcon,
  Layers3,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  uploadAdminImage,
  updateAdminCategory,
} from "../../lib/adminApi.js";

const toStringSafe = (value) => String(value ?? "").trim();

const isImagePath = (value) => {
  const v = toStringSafe(value);
  return (
    v.startsWith("/") ||
    v.startsWith("./") ||
    v.startsWith("../") ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("data:image/") ||
    /\/.+\./.test(v) ||
    /\.(png|jpe?g|webp|svg|gif|avif)(\?|$)/i.test(v)
  );
};

const isEmojiLike = (value) => {
  const v = toStringSafe(value);
  if (!v) return false;
  return v.length <= 3 && !isImagePath(v);
};

const getCategoryParentId = (category) =>
  category?.parentId ?? category?.parent_id ?? category?.parent?.id ?? null;

const hasParentCategory = (category) => {
  const parentId = getCategoryParentId(category);
  if (parentId === null || parentId === undefined) return false;
  return String(parentId).trim() !== "";
};

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [parentsOnly, setParentsOnly] = useState(true);
  const [selectedParent, setSelectedParent] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [imageFileName, setImageFileName] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    parent_id: "",
    icon: "",
    published: true,
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const params = useMemo(
    () => ({
      page,
      limit,
      q: debouncedSearch || undefined,
      parentsOnly: parentsOnly || undefined,
    }),
    [page, limit, debouncedSearch, parentsOnly]
  );

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories", params],
    queryFn: () => fetchAdminCategories(params),
    keepPreviousData: true,
  });

  const parentOptionsQuery = useQuery({
    queryKey: ["admin-categories", "parent-options"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      setNotice("Category created.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      setNotice("Category updated.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      setNotice("Category deleted.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadAdminImage,
    onSuccess: (data) => {
      const url = data?.data?.url || data?.url;
      if (!url) {
        setUploadError("Upload succeeded but no URL returned.");
        return;
      }
      setForm((prev) => ({ ...prev, icon: url }));
      setUploadError("");
      setNotice("Image uploaded.");
    },
    onError: (error) => {
      setUploadError(error?.response?.data?.message || "Failed to upload image.");
    },
  });

  const items = categoriesQuery.data?.data || [];
  const parentOptions = parentOptionsQuery.data?.data || [];
  const meta = categoriesQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const isSubView = Boolean(selectedParent);

  const selectedParentId = Number(selectedParent?.id);
  const selectedParentName = selectedParent?.name || "Parent";

  const subCategoryItems = useMemo(() => {
    if (!isSubView || !Number.isFinite(selectedParentId)) return [];
    const keyword = debouncedSearch.toLowerCase();
    return parentOptions.filter((category) => {
      const parentIdRaw = getCategoryParentId(category);
      if (parentIdRaw === null || parentIdRaw === undefined || String(parentIdRaw).trim() === "") {
        return false;
      }
      const parentId = Number(parentIdRaw);
      if (!Number.isFinite(parentId) || parentId !== selectedParentId) return false;
      if (!keyword) return true;
      const text = `${toStringSafe(category?.name)} ${toStringSafe(category?.code)} ${toStringSafe(
        category?.description
      )}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [debouncedSearch, isSubView, parentOptions, selectedParentId]);

  const tableItems = isSubView ? subCategoryItems : items;
  const tableIsLoading = isSubView ? parentOptionsQuery.isLoading : categoriesQuery.isLoading;
  const tableIsError = isSubView ? parentOptionsQuery.isError : categoriesQuery.isError;
  const tableError = isSubView ? parentOptionsQuery.error : categoriesQuery.error;

  useEffect(() => {
    if (!Array.isArray(tableItems) || tableItems.length === 0) {
      setSelectedIds([]);
      return;
    }
    const idSet = new Set(tableItems.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
  }, [tableItems]);

  useEffect(() => {
    if (!isSubView || !Number.isFinite(selectedParentId)) return;
    const exists = parentOptions.some((category) => Number(category?.id) === selectedParentId);
    if (!exists) {
      setSelectedParent(null);
      setSelectedIds([]);
    }
  }, [isSubView, parentOptions, selectedParentId]);

  const allSelected =
    tableItems.length > 0 && tableItems.every((item) => selectedIds.includes(item.id));
  const isSaving = Boolean(
    createMutation.isPending ||
      createMutation.isLoading ||
      updateMutation.isPending ||
      updateMutation.isLoading
  );

  const openCreate = () => {
    setEditing(null);
    setImageFileName("");
    setForm({
      name: "",
      code: "",
      description: "",
      parent_id: isSubView ? String(selectedParent?.id ?? "") : "",
      icon: "",
      published: true,
    });
    setLocalPreviewUrl("");
    setUploadError("");
    setIsFormOpen(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setImageFileName("");
    setForm({
      name: category?.name || "",
      code: category?.code || "",
      description: category?.description || "",
      parent_id: String(category?.parentId ?? category?.parent_id ?? ""),
      icon: category?.icon || "",
      published: Boolean(category?.published ?? true),
    });
    setLocalPreviewUrl("");
    setUploadError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving || uploadMutation.isPending || uploadMutation.isLoading) return;
    setIsFormOpen(false);
    setEditing(null);
  };

  const handleApplyFilters = () => {
    setDebouncedSearch(search.trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setParentsOnly(true);
    setPage(1);
  };

  const handleDemoAction = (label) => {
    setNotice(`${label} is demo-only.`);
  };

  const handleBackToParents = () => {
    setSelectedParent(null);
    setSelectedIds([]);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handleOpenSubcategories = (category) => {
    if (!category?.id) return;
    const code = toStringSafe(category?.code);
    if (code) {
      navigate(`/admin/categories/${encodeURIComponent(code)}`);
      return;
    }
    navigate(`/admin/categories/id/${encodeURIComponent(String(category.id))}`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = toStringSafe(form.name);
    if (!name) return;

    const payload = {
      name,
      code: toStringSafe(form.code) || undefined,
      description: toStringSafe(form.description) || undefined,
      icon: toStringSafe(form.icon) || undefined,
      published: Boolean(form.published),
    };

    const parentIdValue = isSubView
      ? String(selectedParent?.id ?? "")
      : toStringSafe(form.parent_id);
    if (editing) {
      payload.parent_id = parentIdValue ? Number(parentIdValue) : null;
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      if (parentIdValue) payload.parent_id = Number(parentIdValue);
      createMutation.mutate(payload);
    }
  };

  useEffect(() => {
    return () => {
      if (toStringSafe(localPreviewUrl).startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleTogglePublished = (category) => {
    if (!category?.id || !category?.name) return;
    updateMutation.mutate({
      id: category.id,
      payload: {
        name: category.name,
        code: category.code || undefined,
        description: category.description || undefined,
        icon: category.icon || undefined,
        parent_id: category.parentId ?? category.parent_id ?? null,
        published: !Boolean(category.published),
      },
    });
  };

  const previewImageUrl = useMemo(() => {
    if (toStringSafe(localPreviewUrl)) return localPreviewUrl;
    const iconUrl = toStringSafe(form.icon);
    return isImagePath(iconUrl) ? iconUrl : "";
  }, [localPreviewUrl, form.icon]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Category</h1>
          {isSubView ? (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <button
                type="button"
                onClick={handleBackToParents}
                className="font-medium text-slate-600 hover:text-emerald-600"
              >
                Categories
              </button>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700">{selectedParentName}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Organize your product catalog.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!isSubView ? (
            <>
              <button
                type="button"
                onClick={() => handleDemoAction("Export")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                type="button"
                onClick={() => handleDemoAction("Import")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => handleDemoAction("Bulk Action")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-medium text-white hover:bg-amber-600"
          >
            <Layers3 className="h-4 w-4" />
            Bulk Action
          </button>
          <button
            type="button"
            onClick={() => handleDemoAction("Delete")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Category name"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          {!isSubView ? (
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-600">
              <span>Parents Only</span>
              <button
                type="button"
                onClick={() => setParentsOnly((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  parentsOnly ? "bg-emerald-500" : "bg-slate-300"
                }`}
                aria-label="Toggle parents only"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    parentsOnly ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {tableIsLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {isSubView ? "Loading sub categories..." : "Loading categories..."}
        </div>
      ) : tableIsError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {tableError?.response?.data?.message || "Failed to load categories."}
        </div>
      ) : tableItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {isSubView ? "No sub categories found." : "No categories found."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => {
                        if (event.target.checked) setSelectedIds(tableItems.map((item) => item.id));
                        else setSelectedIds([]);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Icon</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((category) => {
                  const iconValue = toStringSafe(category?.icon || category?.image);
                  const hasImage = isImagePath(iconValue);
                  const hasEmojiIcon = isEmojiLike(iconValue);
                  const isChildRow = hasParentCategory(category);
                  const canOpenSubcategories = !isSubView && !isChildRow;
                  return (
                    <tr
                      key={category.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(category.id)}
                          onChange={(event) => {
                            setSelectedIds((prev) => {
                              if (event.target.checked) return [...prev, category.id];
                              return prev.filter((id) => id !== category.id);
                            });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{category.code || category.id}</td>
                      <td className="px-4 py-3">
                        {hasImage ? (
                          <img
                            src={iconValue}
                            alt={category.name}
                            className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : hasEmojiIcon ? (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-base">
                            {iconValue}
                          </span>
                        ) : (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                            <ImageIcon className="h-4 w-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {!isSubView && !isChildRow ? (
                          <button
                            type="button"
                            onClick={() => handleOpenSubcategories(category)}
                            className="inline-flex items-center gap-1 text-left text-slate-900 hover:text-emerald-600"
                          >
                            <span>{category.name}</span>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </button>
                        ) : (
                          category.name
                        )}
                      </td>
                      <td className="max-w-[300px] px-4 py-3 text-slate-500">
                        <span className="line-clamp-1">{category.description || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(category)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            category.published ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          aria-label={`Toggle publish for ${category.name}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              category.published ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!canOpenSubcategories) return;
                              handleOpenSubcategories(category);
                            }}
                            title={
                              canOpenSubcategories
                                ? "View sub categories"
                                : "Only parent categories can be viewed"
                            }
                            aria-disabled={!canOpenSubcategories}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white transition ${
                              canOpenSubcategories
                                ? "text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                                : "pointer-events-auto cursor-not-allowed text-slate-500 opacity-40"
                            }`}
                            aria-label={
                              canOpenSubcategories
                                ? `Open sub categories for ${category.name}`
                                : `View disabled for ${category.name}`
                            }
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            aria-label={`Edit ${category.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete ${category.name}?`)) {
                                deleteMutation.mutate(category.id);
                              }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                            aria-label={`Delete ${category.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isSubView ? (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"
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
            className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-700 disabled:opacity-50"
            disabled={meta.page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </button>
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={closeForm}
            aria-label="Close category drawer"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editing ? "Edit Category" : "Add Category"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Add your Product and necessary information from here
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue="en"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
                  >
                    <option value="en">en</option>
                  </select>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <form
              id="category-form"
              className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
              onSubmit={handleSubmit}
            >
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Category title"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Category Description"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Parent Category</label>
                <select
                  value={form.parent_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, parent_id: event.target.value }))
                  }
                  disabled={isSubView}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {isSubView ? (
                    <option value={String(selectedParent?.id ?? "")}>{selectedParentName}</option>
                  ) : (
                    <>
                      <option value="">Home</option>
                      {parentOptions
                        .filter((category) => !editing || category.id !== editing.id)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500">Category Image</label>
                <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                  <Upload className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-600">Drag your images here</span>
                  <span>Only *.jpeg, *.jpg and *.png images are accepted</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setImageFileName(file?.name || "");
                      if (!file) return;
                      setLocalPreviewUrl((prev) => {
                        if (toStringSafe(prev).startsWith("blob:")) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(file);
                      });
                      uploadMutation.mutate(file);
                    }}
                  />
                </label>
                {imageFileName ? (
                  <p className="mt-1 text-xs text-slate-500">Selected file: {imageFileName}</p>
                ) : null}
                {uploadMutation.isPending || uploadMutation.isLoading ? (
                  <p className="mt-1 text-xs text-slate-500">Uploading image...</p>
                ) : null}
                {uploadError ? (
                  <p className="mt-1 text-xs text-rose-600">{uploadError}</p>
                ) : null}
                <input
                  value={form.icon}
                  onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Image URL (optional)"
                />
                {previewImageUrl ? (
                  <div className="mt-3 flex min-h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 sm:min-h-32">
                    <img
                      src={previewImageUrl}
                      alt="Category preview"
                      className="max-h-52 w-full rounded-lg object-contain"
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">Published</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{form.published ? "Yes" : "No"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, published: !Boolean(prev.published) }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      form.published ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    aria-label="Toggle published"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        form.published ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {createMutation.isError || updateMutation.isError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {createMutation.error?.response?.data?.message ||
                    updateMutation.error?.response?.data?.message ||
                    "Failed to save category."}
                </div>
              ) : null}
            </form>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="category-form"
                  disabled={
                    isSaving ||
                    uploadMutation.isPending ||
                    uploadMutation.isLoading
                  }
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {editing ? "Update Category" : "Add Category"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  ChevronRight,
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
import QueryState from "../../components/UI/QueryState.jsx";
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  uploadAdminImage,
  updateAdminCategory,
} from "../../lib/adminApi.js";

const toStringSafe = (value) => String(value ?? "").trim();
const normalizeCode = (value) => toStringSafe(value).toLowerCase();

const getCategoryParentId = (category) =>
  category?.parentId ?? category?.parent_id ?? category?.parent?.id ?? null;

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

const btnBase =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const btnGreen = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700`;
const btnAmber = `${btnBase} bg-amber-500 text-white hover:bg-amber-600`;
const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const statCardClass =
  "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm";
const tableHeadCell =
  "whitespace-nowrap px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-4 py-3.5 align-middle text-sm text-slate-700";

function CategoryPublishedBadge({ published }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          published ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {published ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminSubCategoriesPage({ resolveMode = "code" }) {
  const qc = useQueryClient();
  const params = useParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories", "sub-route-dataset"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 500 }),
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      setNotice("Sub category created.");
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
      setNotice("Sub category updated.");
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
      setNotice("Sub category deleted.");
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

  const categories = categoriesQuery.data?.data || [];
  const codeParamRaw = toStringSafe(params?.code);
  const codeParam = useMemo(() => {
    if (!codeParamRaw) return "";
    try {
      return decodeURIComponent(codeParamRaw).trim();
    } catch {
      return codeParamRaw;
    }
  }, [codeParamRaw]);
  const idParam = toStringSafe(params?.id);

  const parentCategory = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) return null;
    if (resolveMode === "id") {
      if (!idParam) return null;
      return categories.find((category) => String(category?.id) === idParam) || null;
    }
    if (!codeParam) return null;
    const key = normalizeCode(codeParam);
    return categories.find((category) => normalizeCode(category?.code) === key) || null;
  }, [categories, codeParam, idParam, resolveMode]);

  const parentId = Number(parentCategory?.id);
  const subCategories = useMemo(() => {
    if (!parentCategory || !Number.isFinite(parentId)) return [];
    const keyword = debouncedSearch.toLowerCase();
    return categories.filter((category) => {
      const categoryParentId = getCategoryParentId(category);
      if (String(categoryParentId ?? "") !== String(parentId)) return false;
      if (!keyword) return true;
      const haystack = `${toStringSafe(category?.name)} ${toStringSafe(category?.code)} ${toStringSafe(
        category?.description
      )}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [categories, debouncedSearch, parentCategory, parentId]);
  const activeFilterCount = debouncedSearch ? 1 : 0;

  useEffect(() => {
    if (!Array.isArray(subCategories) || subCategories.length === 0) {
      setSelectedIds([]);
      return;
    }
    const idSet = new Set(subCategories.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => idSet.has(id)));
  }, [subCategories]);

  const isSaving = Boolean(
    createMutation.isPending ||
      createMutation.isLoading ||
      updateMutation.isPending ||
      updateMutation.isLoading
  );
  const allSelected =
    subCategories.length > 0 && subCategories.every((item) => selectedIds.includes(item.id));

  const handleDemoAction = (label) => {
    setNotice(`${label} is demo-only.`);
  };

  const handleApplyFilters = () => {
    setDebouncedSearch(search.trim());
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  const openCreate = () => {
    if (!parentCategory) return;
    setEditing(null);
    setImageFileName("");
    setForm({
      name: "",
      code: "",
      description: "",
      parent_id: String(parentCategory.id),
      icon: "",
      published: true,
    });
    setLocalPreviewUrl("");
    setUploadError("");
    setIsFormOpen(true);
  };

  const openEdit = (category) => {
    if (!parentCategory) return;
    setEditing(category);
    setImageFileName("");
    setForm({
      name: category?.name || "",
      code: category?.code || "",
      description: category?.description || "",
      parent_id: String(parentCategory.id),
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

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!parentCategory) return;
    const name = toStringSafe(form.name);
    if (!name) return;

    const payload = {
      name,
      code: toStringSafe(form.code) || undefined,
      description: toStringSafe(form.description) || undefined,
      icon: toStringSafe(form.icon) || undefined,
      published: Boolean(form.published),
      parent_id: Number(parentCategory.id),
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const handleTogglePublished = (category) => {
    if (!category?.id || !category?.name || !parentCategory) return;
    updateMutation.mutate({
      id: category.id,
      payload: {
        name: category.name,
        code: category.code || undefined,
        description: category.description || undefined,
        icon: category.icon || undefined,
        parent_id: Number(parentCategory.id),
        published: !Boolean(category.published),
      },
    });
  };

  useEffect(() => {
    return () => {
      if (toStringSafe(localPreviewUrl).startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const notFound = !categoriesQuery.isLoading && !categoriesQuery.isError && !parentCategory;
  const emptyChildren = Boolean(parentCategory) && !categoriesQuery.isLoading && subCategories.length === 0;
  const parentLabel = parentCategory?.name || (resolveMode === "id" ? `#${idParam || "unknown"}` : codeParam || "unknown");
  const previewImageUrl = useMemo(() => {
    if (toStringSafe(localPreviewUrl)) return localPreviewUrl;
    const iconUrl = toStringSafe(form.icon);
    return isImagePath(iconUrl) ? iconUrl : "";
  }, [localPreviewUrl, form.icon]);

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              Admin / Categories
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Sub Categories
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Link to="/admin/categories" className="font-medium text-slate-600 hover:text-emerald-600">
                Categories
              </Link>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-medium text-slate-700">{parentLabel}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-auto">
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total records</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{subCategories.length}</p>
            </div>
            <div className={statCardClass}>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Active filters</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{activeFilterCount}</p>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <QueryState
        isLoading={categoriesQuery.isLoading}
        isError={categoriesQuery.isError}
        error={categoriesQuery.error}
        onRetry={categoriesQuery.refetch}
        isEmpty={notFound}
        emptyTitle="Category not found"
        emptyHint="Please return to categories list and select a valid parent category."
        emptyActionLabel="Back to Categories"
        onEmptyAction={() => {
          window.location.assign("/admin/categories");
        }}
      >
        {emptyChildren ? (
          <QueryState
            isLoading={false}
            isError={false}
            isEmpty={true}
            emptyTitle="No sub categories"
            emptyHint="Use Add Category to create the first sub category for this parent."
          />
        ) : (
          <>
            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative w-full xl:max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search sub category name"
                    className={`${fieldClass} pl-9`}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoAction("Bulk Action")}
                    className={btnAmber}
                  >
                    <Layers3 className="h-4 w-4" />
                    Bulk Action
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoAction("Delete")}
                    className={btnDanger}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                  <button type="button" onClick={openCreate} className={btnGreen}>
                    <Plus className="h-4 w-4" />
                    Add Category
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className={`${btnGreen} w-full`}
                >
                  <Filter className="h-4 w-4" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className={`${btnOutline} w-full`}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{subCategories.length}</span>{" "}
                records under <span className="font-semibold text-slate-700">{parentLabel}</span>
              </div>
              <div className="-mx-4 w-auto overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:px-0">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={`${tableHeadCell} w-12`}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(event) => {
                            if (event.target.checked) setSelectedIds(subCategories.map((item) => item.id));
                            else setSelectedIds([]);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className={tableHeadCell}>ID</th>
                      <th className={tableHeadCell}>Icon</th>
                      <th className={tableHeadCell}>Name</th>
                      <th className={tableHeadCell}>Description</th>
                      <th className={tableHeadCell}>Status</th>
                      <th className={`${tableHeadCell} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subCategories.map((category) => {
                      const iconValue = toStringSafe(category?.icon || category?.image);
                      const hasImage = isImagePath(iconValue);
                      const hasEmojiIcon = isEmojiLike(iconValue);
                      return (
                        <tr
                          key={category.id}
                          className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                        >
                          <td className={tableCell}>
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
                          <td className={`${tableCell} font-medium tabular-nums text-slate-700`}>
                            {category.code || category.id}
                          </td>
                          <td className={tableCell}>
                            {hasImage ? (
                              <img
                                src={iconValue}
                                alt={category.name}
                                className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : hasEmojiIcon ? (
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-base">
                                {iconValue}
                              </span>
                            ) : (
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                                <ImageIcon className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                          <td className={`${tableCell} max-w-[260px] font-medium text-slate-900`}>
                            <span className="truncate">{category.name}</span>
                          </td>
                          <td className={`${tableCell} max-w-[300px] text-slate-500`}>
                            <span className="line-clamp-1">{category.description || "-"}</span>
                          </td>
                          <td className={tableCell}>
                            <div className="flex items-center gap-2">
                              <CategoryPublishedBadge published={Boolean(category.published)} />
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
                            </div>
                          </td>
                          <td className={`${tableCell} text-right`}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="Only parent categories can be viewed"
                                aria-disabled={true}
                                onClick={() => {}}
                                className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 opacity-40"
                                aria-label={`View disabled for ${category.name}`}
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
          </>
        )}
      </QueryState>

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
              id="sub-category-form"
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
                  disabled={true}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600"
                >
                  <option value={String(parentCategory?.id ?? "")}>{parentCategory?.name || "-"}</option>
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
                  form="sub-category-form"
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

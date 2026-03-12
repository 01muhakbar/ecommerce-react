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
  bulkAdminCategories,
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

const btnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-medium transition";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const btnGreen = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700`;
const btnAmber = `${btnBase} bg-amber-500 text-white hover:bg-amber-600`;
const btnSoft = `${btnBase} bg-slate-50 text-slate-600 hover:bg-slate-100`;
const fieldClass =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-3 py-2 align-middle text-sm text-slate-700";

function CategoryPublishedBadge({ published }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
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

function CategoryTypeBadge({ isChildRow, isSubView }) {
  const label = isSubView ? "Sub Category" : isChildRow ? "Child Category" : "Parent Category";
  const palette =
    isSubView || isChildRow
      ? "bg-sky-50 text-sky-600"
      : "bg-slate-100 text-slate-500";
  return (
    <span
      className={`inline-flex min-h-5 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${palette}`}
    >
      {label}
    </span>
  );
}

function CategoryFormSectionHeader({ eyebrow, title, description, meta }) {
  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {eyebrow}
        </p>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      {meta ? (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

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
  const [notice, setNotice] = useState({ type: "success", message: "" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [imageFileName, setImageFileName] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [deletingCategoryName, setDeletingCategoryName] = useState("");
  const [publishingCategoryId, setPublishingCategoryId] = useState(null);
  const [publishContext, setPublishContext] = useState({ name: "", nextPublished: false });
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
    if (!notice?.message) return;
    const timer = setTimeout(() => setNotice({ type: "success", message: "" }), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  const showNotice = (message, type = "success") => {
    setNotice({ type, message });
  };

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
      showNotice("Category created.");
      setIsFormOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to create category.", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      showNotice("Category updated.");
      setIsFormOpen(false);
      setEditing(null);
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to update category.", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      showNotice(
        deletingCategoryName ? `${deletingCategoryName} deleted.` : "Category deleted."
      );
      setDeletingCategoryId(null);
      setDeletingCategoryName("");
    },
    onError: (error) => {
      showNotice(error?.response?.data?.message || "Failed to delete category.", "error");
      setDeletingCategoryId(null);
      setDeletingCategoryName("");
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminCategories(action, ids),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      const affected = Array.isArray(variables?.ids) ? variables.ids.length : 0;
      setSelectedIds([]);
      showNotice(
        affected > 0
          ? `${affected} categor${affected > 1 ? "ies" : "y"} deleted.`
          : "Selected categories deleted."
      );
    },
    onError: (error) => {
      showNotice(
        error?.response?.data?.message || "Failed to delete selected categories.",
        "error"
      );
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
      showNotice("Image uploaded.");
    },
    onError: (error) => {
      setUploadError(error?.response?.data?.message || "Failed to upload image.");
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["storeCategories"] });
      qc.invalidateQueries({ queryKey: ["storefront", "categories"] });
      showNotice(
        publishContext?.name
          ? `${publishContext.name} ${publishContext.nextPublished ? "published" : "unpublished"}.`
          : "Category visibility updated."
      );
      setPublishingCategoryId(null);
      setPublishContext({ name: "", nextPublished: false });
    },
    onError: (error) => {
      showNotice(
        error?.response?.data?.message || "Failed to update category visibility.",
        "error"
      );
      setPublishingCategoryId(null);
      setPublishContext({ name: "", nextPublished: false });
    },
  });

  const items = categoriesQuery.data?.data || [];
  const parentOptions = parentOptionsQuery.data?.data || [];
  const meta = categoriesQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const isSubView = Boolean(selectedParent);
  const activeFilterCount = (debouncedSearch ? 1 : 0) + (!parentsOnly ? 1 : 0);

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
  const isFormBusy = Boolean(
    isSaving || uploadMutation.isPending || uploadMutation.isLoading
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
    if (isFormBusy) return;
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
    showNotice(`${label} is demo-only.`);
  };

  const handleDeleteSelected = () => {
    const ids = selectedIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (ids.length === 0) {
      showNotice("Select at least one category before running bulk delete.", "error");
      return;
    }
    if (bulkMutation.isPending || bulkMutation.isLoading) return;
    const contextLabel = isSubView
      ? ` under ${selectedParentName}`
      : parentsOnly
      ? " from the parent categories view"
      : " from the current filtered list";
    if (
      !window.confirm(
        `Delete ${ids.length} selected categor${ids.length > 1 ? "ies" : "y"}${contextLabel}? This action cannot be undone.`
      )
    ) {
      return;
    }
    bulkMutation.mutate({ action: "delete", ids });
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
    if (isFormBusy) return;
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
    const nextPublished = !Boolean(category.published);
    setPublishingCategoryId(category.id);
    setPublishContext({ name: category.name, nextPublished });
    publishMutation.mutate({
      id: category.id,
      payload: {
        name: category.name,
        code: category.code || undefined,
        description: category.description || undefined,
        icon: category.icon || undefined,
        parent_id: category.parentId ?? category.parent_id ?? null,
        published: nextPublished,
      },
    });
  };

  const handleDeleteCategory = (category) => {
    if (!category?.id || !category?.name) return;
    const isChildRow = hasParentCategory(category);
    const parentLabel =
      category?.parent?.name ||
      category?.parentName ||
      (isChildRow ? `#${getCategoryParentId(category)}` : "");
    const relationHint = isChildRow
      ? ` It is currently nested under ${parentLabel || "a parent category"}.`
      : " Check child category placement before removing this parent category.";
    if (
      !window.confirm(
        `Delete ${category.name}?${relationHint} This action cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingCategoryId(category.id);
    setDeletingCategoryName(category.name);
    deleteMutation.mutate(category.id);
  };

  const previewImageUrl = useMemo(() => {
    if (toStringSafe(localPreviewUrl)) return localPreviewUrl;
    const iconUrl = toStringSafe(form.icon);
    return isImagePath(iconUrl) ? iconUrl : "";
  }, [localPreviewUrl, form.icon]);

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-2.5 shadow-sm sm:px-5">
        <div className="flex flex-col gap-1.5">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {isSubView ? "Sub Categories" : "Categories"}
            </h1>
            {isSubView ? (
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
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
              <p className="text-sm text-slate-500">Organize your product catalog hierarchy.</p>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {isSubView ? tableItems.length : meta.total || 0} total
            <span className="mx-1.5 text-slate-300">•</span>
            {activeFilterCount} filters
            {selectedIds.length > 0 ? (
              <>
                <span className="mx-1.5 text-slate-300">•</span>
                {selectedIds.length} selected
              </>
            ) : null}
          </p>
        </div>
      </div>

      {notice?.message ? (
        <div
          className={`rounded-xl px-3 py-2 text-sm ${
            notice.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="w-full xl:max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isSubView ? "Search sub category name" : "Search category name"}
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {!isSubView ? (
                <div className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] text-slate-600">
                  <span>{parentsOnly ? "Parents only" : "All levels"}</span>
                  <button
                    type="button"
                    onClick={() => setParentsOnly((prev) => !prev)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                      parentsOnly ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    aria-label="Toggle parents only"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                        parentsOnly ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ) : null}
              <button type="button" onClick={handleApplyFilters} className={btnOutline}>
                <Filter className="h-4 w-4" />
                Apply
              </button>
              <button type="button" onClick={handleResetFilters} className={btnSoft}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button type="button" onClick={openCreate} className={btnGreen}>
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            {!isSubView ? (
              <>
                <button
                  type="button"
                  onClick={() => handleDemoAction("Export")}
                  className={btnSoft}
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoAction("Import")}
                  className={btnSoft}
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
              </>
            ) : null}
                <button
                  type="button"
                  onClick={() => handleDemoAction("Bulk Action")}
                  className={`${selectedIds.length > 0 ? btnAmber : btnSoft}`}
              >
                <Layers3 className="h-4 w-4" />
                Bulk
              </button>
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className={btnDanger}
                  disabled={
                    selectedIds.length === 0 || bulkMutation.isPending || bulkMutation.isLoading
                  }
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
          </div>
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
          <div className="space-y-1">
            <p className="font-medium text-slate-700">
              {debouncedSearch || !parentsOnly
                ? isSubView
                  ? "No sub categories match the current filters."
                  : "No categories match the current filters."
                : isSubView
                ? "No sub categories added under this parent yet."
                : "No categories added yet."}
            </p>
            <p>
              {isSubView
                ? `Try a different search term or add a child category under ${selectedParentName}.`
                : debouncedSearch || !parentsOnly
                ? "Adjust search or reset filters to return to the full catalog view."
                : "Add a category to start organizing your product catalog hierarchy."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-1 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-700">{tableItems.length}</span> rows
            {isSubView ? (
              <span className="text-slate-500"> under {selectedParentName}</span>
            ) : (
              <>
                {" "}
                / <span className="font-semibold text-slate-700">{meta.total || 0}</span>
              </>
            )}
            {selectedIds.length > 0 ? <span className="ml-2 text-slate-400">{selectedIds.length} selected</span> : null}
          </div>
          <div className="-mx-3 w-auto overflow-x-auto px-3 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
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
                  <th className={`${tableHeadCell} w-[36%]`}>Category</th>
                  <th className={`${tableHeadCell} w-[25%]`}>Description</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[19%] text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((category) => {
                  const iconValue = toStringSafe(category?.icon || category?.image);
                  const hasImage = isImagePath(iconValue);
                  const hasEmojiIcon = isEmojiLike(iconValue);
                  const isChildRow = hasParentCategory(category);
                  const isDeletingRow = deletingCategoryId === category.id && deleteMutation.isPending;
                  const isPublishingRow =
                    publishingCategoryId === category.id && publishMutation.isPending;
                  const isRowBusy = isDeletingRow || isPublishingRow;
                  const canOpenSubcategories = !isSubView && !isChildRow;
                  const parentLabel =
                    category?.parent?.name ||
                    category?.parentName ||
                    (isChildRow ? `#${getCategoryParentId(category)}` : "Top level");
                  return (
                    <tr
                      key={category.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-[4%]`}>
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
                      <td className={`${tableCell} w-[36%]`}>
                        <div className="flex items-center gap-2.5">
                          {hasImage ? (
                            <img
                              src={iconValue}
                              alt={category.name}
                              className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : hasEmojiIcon ? (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm">
                              {iconValue}
                            </span>
                          ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                              <ImageIcon className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                          {!isSubView && !isChildRow ? (
                            <button
                              type="button"
                              onClick={() => handleOpenSubcategories(category)}
                              className="inline-flex items-center gap-1 text-left text-sm font-semibold text-slate-900 hover:text-emerald-600"
                            >
                              <span className="truncate">{category.name}</span>
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-sm font-semibold text-slate-900">{category.name}</span>
                          )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                              <span>{category.code || `ID #${category.id}`}</span>
                              <span className="text-slate-300">•</span>
                              <CategoryTypeBadge isChildRow={isChildRow} isSubView={isSubView} />
                              <span className="text-slate-300">•</span>
                              <span className="truncate">
                                {isSubView || isChildRow ? parentLabel : "Open child records"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[25%] max-w-[260px] text-slate-500`}>
                        <span className="line-clamp-2 text-sm text-slate-500">
                          {category.description || "-"}
                        </span>
                      </td>
                      <td className={`${tableCell} w-[16%]`}>
                        <div className="flex items-center gap-2">
                          <CategoryPublishedBadge published={Boolean(category.published)} />
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(category)}
                            disabled={isPublishingRow}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                              category.published ? "bg-emerald-500" : "bg-slate-300"
                            } ${isPublishingRow ? "cursor-wait opacity-60" : ""}`}
                            aria-label={`Toggle publish for ${category.name}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                category.published ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        {isPublishingRow ? (
                          <div className="mt-1 text-[10px] font-medium text-slate-400">Updating...</div>
                        ) : null}
                      </td>
                      <td className={`${tableCell} w-[19%] text-right`}>
                        <div className="flex items-center justify-end gap-1">
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
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white transition ${
                              canOpenSubcategories
                                ? "text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                                : "pointer-events-auto cursor-not-allowed text-slate-500 opacity-40"
                            }`}
                            disabled={isRowBusy}
                            aria-label={
                              canOpenSubcategories
                                ? `Open sub categories for ${category.name}`
                                : `View disabled for ${category.name}`
                            }
                          >
                            <ZoomIn className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            disabled={isRowBusy}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Edit ${category.name}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category)}
                            disabled={isRowBusy}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${category.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        {isDeletingRow ? (
                          <div className="mt-1 text-[10px] font-medium text-slate-400">Deleting...</div>
                        ) : null}
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
                    {editing
                      ? "Adjust category details, hierarchy, and visibility without leaving the catalog workspace."
                      : "Create a new catalog group and place it in the right parent level before publishing it."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                      {editing ? "Edit Mode" : "Create Mode"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      {isSubView
                        ? `Parent: ${selectedParentName}`
                        : form.parent_id
                        ? `Parent #${form.parent_id}`
                        : "Top-level category"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      {form.published ? "Ready to publish" : "Saved as inactive"}
                    </span>
                  </div>
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
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <CategoryFormSectionHeader
                  eyebrow="Basic Details"
                  title="Name the category and describe its role"
                  description="Use a short title and a practical description so admin mapping and storefront grouping stay aligned."
                  meta={editing ? `Editing #${editing.id}` : "New category"}
                />
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

                <div className="mt-4">
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
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <CategoryFormSectionHeader
                  eyebrow="Hierarchy"
                  title="Choose where this category should live"
                  description="Parent selection determines whether the record stays top-level or becomes a child category."
                  meta={isSubView ? "Parent locked" : "Hierarchy control"}
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <label className="text-xs font-semibold text-slate-500">Parent Category</label>
                  <select
                    value={form.parent_id}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, parent_id: event.target.value }))
                    }
                    disabled={isSubView}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
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
                  <p className="mt-2 text-xs text-slate-500">
                    {isSubView
                      ? `This drawer is locked to ${selectedParentName} because it was opened from the sub category view.`
                      : form.parent_id
                      ? "This record will be stored as a child category under the selected parent."
                      : "Leave it on Home to keep this record as a top-level category."}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <CategoryFormSectionHeader
                  eyebrow="Media & Visibility"
                  title="Upload an icon and confirm storefront visibility"
                  description="Use a recognizable image and decide whether this category should be active right after save."
                  meta={previewImageUrl ? "Preview ready" : "Optional media"}
                />
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

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div>
                    <span className="text-sm font-medium text-slate-700">Published</span>
                    <p className="mt-1 text-xs text-slate-500">
                      {form.published
                        ? "This category will be active for catalog mapping after save."
                        : "Keep this category hidden until the hierarchy is fully ready."}
                    </p>
                  </div>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Category Action Panel
                  </p>
                  <p>
                    {editing
                      ? "Review hierarchy and visibility before updating this category."
                      : "Save this category when hierarchy, media, and publish state are ready."}
                  </p>
                </div>
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
                    disabled={isFormBusy}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {isFormBusy
                      ? editing
                        ? "Saving..."
                        : "Creating..."
                      : editing
                      ? "Update Category"
                      : "Add Category"}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

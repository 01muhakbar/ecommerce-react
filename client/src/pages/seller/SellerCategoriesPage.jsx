import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Image as ImageIcon, Pencil, Plus, Search, Upload, X } from "lucide-react";
import {
  createSellerCategory,
  getSellerCategories,
  setSellerCategoryPublished,
  updateSellerCategory,
  uploadSellerCategoryImage,
} from "../../api/sellerCategories.ts";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { buildCategoryTree } from "../../utils/categoryTree.ts";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerShellPageClass,
  sellerTableCellClass,
  sellerTableHeadCellClass,
  sellerTextareaClass,
  SellerWorkspaceBadge,
  SellerWorkspaceFilterBar,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

const defaultFilters = {
  q: "",
  published: "",
  page: 1,
  limit: 10,
};

const defaultForm = {
  name: "",
  description: "",
  parentId: "",
  image: "",
  isPublished: true,
};

const toText = (value) => String(value || "").trim();

const flattenTree = (nodes, depth = 0) =>
  (Array.isArray(nodes) ? nodes : []).flatMap((node) => [
    {
      id: Number(node?.id || 0) || null,
      label: `${depth > 0 ? `${"— ".repeat(depth)}` : ""}${node?.name || "Category"}`,
    },
    ...flattenTree(node?.children, depth + 1),
  ]);

const formatErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function PublishSwitch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function CategoryFormModal({
  open,
  mode = "create",
  form,
  onChange,
  onClose,
  onSubmit,
  onImageSelect,
  parentOptions,
  isSubmitting = false,
  isUploading = false,
  canManage = false,
}) {
  const fileInputRef = useRef(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-[1.7rem] font-semibold tracking-tight text-slate-900">
              {mode === "edit" ? "Update Category" : "Add Category"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Manage category info, parent, image, and visibility.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close category modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-8">
            <label className="pt-2 text-sm font-medium text-slate-700">Category Name</label>
            <input
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              className={sellerFieldClass}
              placeholder="Category name"
              disabled={!canManage || isSubmitting}
            />

            <label className="pt-2 text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              className={`${sellerTextareaClass} min-h-[118px]`}
              placeholder="Optional category description"
              disabled={!canManage || isSubmitting}
            />

            <label className="pt-2 text-sm font-medium text-slate-700">Parent Category</label>
            <select
              value={form.parentId}
              onChange={(event) => onChange("parentId", event.target.value)}
              className={sellerFieldClass}
              disabled={!canManage || isSubmitting}
            >
              <option value="">Root category</option>
              {parentOptions.map((option) => (
                <option key={option.id || "root"} value={option.id || ""}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="pt-2 text-sm font-medium text-slate-700">Category Image</label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canManage || isSubmitting || isUploading}
                className="flex min-h-[148px] w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-8 w-8 text-emerald-500" />
                <p className="mt-3 text-lg font-medium text-slate-800">Drag your image here</p>
                <p className="mt-1 text-sm text-slate-500">
                  {isUploading ? "Uploading image..." : "Only .jpeg, .webp and .png images are accepted"}
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onImageSelect(file);
                  event.target.value = "";
                }}
              />

              {form.image ? (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <img
                    src={resolveAssetUrl(form.image)}
                    alt={form.name || "Category preview"}
                    className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">Uploaded image</p>
                    <p className="truncate text-xs text-slate-500">{form.image}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <label className="pt-2 text-sm font-medium text-slate-700">Published</label>
            <div className="flex items-center gap-3">
              <PublishSwitch
                checked={Boolean(form.isPublished)}
                disabled={!canManage || isSubmitting}
                onChange={() => onChange("isPublished", !form.isPublished)}
              />
              <span className="text-sm text-slate-600">
                {form.isPublished ? "Visible in storefront" : "Hidden from storefront"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 px-6 py-5">
          <button type="button" onClick={onClose} className={sellerSecondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canManage || isSubmitting}
            className={`${sellerPrimaryButtonClass} h-11 bg-emerald-500 hover:bg-emerald-600`}
          >
            {isSubmitting ? "Saving..." : mode === "edit" ? "Update Category" : "Add Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SellerCategoriesPage() {
  const queryClient = useQueryClient();
  const { sellerContext, workspaceStoreId } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewCategories = permissionKeys.includes("CATEGORY_VIEW");
  const canManageCategories = permissionKeys.includes("CATEGORY_MANAGE");

  const [filters, setFilters] = useState(defaultFilters);
  const [draftSearch, setDraftSearch] = useState("");
  const [notice, setNotice] = useState({ type: "info", message: "" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => ({ ...current, q: draftSearch.trim(), page: 1 }));
    }, 250);
    return () => clearTimeout(timer);
  }, [draftSearch]);

  const categoriesQuery = useQuery({
    queryKey: ["seller", "categories", workspaceStoreId, filters],
    queryFn: () => getSellerCategories(workspaceStoreId, filters),
    enabled: canViewCategories && Number(workspaceStoreId) > 0,
  });

  const parentOptionsQuery = useQuery({
    queryKey: ["seller", "categories", "parents", workspaceStoreId],
    queryFn: () => getSellerCategories(workspaceStoreId, { page: 1, limit: 200 }),
    enabled: canViewCategories && Number(workspaceStoreId) > 0,
    staleTime: 5 * 60 * 1000,
  });

  const invalidateCategoryQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["seller", "categories", workspaceStoreId] }),
      queryClient.invalidateQueries({
        queryKey: ["seller", "products", "authoring-meta", workspaceStoreId],
      }),
      queryClient.invalidateQueries({ queryKey: ["storeCategories"] }),
      queryClient.invalidateQueries({ queryKey: ["storefront", "categories"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload) => createSellerCategory(workspaceStoreId, payload),
    onSuccess: async () => {
      await invalidateCategoryQueries();
      setIsModalOpen(false);
      setEditingCategory(null);
      setForm(defaultForm);
      setNotice({ type: "success", message: "Category created." });
    },
    onError: (error) => {
      setNotice({ type: "error", message: formatErrorMessage(error, "Failed to create category.") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSellerCategory(workspaceStoreId, id, payload),
    onSuccess: async () => {
      await invalidateCategoryQueries();
      setIsModalOpen(false);
      setEditingCategory(null);
      setForm(defaultForm);
      setNotice({ type: "success", message: "Category updated." });
    },
    onError: (error) => {
      setNotice({ type: "error", message: formatErrorMessage(error, "Failed to update category.") });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }) =>
      setSellerCategoryPublished(workspaceStoreId, id, isPublished),
    onSuccess: async () => {
      await invalidateCategoryQueries();
      setNotice({ type: "success", message: "Category visibility updated." });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: formatErrorMessage(error, "Failed to update category visibility."),
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadSellerCategoryImage,
    onSuccess: (data) => {
      const url = data?.data?.url || data?.url;
      if (!url) {
        setNotice({ type: "error", message: "Upload succeeded but no URL was returned." });
        return;
      }
      setForm((current) => ({ ...current, image: url }));
      setNotice({ type: "success", message: "Category image uploaded." });
    },
    onError: (error) => {
      setNotice({ type: "error", message: formatErrorMessage(error, "Failed to upload image.") });
    },
  });

  const items = categoriesQuery.data?.data || [];
  const meta = categoriesQuery.data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 };
  const parentTree = useMemo(
    () => buildCategoryTree(parentOptionsQuery.data?.data || []),
    [parentOptionsQuery.data?.data],
  );
  const parentOptions = useMemo(() => flattenTree(parentTree), [parentTree]);

  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(Number(item.id)));

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm(defaultForm);
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setForm({
      name: category?.name || "",
      description: category?.description || "",
      parentId: category?.parentId ? String(category.parentId) : "",
      image: category?.image || category?.icon || "",
      isPublished: Boolean(category?.isPublished ?? category?.published),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    const name = toText(form.name);
    if (!name) {
      setNotice({ type: "error", message: "Category name is required." });
      return;
    }

    const payload = {
      name,
      description: toText(form.description) || undefined,
      parentId: Number(form.parentId || 0) || null,
      image: toText(form.image) || null,
      isPublished: Boolean(form.isPublished),
    };

    if (editingCategory?.id) {
      updateMutation.mutate({ id: editingCategory.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const tableRows = items.map((category) => {
    const imageUrl = resolveAssetUrl(category?.image || category?.icon || "");
    return (
      <tr key={category.id} className="border-t border-slate-100">
        <td className={`${sellerTableCellClass} w-10`}>
          <input
            type="checkbox"
            checked={selectedIds.includes(Number(category.id))}
            onChange={(event) => {
              setSelectedIds((current) =>
                event.target.checked
                  ? [...current, Number(category.id)]
                  : current.filter((entry) => entry !== Number(category.id)),
              );
            }}
            className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
          />
        </td>
        <td className={`${sellerTableCellClass} w-[72px] text-slate-500`}>#{category.id}</td>
        <td className={`${sellerTableCellClass} w-[84px]`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={category.name}
              className="h-11 w-11 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </td>
        <td className={sellerTableCellClass}>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{category.name}</p>
            {category.parent?.name ? (
              <p className="mt-1 text-xs text-slate-500">Parent: {category.parent.name}</p>
            ) : null}
          </div>
        </td>
        <td className={sellerTableCellClass}>
          <p className="line-clamp-2 max-w-[260px] text-slate-600">{category.description || "—"}</p>
        </td>
        <td className={`${sellerTableCellClass} w-[130px]`}>
          <PublishSwitch
            checked={Boolean(category.isPublished)}
            disabled={!canManageCategories || publishMutation.isPending}
            onChange={() =>
              publishMutation.mutate({
                id: category.id,
                isPublished: !category.isPublished,
              })
            }
          />
        </td>
        <td className={`${sellerTableCellClass} w-[110px]`}>
          <button
            type="button"
            onClick={() => openEditModal(category)}
            disabled={!canManageCategories}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Edit ${category.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  });

  return (
    <div className={`${sellerShellPageClass} px-4 py-6 sm:px-6`}>
      <div className="mx-auto max-w-[1240px] space-y-4">
        <SellerWorkspaceSectionHeader
          title="Category"
          description="Manage product categories"
          actions={
            <>
              <button type="button" disabled className={sellerSecondaryButtonClass}>
                Export
              </button>
              <button type="button" disabled className={sellerSecondaryButtonClass}>
                Import
              </button>
              <button type="button" disabled className={sellerSecondaryButtonClass}>
                Bulk Action
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!canManageCategories}
                className={`${sellerPrimaryButtonClass} bg-emerald-500 hover:bg-emerald-600`}
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </>
          }
        />

        {notice.message ? (
          <SellerWorkspaceNotice
            type={notice.type === "error" ? "error" : notice.type === "success" ? "success" : "info"}
          >
            {notice.message}
          </SellerWorkspaceNotice>
        ) : null}

        {!canViewCategories ? (
          <SellerWorkspacePanel className="p-5">
            <p className="text-sm text-slate-600">You do not have permission to view categories in this store.</p>
          </SellerWorkspacePanel>
        ) : (
          <>
            <SellerWorkspaceFilterBar>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    className={`${sellerFieldClass} pl-9`}
                    placeholder="Search category name"
                  />
                </div>
                <select
                  value={filters.published}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      published: event.target.value,
                      page: 1,
                    }))
                  }
                  className={sellerFieldClass}
                >
                  <option value="">Published</option>
                  <option value="true">Published</option>
                  <option value="false">Unpublished</option>
                </select>
                <div className="flex items-center justify-end gap-2">
                  <SellerWorkspaceBadge label={`${meta.total} categories`} tone="teal" />
                </div>
              </div>
            </SellerWorkspaceFilterBar>

            <SellerWorkspacePanel className="overflow-hidden p-0">
              {categoriesQuery.isLoading ? (
                <div className="px-5 py-12 text-sm text-slate-500">Loading categories...</div>
              ) : categoriesQuery.isError ? (
                <div className="px-5 py-12 text-sm text-rose-600">
                  {formatErrorMessage(categoriesQuery.error, "Failed to load categories.")}
                </div>
              ) : items.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-lg font-semibold text-slate-900">No categories found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={`${sellerTableHeadCellClass} w-10`}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(event) =>
                                setSelectedIds(event.target.checked ? items.map((item) => Number(item.id)) : [])
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            />
                          </th>
                          <th className={`${sellerTableHeadCellClass} w-[72px]`}>ID</th>
                          <th className={`${sellerTableHeadCellClass} w-[84px]`}>Icon</th>
                          <th className={sellerTableHeadCellClass}>Name</th>
                          <th className={sellerTableHeadCellClass}>Description</th>
                          <th className={`${sellerTableHeadCellClass} w-[130px]`}>Published</th>
                          <th className={`${sellerTableHeadCellClass} w-[110px]`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>{tableRows}</tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                    <span>
                      Page {meta.page} of {meta.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
                        }
                        disabled={meta.page <= 1}
                        className={sellerSecondaryButtonClass}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            page: Math.min(meta.totalPages, current.page + 1),
                          }))
                        }
                        disabled={meta.page >= meta.totalPages}
                        className={sellerSecondaryButtonClass}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </SellerWorkspacePanel>
          </>
        )}
      </div>

      <CategoryFormModal
        open={isModalOpen}
        mode={editingCategory ? "edit" : "create"}
        form={form}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
          setForm(defaultForm);
        }}
        onSubmit={handleSubmit}
        onImageSelect={(file) => uploadMutation.mutate(file)}
        parentOptions={editingCategory?.id ? parentOptions.filter((item) => item.id !== editingCategory.id) : parentOptions}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isUploading={uploadMutation.isPending}
        canManage={canManageCategories}
      />
    </div>
  );
}

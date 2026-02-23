import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkAdminProducts,
  deleteAdminProduct,
  fetchAdminCategories,
  fetchAdminProducts,
  updateAdminProductPublished,
} from "../../lib/adminApi.js";
import { moneyIDR } from "../../utils/money.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import {
  Download,
  ChevronDown,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import ProductForm from "./ProductForm.jsx";
import ProductPreviewDrawer from "./ProductPreviewDrawer.jsx";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";
const DEFAULT_FILTERS = { q: "", categoryId: "", priceSort: "default" };

const btnBase =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300`;
const btnGreen = `${btnBase} border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-300`;
const btnDanger = `${btnBase} border border-rose-300 bg-rose-300 text-white hover:bg-rose-400 focus-visible:ring-rose-300`;
const btnPeach = `${btnBase} border border-amber-300 bg-amber-300 text-white hover:bg-amber-400 focus-visible:ring-amber-300`;

const inputBase =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100";
const selectBase = `${inputBase} pr-8`;

const tableHeadCell =
  "px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500";
const tableCell = "px-3 py-4 align-middle text-sm";

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState({
    open: false,
    action: "delete",
    ids: [],
  });
  const [publishedOverrides, setPublishedOverrides] = useState({});
  const [publishingIds, setPublishingIds] = useState(() => new Set());
  const [publishError, setPublishError] = useState("");
  const [drawerState, setDrawerState] = useState({
    open: false,
    mode: "create",
    productId: null,
  });
  const bulkMenuRef = useRef(null);

  const params = useMemo(
    () => ({
      page,
      limit,
      q: appliedFilters.q || undefined,
      categoryId: appliedFilters.categoryId || undefined,
    }),
    [page, limit, appliedFilters]
  );

  const productsQuery = useQuery({
    queryKey: ["admin-products", page, limit, appliedFilters.q, appliedFilters.categoryId],
    queryFn: () => fetchAdminProducts(params),
    keepPreviousData: true,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-filter"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => deleteAdminProduct(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setSelectedIds(new Set());
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }) => updateAdminProductPublished(id, published),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminProducts(action, ids),
  });

  const items = productsQuery.data?.data || [];
  const categories = categoriesQuery.data?.data || [];
  const meta = productsQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));

  const displayItems = useMemo(() => {
    const sorted = [...items];
    if (appliedFilters.priceSort === "price_asc") {
      sorted.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (appliedFilters.priceSort === "price_desc") {
      sorted.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    }
    return sorted;
  }, [items, appliedFilters.priceSort]);

  useEffect(() => {
    const visibleIds = new Set(displayItems.map((product) => Number(product?.id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [displayItems]);

  const asCurrency = (value) => moneyIDR(Number(value || 0));
  const resolveThumbnail = (product) =>
    resolveAssetUrl(product.imageUrl || product.promoImagePath || FALLBACK_THUMBNAIL);

  const getPublished = (product) => {
    const override = publishedOverrides[product.id];
    if (typeof override === "boolean") return override;
    return Boolean(product.published ?? true);
  };

  const allVisibleSelected =
    displayItems.length > 0 &&
    displayItems.every((product) => selectedIds.has(Number(product.id)));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        displayItems.forEach((product) => next.delete(Number(product.id)));
      } else {
        displayItems.forEach((product) => next.add(Number(product.id)));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const numId = Number(id);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  };

  const applyFilters = () => {
    setAppliedFilters({
      q: String(draftFilters.q || "").trim(),
      categoryId: String(draftFilters.categoryId || ""),
      priceSort: String(draftFilters.priceSort || "default"),
    });
    setPage(1);
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || bulkMutation.isPending) return;
    setBulkConfirm({ open: true, action: "delete", ids });
  };

  const handleDeleteOne = (id) => {
    if (deleteMutation.isPending) return;
    if (!window.confirm("Delete this product?")) return;
    deleteMutation.mutate([Number(id)]);
  };

  const handleBulkAction = (action) => {
    const ids = Array.from(selectedIds);
    if (!action || ids.length === 0 || bulkMutation.isPending) return;

    if (action === "delete_selected") {
      setBulkConfirm({ open: true, action: "delete", ids });
      setBulkMenuOpen(false);
      return;
    }

    const nextAction = action === "publish_selected" ? "publish" : "unpublish";
    setBulkNotice(null);
    bulkMutation.mutate(
      { action: nextAction, ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          setSelectedIds(new Set());
          setBulkMenuOpen(false);
          setBulkNotice({
            type: "success",
            message:
              nextAction === "publish"
                ? `${affected} product(s) published.`
                : `${affected} product(s) unpublished.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          setBulkNotice({
            type: "error",
            message:
              error?.response?.data?.message || "Bulk action failed. Please try again.",
          });
          setBulkMenuOpen(false);
        },
      }
    );
  };

  const handleConfirmBulkDelete = () => {
    const ids = Array.isArray(bulkConfirm.ids) ? bulkConfirm.ids : [];
    if (!bulkConfirm.open || ids.length === 0 || bulkMutation.isPending) return;

    setBulkNotice(null);
    bulkMutation.mutate(
      { action: "delete", ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          setSelectedIds(new Set());
          setBulkConfirm({ open: false, action: "delete", ids: [] });
          setBulkMenuOpen(false);
          setBulkNotice({
            type: "success",
            message: `${affected} product(s) deleted.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          setBulkNotice({
            type: "error",
            message:
              error?.response?.data?.message || "Delete selected failed. Please try again.",
          });
        },
      }
    );
  };

  const openCreateDrawer = () => {
    setDrawerState({ open: true, mode: "create", productId: null });
  };

  const openEditDrawer = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    setDrawerState({ open: true, mode: "edit", productId: parsedId });
  };

  const openViewDrawer = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    setDrawerState({ open: true, mode: "view", productId: parsedId });
  };

  const closeDrawer = () => {
    setDrawerState({ open: false, mode: "create", productId: null });
  };

  const handleTogglePublished = (product) => {
    const productId = Number(product?.id);
    if (!productId || publishingIds.has(productId)) return;

    const hadOverride = Object.prototype.hasOwnProperty.call(publishedOverrides, productId);
    const previousOverride = hadOverride ? publishedOverrides[productId] : undefined;
    const previousValue = getPublished(product);
    const nextValue = !previousValue;

    setPublishError("");
    setPublishingIds((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
    setPublishedOverrides((prev) => ({ ...prev, [productId]: nextValue }));

    publishMutation.mutate(
      { id: productId, published: nextValue },
      {
        onSuccess: (response) => {
          const serverValue = response?.data?.published;
          setPublishedOverrides((prev) => ({
            ...prev,
            [productId]:
              typeof serverValue === "boolean" ? serverValue : nextValue,
          }));
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          setPublishError(
            error?.response?.data?.message || "Failed to update published status."
          );
          setPublishedOverrides((prev) => {
            const next = { ...prev };
            if (hadOverride) next[productId] = previousOverride;
            else delete next[productId];
            return next;
          });
        },
        onSettled: () => {
          setPublishingIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        },
      }
    );
  };

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!bulkMenuRef.current) return;
      if (!bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!drawerState.open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerState.open]);

  return (
    <div className="w-full min-w-0 space-y-6 rounded-2xl bg-slate-50/70 p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage products in your catalog.</p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 gap-y-2 xl:w-auto xl:max-w-[70%] xl:justify-end">
          <button
            type="button"
            className={`${btnOutline} shrink-0`}
            onClick={() => console.log("[admin/products] export clicked")}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            className={`${btnOutline} shrink-0`}
            onClick={() => console.log("[admin/products] import clicked")}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>

          <div ref={bulkMenuRef} className="relative shrink-0">
            <button
              type="button"
              disabled={bulkMutation.isPending}
              onClick={() => setBulkMenuOpen((prev) => !prev)}
              className={`${btnPeach} min-w-[132px] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              Bulk Action
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {bulkMenuOpen ? (
              <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => handleBulkAction("delete_selected")}
                  disabled={selectedIds.size === 0 || bulkMutation.isPending}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Selected
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction("publish_selected")}
                  disabled={selectedIds.size === 0 || bulkMutation.isPending}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Publish Selected
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction("unpublish_selected")}
                  disabled={selectedIds.size === 0 || bulkMutation.isPending}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unpublish Selected
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || deleteMutation.isPending || bulkMutation.isPending}
            className={`${btnDanger} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>

          <button
            type="button"
            onClick={openCreateDrawer}
            className={`${btnGreen} shrink-0`}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_6px_20px_-16px_rgba(15,23,42,0.3)]">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-full md:w-72">
              <input
                type="search"
                value={draftFilters.q}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, q: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="Search Product"
                className={`${inputBase} pr-10`}
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <select
              value={draftFilters.categoryId}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, categoryId: event.target.value }))
              }
              className={`${selectBase} w-full md:w-48`}
            >
              <option value="">Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={draftFilters.priceSort}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, priceSort: event.target.value }))
              }
              className={`${selectBase} w-full md:w-44`}
            >
              <option value="default">Price</option>
              <option value="price_asc">Low to High</option>
              <option value="price_desc">High to Low</option>
            </select>

            <button type="button" onClick={applyFilters} className={btnGreen}>
              <Filter className="h-4 w-4" />
              Filter
            </button>

            <button type="button" onClick={resetFilters} className={btnOutline}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>

          {categoriesQuery.isError ? (
            <p className="mt-2 text-xs text-rose-500">Failed to load categories.</p>
          ) : null}
          {publishError ? (
            <p className="mt-2 text-xs text-rose-500">{publishError}</p>
          ) : null}
          {bulkNotice ? (
            <p
              className={`mt-2 text-xs ${
                bulkNotice.type === "error" ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {bulkNotice.message}
            </p>
          ) : null}
        </div>

        {productsQuery.isLoading ? (
          <div className="p-6 text-sm text-slate-500">Loading products...</div>
        ) : productsQuery.isError ? (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {productsQuery.error?.response?.data?.message || "Failed to load products."}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No products found.</div>
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[900px] lg:min-w-full table-fixed text-left">
              <thead className="bg-[#F7F7F7]">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible products"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                  </th>
                  <th className={`${tableHeadCell} w-[24%]`}>Product Name</th>
                  <th className={`${tableHeadCell} w-[15%]`}>Category</th>
                  <th className={`${tableHeadCell} w-[9%]`}>Price</th>
                  <th className={`${tableHeadCell} w-[9%]`}>Sale Price</th>
                  <th className={`${tableHeadCell} w-[7%]`}>Stock</th>
                  <th className={`${tableHeadCell} w-[10%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[6%] text-center`}>View</th>
                  <th className={`${tableHeadCell} w-[8%] text-center`}>Published</th>
                  <th className={`${tableHeadCell} w-[8%] text-center`}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {displayItems.map((product) => {
                  const isSelected = selectedIds.has(Number(product.id));
                  const isPublished = getPublished(product);
                  const hasSalePrice =
                    Number(product.salePrice || 0) > 0 &&
                    Number(product.salePrice || 0) <
                      Number(product.originalPrice || product.price || 0);

                  return (
                    <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name || `product ${product.id}`}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(product.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                      </td>

                      <td className={`${tableCell} w-[24%]`}>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <img
                              src={resolveThumbnail(product)}
                              alt={product.name || `#${product.id}`}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = FALLBACK_THUMBNAIL;
                              }}
                              className="h-full w-full object-contain p-1"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {product.name || `#${product.id}`}
                            </div>
                            <div className="truncate text-xs text-slate-500">{product.slug || "-"}</div>
                          </div>
                        </div>
                      </td>

                      <td className={`${tableCell} w-[15%] text-slate-700`}>
                        <span className="block truncate">{product.category?.name || "-"}</span>
                      </td>

                      <td className={`${tableCell} w-[9%] font-semibold text-slate-900`}>
                        {asCurrency(product.price)}
                      </td>

                      <td className={`${tableCell} w-[9%]`}>
                        {hasSalePrice ? (
                          <div className="font-semibold text-emerald-700">
                            {asCurrency(product.salePrice)}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className={`${tableCell} w-[7%] text-slate-700`}>{product.stock ?? 0}</td>

                      <td className={`${tableCell} w-[10%]`}>
                        <span className="inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                          {String(product.status || "").toLowerCase() === "active"
                            ? "Selling"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className={`${tableCell} w-[6%] text-center`}>
                        <button
                          type="button"
                          onClick={() => openViewDrawer(product.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          title="View product"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      </td>

                      <td className={`${tableCell} w-[8%] text-center`}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(product)}
                          disabled={publishingIds.has(Number(product.id))}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                            isPublished ? "bg-emerald-500" : "bg-rose-500"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label="Toggle published"
                          aria-busy={publishingIds.has(Number(product.id))}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                              isPublished ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>

                      <td className={`${tableCell} w-[8%] text-center`}>
                        <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(product.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(product.id)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete product"
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
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>

      {drawerState.open ? (
        <>
          <button
            type="button"
            aria-label="Close add product drawer"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <div className="fixed inset-y-0 left-0 right-0 z-50 border-l border-slate-200 bg-white shadow-2xl md:left-[280px]">
            {drawerState.mode === "view" ? (
              <ProductPreviewDrawer
                productId={drawerState.productId}
                onClose={closeDrawer}
                onEdit={(id) => openEditDrawer(id)}
              />
            ) : (
              <ProductForm
                key={`${drawerState.mode}-${drawerState.productId ?? "new"}`}
                mode="drawer"
                productId={drawerState.mode === "edit" ? drawerState.productId : null}
                onClose={closeDrawer}
                onSuccess={() => {
                  closeDrawer();
                  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
                }}
              />
            )}
          </div>
        </>
      ) : null}

      {bulkConfirm.open ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (bulkMutation.isPending) return;
              setBulkConfirm({ open: false, action: "delete", ids: [] });
            }}
            className="fixed inset-0 z-[70] bg-slate-900/35"
            aria-label="Close bulk delete confirmation"
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Are you sure?</h3>
              <p className="mt-2 text-sm text-slate-500">This action cannot be undone.</p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={() => setBulkConfirm({ open: false, action: "delete", ids: [] })}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={handleConfirmBulkDelete}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-500 bg-rose-500 px-4 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkMutation.isPending ? "Deleting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

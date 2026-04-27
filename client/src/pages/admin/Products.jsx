import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bulkAdminProducts,
  deleteAdminProduct,
  duplicateAdminProduct,
  exportAdminProducts,
  fetchAdminCategories,
  fetchAdminProducts,
  importAdminProducts,
  updateAdminProductPublished,
} from "../../lib/adminApi.js";
import { moneyIDR } from "../../utils/money.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { getPrimaryProductImageUrl } from "../../utils/productDisplay.js";
import {
  ChevronDown,
  Copy,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import ProductForm from "./ProductForm.jsx";
import ProductFilterBar from "../../components/Products/ProductFilterBar.jsx";
import ProductInventoryBadge from "../../components/Products/ProductInventoryBadge.jsx";
import ProductManagementHeader from "../../components/Products/ProductManagementHeader.jsx";
import ProductPublishedToggle from "../../components/Products/ProductPublishedToggle.jsx";
import ProductRowActionsMenu from "../../components/Products/ProductRowActionsMenu.jsx";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";
const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024;
const SEARCH_DEBOUNCE_MS = 400;
const COLUMN_VISIBILITY_STORAGE_KEY = "admin-products-column-visibility.v1";

const DEFAULT_FILTERS = {
  q: "",
  categoryIds: [],
  sort: "date_added",
  published: "all",
  status: "all",
  reviewState: "all",
};

const DEFAULT_COLUMN_VISIBILITY = {
  title: true,
  category: true,
  price: true,
  salePrice: true,
  stock: true,
  status: true,
  published: true,
  view: true,
  actions: true,
};

const SORT_OPTIONS = [
  { value: "date_added", label: "Date Added" },
  { value: "date_updated", label: "Date Updated" },
  { value: "price_asc", label: "Low to High" },
  { value: "price_desc", label: "High to Low" },
];

const PUBLISHED_OPTIONS = [
  { value: "all", label: "All publish states" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

const INVENTORY_OPTIONS = [
  { value: "all", label: "All stock states" },
  { value: "selling", label: "Selling" },
  { value: "out_of_stock", label: "Out of Stock" },
];

const PRICE_MENU_OPTIONS = [
  { value: "price_asc", label: "Low to High" },
  { value: "price_desc", label: "High to Low" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
  { value: "selling", label: "Inventory - Selling" },
  { value: "out_of_stock", label: "Inventory - Out of Stock" },
  { value: "date_added", label: "Date Added" },
  { value: "date_updated", label: "Date Updated" },
];

const btnBase =
  "inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[12px] font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus-visible:ring-slate-300`;
const btnGreen = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300`;
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300`;
const btnAmber = `${btnBase} bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-300`;
const btnSoft = `${btnBase} bg-slate-50 text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300`;

const inputBase =
  "h-[38px] w-full rounded-xl border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none";
const selectBase = `${inputBase} pr-8`;
const tableHeadCell =
  "whitespace-nowrap px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500";
const tableCell = "px-2 py-2.5 align-middle text-sm text-slate-700";

const getInitialColumnVisibility = () => {
  if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;

  try {
    const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_VISIBILITY;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_COLUMN_VISIBILITY;
    }

    return Object.keys(DEFAULT_COLUMN_VISIBILITY).reduce((acc, key) => {
      acc[key] =
        typeof parsed[key] === "boolean"
          ? parsed[key]
          : DEFAULT_COLUMN_VISIBILITY[key];
      return acc;
    }, {});
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
};

const getStorefrontBadgeMeta = ({ visibility, published, status, submissionStatus }) => {
  const stateCode = String(visibility?.stateCode || "")
    .trim()
    .toUpperCase();
  const reasonCode = String(visibility?.reasonCode || "")
    .trim()
    .toUpperCase();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedSubmission = String(submissionStatus || "none")
    .trim()
    .toLowerCase();

  if (stateCode === "STOREFRONT_VISIBLE") {
    return {
      label: "Visible",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dotClassName: "bg-emerald-500",
    };
  }

  if (stateCode === "PUBLISHED_BLOCKED" && reasonCode === "REVIEW_PENDING") {
    return {
      label: "Review blocked",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      dotClassName: "bg-sky-500",
    };
  }

  if (stateCode === "PUBLISHED_BLOCKED" && reasonCode === "REVISION_REQUIRED") {
    return {
      label: "Revision blocked",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }

  if (
    stateCode === "PUBLISHED_BLOCKED" &&
    (reasonCode === "STORE_NOT_ACTIVE" || reasonCode === "STORE_NOT_READY")
  ) {
    return {
      label: reasonCode === "STORE_NOT_READY" ? "Store not ready" : "Store blocked",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }

  if (!published) {
    return {
      label: normalizedStatus === "draft" ? "Draft" : "Hidden",
      className: "border-slate-200 bg-slate-100 text-slate-600",
      dotClassName: "bg-slate-400",
    };
  }

  if (normalizedSubmission === "submitted") {
    return {
      label: "Review blocked",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      dotClassName: "bg-sky-500",
    };
  }

  if (normalizedSubmission === "needs_revision") {
    return {
      label: "Revision blocked",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      dotClassName: "bg-amber-500",
    };
  }

  if (normalizedStatus === "active") {
    return {
      label: "Visible",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dotClassName: "bg-emerald-500",
    };
  }

  return {
    label: "Blocked",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    dotClassName: "bg-amber-500",
  };
};

function ProductPublishedBadge({ visibility, published, status, submissionStatus }) {
  const meta = getStorefrontBadgeMeta({
    visibility,
    published,
    status,
    submissionStatus,
  });

  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClassName}`} />
      {meta.label}
    </span>
  );
}

function ProductSellerReviewBadge({ submission }) {
  const status = submission?.status || "none";
  const toneClass =
    status === "submitted"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "needs_revision"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}
    >
      {submission?.label || "Not submitted"}
    </span>
  );
}

function ProductCategoryBadge({ label }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
      {label || "Uncategorized"}
    </span>
  );
}

const resolveAdminProductPricing = (product) => {
  const basePrice = Number(product?.price || 0);
  const rawSalePrice = product?.salePrice;
  const salePrice = Number.isFinite(Number(rawSalePrice)) ? Number(rawSalePrice) : null;
  const hasSalePrice = salePrice !== null && salePrice > 0 && salePrice < basePrice;

  return {
    basePrice,
    salePrice: hasSalePrice ? salePrice : null,
    hasSalePrice,
  };
};

const getStockMeta = (value) => {
  const stock = Number(value || 0);
  if (stock <= 0) {
    return {
      label: "Out of stock",
      className: "text-rose-500",
    };
  }
  if (stock <= 10) {
    return {
      label: "Low stock",
      className: "text-amber-600",
    };
  }
  return {
    label: "In stock",
    className: "text-emerald-600",
  };
};

const getInventoryStatusMeta = (value) => {
  const stock = Number(value || 0);
  if (stock <= 0) {
    return {
      code: "out_of_stock",
      label: "Out of Stock",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    code: "selling",
    label: "Selling",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

const resolveQuickFilterValue = (filters) => {
  if (filters.published === "published") return "published";
  if (filters.published === "unpublished") return "unpublished";
  if (filters.status === "selling") return "selling";
  if (filters.status === "out_of_stock") return "out_of_stock";
  if (filters.sort === "price_asc") return "price_asc";
  if (filters.sort === "price_desc") return "price_desc";
  if (filters.sort === "date_updated") return "date_updated";
  return "date_added";
};

const buildQuickFilterPatch = (value, currentFilters) => {
  const basePatch = {
    sort: currentFilters.sort,
    published: "all",
    status: "all",
  };

  if (value === resolveQuickFilterValue(currentFilters)) {
    return { ...basePatch, sort: "date_added" };
  }

  if (value === "price_asc") return { ...basePatch, sort: "price_asc" };
  if (value === "price_desc") return { ...basePatch, sort: "price_desc" };
  if (value === "published") return { ...basePatch, sort: "date_added", published: "published" };
  if (value === "unpublished") {
    return { ...basePatch, sort: "date_added", published: "unpublished" };
  }
  if (value === "selling") return { ...basePatch, sort: "date_added", status: "selling" };
  if (value === "out_of_stock") {
    return { ...basePatch, sort: "date_added", status: "out_of_stock" };
  }
  if (value === "date_updated") return { ...basePatch, sort: "date_updated" };

  return { ...basePatch, sort: "date_added" };
};

const getProductCategoryContext = (product) => {
  const selectedCategories = Array.isArray(product?.categories)
    ? product.categories.filter(Boolean)
    : [];
  const fallbackDefaultId = Number(product?.defaultCategoryId ?? product?.categoryId ?? 0);
  const defaultCategory =
    product?.defaultCategory ||
    product?.category ||
    selectedCategories.find((category) => Number(category?.id) === fallbackDefaultId) ||
    null;
  const relatedCategories = selectedCategories.filter(
    (category) => Number(category?.id) !== Number(defaultCategory?.id ?? 0)
  );

  return {
    defaultCategory,
    relatedCategories,
  };
};

const downloadResponseFile = async (response, fallbackName) => {
  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] || fallbackName;

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);

  return filename;
};

const formatFileSize = (value) => {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
};

const parseImportPreview = async (file) => {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Import only accepts valid JSON files.");
  }

  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.items)
      ? parsed.items
      : null;

  if (!items) {
    throw new Error("Import file must be a JSON array or an object with an `items` array.");
  }

  if (items.length === 0) {
    throw new Error("Import file does not contain any product rows.");
  }

  const hasInvalidItem = items.some(
    (item) => !item || typeof item !== "object" || Array.isArray(item)
  );
  if (hasInvalidItem) {
    throw new Error("Each imported product row must be an object.");
  }

  return {
    totalRows: items.length,
  };
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [columnVisibility, setColumnVisibility] = useState(getInitialColumnVisibility);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [publishedOverrides, setPublishedOverrides] = useState({});
  const [publishingIds, setPublishingIds] = useState(() => new Set());
  const [notice, setNotice] = useState(null);
  const [bulkConfirm, setBulkConfirm] = useState({
    open: false,
    ids: [],
  });
  const [drawerState, setDrawerState] = useState({
    open: false,
    mode: "create",
    productId: null,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [pendingImportSummary, setPendingImportSummary] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [priceMenuOpen, setPriceMenuOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [rowMenuOpenId, setRowMenuOpenId] = useState(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [priceSearch, setPriceSearch] = useState("");

  const publishedParam =
    appliedFilters.published === "published"
      ? true
      : appliedFilters.published === "unpublished"
        ? false
        : undefined;

  const params = useMemo(
    () => ({
      page,
      limit,
      q: appliedFilters.q || undefined,
      categoryIds: appliedFilters.categoryIds.length
        ? appliedFilters.categoryIds.join(",")
        : undefined,
      sort: appliedFilters.sort || undefined,
      published: publishedParam,
      inventoryStatus:
        appliedFilters.status && appliedFilters.status !== "all"
          ? appliedFilters.status
          : undefined,
      sellerSubmissionStatus:
        appliedFilters.reviewState && appliedFilters.reviewState !== "all"
          ? appliedFilters.reviewState
          : undefined,
    }),
    [appliedFilters, limit, page, publishedParam]
  );

  const productsQuery = useQuery({
    queryKey: [
      "admin-products",
      page,
      limit,
      appliedFilters.q,
      appliedFilters.categoryIds.join(","),
      appliedFilters.sort,
      appliedFilters.published,
      appliedFilters.status,
      appliedFilters.reviewState,
    ],
    queryFn: () => fetchAdminProducts(params),
    keepPreviousData: true,
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories-filter"],
    queryFn: () => fetchAdminCategories({ page: 1, limit: 200 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminProduct(id),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }) => updateAdminProductPublished(id, published),
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminProducts(action, ids),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => duplicateAdminProduct(id),
  });

  const items = productsQuery.data?.data || [];
  const meta = productsQuery.data?.meta || { page: 1, limit, total: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));
  const categories = useMemo(() => {
    const source = categoriesQuery.data?.data || [];
    return [...source].sort((left, right) =>
      String(left?.name || "").localeCompare(String(right?.name || ""), "id")
    );
  }, [categoriesQuery.data?.data]);

  const isOperationsBusy =
    isExporting ||
    isImporting ||
    bulkMutation.isPending ||
    deleteMutation.isPending ||
    duplicateMutation.isPending;
  const selectedCount = selectedIds.size;
  const activeFilterCount =
    (appliedFilters.q ? 1 : 0) +
    (appliedFilters.categoryIds.length > 0 ? 1 : 0) +
    (appliedFilters.sort !== "date_added" ? 1 : 0) +
    (appliedFilters.published !== "all" ? 1 : 0) +
    (appliedFilters.status !== "all" ? 1 : 0) +
    (appliedFilters.reviewState !== "all" ? 1 : 0);
  const selectedCategoryNames = useMemo(
    () =>
      categories
        .filter((category) => draftFilters.categoryIds.includes(Number(category.id)))
        .map((category) => category.name),
    [categories, draftFilters.categoryIds]
  );
  const selectedCategoryLabel =
    selectedCategoryNames.length === 0
      ? "All categories"
      : selectedCategoryNames.length === 1
        ? selectedCategoryNames[0]
        : `${selectedCategoryNames.length} categories`;
  const filteredCategories = useMemo(() => {
    const keyword = String(categorySearch || "").trim().toLowerCase();
    if (!keyword) return categories;
    return categories.filter((category) =>
      String(category?.name || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [categories, categorySearch]);
  const quickFilterValue = useMemo(
    () => resolveQuickFilterValue(draftFilters),
    [draftFilters]
  );
  const filteredPriceOptions = useMemo(() => {
    const keyword = String(priceSearch || "").trim().toLowerCase();
    if (!keyword) return PRICE_MENU_OPTIONS;
    return PRICE_MENU_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(keyword)
    );
  }, [priceSearch]);
  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  const closeFloatingMenus = () => {
    setExportMenuOpen(false);
    setImportMenuOpen(false);
    setBulkMenuOpen(false);
    setCategoryMenuOpen(false);
    setPriceMenuOpen(false);
    setColumnMenuOpen(false);
    setRowMenuOpenId(null);
  };

  const asCurrency = (value) => moneyIDR(Number(value || 0));
  const resolveThumbnail = (product) =>
    resolveAssetUrl(getPrimaryProductImageUrl(product, FALLBACK_THUMBNAIL));

  const getPublished = (product) => {
    const override = publishedOverrides[product.id];
    if (typeof override === "boolean") return override;
    if (typeof product?.published === "boolean") return product.published;
    if (typeof product?.visibility?.isPublished === "boolean") {
      return product.visibility.isPublished;
    }
    return false;
  };

  const allVisibleSelected =
    items.length > 0 && items.every((product) => selectedIds.has(Number(product.id)));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        items.forEach((product) => next.delete(Number(product.id)));
      } else {
        items.forEach((product) => next.add(Number(product.id)));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    const parsedId = Number(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(parsedId)) next.delete(parsedId);
      else next.add(parsedId);
      return next;
    });
  };

  const applyImmediateFilterPatch = (patch) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
    setAppliedFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds(new Set());
    setBulkConfirm({ open: false, ids: [] });
    closeFloatingMenus();
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    setSelectedIds(new Set());
    setNotice(null);
    setBulkConfirm({ open: false, ids: [] });
    closeFloatingMenus();
  };

  const handleToggleCategory = (categoryId) => {
    const parsedId = Number(categoryId);
    const nextIds = draftFilters.categoryIds.includes(parsedId)
      ? draftFilters.categoryIds.filter((value) => value !== parsedId)
      : [...draftFilters.categoryIds, parsedId];
    applyImmediateFilterPatch({ categoryIds: nextIds });
  };

  const handleQuickFilterSelect = (value) => {
    applyImmediateFilterPatch(buildQuickFilterPatch(value, draftFilters));
  };

  const showNotice = (payload) => {
    setNotice(payload);
  };

  const handleExport = async (format) => {
    if (isOperationsBusy) return;

    setIsExporting(true);
    closeFloatingMenus();
    showNotice(null);

    try {
      const response = await exportAdminProducts({
        q: appliedFilters.q,
        categoryIds: appliedFilters.categoryIds,
        sort: appliedFilters.sort,
        published: publishedParam,
        inventoryStatus:
          appliedFilters.status !== "all" ? appliedFilters.status : undefined,
        sellerSubmissionStatus:
          appliedFilters.reviewState !== "all" ? appliedFilters.reviewState : undefined,
        format,
      });
      const fallbackName =
        format === "csv" ? "products-export.csv" : "products-export.json";
      const filename = await downloadResponseFile(response, fallbackName);

      showNotice({
        type: "success",
        title: "Export completed",
        message: `${format.toUpperCase()} export downloaded as ${filename}.`,
      });
    } catch (error) {
      showNotice({
        type: "error",
        title: "Export failed",
        message: error?.message || "Export failed. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerImportPicker = () => {
    if (isOperationsBusy) return;
    const input = document.getElementById("admin-products-import-input");
    input?.click();
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isOperationsBusy) return;

    const normalizedName = String(file.name || "").toLowerCase();
    const normalizedType = String(file.type || "").toLowerCase();
    const looksLikeJson =
      normalizedName.endsWith(".json") ||
      normalizedType === "application/json" ||
      normalizedType.endsWith("+json");

    if (!looksLikeJson) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      showNotice({
        type: "error",
        title: "Invalid import file",
        message: "Import only accepts JSON files exported from Admin Products.",
      });
      return;
    }

    if (file.size <= 0) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      showNotice({
        type: "error",
        title: "Empty import file",
        message: "Choose a JSON file that contains at least one product row.",
      });
      return;
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      showNotice({
        type: "error",
        title: "Import file too large",
        message: "Import file exceeds the 2 MB limit for the current MVP flow.",
      });
      return;
    }

    try {
      const preview = await parseImportPreview(file);
      setPendingImportFile(file);
      setPendingImportSummary({
        name: file.name,
        size: file.size,
        totalRows: preview.totalRows,
      });
      showNotice({
        type: "success",
        title: "Import file ready",
        message: `${preview.totalRows} product row(s) detected in ${file.name}.`,
      });
    } catch (error) {
      setPendingImportFile(null);
      setPendingImportSummary(null);
      showNotice({
        type: "error",
        title: "Import file invalid",
        message: error?.message || "Import file validation failed.",
      });
    }
  };

  const handleImportNow = async () => {
    if (!pendingImportFile || isOperationsBusy) return;

    showNotice(null);
    setIsImporting(true);

    try {
      const response = await importAdminProducts(pendingImportFile);
      const summary = response?.data || {};
      const totalRows = Number(summary.totalRows || 0);
      const created = Number(summary.created || 0);
      const updated = Number(summary.updated || 0);
      const failed = Number(summary.failed || 0);
      const importErrors = Array.isArray(summary.errors) ? summary.errors : [];
      const errorPreview = importErrors.slice(0, 3).map((entry) => {
        const rowLabel = entry?.row ? `Row ${entry.row}` : "Row";
        const slugLabel = entry?.slug ? ` (${entry.slug})` : "";
        return `${rowLabel}${slugLabel}: ${entry?.message || "Import row failed."}`;
      });

      showNotice({
        type: failed > 0 && created + updated === 0 ? "error" : "success",
        title: failed > 0 ? "Import completed with warnings" : "Import completed",
        message: `Processed ${totalRows} row(s): ${created} created, ${updated} updated, ${failed} failed.`,
        details: errorPreview,
        meta:
          failed > errorPreview.length
            ? `${failed - errorPreview.length} additional row error(s) not shown.`
            : null,
      });

      setPendingImportFile(null);
      setPendingImportSummary(null);
      setSelectedIds(new Set());
      closeFloatingMenus();
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (error) {
      showNotice({
        type: "error",
        title: "Import failed",
        message: error?.response?.data?.message || "Import failed. Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkAction = (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showNotice({
        type: "error",
        title: "Selection required",
        message: "Select at least one product before running a bulk action.",
      });
      setBulkMenuOpen(false);
      return;
    }

    if (action === "delete") {
      setBulkConfirm({ open: true, ids });
      setBulkMenuOpen(false);
      return;
    }

    showNotice(null);
    bulkMutation.mutate(
      { action, ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          setSelectedIds(new Set());
          setBulkMenuOpen(false);
          showNotice({
            type: "success",
            title:
              action === "publish"
                ? "Bulk publish completed"
                : "Bulk unpublish completed",
            message:
              action === "publish"
                ? `${affected} product(s) published.`
                : `${affected} product(s) unpublished.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          showNotice({
            type: "error",
            title: "Bulk action failed",
            message:
              error?.response?.data?.message || "Bulk action failed. Please try again.",
          });
        },
      }
    );
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkConfirm.open || bulkConfirm.ids.length === 0 || bulkMutation.isPending) {
      return;
    }

    showNotice(null);
    bulkMutation.mutate(
      { action: "delete", ids: bulkConfirm.ids },
      {
        onSuccess: (response) => {
          const affected = Number(response?.affected || 0);
          const archived = Number(response?.archived || 0);
          setSelectedIds(new Set());
          setBulkConfirm({ open: false, ids: [] });
          setBulkMenuOpen(false);
          showNotice({
            type: archived > 0 ? "warning" : "success",
            title:
              archived > 0
                ? affected > 0
                  ? "Bulk delete archived referenced products"
                  : "Bulk delete archived selected products"
                : "Bulk delete completed",
            message:
              archived > 0
                ? affected > 0
                  ? `${affected} product(s) deleted. ${archived} product(s) archived and hidden from the catalog because they are already used in transaction history.`
                  : `${archived} product(s) archived and hidden from the catalog because they are already used in transaction history.`
                : `${affected} product(s) deleted.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          const partialAffected = Number(error?.response?.data?.affected || 0);
          const blockedIds = Array.isArray(error?.response?.data?.blockedIds)
            ? error.response.data.blockedIds
            : [];
          const isDeleteBlocked = blockedIds.length > 0;
          if (partialAffected > 0) {
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
          }
          setBulkConfirm({ open: false, ids: [] });
          setBulkMenuOpen(false);
          showNotice({
            type: partialAffected > 0 || isDeleteBlocked ? "warning" : "error",
            title:
              partialAffected > 0
                ? "Bulk delete partially completed"
                : isDeleteBlocked
                  ? "Bulk delete blocked"
                  : "Bulk delete failed",
            message: isDeleteBlocked
              ? error?.response?.data?.message ||
                "Selected products are already used in transaction history and cannot be deleted."
              : error?.response?.data?.message || "Delete selected failed. Please try again.",
          });
        },
      }
    );
  };

  const handleDeleteOne = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId || deleteMutation.isPending) return;
    closeFloatingMenus();

    if (!window.confirm("Delete this product?")) return;

    deleteMutation.mutate(parsedId, {
      onSuccess: (response) => {
        showNotice({
          type: response?.archived ? "warning" : "success",
          title: response?.archived ? "Product archived" : "Product deleted",
          message: response?.archived
            ? `Product #${parsedId} was hidden from the catalog because it is already used in transaction history.`
            : `Product #${parsedId} deleted.`,
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(parsedId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      },
      onError: (error) => {
        showNotice({
          type: "error",
          title: "Delete failed",
          message: error?.response?.data?.message || "Delete failed. Please try again.",
        });
      },
    });
  };

  const handleTogglePublished = (product) => {
    const productId = Number(product?.id);
    if (!productId || publishingIds.has(productId)) return;

    const hadOverride = Object.prototype.hasOwnProperty.call(publishedOverrides, productId);
    const previousOverride = hadOverride ? publishedOverrides[productId] : undefined;
    const previousValue = getPublished(product);
    const nextValue = !previousValue;

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
          showNotice({
            type: "success",
            title: nextValue ? "Product published" : "Product unpublished",
            message: `${product?.name || `Product #${productId}`} updated successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        },
        onError: (error) => {
          setPublishedOverrides((prev) => {
            const next = { ...prev };
            if (hadOverride) next[productId] = previousOverride;
            else delete next[productId];
            return next;
          });
          showNotice({
            type: "error",
            title: "Published toggle failed",
            message:
              error?.response?.data?.message || "Failed to update published status.",
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

  const handleDuplicateProduct = (product) => {
    const productId = Number(product?.id);
    if (!productId || duplicateMutation.isPending) return;

    closeFloatingMenus();
    showNotice(null);

    duplicateMutation.mutate(productId, {
      onSuccess: (response) => {
        const duplicated = response?.data;
        showNotice({
          type: "success",
          title: "Duplicate created",
          message: `${duplicated?.name || "Product copy"} created as an unpublished admin copy.`,
        });
        queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      },
      onError: (error) => {
        showNotice({
          type: "error",
          title: "Duplicate failed",
          message:
            error?.response?.data?.message || "Failed to duplicate the selected product.",
        });
      },
    });
  };

  const openCreateDrawer = () => {
    setDrawerState({ open: true, mode: "create", productId: null });
  };

  const openEditDrawer = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    setDrawerState({ open: true, mode: "edit", productId: parsedId });
  };

  const openProductDetailPage = (productId) => {
    const parsedId = Number(productId);
    if (!parsedId) return;
    navigate(`/admin/catalog/products/${encodeURIComponent(String(parsedId))}`);
  };

  const closeDrawer = () => {
    setDrawerState({ open: false, mode: "create", productId: null });
  };

  useEffect(() => {
    const visibleIds = new Set(items.map((product) => Number(product?.id)));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (visibleIds.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      COLUMN_VISIBILITY_STORAGE_KEY,
      JSON.stringify(columnVisibility)
    );
  }, [columnVisibility]);

  useEffect(() => {
    const nextQ = String(draftFilters.q || "").trim();
    if (nextQ === appliedFilters.q) return undefined;

    const timeoutId = window.setTimeout(() => {
      setAppliedFilters((prev) => ({ ...prev, q: nextQ }));
      setPage(1);
      setSelectedIds(new Set());
      setBulkConfirm({ open: false, ids: [] });
      setRowMenuOpenId(null);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [appliedFilters.q, draftFilters.q]);

  useEffect(() => {
    const onPointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (!target.closest("[data-products-export-menu]")) setExportMenuOpen(false);
      if (!target.closest("[data-products-import-menu]")) setImportMenuOpen(false);
      if (!target.closest("[data-products-bulk-menu]")) setBulkMenuOpen(false);
      if (!target.closest("[data-products-category-menu]")) setCategoryMenuOpen(false);
      if (!target.closest("[data-products-price-menu]")) setPriceMenuOpen(false);
      if (!target.closest("[data-products-column-menu]")) setColumnMenuOpen(false);
      if (!target.closest("[data-products-row-menu]")) setRowMenuOpenId(null);
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

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="space-y-1.5 overflow-x-hidden">
      {notice ? (
        <div className="pointer-events-none fixed right-5 top-24 z-[90] w-full max-w-sm">
          <div
            className={`pointer-events-auto rounded-2xl border bg-white px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ${
              notice.type === "error"
                ? "border-rose-200"
                : notice.type === "warning"
                  ? "border-amber-200"
                  : "border-emerald-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  notice.type === "error"
                    ? "bg-rose-500"
                    : notice.type === "warning"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                {notice.title ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-900">
                    {notice.title}
                  </p>
                ) : null}
                <p className={`text-sm text-slate-600 ${notice.title ? "mt-1" : ""}`}>
                  {notice.message}
                </p>
                {Array.isArray(notice.details) && notice.details.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-500">
                    {notice.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
                {notice.meta ? <p className="mt-2 text-[11px] text-slate-500">{notice.meta}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ProductManagementHeader
        title="Products"
        subtitle="Manage your products inventory"
        subtitleClassName="whitespace-nowrap"
      >
              <div className="relative" data-products-export-menu>
                <button
                  type="button"
                  onClick={() => {
                    setExportMenuOpen((prev) => !prev);
                    setImportMenuOpen(false);
                    setBulkMenuOpen(false);
                  }}
                  disabled={isOperationsBusy}
                  className={`${btnOutline} h-[34px] gap-1 rounded-lg px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {exportMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleExport("csv")}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Export to CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("json")}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Export to JSON
                    </button>
                  </div>
                ) : null}
              </div>

              <div
                className="flex min-w-0 flex-wrap items-center gap-1 xl:flex-nowrap xl:gap-1"
                data-products-import-menu
              >
                <button
                  type="button"
                  onClick={() => {
                    setImportMenuOpen((prev) => !prev);
                    setExportMenuOpen(false);
                    setBulkMenuOpen(false);
                  }}
                  disabled={isOperationsBusy}
                  className={`${btnOutline} h-[34px] gap-1 rounded-lg px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
                <input
                  id="admin-products-import-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                {importMenuOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={triggerImportPicker}
                      disabled={isOperationsBusy}
                      title={
                        pendingImportSummary
                          ? `${pendingImportSummary.name} • ${pendingImportSummary.totalRows} rows • ${formatFileSize(pendingImportSummary.size)}`
                          : "SelectYourJSON Products File"
                      }
                      className="inline-flex h-[34px] w-[136px] min-w-0 max-w-[136px] items-center gap-1 rounded-lg border border-emerald-200 border-dashed bg-white px-1.5 text-[10px] font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span className="truncate">
                        {pendingImportSummary?.name || "SelectYourJSON Products File"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleImportNow}
                      disabled={!pendingImportFile || isOperationsBusy}
                      className={`inline-flex h-[34px] items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        pendingImportFile && !isOperationsBusy
                          ? "bg-sky-500 text-white hover:bg-sky-600"
                          : "border border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isImporting ? "Importing..." : "Import Now"}
                    </button>
                  </>
                ) : null}
              </div>

              <div className="relative" data-products-bulk-menu>
                <button
                  type="button"
                  disabled={selectedCount === 0 || bulkMutation.isPending}
                  onClick={() => {
                    setBulkMenuOpen((prev) => !prev);
                    setExportMenuOpen(false);
                    setImportMenuOpen(false);
                  }}
                  className={`h-[34px] gap-1 rounded-lg px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedCount > 0 ? btnAmber : btnOutline
                  }`}
                >
                  Bulk Action
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {bulkMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => handleBulkAction("delete")}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                    >
                      Delete multiple
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("publish")}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                    >
                      Publish multiple
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkAction("unpublish")}
                      className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                    >
                      Unpublish multiple
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setBulkConfirm({ open: true, ids: Array.from(selectedIds) })}
                disabled={selectedCount === 0 || bulkMutation.isPending}
                className={`${btnDanger} h-[34px] gap-1 rounded-lg px-2 text-[11px] hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>

              <button
                type="button"
                onClick={openCreateDrawer}
                disabled={isOperationsBusy}
                className={`${btnGreen} h-[34px] gap-1 rounded-lg px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Product
              </button>
      </ProductManagementHeader>

      <ProductFilterBar
        controls={
          <div className="grid min-w-0 flex-1 gap-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,0.62fr)_minmax(0,0.62fr)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={draftFilters.q}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, q: event.target.value }))
                }
                placeholder="Search by product name"
                className={`${inputBase} pl-9`}
              />
            </div>

            <div className="relative" data-products-category-menu>
              <button
                type="button"
                onClick={() => {
                  setCategoryMenuOpen((prev) => !prev);
                  setPriceMenuOpen(false);
                  setColumnMenuOpen(false);
                }}
                className={`${btnOutline} h-[38px] w-full justify-start gap-2 rounded-xl border-dashed px-3 text-sm font-semibold ${
                  draftFilters.categoryIds.length > 0
                    ? "border-emerald-300 bg-emerald-50/70 text-emerald-700"
                    : ""
                }`}
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current/30">
                  <Plus className="h-3 w-3" />
                </span>
                <span className="truncate">Category</span>
              </button>
              {categoryMenuOpen ? (
                <div className="absolute left-0 z-30 mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Category"
                      className={`${inputBase} h-[40px] rounded-xl border-slate-200 pl-9 pr-3`}
                    />
                  </div>
                  <div className="mt-2 max-h-64 space-y-0.5 overflow-auto pr-1">
                    {filteredCategories.length ? (
                      filteredCategories.map((category) => {
                      const checked = draftFilters.categoryIds.includes(Number(category.id));
                      return (
                        <label
                          key={category.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition ${
                            checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleCategory(category.id)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                          />
                          <span className="min-w-0 truncate">{category.name}</span>
                        </label>
                      );
                    })
                    ) : (
                      <div className="px-2.5 py-3 text-sm text-slate-500">
                        No categories found.
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-1 pt-2">
                    <span className="text-[11px] font-medium text-slate-500">
                      {selectedCategoryNames.length
                        ? `${selectedCategoryNames.length} selected`
                        : "No category selected"}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyImmediateFilterPatch({ categoryIds: [] })}
                      className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative" data-products-price-menu>
              <button
                type="button"
                onClick={() => {
                  setPriceMenuOpen((prev) => !prev);
                  setCategoryMenuOpen(false);
                  setColumnMenuOpen(false);
                }}
                className={`${btnOutline} h-[38px] w-full justify-start gap-2 rounded-xl border-dashed px-3 text-sm font-semibold ${
                  quickFilterValue !== "date_added"
                    ? "border-emerald-300 bg-emerald-50/70 text-emerald-700"
                    : ""
                }`}
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current/30">
                  <Plus className="h-3 w-3" />
                </span>
                <span className="truncate">Price</span>
              </button>
              {priceMenuOpen ? (
                <div className="absolute left-0 z-30 mt-2 w-[280px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={priceSearch}
                      onChange={(event) => setPriceSearch(event.target.value)}
                      placeholder="Price"
                      className={`${inputBase} h-[40px] rounded-xl border-slate-200 pl-9 pr-3`}
                    />
                  </div>
                  <div className="mt-2 max-h-64 space-y-0.5 overflow-auto pr-1">
                    {filteredPriceOptions.length ? (
                      filteredPriceOptions.map((option) => {
                        const checked = quickFilterValue === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleQuickFilterSelect(option.value)}
                            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                              checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`inline-flex h-4 w-4 shrink-0 rounded border ${
                                checked
                                  ? "border-emerald-500 bg-emerald-100"
                                  : "border-slate-300 bg-white"
                              }`}
                            />
                            <span className="truncate">{option.label}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-2.5 py-3 text-sm text-slate-500">
                        No price filters found.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>

            <div className="relative" data-products-column-menu>
              <button
                type="button"
                onClick={() => {
                  setColumnMenuOpen((prev) => !prev);
                  setCategoryMenuOpen(false);
                }}
                title={`Toggle columns (${visibleColumnCount}/9 visible)`}
                className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span>View</span>
              </button>
              {columnMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Visible columns
                    </p>
                    <button
                      type="button"
                      onClick={() => setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)}
                      className="text-[11px] font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      ["title", "Title"],
                      ["category", "Category"],
                      ["price", "Price"],
                      ["salePrice", "Sale Price"],
                      ["stock", "Stock"],
                      ["status", "Inventory"],
                      ["published", "Published"],
                      ["view", "View"],
                      ["actions", "Actions"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(columnVisibility[key])}
                          onChange={() =>
                            setColumnVisibility((prev) => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        }
        footer={categoriesQuery.isError ? <p className="text-xs text-rose-500">Failed to load categories.</p> : null}
      />
      {productsQuery.isLoading ? (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading products...
        </div>
      ) : productsQuery.isError ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 shadow-sm">
          {productsQuery.error?.response?.data?.message || "Failed to load products."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[18px] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {activeFilterCount > 0
            ? "No products match the current filters."
            : "No products added yet."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: "44px" }} />
                {columnVisibility.title ? <col style={{ width: "250px" }} /> : null}
                {columnVisibility.category ? <col style={{ width: "118px" }} /> : null}
                {columnVisibility.price ? <col style={{ width: "96px" }} /> : null}
                {columnVisibility.salePrice ? <col style={{ width: "96px" }} /> : null}
                {columnVisibility.stock ? <col style={{ width: "80px" }} /> : null}
                {columnVisibility.status ? <col style={{ width: "84px" }} /> : null}
                {columnVisibility.view ? <col style={{ width: "56px" }} /> : null}
                {columnVisibility.published ? <col style={{ width: "72px" }} /> : null}
                {columnVisibility.actions ? <col style={{ width: "64px" }} /> : null}
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-11 px-2.5`}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible products"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                  </th>
                  {columnVisibility.title ? (
                    <th className={`${tableHeadCell} min-w-[190px]`}>Product Name</th>
                  ) : null}
                  {columnVisibility.category ? (
                    <th className={`${tableHeadCell} min-w-[110px]`}>Category</th>
                  ) : null}
                  {columnVisibility.price ? (
                    <th className={`${tableHeadCell} min-w-[88px] text-right`}>Price</th>
                  ) : null}
                  {columnVisibility.salePrice ? (
                    <th className={`${tableHeadCell} min-w-[88px] text-right`}>Sale Price</th>
                  ) : null}
                  {columnVisibility.stock ? (
                    <th className={`${tableHeadCell} min-w-[76px] text-right`}>Stock</th>
                  ) : null}
                  {columnVisibility.status ? (
                    <th className={`${tableHeadCell} min-w-[80px]`}>Inventory</th>
                  ) : null}
                  {columnVisibility.view ? (
                    <th className={`${tableHeadCell} min-w-[52px] text-center`}>View</th>
                  ) : null}
                  {columnVisibility.published ? (
                    <th className={`${tableHeadCell} min-w-[68px] text-center`}>Published</th>
                  ) : null}
                  {columnVisibility.actions ? (
                    <th className={`${tableHeadCell} min-w-[60px] text-center`}>Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((product) => {
                  const productId = Number(product.id);
                  const isSelected = selectedIds.has(productId);
                  const isPublished = getPublished(product);
                  const pricing = resolveAdminProductPricing(product);
                  const inventoryMeta = getInventoryStatusMeta(product.stock);
                  const categoryContext = getProductCategoryContext(product);
                  const sellerSubmission = product?.sellerSubmission || null;
                  const publishGate = sellerSubmission?.publishGate || null;
                  const publishToggleDisabled =
                    publishingIds.has(productId) ||
                    (!isPublished && publishGate && publishGate.canUseListToggle === false);
                  const publishToggleTitle =
                    !isPublished && publishGate?.hint
                      ? publishGate.hint
                      : "Toggle published";
                  const rowMenuOpen = rowMenuOpenId === productId;

                  return (
                    <tr
                      key={product.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-11 px-2.5`}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name || `product ${product.id}`}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(product.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                      </td>

                      {columnVisibility.title ? (
                        <td className={tableCell}>
                          <div className="flex min-w-0 items-start gap-2">
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-slate-900">
                                {product.name || `#${product.id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                      ) : null}

                      {columnVisibility.category ? (
                        <td className={tableCell}>
                          <div className="space-y-0.5">
                            <ProductCategoryBadge label={categoryContext.defaultCategory?.name} />
                            {categoryContext.relatedCategories.length > 0 ? (
                              <p className="text-[10px] text-slate-400">
                                +{categoryContext.relatedCategories.length} more
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-400">-</p>
                            )}
                          </div>
                        </td>
                      ) : null}

                      {columnVisibility.price ? (
                        <td className={`${tableCell} text-right font-semibold tabular-nums text-slate-900`}>
                          {asCurrency(pricing.basePrice)}
                        </td>
                      ) : null}

                      {columnVisibility.salePrice ? (
                        <td className={`${tableCell} text-right tabular-nums`}>
                          {pricing.hasSalePrice ? (
                            <span className="font-semibold text-emerald-700">
                              {asCurrency(pricing.salePrice)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      ) : null}

                      {columnVisibility.stock ? (
                        <td className={`${tableCell} text-right tabular-nums`}>
                          <div className="font-semibold text-slate-900">{product.stock ?? 0}</div>
                        </td>
                      ) : null}

                      {columnVisibility.status ? (
                        <td className={tableCell}>
                          <ProductInventoryBadge
                            label={inventoryMeta.label}
                            className={inventoryMeta.className}
                          />
                        </td>
                      ) : null}

                      {columnVisibility.view ? (
                        <td className={`${tableCell} text-center`}>
                          <button
                            type="button"
                            onClick={() => openProductDetailPage(product.id)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                            title="View product"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      ) : null}

                      {columnVisibility.published ? (
                        <td className={`${tableCell} text-center`}>
                          <ProductPublishedToggle
                            checked={isPublished}
                            onClick={() => handleTogglePublished(product)}
                            disabled={publishToggleDisabled}
                            ariaLabel={publishToggleTitle}
                            title={publishToggleTitle}
                            busy={publishingIds.has(productId)}
                          />
                        </td>
                      ) : null}

                      {columnVisibility.actions ? (
                        <td className={`${tableCell} text-center`}>
                          <ProductRowActionsMenu
                            open={rowMenuOpen}
                            onToggle={() =>
                              setRowMenuOpenId((prev) => (prev === productId ? null : productId))
                            }
                            containerProps={{ "data-products-row-menu": true }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                closeFloatingMenus();
                                openProductDetailPage(product.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Search className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(product)}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                closeFloatingMenus();
                                openEditDrawer(product.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOne(product.id)}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </ProductRowActionsMenu>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {drawerState.open ? (
        <>
          <button
            type="button"
            aria-label="Close product drawer"
            onClick={closeDrawer}
            className="fixed inset-0 z-40 bg-slate-900/35"
          />
          <div className="fixed inset-0 z-50 w-screen max-w-full overflow-x-hidden border-l border-slate-200 bg-white shadow-2xl md:left-[280px] md:right-0 md:w-auto">
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
          </div>
        </>
      ) : null}

      {bulkConfirm.open ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (bulkMutation.isPending) return;
              setBulkConfirm({ open: false, ids: [] });
            }}
            className="fixed inset-0 z-[70] bg-slate-900/35"
            aria-label="Close bulk delete confirmation"
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">Delete selected products?</h3>
              <p className="mt-2 text-sm text-slate-500">
                You are about to delete {bulkConfirm.ids.length} selected product(s). This action
                cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={() => setBulkConfirm({ open: false, ids: [] })}
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

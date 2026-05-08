import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Plus,
  PlusCircle,
  RotateCcw,
  Search,
  SquarePen,
  SlidersHorizontal,
  Store as StoreIcon,
  Trash2,
  Upload,
} from "lucide-react";
import {
  bulkSellerAttributes,
  createSellerAttribute,
  deleteSellerAttribute,
  exportSellerAttributes,
  getSellerAttributes,
  importSellerAttributes,
  setSellerAttributePublished,
  updateSellerAttribute,
} from "../../api/sellerAttributes.ts";
import AttributeModal from "../../components/admin/attributes/AttributeModal.jsx";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerDangerButtonClass,
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceNotice,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

const defaultFilters = {
  keyword: "",
  optionType: "",
  published: "",
  status: "active",
  page: 1,
  limit: 20,
};

const DEFAULT_COLUMN_VISIBILITY = {
  id: true,
  name: true,
  displayName: true,
  optionType: true,
  published: true,
  values: true,
  actions: true,
};

const OPTION_TYPE_OPTIONS = [
  { value: "", label: "Option Type" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
];

const PUBLISHED_OPTIONS = [
  { value: "", label: "Published" },
  { value: "true", label: "Published" },
  { value: "false", label: "Unpublished" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active only" },
  { value: "archived", label: "Archived only" },
];

const COLUMN_LABELS = {
  id: "ID",
  name: "Name",
  displayName: "Display Name",
  optionType: "Option Type",
  published: "Published",
  values: "Values",
  actions: "Action",
};

const parseFilename = (headerValue, fallback) => {
  const match = String(headerValue || "").match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

const downloadResponse = async (response, fallbackName) => {
  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("content-disposition"), fallbackName);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const validateImportFile = async (file) => {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file.");
  }

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : null;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Import JSON must be a non-empty array.");
  }

  items.forEach((entry, index) => {
    const name = String(entry?.name || "").trim();
    const type = String(entry?.type || "dropdown").trim().toLowerCase();
    const values = Array.isArray(entry?.values) ? entry.values : [];
    if (!name) {
      throw new Error(`Row ${index + 1} is missing name.`);
    }
    if (!["dropdown", "radio", "checkbox"].includes(type)) {
      throw new Error(`Row ${index + 1} has invalid type.`);
    }
    if (values.length === 0) {
      throw new Error(`Row ${index + 1} must include at least one value.`);
    }
  });

  return { count: items.length };
};

function FilterPopover({
  open,
  placeholder,
  options,
  selectedValue,
  searchValue,
  onSearchChange,
  onSelect,
}) {
  if (!open) return null;

  return (
    <div className="absolute left-0 top-full z-30 mt-2 w-[182px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_38px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-100 px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={placeholder}
            className="h-8 w-full border-0 bg-transparent pl-5 pr-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="p-1.5">
        {options.length === 0 ? (
          <div className="rounded-lg px-3 py-2 text-sm text-slate-400">No results</div>
        ) : (
          options.map((option) => {
            const checked = selectedValue === option.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => onSelect?.(checked ? "" : option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  checked ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    checked
                      ? "border-teal-500 bg-white text-teal-600"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span>{option.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ScopeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      <StoreIcon className="h-3.5 w-3.5" />
      My Store
    </span>
  );
}

function RowActions({ attribute, open, onToggle, onEdit, onDelete }) {
  const disabled = !attribute?.editable;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        aria-label="Open row actions"
        title={disabled ? "Managed by Admin" : ""}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            disabled={disabled}
            title={disabled ? "Managed by Admin" : ""}
            onClick={disabled ? undefined : onEdit}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium ${
              disabled ? "cursor-not-allowed text-slate-400" : "text-slate-700 transition hover:bg-slate-50"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            {disabled ? "Managed by Admin" : "Edit"}
          </button>
          <button
            type="button"
            disabled={disabled}
            title={disabled ? "Managed by Admin" : ""}
            onClick={disabled ? undefined : onDelete}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium ${
              disabled ? "cursor-not-allowed text-slate-400" : "text-rose-600 transition hover:bg-rose-50"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {disabled ? "Managed by Admin" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SectionTable({
  title,
  subtitle,
  tone = "store",
  hideHeader = false,
  showCount = true,
  rows,
  visibleColumns,
  selectedIds,
  setSelectedIds,
  openMenuId,
  setOpenMenuId,
  rowMenuRef,
  onEdit,
  onDelete,
  onOpenValues,
  togglePublishedMutation,
  toggleVariables,
  emptyState,
  hideSelection = false,
}) {
  const selectableRows = rows.filter((row) => row.editable);
  const allSelected =
    !hideSelection &&
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedIds.includes(Number(row.id)));
  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      {!hideHeader ? (
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            {showCount ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  tone === "store"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                {rows.length} row{rows.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-4 py-10">{emptyState}</div>
      ) : (
        <div className="overflow-x-hidden">
          <table className="w-full table-auto text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-12 whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {hideSelection ? null : (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds(
                          allSelected ? [] : selectableRows.map((attribute) => Number(attribute.id))
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  )}
                </th>
                {visibleColumns.id ? <th className="w-14 whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">ID</th> : null}
                {visibleColumns.name ? <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Name</th> : null}
                {visibleColumns.displayName ? <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Display Name</th> : null}
                {visibleColumns.optionType ? <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Option Type</th> : null}
                {visibleColumns.scope ? <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Scope</th> : null}
                {visibleColumns.published ? <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Published</th> : null}
                {visibleColumns.values ? <th className="w-16 whitespace-nowrap px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Values</th> : null}
                {visibleColumns.actions ? <th className="w-16 whitespace-nowrap px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((attribute) => {
                const id = Number(attribute.id);
                const isEditable = Boolean(attribute.editable);
                const isToggling =
                  togglePublishedMutation.isPending && toggleVariables?.id === id;

                return (
                  <tr key={id} className="border-t border-slate-100 transition hover:bg-slate-50/80">
                    <td className="px-3 py-3 align-middle text-sm text-slate-700">
                      {hideSelection ? null : (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          disabled={!isEditable}
                          title={!isEditable ? "Managed by Admin" : ""}
                          onChange={() =>
                            setSelectedIds((prev) =>
                              prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      )}
                    </td>
                    {visibleColumns.id ? <td className="px-3 py-3 align-middle text-sm text-slate-700"><span className="font-medium text-slate-900">{id}</span></td> : null}
                    {visibleColumns.name ? (
                      <td className="px-3 py-3 align-middle text-sm text-slate-700">
                        <div className="space-y-1">
                          <span className="block truncate font-semibold text-slate-900" title={attribute.name}>
                            {attribute.name}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                attribute.isUsed
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                              }`}
                            >
                              {attribute.isUsed
                                ? `Used by ${attribute.usageCount} product${attribute.usageCount === 1 ? "" : "s"}`
                                : "Unused"}
                            </span>
                          </div>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.displayName ? (
                      <td className={`${visibleColumnCount <= 4 ? "w-[28%]" : ""} px-3 py-3 align-middle text-sm text-slate-700`}>
                        <span className="block truncate" title={attribute.displayName || "-"}>
                          {attribute.displayName || "-"}
                        </span>
                      </td>
                    ) : null}
                    {visibleColumns.optionType ? (
                      <td className="px-3 py-3 align-middle text-sm text-slate-700">
                        <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium uppercase text-slate-600">
                          {attribute.type}
                        </span>
                      </td>
                    ) : null}
                    {visibleColumns.scope ? (
                      <td className="px-3 py-3 align-middle text-sm text-slate-700">
                        <ScopeBadge scope={attribute.scope} />
                      </td>
                    ) : null}
                    {visibleColumns.published ? (
                      <td className="px-3 py-3 align-middle text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex min-h-6 whitespace-nowrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            attribute.published
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${attribute.published ? "bg-emerald-500" : "bg-rose-400"}`} />
                            {attribute.published ? "Published" : "Unpublished"}
                          </span>
                          <button
                            type="button"
                            disabled={!isEditable || isToggling}
                            title={!isEditable ? "Managed by Admin" : ""}
                            onClick={() =>
                              isEditable &&
                              togglePublishedMutation.mutate({
                                id,
                                published: !attribute.published,
                              })
                            }
                            className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition ${
                              attribute.published ? "bg-emerald-500" : "bg-slate-300"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                                attribute.published ? "translate-x-4.5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.values ? (
                      <td className="px-3 py-3 align-middle text-sm text-slate-700">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => onOpenValues?.(attribute)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            title={`Manage values for ${attribute.name || "attribute"}`}
                            aria-label={`Open values for ${attribute.name || "attribute"}`}
                          >
                            <SquarePen className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                    {visibleColumns.actions ? (
                      <td className="px-2 py-3 align-middle text-right text-sm text-slate-700">
                        <div ref={openMenuId === id ? rowMenuRef : null} className="flex justify-end">
                          <RowActions
                            attribute={attribute}
                            open={openMenuId === id}
                            onToggle={() => setOpenMenuId((prev) => (prev === id ? null : id))}
                            onEdit={() => {
                              setOpenMenuId(null);
                              onEdit(attribute);
                            }}
                            onDelete={() => {
                              setOpenMenuId(null);
                              onDelete(attribute);
                            }}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function SellerAttributesPage() {
  const navigate = useNavigate();
  const { workspaceStoreId: storeId, sellerContext, workspaceRoutes } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewAttributes = permissionKeys.includes("ATTRIBUTE_VIEW");
  const canManageAttributes = permissionKeys.includes("ATTRIBUTE_MANAGE");
  const queryClient = useQueryClient();

  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [selectedIds, setSelectedIds] = useState([]);
  const [notice, setNotice] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [exportingFormat, setExportingFormat] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [pendingImportCount, setPendingImportCount] = useState(0);
  const [importPickerVisible, setImportPickerVisible] = useState(false);
  const [modalState, setModalState] = useState({ open: false, mode: "create", attribute: null });
  const [modalSubmitError, setModalSubmitError] = useState("");

  const exportMenuRef = useRef(null);
  const bulkMenuRef = useRef(null);
  const viewMenuRef = useRef(null);
  const rowMenuRef = useRef(null);
  const importInputRef = useRef(null);
  const optionTypeFilterRef = useRef(null);
  const publishedFilterRef = useRef(null);
  const statusFilterRef = useRef(null);

  const [optionTypeFilterOpen, setOptionTypeFilterOpen] = useState(false);
  const [publishedFilterOpen, setPublishedFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [optionTypeSearch, setOptionTypeSearch] = useState("");
  const [publishedSearch, setPublishedSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const effectiveFilters = useMemo(
    () => ({
      ...appliedFilters,
      scope: "store",
    }),
    [appliedFilters]
  );

  const attributesQuery = useQuery({
    queryKey: ["seller", "attributes", storeId, effectiveFilters],
    queryFn: () => getSellerAttributes(storeId, effectiveFilters),
    enabled: Boolean(storeId) && canViewAttributes,
    keepPreviousData: true,
  });

  const attributes = Array.isArray(attributesQuery.data?.data) ? attributesQuery.data.data : [];
  const meta = attributesQuery.data?.meta || {
    page: effectiveFilters.page,
    limit: effectiveFilters.limit,
    total: 0,
    totalPages: 1,
  };

  const storeAttributes = useMemo(
    () => attributes.filter((attribute) => attribute.scope === "store"),
    [attributes]
  );

  const filteredOptionTypeOptions = useMemo(() => {
    const keyword = String(optionTypeSearch || "").trim().toLowerCase();
    if (!keyword) return OPTION_TYPE_OPTIONS.filter((option) => option.value);
    return OPTION_TYPE_OPTIONS.filter(
      (option) => option.value && option.label.toLowerCase().includes(keyword)
    );
  }, [optionTypeSearch]);

  const filteredPublishedOptions = useMemo(() => {
    const keyword = String(publishedSearch || "").trim().toLowerCase();
    if (!keyword) return PUBLISHED_OPTIONS.filter((option) => option.value);
    return PUBLISHED_OPTIONS.filter(
      (option) => option.value && option.label.toLowerCase().includes(keyword)
    );
  }, [publishedSearch]);

  const filteredStatusOptions = useMemo(() => {
    const keyword = String(statusSearch || "").trim().toLowerCase();
    if (!keyword) return STATUS_OPTIONS;
    return STATUS_OPTIONS.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [statusSearch]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) =>
        storeAttributes.some((attribute) => Number(attribute.id) === Number(id) && attribute.editable)
      )
    );
  }, [storeAttributes]);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!bulkMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!bulkMenuRef.current?.contains(event.target)) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [bulkMenuOpen]);

  useEffect(() => {
    if (!viewMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!viewMenuRef.current?.contains(event.target)) setViewMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handleOutsideClick = (event) => {
      if (!rowMenuRef.current?.contains(event.target)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  useEffect(() => {
    if (!optionTypeFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!optionTypeFilterRef.current?.contains(event.target)) setOptionTypeFilterOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [optionTypeFilterOpen]);

  useEffect(() => {
    if (!publishedFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!publishedFilterRef.current?.contains(event.target)) setPublishedFilterOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [publishedFilterOpen]);

  useEffect(() => {
    if (!statusFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!statusFilterRef.current?.contains(event.target)) setStatusFilterOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [statusFilterOpen]);

  const invalidateAttributes = async () => {
    await queryClient.invalidateQueries({ queryKey: ["seller", "attributes", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ mode, attributeId, payload }) =>
      mode === "edit"
        ? updateSellerAttribute(storeId, attributeId, payload)
        : createSellerAttribute(storeId, payload),
    onSuccess: async (_, variables) => {
      setModalState({ open: false, mode: "create", attribute: null });
      setModalSubmitError("");
      await invalidateAttributes();
      setNotice({
        type: "success",
        message:
          variables.mode === "edit"
            ? "Attribute updated successfully."
            : "Attribute created successfully.",
      });
    },
    onError: (error) => {
      setModalSubmitError(error?.response?.data?.message || "Failed to save attribute.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attributeId) => deleteSellerAttribute(storeId, attributeId),
    onSuccess: async (result) => {
      await invalidateAttributes();
      setSelectedIds([]);
      setNotice({
        type: "success",
        message: result?.archived
          ? "Attribute was archived because it is already used by products."
          : "Attribute deleted successfully.",
      });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to delete attribute.",
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkSellerAttributes(storeId, action, ids),
    onSuccess: async (_, variables) => {
      setSelectedIds([]);
      await invalidateAttributes();
      setNotice({
        type: "success",
        message:
          variables.action === "delete"
            ? "Selected store attributes processed successfully."
            : variables.action === "publish"
              ? "Selected store attributes published successfully."
              : "Selected store attributes unpublished successfully.",
      });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to run bulk action.",
      });
    },
  });

  const togglePublishedMutation = useMutation({
    mutationFn: ({ id, published }) => setSellerAttributePublished(storeId, id, published),
    onSuccess: async () => {
      await invalidateAttributes();
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to update published state.",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file) => importSellerAttributes(storeId, file),
    onSuccess: async (result) => {
      setPendingImportFile(null);
      setPendingImportCount(0);
      setImportPickerVisible(false);
      await invalidateAttributes();
      setNotice({
        type: "success",
        message: `Import completed. ${result?.data?.created || 0} created, ${
          result?.data?.updated || 0
        } updated.`,
      });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to import attributes.",
      });
    },
  });

  const visibleColumns = {
    id: columnVisibility.id !== false,
    name: columnVisibility.name !== false,
    displayName: columnVisibility.displayName !== false,
    optionType: columnVisibility.optionType !== false,
    scope: false,
    published: columnVisibility.published !== false,
    values: columnVisibility.values !== false,
    actions: columnVisibility.actions !== false,
  };

  const closeFilterMenus = () => {
    setOptionTypeFilterOpen(false);
    setPublishedFilterOpen(false);
    setStatusFilterOpen(false);
  };

  const handleApplyFilters = () => {
    closeFilterMenus();
    setAppliedFilters((prev) => ({
      ...prev,
      ...draftFilters,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    closeFilterMenus();
    setOptionTypeSearch("");
    setPublishedSearch("");
    setStatusSearch("");
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  const handleExport = async (format) => {
    try {
      setNotice(null);
      setExportingFormat(format);
      const response = await exportSellerAttributes(storeId, {
        format,
        filters: effectiveFilters,
      });
      await downloadResponse(response, `seller-attributes.${format}`);
      setNotice({
        type: "success",
        message: `Attributes exported to ${String(format).toUpperCase()}.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to export seller attributes.",
      });
    } finally {
      setExportMenuOpen(false);
      setExportingFormat("");
    }
  };

  const handleImportFileSelect = async (file) => {
    if (!file) {
      setPendingImportFile(null);
      setPendingImportCount(0);
      return;
    }

    try {
      const validation = await validateImportFile(file);
      setPendingImportFile(file);
      setPendingImportCount(validation.count);
      setNotice({
        type: "success",
        message: `${validation.count} attribute row(s) ready to import.`,
      });
    } catch (error) {
      setPendingImportFile(null);
      setPendingImportCount(0);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Invalid import file.",
      });
    }
  };

  const handleImportNow = () => {
    if (!pendingImportFile || importMutation.isPending) return;
    importMutation.mutate(pendingImportFile);
  };

  const handleBulkAction = (action) => {
    if (selectedIds.length === 0 || bulkMutation.isPending) {
      setBulkMenuOpen(false);
      return;
    }

    if (action === "delete") {
      if (!window.confirm("Delete selected store attributes? Used attributes will be archived.")) {
        return;
      }
    }

    bulkMutation.mutate({ action, ids: selectedIds });
    setBulkMenuOpen(false);
  };

  const openCreateModal = () => {
    setModalSubmitError("");
    setModalState({ open: true, mode: "create", attribute: null });
  };

  const openEditModal = (attribute) => {
    if (!attribute?.editable) return;
    setModalSubmitError("");
    setModalState({ open: true, mode: "edit", attribute });
  };

  const handleDeleteAttribute = (attribute) => {
    if (!attribute?.editable) return;
    if (!window.confirm(`Delete attribute "${attribute.name}"? Used attributes will be archived.`)) return;
    deleteMutation.mutate(attribute.id);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm("Delete selected store attributes? Used attributes will be archived.")) return;
    bulkMutation.mutate({ action: "delete", ids: selectedIds });
  };

  if (!canViewAttributes) {
    return (
      <SellerWorkspaceStatePanel
        tone="warning"
        title="Attributes visibility is unavailable"
        description="Your seller role does not include attribute visibility."
      />
    );
  }

  if (!storeId) {
    return (
      <SellerWorkspaceStatePanel
        tone="warning"
        title="Store context is unavailable"
        description="Seller attributes require an active store workspace."
      />
    );
  }

  if (attributesQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        tone="critical"
        title="Failed to load attributes"
        description="Seller attributes could not be loaded right now."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attributes</h1>
            <p className="mt-2 text-sm text-slate-500">Manage product attributes</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setBulkMenuOpen(false);
                  setExportMenuOpen((prev) => !prev);
                }}
                disabled={Boolean(exportingFormat)}
                className={sellerSecondaryButtonClass}
              >
                <Download className="h-4 w-4" />
                {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
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

            <button
              type="button"
              onClick={() => setImportPickerVisible(true)}
              disabled={!canManageAttributes || importMutation.isPending}
              title={!canManageAttributes ? "Your seller role cannot manage attributes." : ""}
              className={sellerSecondaryButtonClass}
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0] || null;
                await handleImportFileSelect(file);
                if (file) {
                  setImportPickerVisible(true);
                }
                event.target.value = "";
              }}
            />
            {importPickerVisible ? (
              <>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex h-9 min-w-[168px] max-w-[260px] items-center rounded-lg border border-dashed border-teal-400 bg-white px-3 text-[11px] font-medium text-slate-500 transition hover:border-teal-500 hover:bg-teal-50"
                  title={pendingImportFile?.name || "Select JSON attribute file"}
                >
                  <span className="truncate">
                    {pendingImportFile?.name || "SelectYourJSON Attribute File"}
                  </span>
                </button>
                {pendingImportFile ? (
                  <button
                    type="button"
                    disabled={importMutation.isPending}
                    onClick={handleImportNow}
                    className={sellerPrimaryButtonClass}
                    title={pendingImportCount > 0 ? `${pendingImportCount} row(s) ready to import.` : ""}
                  >
                    <PackagePlus className="h-4 w-4" />
                    {importMutation.isPending ? "Importing..." : "Import Now"}
                  </button>
                ) : null}
              </>
            ) : null}
            <div ref={bulkMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!canManageAttributes || selectedIds.length === 0 || bulkMutation.isPending) return;
                  setExportMenuOpen(false);
                  setBulkMenuOpen((prev) => !prev);
                }}
                disabled={!canManageAttributes || selectedIds.length === 0 || bulkMutation.isPending}
                title={
                  !canManageAttributes
                    ? "Your seller role cannot manage attributes."
                    : selectedIds.length === 0
                      ? "Select store attributes first."
                      : ""
                }
                className={sellerSecondaryButtonClass}
              >
                Bulk Action
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {bulkMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => handleBulkAction("publish")}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Publish selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("unpublish")}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Unpublish selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction("delete")}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    Delete selected
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={!canManageAttributes || selectedIds.length === 0 || bulkMutation.isPending}
              title={
                !canManageAttributes
                  ? "Your seller role cannot manage attributes."
                  : ""
              }
              className={sellerDangerButtonClass}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!canManageAttributes}
              className={sellerPrimaryButtonClass}
              title={!canManageAttributes ? "Your seller role cannot manage attributes." : ""}
            >
              <Plus className="h-4 w-4" />
              Add Attribute
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <SellerWorkspaceNotice type={notice.type === "error" ? "error" : "success"}>
          {notice.message}
        </SellerWorkspaceNotice>
      ) : null}

      <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-2 xl:flex-1 xl:grid-cols-[minmax(0,1.1fr)_auto_auto_auto]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={draftFilters.keyword}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleApplyFilters();
                }}
                placeholder="Search by attribute name"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div ref={optionTypeFilterRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setOptionTypeFilterOpen((prev) => !prev);
                  setPublishedFilterOpen(false);
                  setStatusFilterOpen(false);
                }}
                className={`inline-flex h-9 min-w-[136px] items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition ${
                  optionTypeFilterOpen || draftFilters.optionType
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">
                  {draftFilters.optionType
                    ? OPTION_TYPE_OPTIONS.find((option) => option.value === draftFilters.optionType)?.label || "Option Type"
                    : "Option Type"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>

              <FilterPopover
                open={optionTypeFilterOpen}
                placeholder="Option Type"
                options={filteredOptionTypeOptions}
                selectedValue={draftFilters.optionType}
                searchValue={optionTypeSearch}
                onSearchChange={setOptionTypeSearch}
                onSelect={(value) => {
                  setDraftFilters((prev) => ({ ...prev, optionType: value }));
                  setOptionTypeFilterOpen(false);
                }}
              />
            </div>

            <div ref={publishedFilterRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setPublishedFilterOpen((prev) => !prev);
                  setOptionTypeFilterOpen(false);
                  setStatusFilterOpen(false);
                }}
                className={`inline-flex h-9 min-w-[132px] items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition ${
                  publishedFilterOpen || draftFilters.published
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">
                  {draftFilters.published
                    ? PUBLISHED_OPTIONS.find((option) => option.value === draftFilters.published)?.label || "Published"
                    : "Published"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>

              <FilterPopover
                open={publishedFilterOpen}
                placeholder="Published"
                options={filteredPublishedOptions}
                selectedValue={draftFilters.published}
                searchValue={publishedSearch}
                onSearchChange={setPublishedSearch}
                onSelect={(value) => {
                  setDraftFilters((prev) => ({ ...prev, published: value }));
                  setPublishedFilterOpen(false);
                }}
              />
            </div>

            <div ref={statusFilterRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setStatusFilterOpen((prev) => !prev);
                  setOptionTypeFilterOpen(false);
                  setPublishedFilterOpen(false);
                }}
                className={`inline-flex h-9 min-w-[142px] items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition ${
                  statusFilterOpen || draftFilters.status
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">
                  {STATUS_OPTIONS.find((option) => option.value === draftFilters.status)?.label || "Status"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>

              <FilterPopover
                open={statusFilterOpen}
                placeholder="Status"
                options={filteredStatusOptions}
                selectedValue={draftFilters.status}
                searchValue={statusSearch}
                onSearchChange={setStatusSearch}
                onSelect={(value) => {
                  setDraftFilters((prev) => ({ ...prev, status: value || "active" }));
                  setStatusFilterOpen(false);
                }}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={handleApplyFilters} className={sellerSecondaryButtonClass}>
              <Filter className="h-4 w-4" />
              Apply
            </button>
            <button type="button" onClick={handleResetFilters} className={sellerSecondaryButtonClass}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <div ref={viewMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  closeFilterMenus();
                  setViewMenuOpen((prev) => !prev);
                }}
                className={sellerSecondaryButtonClass}
              >
                <SlidersHorizontal className="h-4 w-4" />
                View
              </button>
              {viewMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={columnVisibility[key] !== false}
                        onChange={() =>
                          setColumnVisibility((prev) => ({
                            ...prev,
                            [key]: prev[key] === false,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {attributesQuery.isLoading && !attributesQuery.data ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
          Loading attributes...
        </div>
      ) : null}

      {!attributesQuery.isLoading ? (
        <>
          <SectionTable
            title=""
            subtitle=""
            tone="store"
            hideHeader
            showCount={false}
            rows={storeAttributes}
            visibleColumns={visibleColumns}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            rowMenuRef={rowMenuRef}
            onEdit={openEditModal}
            onDelete={handleDeleteAttribute}
            onOpenValues={(attribute) =>
              navigate(workspaceRoutes.attributeValues(attribute.id), {
                state: { attribute },
              })
            }
            togglePublishedMutation={togglePublishedMutation}
            toggleVariables={togglePublishedMutation.variables}
            emptyState={
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <PackagePlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">You haven&apos;t created any attributes yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Create store-specific attributes for metadata and internal catalog organization.
                  </p>
                </div>
                <button type="button" onClick={openCreateModal} disabled={!canManageAttributes} className={sellerPrimaryButtonClass}>
                  <Plus className="h-4 w-4" />
                  Create your first attribute
                </button>
              </div>
            }
          />

          <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="whitespace-nowrap">{selectedIds.length} store row(s) selected on this page.</div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <span className="whitespace-nowrap">Rows per page</span>
                <select
                  value={meta.limit}
                  onChange={(event) => {
                    const nextLimit = Number(event.target.value) || 20;
                    setDraftFilters((prev) => ({ ...prev, limit: nextLimit, page: 1 }));
                    setAppliedFilters((prev) => ({ ...prev, limit: nextLimit, page: 1 }));
                  }}
                  className={`${sellerFieldClass} min-w-[92px]`}
                >
                  {[10, 20, 50, 100].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <span className="whitespace-nowrap">
                Page {meta.page} of {meta.totalPages} • {meta.total} total
              </span>

              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setAppliedFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={meta.page <= 1}
                  className={sellerSecondaryButtonClass}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAppliedFilters((prev) => ({
                      ...prev,
                      page: Math.min(meta.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={meta.page >= meta.totalPages}
                  className={sellerSecondaryButtonClass}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {!attributesQuery.isLoading && attributes.length === 0 && appliedFilters.status === "archived" ? (
        <SellerWorkspaceNotice type="info">
          No archived attributes matched the current filter.
        </SellerWorkspaceNotice>
      ) : null}
      <AttributeModal
        open={modalState.open}
        mode={modalState.mode}
        attribute={modalState.attribute}
        onClose={() => {
          if (saveMutation.isPending) return;
          setModalState({ open: false, mode: "create", attribute: null });
          setModalSubmitError("");
        }}
        onSubmit={(payload) =>
          saveMutation.mutate({
            mode: modalState.mode,
            attributeId: modalState.attribute?.id ?? null,
            payload,
          })
        }
        isSubmitting={saveMutation.isPending}
        submitError={modalSubmitError}
      />
    </div>
  );
}

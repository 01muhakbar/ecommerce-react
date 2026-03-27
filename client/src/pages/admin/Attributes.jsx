import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "../../api/axios.ts";
import { UiErrorState, UiSkeleton } from "../../components/primitives/state/index.js";
import EditAttributeDrawer from "../../components/admin/attributes/EditAttributeDrawer.jsx";
import {
  GENERIC_ERROR,
  NO_ATTRIBUTES_FOUND,
  UPDATING,
} from "../../constants/uiMessages.js";

const fetchAdminAttributes = async () => {
  const { data } = await api.get("/admin/attributes");
  return data;
};

const toText = (value) => String(value ?? "").trim();

const headerBtnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11px] font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const headerBtnSoft = `${headerBtnBase} bg-slate-50 text-slate-600 hover:bg-slate-100`;
const headerBtnAmber = `${headerBtnBase} bg-amber-500 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnDanger = `${headerBtnBase} bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const fieldClass =
  "h-8 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";
const tableHeadCell =
  "whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-3 py-2 align-middle text-sm text-slate-700";

function AttributeStatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export default function AdminAttributesPage() {
  const qc = useQueryClient();
  const bulkMenuRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");
  const [publishedMap, setPublishedMap] = useState({});
  const [editingAttribute, setEditingAttribute] = useState(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);

  const [valuesOpen, setValuesOpen] = useState(false);
  const [activeAttribute, setActiveAttribute] = useState(null);
  const [valueInput, setValueInput] = useState("");
  const [valueError, setValueError] = useState("");
  const [valueDeleteError, setValueDeleteError] = useState("");
  const [deletingValueId, setDeletingValueId] = useState(null);

  const attributesQuery = useQuery({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/admin/attributes", payload);
      return data;
    },
    onSuccess: () => {
      setNameInput("");
      setSubmitError("");
      setIsOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (err) => {
      setSubmitError(err?.response?.data?.message || "Failed to create attribute.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/attributes/${id}`);
      return data;
    },
    onSuccess: () => {
      setDeleteError("");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (err) => {
      setDeleteError(err?.response?.data?.message || "Failed to delete attribute.");
      setDeletingId(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map((id) => api.delete(`/admin/attributes/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      setDeleteError("");
      setSelectedIds(new Set());
      setBulkMenuOpen(false);
      setBulkNotice(`${count} attribute(s) deleted.`);
      qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (err) => {
      setDeleteError(err?.response?.data?.message || "Failed to delete selected attributes.");
    },
  });

  const valuesQuery = useQuery({
    queryKey: ["admin", "attribute-values", activeAttribute?.id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/attributes/${activeAttribute.id}/values`);
      return data;
    },
    enabled: Boolean(valuesOpen && activeAttribute?.id),
  });

  const createValueMutation = useMutation({
    mutationFn: async ({ attributeId, value }) => {
      const { data } = await api.post(`/admin/attributes/${attributeId}/values`, { value });
      return data;
    },
    onSuccess: () => {
      setValueInput("");
      setValueError("");
      qc.invalidateQueries({ queryKey: ["admin", "attribute-values", activeAttribute?.id] });
    },
    onError: (err) => {
      setValueError(err?.response?.data?.message || "Failed to create value.");
    },
  });

  const deleteValueMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/attribute-values/${id}`);
      return data;
    },
    onSuccess: () => {
      setValueDeleteError("");
      setDeletingValueId(null);
      qc.invalidateQueries({ queryKey: ["admin", "attribute-values", activeAttribute?.id] });
    },
    onError: (err) => {
      setValueDeleteError(err?.response?.data?.message || "Failed to delete value.");
      setDeletingValueId(null);
    },
  });

  const attributes = Array.isArray(attributesQuery.data?.data) ? attributesQuery.data.data : [];
  const warning = attributesQuery.data?.warning || "";
  const valuesWarning = valuesQuery.data?.warning || "";
  const values = Array.isArray(valuesQuery.data?.data) ? valuesQuery.data.data : [];

  const filteredAttributes = useMemo(() => {
    const keyword = appliedSearch.toLowerCase();
    if (!keyword) return attributes;
    return attributes.filter((attr) => {
      const name = toText(attr?.name).toLowerCase();
      const displayName = toText(attr?.displayName ?? attr?.display_name ?? attr?.name).toLowerCase();
      const option = toText(attr?.option ?? attr?.type ?? attr?.inputType).toLowerCase();
      return `${name} ${displayName} ${option}`.includes(keyword);
    });
  }, [attributes, appliedSearch]);
  const previewAttributeIds = useMemo(
    () =>
      filteredAttributes
        .map((attr) => Number(attr?.id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .slice(0, 20),
    [filteredAttributes]
  );
  const activeFilterCount = appliedSearch ? 1 : 0;

  const valuesPreviewQuery = useQuery({
    queryKey: ["admin", "attribute-values-preview", previewAttributeIds],
    queryFn: async () => {
      const entries = await Promise.all(
        previewAttributeIds.map(async (id) => {
          const { data } = await api.get(`/admin/attributes/${id}/values`);
          const list = Array.isArray(data?.data) ? data.data : [];
          return [
            id,
            list
              .map((item) => toText(item?.value))
              .filter(Boolean),
          ];
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: previewAttributeIds.length > 0,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    setSelectedIds((prev) => {
      if (!filteredAttributes.length) return new Set();
      const visible = new Set(filteredAttributes.map((attr) => Number(attr?.id)));
      const next = new Set();
      prev.forEach((id) => {
        if (visible.has(Number(id))) next.add(Number(id));
      });
      return next;
    });
  }, [filteredAttributes]);

  useEffect(() => {
    if (!attributes.length) return;
    setPublishedMap((prev) => {
      const next = { ...prev };
      attributes.forEach((attr) => {
        const id = Number(attr?.id);
        if (!id) return;
        if (typeof next[id] !== "boolean") {
          if (typeof attr?.published === "boolean") next[id] = attr.published;
          else next[id] = true;
        }
      });
      return next;
    });
  }, [attributes]);

  useEffect(() => {
    if (!bulkMenuOpen) return undefined;
    const onClickOutside = (event) => {
      if (!bulkMenuRef.current) return;
      if (!bulkMenuRef.current.contains(event.target)) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [bulkMenuOpen]);

  const allSelected =
    filteredAttributes.length > 0 &&
    filteredAttributes.every((attr) => selectedIds.has(Number(attr?.id)));

  const applyFilters = () => {
    setAppliedSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedIds(new Set());
    setBulkMenuOpen(false);
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        filteredAttributes.forEach((attr) => next.delete(Number(attr?.id)));
        return next;
      }
      const next = new Set(prev);
      filteredAttributes.forEach((attr) => next.add(Number(attr?.id)));
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    const safeId = Number(id);
    if (!safeId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(safeId)) next.delete(safeId);
      else next.add(safeId);
      return next;
    });
  };

  const getDisplayName = (attr) => toText(attr?.displayName ?? attr?.display_name ?? attr?.name) || "-";
  const getOption = (attr) => toText(attr?.option ?? attr?.type ?? attr?.inputType) || "-";
  const getAttributeValues = (attr) => {
    const id = Number(attr?.id);
    const fromPreview = Array.isArray(valuesPreviewQuery.data?.[id])
      ? valuesPreviewQuery.data[id]
      : null;
    if (fromPreview && fromPreview.length > 0) return fromPreview;

    const fromAttr = Array.isArray(attr?.values)
      ? attr.values.map((item) => toText(item?.value ?? item)).filter(Boolean)
      : [];
    if (fromAttr.length > 0) return fromAttr;

    const cachedValues = qc.getQueryData(["admin", "attribute-values", id]);
    const fromCache = Array.isArray(cachedValues?.data)
      ? cachedValues.data.map((item) => toText(item?.value)).filter(Boolean)
      : [];
    return fromCache;
  };
  const getPublished = (attr) => {
    const id = Number(attr?.id);
    if (!id) return true;
    if (typeof publishedMap[id] === "boolean") return publishedMap[id];
    if (typeof attr?.published === "boolean") return attr.published;
    return true;
  };

  const handleTogglePublished = (attr) => {
    const id = Number(attr?.id);
    if (!id) return;
    setPublishedMap((prev) => ({ ...prev, [id]: !getPublished(attr) }));
  };

  const handleDeleteOne = (attr) => {
    if (!attr?.id) return;
    if (!window.confirm(`Delete attribute "${attr.name}"?`)) return;
    setDeleteError("");
    setDeletingId(attr.id);
    deleteMutation.mutate(attr.id);
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || bulkDeleteMutation.isPending) return;
    if (!window.confirm(`Delete ${ids.length} selected attribute(s)?`)) return;
    setDeleteError("");
    bulkDeleteMutation.mutate(ids);
  };

  const handleBulkAction = (action) => {
    if (selectedIds.size === 0) return;
    setBulkMenuOpen(false);
    if (action === "delete") {
      handleDeleteSelected();
      return;
    }
    setBulkNotice("Bulk action is UI-only for attributes in current API.");
  };

  const handleOpenValues = (attr) => {
    setActiveAttribute(attr);
    setValuesOpen(true);
    setValueInput("");
    setValueError("");
    setValueDeleteError("");
  };

  const handleOpenEditDrawer = (attr) => {
    setEditingAttribute(attr);
    setIsEditDrawerOpen(true);
  };

  const handleCloseEditDrawer = () => {
    setIsEditDrawerOpen(false);
    setEditingAttribute(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-2 shadow-sm sm:px-5">
        <div className="flex flex-col gap-1.5">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attributes</h1>
            <p className="text-sm text-slate-500">
              Manage product attributes and their selectable values.
            </p>
          </div>
          <p className="text-[11px] text-slate-500">
            {filteredAttributes.length} total
            <span className="mx-1.5 text-slate-300">•</span>
            {activeFilterCount} filters
            {selectedIds.size > 0 ? (
              <>
                <span className="mx-1.5 text-slate-300">•</span>
                {selectedIds.size} selected
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-full xl:max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search by attribute name"
              className={`${fieldClass} pl-9`}
            />
          </div>
          <button type="button" onClick={applyFilters} className={headerBtnOutline}>
            <Filter className="h-4 w-4" />
            Apply
          </button>
          <button type="button" onClick={resetFilters} className={headerBtnSoft}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmitError("");
              setIsOpen(true);
            }}
            className={headerBtnGreen}
          >
            <Plus className="h-4 w-4" />
            Add Attribute
          </button>
          <button
            type="button"
            className={headerBtnSoft}
            onClick={() => setBulkNotice("Export is UI-only.")}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            className={headerBtnSoft}
            onClick={() => setBulkNotice("Import is UI-only.")}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>

          <div ref={bulkMenuRef} className="relative">
            <button
              type="button"
              className={selectedIds.size > 0 ? headerBtnAmber : headerBtnSoft}
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              onClick={() => setBulkMenuOpen((prev) => !prev)}
            >
              Bulk
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {bulkMenuOpen ? (
              <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-lg border border-amber-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => handleBulkAction("delete")}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50"
                >
                  Delete Selected
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction("publish")}
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-amber-50"
                >
                  Toggle Published (UI)
                </button>
              </div>
            ) : null}
          </div>

          {selectedIds.size > 0 ? (
            <button
              type="button"
              className={headerBtnDanger}
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : null}
          {attributesQuery.isFetching || valuesPreviewQuery.isFetching ? (
            <span className="text-[10px] text-slate-400">{UPDATING}</span>
          ) : null}
        </div>
      </div>

      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Warning: {warning}
        </div>
      ) : null}

      {bulkNotice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {bulkNotice}
        </div>
      ) : null}

      {deleteError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {deleteError}
        </div>
      ) : null}

      {attributesQuery.isLoading && !attributesQuery.data ? (
        <UiSkeleton variant="table" rows={8} />
      ) : null}

      {attributesQuery.isError && !attributesQuery.data ? (
        <UiErrorState title={GENERIC_ERROR} message={GENERIC_ERROR} onRetry={attributesQuery.refetch} />
      ) : null}

      {!attributesQuery.isLoading && !attributesQuery.isError && filteredAttributes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">{NO_ATTRIBUTES_FOUND}</p>
          <p className="mt-1 text-sm text-slate-500">
            Create your first attribute to start managing product options.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitError("");
              setIsOpen(true);
            }}
            className="mt-4 inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-[11px] font-medium text-white hover:bg-emerald-700"
          >
            Add Attribute
          </button>
        </div>
      ) : null}

      {!attributesQuery.isLoading && !attributesQuery.isError && filteredAttributes.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-0.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-700">{filteredAttributes.length}</span> /{" "}
            <span className="font-semibold text-slate-700">{attributes.length}</span>
          </div>
          <div className="-mx-3 w-auto overflow-x-auto px-3 pb-1 md:mx-0 md:w-full md:px-0">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className={`${tableHeadCell} w-[32%]`}>Attribute</th>
                  <th className={`${tableHeadCell} w-[12%]`}>Option</th>
                  <th className={`${tableHeadCell} w-[14%]`}>Status</th>
                  <th className={`${tableHeadCell} w-[24%] min-w-[220px]`}>Values</th>
                  <th className={`${tableHeadCell} w-[14%] text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttributes.map((attr) => {
                  const id = Number(attr?.id);
                  const idLabel = toText(attr?.id);
                  const isDeleting = deleteMutation.isPending && deletingId === id;
                  const valueList = getAttributeValues(attr);
                  const visibleValues = valueList.slice(0, 4);
                  const remainingCount = Math.max(0, valueList.length - visibleValues.length);
                  const cachedValues = qc.getQueryData(["admin", "attribute-values", id]);
                  const valuesCount = valueList.length
                    ? valueList.length
                    : Array.isArray(cachedValues?.data)
                      ? cachedValues.data.length
                      : null;
                  return (
                    <tr
                      key={id || idLabel}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={`${tableCell} w-[4%]`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className={`${tableCell} w-[32%]`}>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{toText(attr?.name) || "-"}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            <span>{getDisplayName(attr)}</span>
                            <span className="text-slate-300">•</span>
                            <span>ID #{idLabel || "-"}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[12%]`}>{getOption(attr)}</td>
                      <td className={`${tableCell} w-[14%]`}>
                        <div className="flex items-center gap-2">
                          <AttributeStatusBadge isActive={getPublished(attr)} />
                          <button
                            type="button"
                            onClick={() => handleTogglePublished(attr)}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                              getPublished(attr) ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            aria-label={`Toggle publish for ${toText(attr?.name) || "attribute"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                getPublished(attr) ? "translate-x-5" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[24%]`}>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {visibleValues.length > 0 ? (
                              visibleValues.map((value, chipIndex) => (
                                <span
                                  key={`${id}-value-${chipIndex}-${value}`}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {value}
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                                No values
                              </span>
                            )}
                            {remainingCount > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                +{remainingCount} more
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenValues(attr)}
                            className="inline-flex h-6 items-center gap-1 rounded-lg border border-slate-200 px-2 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            title="Manage values"
                          >
                            <Settings2 className="h-3 w-3" />
                            <span className="text-[10px] font-medium">
                              {typeof valuesCount === "number" ? valuesCount : "..."}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className={`${tableCell} w-[14%] text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDrawer(attr)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            aria-label={`Edit ${toText(attr?.name) || "attribute"}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(attr)}
                            disabled={isDeleting}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${toText(attr?.name) || "attribute"}`}
                          >
                            <Trash2 className="h-3 w-3" />
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
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Admin / Attributes / Add
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    Add Attribute
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a new attribute title used for product options.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close modal"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Basic Info</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Enter the primary attribute name.
                </p>
                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </label>
                  <input
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    placeholder="e.g. Size"
                  />
                </div>
              </section>
              {submitError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {submitError}
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-200 bg-white/95 px-6 py-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate({ name: nameInput })}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={createMutation.isPending || !nameInput.trim()}
                >
                  {createMutation.isPending ? "Saving..." : "Save Attribute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {valuesOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Admin / Attributes / Values
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                    Manage Values
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{activeAttribute?.name || "-"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValuesOpen(false)}
                  aria-label="Close values"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {valuesWarning ? (
              <div className="mx-6 mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Warning: {valuesWarning}
              </div>
            ) : null}

            {valueError ? (
              <div className="mx-6 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueError}
              </div>
            ) : null}

            {valueDeleteError ? (
              <div className="mx-6 mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueDeleteError}
              </div>
            ) : null}

            <div className="space-y-4 px-6 py-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Add Value</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Add a selectable value for this attribute.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={valueInput}
                    onChange={(event) => setValueInput(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
                    placeholder="New value"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      createValueMutation.mutate({
                        attributeId: activeAttribute.id,
                        value: valueInput,
                      })
                    }
                    disabled={createValueMutation.isPending || !valueInput.trim()}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {createValueMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Current Values</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Delete values only if they are no longer needed.
                </p>
                <div className="mt-4">
              {valuesQuery.isLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : valuesQuery.isError ? (
                <div className="text-sm text-rose-600">{GENERIC_ERROR}</div>
              ) : values.length === 0 ? (
                <div className="text-sm text-slate-500">No values yet.</div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {values.map((val) => (
                    <li
                      key={val.id}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                    >
                      <span>{val.value}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete value "${val.value}"?`)) {
                            return;
                          }
                          setValueDeleteError("");
                          setDeletingValueId(val.id);
                          deleteValueMutation.mutate(val.id);
                        }}
                        disabled={deleteValueMutation.isPending && deletingValueId === val.id}
                        className="text-xs font-semibold text-rose-600 disabled:text-rose-300"
                      >
                        {deleteValueMutation.isPending && deletingValueId === val.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <EditAttributeDrawer
        open={isEditDrawerOpen}
        attribute={editingAttribute}
        onClose={handleCloseEditDrawer}
        onUpdated={() => {
          handleCloseEditDrawer();
          setBulkNotice("Attribute updated.");
          qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
        }}
      />
    </div>
  );
}

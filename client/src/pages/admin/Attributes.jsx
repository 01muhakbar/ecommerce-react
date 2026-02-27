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
import {
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
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
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition";
const headerBtnOutline = `${headerBtnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300`;
const headerBtnAmber = `${headerBtnBase} bg-amber-500 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnDanger = `${headerBtnBase} bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60`;
const headerBtnGreen = `${headerBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Attributes</h1>
          <p className="text-sm text-slate-500">Manage attribute sets for your products.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={headerBtnOutline}
            onClick={() => setBulkNotice("Export is UI-only.")}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            className={headerBtnOutline}
            onClick={() => setBulkNotice("Import is UI-only.")}
          >
            <Upload className="h-4 w-4" />
            Import
          </button>

          <div ref={bulkMenuRef} className="relative">
            <button
              type="button"
              className={headerBtnAmber}
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              onClick={() => setBulkMenuOpen((prev) => !prev)}
            >
              Bulk Action
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

          <button
            type="button"
            className={headerBtnDanger}
            disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
            onClick={handleDeleteSelected}
          >
            <Trash2 className="h-4 w-4" />
            Delete
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
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search by attribute name"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button type="button" onClick={applyFilters} className={headerBtnGreen}>
            <Filter className="h-4 w-4" />
            Filter
          </button>

          <button type="button" onClick={resetFilters} className={headerBtnOutline}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          {attributesQuery.isFetching ? <UiUpdatingBadge label={UPDATING} /> : null}

          {selectedIds.size > 0 ? (
            <span className="ml-auto text-sm text-slate-500">{selectedIds.size} selected</span>
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
        <UiEmptyState
          title={NO_ATTRIBUTES_FOUND}
          description="Create your first attribute to start managing product options."
          actions={
            <button
              type="button"
              onClick={() => {
                setSubmitError("");
                setIsOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Add Attribute
            </button>
          }
        />
      ) : null}

      {!attributesQuery.isLoading && !attributesQuery.isError && filteredAttributes.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Display Name</th>
                  <th className="px-4 py-3">Option</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3 text-center">Values</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttributes.map((attr) => {
                  const id = Number(attr?.id);
                  const idLabel = toText(attr?.id);
                  const isDeleting = deleteMutation.isPending && deletingId === id;
                  const cachedValues = qc.getQueryData(["admin", "attribute-values", id]);
                  const valuesCount = Array.isArray(cachedValues?.data) ? cachedValues.data.length : null;
                  return (
                    <tr key={id || idLabel} className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelectRow(id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{idLabel || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{toText(attr?.name) || "-"}</td>
                      <td className="px-4 py-3">{getDisplayName(attr)}</td>
                      <td className="px-4 py-3">{getOption(attr)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(attr)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            getPublished(attr) ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          aria-label={`Toggle publish for ${toText(attr?.name) || "attribute"}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              getPublished(attr) ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenValues(attr)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                          title="Manage values"
                        >
                          <Settings2 className="h-4 w-4" />
                          <span className="text-xs font-medium">{typeof valuesCount === "number" ? valuesCount : "..."}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDrawer(attr)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            aria-label={`Edit ${toText(attr?.name) || "attribute"}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(attr)}
                            disabled={isDeleting}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Delete ${toText(attr?.name) || "attribute"}`}
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
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Attribute</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close modal">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Size"
                />
              </div>
              {submitError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {submitError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate({ name: nameInput })}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={createMutation.isPending || !nameInput.trim()}
                >
                  {createMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {valuesOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Manage Values</h2>
                <p className="text-xs text-slate-500">{activeAttribute?.name || "-"}</p>
              </div>
              <button type="button" onClick={() => setValuesOpen(false)} aria-label="Close values">
                <X className="h-4 w-4" />
              </button>
            </div>

            {valuesWarning ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Warning: {valuesWarning}
              </div>
            ) : null}

            {valueError ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueError}
              </div>
            ) : null}

            {valueDeleteError ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueDeleteError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={valueInput}
                onChange={(event) => setValueInput(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createValueMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="mt-4">
              {valuesQuery.isLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : valuesQuery.isError ? (
                <div className="text-sm text-rose-600">{GENERIC_ERROR}</div>
              ) : values.length === 0 ? (
                <div className="text-sm text-slate-500">No values yet.</div>
              ) : (
                <ul className="space-y-2">
                  {values.map((val) => (
                    <li
                      key={val.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
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
                        className="text-xs text-rose-600 disabled:text-rose-300"
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

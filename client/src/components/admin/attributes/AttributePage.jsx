import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { UiErrorState, UiSkeleton } from "../../primitives/state/index.js";
import {
  bulkAdminAttributes,
  createAdminAttribute,
  deleteAdminAttribute,
  exportAdminAttributes,
  fetchAdminAttributes,
  importAdminAttributes,
  updateAdminAttribute,
} from "../../../lib/adminApi.js";
import AttributeModal from "./AttributeModal.jsx";
import AttributeTable from "./AttributeTable.jsx";
import AttributeToolbar from "./AttributeToolbar.jsx";
import ImportExportDropdown from "./ImportExportDropdown.jsx";

const defaultFilters = {
  q: "",
  type: "",
  published: "",
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

const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-medium transition";
const btnSoft = `${btnBase} bg-slate-50 text-slate-600 hover:bg-slate-100`;
const btnAmber = `${btnBase} bg-amber-400 text-white hover:bg-amber-500`;
const btnDanger = `${btnBase} bg-slate-100 text-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70`;
const btnGreen = `${btnBase} bg-teal-700 text-white hover:bg-teal-800`;

const noticeStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

const toText = (value) => String(value ?? "").trim();

const parseFilename = (headerValue, fallback) => {
  const match = String(headerValue || "").match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

const downloadResponse = async (response, fallbackName) => {
  const blob = await response.blob();
  const filename = parseFilename(
    response.headers.get("content-disposition"),
    fallbackName
  );
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

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Import JSON must be a non-empty array.");
  }

  payload.forEach((entry, index) => {
    const name = toText(entry?.name);
    const type = toText(entry?.type).toLowerCase();
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

  return {
    count: payload.length,
  };
};

export default function AttributePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bulkMenuRef = useRef(null);

  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [selectedIds, setSelectedIds] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY);
  const [notice, setNotice] = useState(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    attribute: null,
  });
  const [modalSubmitError, setModalSubmitError] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [pendingImportCount, setPendingImportCount] = useState(0);
  const [exportingFormat, setExportingFormat] = useState("");

  const queryParams = useMemo(
    () => ({
      page: appliedFilters.page,
      limit: appliedFilters.limit,
      q: toText(appliedFilters.q) || undefined,
      type: toText(appliedFilters.type) || undefined,
      published:
        appliedFilters.published === ""
          ? undefined
          : appliedFilters.published === "true",
    }),
    [appliedFilters]
  );

  const queryKey = useMemo(() => ["admin", "attributes", queryParams], [queryParams]);

  const attributesQuery = useQuery({
    queryKey,
    queryFn: () => fetchAdminAttributes(queryParams),
    keepPreviousData: true,
  });

  const attributes = Array.isArray(attributesQuery.data?.data) ? attributesQuery.data.data : [];
  const meta = attributesQuery.data?.meta || {
    page: queryParams.page,
    limit: queryParams.limit,
    total: 0,
    totalPages: 1,
  };
  const warning = attributesQuery.data?.warning || "";

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => attributes.some((attribute) => Number(attribute.id) === Number(id)))
    );
  }, [attributes]);

  useEffect(() => {
    if (!bulkMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!bulkMenuRef.current) return;
      if (!bulkMenuRef.current.contains(event.target)) {
        setBulkMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [bulkMenuOpen]);

  const openCreateModal = () => {
    setModalSubmitError("");
    setModalState({ open: true, mode: "create", attribute: null });
  };

  const openEditModal = (attribute) => {
    setModalSubmitError("");
    setModalState({ open: true, mode: "edit", attribute });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, open: false }));
    setModalSubmitError("");
  };

  const saveMutation = useMutation({
    mutationFn: ({ mode, attributeId, payload }) =>
      mode === "edit"
        ? updateAdminAttribute(attributeId, payload)
        : createAdminAttribute(payload),
    onSuccess: (_, variables) => {
      closeModal();
      setNotice({
        type: "success",
        message:
          variables.mode === "edit"
            ? "Attribute updated successfully."
            : "Attribute created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (error) => {
      setModalSubmitError(error?.response?.data?.message || "Failed to save attribute.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAdminAttribute(id),
    onSuccess: () => {
      setNotice({ type: "success", message: "Attribute deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to delete attribute.",
      });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }) => bulkAdminAttributes(action, ids),
    onSuccess: (_, variables) => {
      setSelectedIds([]);
      setNotice({
        type: "success",
        message:
          variables.action === "delete"
            ? "Selected attributes deleted successfully."
            : variables.action === "publish"
              ? "Selected attributes published successfully."
              : "Selected attributes unpublished successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to run bulk action.",
      });
    },
  });

  const togglePublishedMutation = useMutation({
    mutationFn: ({ id, published }) => updateAdminAttribute(id, { published }),
    onMutate: async ({ id, published }) => {
      setNotice(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current) => {
        if (!current || !Array.isArray(current.data)) return current;
        return {
          ...current,
          data: current.data.map((attribute) =>
            Number(attribute.id) === Number(id)
              ? { ...attribute, published: Boolean(published) }
              : attribute
          ),
        };
      });
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to update published state.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: (file) => importAdminAttributes(file),
    onSuccess: (result) => {
      setPendingImportFile(null);
      setPendingImportCount(0);
      setNotice({
        type: "success",
        message: `Import completed. ${result?.data?.created || 0} created, ${
          result?.data?.updated || 0
        } updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to import attributes.",
      });
    },
  });

  const handleApplyFilters = () => {
    setAppliedFilters((prev) => ({
      ...prev,
      q: draftFilters.q,
      type: draftFilters.type,
      published: draftFilters.published,
      page: 1,
    }));
    setSelectedIds([]);
  };

  const handleResetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setSelectedIds([]);
  };

  const handleToggleSelectAll = () => {
    if (
      attributes.length > 0 &&
      attributes.every((attribute) => selectedIds.includes(Number(attribute.id)))
    ) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(attributes.map((attribute) => Number(attribute.id)).filter(Boolean));
  };

  const handleToggleSelectRow = (id) => {
    const numericId = Number(id);
    if (!numericId) return;
    setSelectedIds((prev) =>
      prev.includes(numericId)
        ? prev.filter((entry) => Number(entry) !== numericId)
        : [...prev, numericId]
    );
  };

  const handleModalSubmit = (payload) => {
    saveMutation.mutate({
      mode: modalState.mode,
      attributeId: modalState.attribute?.id ?? null,
      payload,
    });
  };

  const handleDeleteAttribute = (attribute) => {
    if (!attribute?.id) return;
    if (!window.confirm(`Delete attribute "${attribute.name}"?`)) return;
    deleteMutation.mutate(attribute.id);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected attribute(s)?`)) return;
    bulkMutation.mutate({ action: "delete", ids: selectedIds });
  };

  const handleBulkAction = (action) => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      handleDeleteSelected();
      return;
    }
    bulkMutation.mutate({ action, ids: selectedIds });
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
        message: `${file.name} is ready to import.`,
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

  const handleExport = async (format) => {
    try {
      setExportingFormat(format);
      const response = await exportAdminAttributes(format);
      await downloadResponse(response, `attributes-export.${format}`);
      setNotice({
        type: "success",
        message: `Attribute ${String(format).toUpperCase()} export downloaded.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to export attributes.",
      });
    } finally {
      setExportingFormat("");
    }
  };

  const showEmptyState =
    !attributesQuery.isLoading &&
    !attributesQuery.isError &&
    attributes.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attributes</h1>
            <p className="text-sm text-slate-500">Manage product attributes</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ImportExportDropdown
              pendingImportFileName={pendingImportFile?.name || ""}
              pendingImportCount={pendingImportCount}
              isImporting={importMutation.isPending}
              exportingFormat={exportingFormat}
              onImportFileSelect={handleImportFileSelect}
              onImportNow={handleImportNow}
              onExport={handleExport}
            />

            <div ref={bulkMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setBulkMenuOpen((prev) => !prev)}
                disabled={selectedIds.length === 0 || bulkMutation.isPending}
                className={selectedIds.length > 0 ? btnAmber : btnSoft}
              >
                Bulk Action
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {bulkMenuOpen ? (
                <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMenuOpen(false);
                      handleBulkAction("publish");
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                  >
                    Publish selected
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMenuOpen(false);
                      handleBulkAction("unpublish");
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                  >
                    Unpublish selected
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMenuOpen(false);
                      handleBulkAction("delete");
                    }}
                    className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-amber-50"
                  >
                    Delete selected
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || bulkMutation.isPending}
              className={selectedIds.length > 0 ? `${btnBase} bg-slate-100 text-slate-500 hover:bg-slate-200` : btnDanger}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

            <button type="button" onClick={openCreateModal} className={btnGreen}>
              <Plus className="h-4 w-4" />
              Add Attribute
            </button>
          </div>
        </div>
      </div>

      <AttributeToolbar
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        columnVisibility={columnVisibility}
        onToggleColumn={(key) =>
          setColumnVisibility((prev) => ({
            ...prev,
            [key]: !prev[key],
          }))
        }
        onResetColumns={() => setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)}
      />

      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Warning: {warning}
        </div>
      ) : null}

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            noticeStyles[notice.type] || noticeStyles.success
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {attributesQuery.isLoading && !attributesQuery.data ? (
        <UiSkeleton variant="table" rows={8} />
      ) : null}

      {attributesQuery.isError && !attributesQuery.data ? (
        <UiErrorState
          title="Failed to load attributes"
          message="Please retry to load the latest attribute truth from the backend."
          onRetry={attributesQuery.refetch}
        />
      ) : null}

      {showEmptyState ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No attributes found</p>
          <p className="mt-1 text-sm text-slate-500">
            Create your first attribute or adjust the current search and filters.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Add Attribute
          </button>
        </div>
      ) : null}

      {!showEmptyState && !attributesQuery.isError ? (
        <AttributeTable
          attributes={attributes}
          meta={meta}
          columnVisibility={columnVisibility}
          selectedIds={selectedIds}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectRow={handleToggleSelectRow}
          onEdit={openEditModal}
          onDelete={handleDeleteAttribute}
          onOpenValues={(attribute) =>
            navigate(`/admin/catalog/attributes/${encodeURIComponent(String(attribute.id))}/values`, {
              state: { attribute },
            })
          }
          onTogglePublished={togglePublishedMutation.mutate}
          onPageChange={(page) =>
            setAppliedFilters((prev) => ({ ...prev, page: Math.max(1, Number(page) || 1) }))
          }
          onLimitChange={(limit) =>
            setAppliedFilters((prev) => ({
              ...prev,
              page: 1,
              limit: Number(limit) || 20,
            }))
          }
          deletePendingId={deleteMutation.isPending ? deleteMutation.variables : null}
          togglePendingId={
            togglePublishedMutation.isPending ? togglePublishedMutation.variables?.id : null
          }
        />
      ) : null}

      <AttributeModal
        open={modalState.open}
        mode={modalState.mode}
        attribute={modalState.attribute}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
        isSubmitting={saveMutation.isPending}
        submitError={modalSubmitError}
      />
    </div>
  );
}

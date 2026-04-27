import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createSellerAttributeValue,
  deleteSellerAttributeValue,
  getSellerAttributeValues,
  updateSellerAttributeValue,
} from "../../api/sellerAttributes.ts";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import {
  sellerDangerButtonClass,
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceNotice,
  SellerWorkspaceStatePanel,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";

const toText = (value) => String(value ?? "").trim();

function ValueStatusBadge({ status, isUsed, usageCount }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
          status === "archived"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "archived" ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
        {status === "archived" ? "Archived" : "Active"}
      </span>
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          isUsed ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {isUsed ? `Used by ${usageCount} product${usageCount === 1 ? "" : "s"}` : "Unused"}
      </span>
    </div>
  );
}

function AttributeValueModal({
  open,
  mode,
  parentAttribute,
  initialValue,
  onClose,
  onSubmit,
  isSubmitting = false,
  error = "",
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(toText(initialValue?.value));
  }, [initialValue, open]);

  if (!open) return null;

  const isEditMode = mode === "edit";
  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedValue = toText(value);
    if (!trimmedValue || isSubmitting) return;
    onSubmit?.(trimmedValue);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <button
        type="button"
        onClick={() => {
          if (!isSubmitting) onClose?.();
        }}
        className="absolute inset-0 cursor-default"
        aria-label="Close value drawer"
      />

      <aside className="absolute right-0 top-0 z-10 flex h-full w-full max-w-[760px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] leading-none font-semibold tracking-tight text-slate-900">
                {isEditMode ? "Edit Attribute Value" : "Add Attribute Value"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Add your attribute values and necessary information from here
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                defaultValue="en"
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                aria-label="Language"
              >
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) onClose?.();
                }}
                disabled={isSubmitting}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close value drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-0">
            <div className="grid border-b border-slate-200 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="px-5 py-4 text-sm font-medium text-slate-700">Attribute Title</div>
              <div className="px-5 py-4">
                <input
                  value={parentAttribute?.displayName || parentAttribute?.name || ""}
                  readOnly
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                />
              </div>
            </div>

            <div className="grid border-b border-slate-200 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="px-5 py-4 text-sm font-medium text-slate-700">Option Type</div>
              <div className="px-5 py-4">
                <input
                  value={toText(parentAttribute?.type || "dropdown")}
                  readOnly
                  className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm capitalize text-slate-500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="px-5 py-4 text-sm font-medium text-slate-700">Value</div>
              <div className="px-5 py-4">
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Press enter to add value"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
              </div>
            </div>
          </div>
        </form>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                if (!isSubmitting) onClose?.();
              }}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !toText(value)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : isEditMode ? "Update Value" : "Add Value"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ValueRowActions({ open, onOpen, onClose, onEdit, onDelete, disabled }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Open value actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SellerAttributeValuesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { attributeId } = useParams();
  const { workspaceStoreId: storeId, buildWorkspacePath } = useSellerWorkspaceRoute();
  const numericAttributeId = Number(attributeId);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalState, setModalState] = useState({ open: false, mode: "create", value: null });
  const [submitError, setSubmitError] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const rowMenuRef = useRef(null);

  const valuesQuery = useQuery({
    queryKey: ["seller", "attribute-values", storeId, numericAttributeId],
    queryFn: () => getSellerAttributeValues(storeId, numericAttributeId),
    enabled: Boolean(storeId) && Number.isInteger(numericAttributeId) && numericAttributeId > 0,
  });

  const parentAttribute = valuesQuery.data?.attribute || null;
  const values = Array.isArray(valuesQuery.data?.data) ? valuesQuery.data.data : [];

  const filteredValues = useMemo(() => {
    const keyword = toText(search).toLowerCase();
    if (!keyword) return values;
    return values.filter((entry) => toText(entry?.value).toLowerCase().includes(keyword));
  }, [search, values]);

  const totalPages = Math.max(1, Math.ceil(filteredValues.length / limit));
  const paginatedValues = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredValues.slice(start, start + limit);
  }, [filteredValues, limit, page]);

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => values.some((entry) => Number(entry.id) === Number(id)))
    );
  }, [values]);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handleOutsideClick = (event) => {
      if (!rowMenuRef.current?.contains(event.target)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  const invalidateValues = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["seller", "attribute-values", storeId, numericAttributeId],
    });
    await queryClient.invalidateQueries({ queryKey: ["seller", "attributes", storeId] });
  };

  const createMutation = useMutation({
    mutationFn: (value) => createSellerAttributeValue(storeId, numericAttributeId, { value }),
    onSuccess: async () => {
      setModalState({ open: false, mode: "create", value: null });
      setSubmitError("");
      setNotice({ type: "success", message: "Value added successfully." });
      await invalidateValues();
    },
    onError: (error) => {
      setSubmitError(error?.response?.data?.message || "Failed to add value.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }) => updateSellerAttributeValue(storeId, id, { value }),
    onSuccess: async () => {
      setModalState({ open: false, mode: "create", value: null });
      setSubmitError("");
      setNotice({ type: "success", message: "Value updated successfully." });
      await invalidateValues();
    },
    onError: (error) => {
      setSubmitError(error?.response?.data?.message || "Failed to update value.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSellerAttributeValue(storeId, id),
    onSuccess: async (result) => {
      setNotice({
        type: "success",
        message: result?.archived
          ? "Value was archived because it is already used by products."
          : "Value deleted successfully.",
      });
      await invalidateValues();
    },
    onError: (error) => {
      setNotice({
        type: "error",
        message: error?.response?.data?.message || "Failed to delete value.",
      });
    },
  });

  const handleDeleteValue = (valueRow) => {
    if (!valueRow?.id) return;
    if (!window.confirm(`Delete value "${valueRow.value}"? Used values will be archived.`)) return;
    deleteMutation.mutate(valueRow.id);
  };

  const openCreateModal = () => {
    setSubmitError("");
    setModalState({ open: true, mode: "create", value: null });
  };

  const openEditModal = (valueRow) => {
    setSubmitError("");
    setModalState({ open: true, mode: "edit", value: valueRow });
  };

  const handleModalSubmit = (value) => {
    if (modalState.mode === "edit" && modalState.value?.id) {
      updateMutation.mutate({ id: modalState.value.id, value });
      return;
    }
    createMutation.mutate(value);
  };

  const allSelectedOnPage =
    paginatedValues.length > 0 &&
    paginatedValues.every((entry) => selectedIds.includes(Number(entry.id)));

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!storeId) {
    return (
      <SellerWorkspaceStatePanel
        tone="warning"
        title="Store context is unavailable"
        description="Attribute values require an active store workspace."
      />
    );
  }

  if (valuesQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        tone="critical"
        title="Failed to load attribute values"
        description="Seller attribute values could not be loaded right now."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[34px] leading-none font-semibold tracking-tight text-slate-900">
              Attribute Values
            </h1>
            <p className="text-sm text-slate-500">Manage attribute values</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-sm">
              <button
                type="button"
                onClick={() => navigate(buildWorkspacePath("/catalog/attributes"))}
                className="font-semibold text-emerald-600 transition hover:text-emerald-700"
              >
                Attributes
              </button>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-900">
                {parentAttribute?.name || `#${numericAttributeId || "-"}`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className={sellerPrimaryButtonClass}
            >
              <Plus className="h-4 w-4" />
              Add Value
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <SellerWorkspaceNotice type={notice.type === "error" ? "error" : "success"}>
          {notice.message}
        </SellerWorkspaceNotice>
      ) : null}

      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="relative max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {valuesQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              Loading attribute values...
            </div>
          ) : null}

          {!valuesQuery.isLoading ? (
            <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        <input
                          type="checkbox"
                          checked={allSelectedOnPage}
                          onChange={() =>
                            setSelectedIds((prev) => {
                              const currentPageIds = paginatedValues
                                .map((entry) => Number(entry.id))
                                .filter(Boolean);
                              if (allSelectedOnPage) {
                                return prev.filter((id) => !currentPageIds.includes(id));
                              }
                              return Array.from(new Set([...prev, ...currentPageIds]));
                            })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        ID
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Name
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Type
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Status
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedValues.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                          No values found for this attribute.
                        </td>
                      </tr>
                    ) : (
                      paginatedValues.map((valueRow) => {
                        const rowId = Number(valueRow.id);
                        const isDeleting =
                          deleteMutation.isPending && deleteMutation.variables === rowId;
                        return (
                          <tr key={rowId} className="border-t border-slate-100 transition hover:bg-slate-50/80">
                            <td className="px-3 py-3 align-middle text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(rowId)}
                                onChange={() =>
                                  setSelectedIds((prev) =>
                                    prev.includes(rowId)
                                      ? prev.filter((id) => Number(id) !== rowId)
                                      : [...prev, rowId]
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="px-3 py-3 align-middle text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">C{rowId}</span>
                            </td>
                            <td className="px-3 py-3 align-middle text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">{valueRow.value || "-"}</span>
                            </td>
                            <td className="px-3 py-3 align-middle text-sm text-slate-700">
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium capitalize text-slate-600">
                                {parentAttribute?.type || "dropdown"}
                              </span>
                            </td>
                            <td className="px-3 py-3 align-middle text-sm text-slate-700">
                              <ValueStatusBadge
                                status={valueRow.status}
                                isUsed={Boolean(valueRow.isUsed)}
                                usageCount={Number(valueRow.usageCount || 0)}
                              />
                            </td>
                            <td className="px-3 py-3 align-middle text-right text-sm text-slate-700">
                              <div ref={openMenuId === rowId ? rowMenuRef : null} className="flex justify-end">
                                <ValueRowActions
                                  open={openMenuId === rowId}
                                  onOpen={() => setOpenMenuId(rowId)}
                                  onClose={() => setOpenMenuId(null)}
                                  onEdit={() => {
                                    setOpenMenuId(null);
                                    openEditModal(valueRow);
                                  }}
                                  onDelete={() => {
                                    setOpenMenuId(null);
                                    handleDeleteValue(valueRow);
                                  }}
                                  disabled={isDeleting}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
                <div>{selectedIds.length} of {filteredValues.length} row(s) selected.</div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="whitespace-nowrap">Rows per page</span>
                    <select
                      value={limit}
                      onChange={(event) => {
                        setLimit(Number(event.target.value));
                        setPage(1);
                      }}
                      className={sellerFieldClass}
                    >
                      {[10, 20, 50].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="min-w-[88px] text-center text-sm font-medium text-slate-700">
                    Page {page} of {totalPages}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page <= 1}
                      className={sellerSecondaryButtonClass}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page >= totalPages}
                      className={sellerSecondaryButtonClass}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <AttributeValueModal
        open={modalState.open}
        mode={modalState.mode}
        parentAttribute={parentAttribute}
        initialValue={modalState.value}
        onClose={() => {
          if (isSubmitting) return;
          setSubmitError("");
          setModalState({ open: false, mode: "create", value: null });
        }}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
        error={submitError}
      />
    </div>
  );
}

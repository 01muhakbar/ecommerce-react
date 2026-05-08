import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, SquarePen, Trash2 } from "lucide-react";

const toText = (value) => String(value ?? "").trim();

const tableHeadCell =
  "whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const tableCell = "px-3 py-3 align-middle text-sm text-slate-700";

function PublishedBadge({ published }) {
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        published
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          published ? "bg-emerald-500" : "bg-rose-400"
        }`}
      />
      {published ? "Published" : "Unpublished"}
    </span>
  );
}

function RowActions({
  open,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  menuDisabled,
  editDisabled,
  deleteDisabled,
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        disabled={menuDisabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="Open row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={editDisabled ? undefined : onEdit}
            disabled={editDisabled}
            title={editDisabled ? "Only Super Admin can manage seller attributes from Admin." : ""}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium ${
              editDisabled ? "text-slate-400" : "text-slate-700 transition hover:bg-slate-50"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={deleteDisabled ? undefined : onDelete}
            disabled={deleteDisabled}
            title={deleteDisabled ? "Only Super Admin can manage seller attributes from Admin." : ""}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium ${
              deleteDisabled ? "text-slate-400" : "text-rose-600 transition hover:bg-rose-50"
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AttributeTable({
  attributes,
  meta,
  columnVisibility,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectRow,
  onEdit,
  onDelete,
  onOpenValues,
  onTogglePublished,
  onPageChange,
  onLimitChange,
  deletePendingId = null,
  togglePendingId = null,
  canManageStoreAttributes = false,
}) {
  const menuRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handleOutsideClick = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const allSelected =
    attributes.length > 0 &&
    attributes.every((attribute) => selectedSet.has(Number(attribute.id)));
  const selectedCount = attributes.filter((attribute) => selectedSet.has(Number(attribute.id))).length;
  const visibleColumns = {
    id: columnVisibility?.id !== false,
    name: columnVisibility?.name !== false,
    displayName: columnVisibility?.displayName !== false,
    optionType: columnVisibility?.optionType !== false,
    scope: columnVisibility?.scope !== false,
    store: columnVisibility?.store !== false,
    published: columnVisibility?.published !== false,
    values: columnVisibility?.values !== false,
    actions: columnVisibility?.actions !== false,
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${tableHeadCell} w-[48px]`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              {visibleColumns.id ? <th className={`${tableHeadCell} w-[90px]`}>ID</th> : null}
              {visibleColumns.name ? <th className={tableHeadCell}>Name</th> : null}
              {visibleColumns.displayName ? <th className={tableHeadCell}>Display Name</th> : null}
              {visibleColumns.optionType ? <th className={tableHeadCell}>Option Type</th> : null}
              {visibleColumns.scope ? <th className={tableHeadCell}>Scope</th> : null}
              {visibleColumns.store ? <th className={tableHeadCell}>Store</th> : null}
              {visibleColumns.published ? <th className={tableHeadCell}>Published</th> : null}
              {visibleColumns.values ? <th className={tableHeadCell}>Values</th> : null}
              {visibleColumns.actions ? (
                <th className={`${tableHeadCell} text-right`}>Action</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attribute) => {
              const id = Number(attribute.id);
              const isDeleting = deletePendingId === id;
              const isToggling = togglePendingId === id;
              const isGlobal = String(attribute.scope || "global") !== "store";
              const isStoreOwned = !isGlobal;
              const canManageRow = isGlobal || canManageStoreAttributes;

              return (
                <tr
                  key={id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/80"
                >
                  <td className={tableCell}>
                    <input
                      type="checkbox"
                      checked={selectedSet.has(id)}
                      onChange={() => onToggleSelectRow?.(id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  {visibleColumns.id ? (
                    <td className={tableCell}>
                      <span className="font-medium text-slate-900">{id}</span>
                    </td>
                  ) : null}
                  {visibleColumns.name ? (
                    <td className={tableCell}>
                      <span className="font-semibold text-slate-900">{attribute.name || "-"}</span>
                    </td>
                  ) : null}
                  {visibleColumns.displayName ? (
                    <td className={tableCell}>{toText(attribute.displayName) || "-"}</td>
                  ) : null}
                  {visibleColumns.optionType ? (
                    <td className={tableCell}>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium uppercase text-slate-600">
                        {attribute.type || "-"}
                      </span>
                    </td>
                  ) : null}
                  {visibleColumns.scope ? (
                    <td className={tableCell}>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          isStoreOwned
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {isStoreOwned ? "Store" : "Global"}
                      </span>
                    </td>
                  ) : null}
                  {visibleColumns.store ? (
                    <td className={tableCell}>{attribute.storeName || "-"}</td>
                  ) : null}
                  {visibleColumns.published ? (
                    <td className={tableCell}>
                      <div className="flex items-center gap-3">
                        <PublishedBadge published={Boolean(attribute.published)} />
                        <button
                          type="button"
                          onClick={() =>
                            canManageRow &&
                            onTogglePublished?.({
                              id,
                              published: !attribute.published,
                            })
                          }
                          disabled={isToggling || !canManageRow}
                          title={
                            !canManageRow ? "Only Super Admin can manage seller attributes from Admin." : ""
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            attribute.published ? "bg-emerald-500" : "bg-rose-300"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label={`Toggle publish for ${attribute.name || "attribute"}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              attribute.published ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.values ? (
                    <td className={tableCell}>
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => canManageRow && onOpenValues?.(attribute)}
                          disabled={!canManageRow}
                          title={
                            !canManageRow
                              ? "Only Super Admin can manage seller attribute values from Admin."
                              : `Manage values for ${attribute.name || "attribute"}`
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Open values for ${attribute.name || "attribute"}`}
                        >
                          <SquarePen className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.actions ? (
                    <td className={`${tableCell} text-right`}>
                      <div ref={openMenuId === id ? menuRef : null} className="flex justify-end">
                        <RowActions
                          open={openMenuId === id}
                          onOpen={() => setOpenMenuId(id)}
                          onClose={() => setOpenMenuId(null)}
                          onEdit={() => {
                            setOpenMenuId(null);
                            canManageRow && onEdit?.(attribute);
                          }}
                          onDelete={() => {
                            setOpenMenuId(null);
                            onDelete?.(attribute);
                          }}
                          menuDisabled={isDeleting}
                          editDisabled={!canManageRow}
                          deleteDisabled={!canManageRow}
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

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <div>{selectedCount} row(s) selected on this page.</div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span>Rows per page</span>
            <select
              value={meta.limit}
              onChange={(event) => onLimitChange?.(Number(event.target.value))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, meta.page - 1))}
              disabled={meta.page <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[88px] text-center text-sm font-medium text-slate-700">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange?.(Math.min(meta.totalPages, meta.page + 1))}
              disabled={meta.page >= meta.totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

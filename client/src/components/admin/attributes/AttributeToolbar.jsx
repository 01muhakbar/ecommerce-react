import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Filter, PlusCircle, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-medium transition";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const btnSoft = `${btnBase} bg-slate-50 text-slate-600 hover:bg-slate-100`;

const FILTER_OPTIONS = [
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
];

const PUBLISHED_OPTIONS = [
  { value: "true", label: "Published" },
  { value: "false", label: "Unpublished" },
];

function FilterPopover({
  open,
  title,
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
                key={option.value}
                type="button"
                onClick={() => onSelect?.(checked ? "" : option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  checked
                    ? "bg-teal-50 text-teal-700"
                    : "text-slate-700 hover:bg-slate-50"
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

export default function AttributeToolbar({
  draftFilters,
  onDraftFiltersChange,
  onApplyFilters,
  onResetFilters,
  columnVisibility,
  onToggleColumn,
  onResetColumns,
}) {
  const viewMenuRef = useRef(null);
  const optionFilterRef = useRef(null);
  const publishedFilterRef = useRef(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [optionFilterOpen, setOptionFilterOpen] = useState(false);
  const [publishedFilterOpen, setPublishedFilterOpen] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");
  const [publishedSearch, setPublishedSearch] = useState("");

  useEffect(() => {
    if (!viewMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!viewMenuRef.current) return;
      if (!viewMenuRef.current.contains(event.target)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!optionFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!optionFilterRef.current) return;
      if (!optionFilterRef.current.contains(event.target)) {
        setOptionFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [optionFilterOpen]);

  useEffect(() => {
    if (!publishedFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!publishedFilterRef.current) return;
      if (!publishedFilterRef.current.contains(event.target)) {
        setPublishedFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [publishedFilterOpen]);

  const filteredTypeOptions = useMemo(() => {
    const keyword = String(optionSearch || "").trim().toLowerCase();
    if (!keyword) return FILTER_OPTIONS;
    return FILTER_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(keyword)
    );
  }, [optionSearch]);

  const filteredPublishedOptions = useMemo(() => {
    const keyword = String(publishedSearch || "").trim().toLowerCase();
    if (!keyword) return PUBLISHED_OPTIONS;
    return PUBLISHED_OPTIONS.filter((option) =>
      option.label.toLowerCase().includes(keyword)
    );
  }, [publishedSearch]);

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2 xl:flex-1 xl:grid-cols-[minmax(0,1.2fr)_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={draftFilters.q}
              onChange={(event) =>
                onDraftFiltersChange?.((prev) => ({ ...prev, q: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") onApplyFilters?.();
              }}
              placeholder="Search by attribute name"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div ref={optionFilterRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setOptionFilterOpen((prev) => !prev);
                setPublishedFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[112px] items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition ${
                optionFilterOpen || draftFilters.type
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span>{draftFilters.type ? FILTER_OPTIONS.find((option) => option.value === draftFilters.type)?.label || "Option Type" : "Option Type"}</span>
            </button>

            <FilterPopover
              open={optionFilterOpen}
              title="Option Type"
              placeholder="Option Type"
              options={filteredTypeOptions}
              selectedValue={draftFilters.type}
              searchValue={optionSearch}
              onSearchChange={setOptionSearch}
              onSelect={(value) => {
                onDraftFiltersChange?.((prev) => ({ ...prev, type: value }));
                setOptionFilterOpen(false);
              }}
            />
          </div>

          <div ref={publishedFilterRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setPublishedFilterOpen((prev) => !prev);
                setOptionFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[112px] items-center gap-2 rounded-lg border border-dashed px-3 text-sm font-medium transition ${
                publishedFilterOpen || draftFilters.published
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span>
                {draftFilters.published
                  ? PUBLISHED_OPTIONS.find((option) => option.value === draftFilters.published)?.label || "Published"
                  : "Published"}
              </span>
            </button>

            <FilterPopover
              open={publishedFilterOpen}
              title="Published"
              placeholder="Published"
              options={filteredPublishedOptions}
              selectedValue={draftFilters.published}
              searchValue={publishedSearch}
              onSearchChange={setPublishedSearch}
              onSelect={(value) => {
                onDraftFiltersChange?.((prev) => ({ ...prev, published: value }));
                setPublishedFilterOpen(false);
              }}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onApplyFilters} className={btnOutline}>
            <Filter className="h-4 w-4" />
            Apply
          </button>
          <button type="button" onClick={onResetFilters} className={btnSoft}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <div ref={viewMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setViewMenuOpen((prev) => !prev)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              View
            </button>
            {viewMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Toggle columns
                  </p>
                  <button
                    type="button"
                    onClick={() => onResetColumns?.()}
                    className="text-[11px] font-medium text-slate-500 transition hover:text-slate-700"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ["id", "Id"],
                    ["name", "Name"],
                    ["displayName", "Display Name"],
                    ["optionType", "Option"],
                    ["published", "Published"],
                    ["values", "Values"],
                    ["actions", "Action"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(columnVisibility?.[key])}
                        onChange={() => onToggleColumn?.(key)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

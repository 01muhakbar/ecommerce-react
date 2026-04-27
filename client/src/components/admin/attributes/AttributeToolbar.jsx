import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Filter, PlusCircle, RotateCcw, Search, SlidersHorizontal } from "lucide-react";

const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[10px] font-medium transition";
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

const SCOPE_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "store", label: "Store" },
];

const CREATED_BY_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "seller", label: "Seller" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
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
  const scopeFilterRef = useRef(null);
  const createdByFilterRef = useRef(null);
  const statusFilterRef = useRef(null);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [optionFilterOpen, setOptionFilterOpen] = useState(false);
  const [publishedFilterOpen, setPublishedFilterOpen] = useState(false);
  const [scopeFilterOpen, setScopeFilterOpen] = useState(false);
  const [createdByFilterOpen, setCreatedByFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");
  const [publishedSearch, setPublishedSearch] = useState("");
  const [scopeSearch, setScopeSearch] = useState("");
  const [createdBySearch, setCreatedBySearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

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

  useEffect(() => {
    if (!scopeFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!scopeFilterRef.current) return;
      if (!scopeFilterRef.current.contains(event.target)) {
        setScopeFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [scopeFilterOpen]);

  useEffect(() => {
    if (!createdByFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!createdByFilterRef.current) return;
      if (!createdByFilterRef.current.contains(event.target)) {
        setCreatedByFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [createdByFilterOpen]);

  useEffect(() => {
    if (!statusFilterOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!statusFilterRef.current) return;
      if (!statusFilterRef.current.contains(event.target)) {
        setStatusFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [statusFilterOpen]);

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

  const filteredScopeOptions = useMemo(() => {
    const keyword = String(scopeSearch || "").trim().toLowerCase();
    if (!keyword) return SCOPE_OPTIONS;
    return SCOPE_OPTIONS.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [scopeSearch]);

  const filteredCreatedByOptions = useMemo(() => {
    const keyword = String(createdBySearch || "").trim().toLowerCase();
    if (!keyword) return CREATED_BY_OPTIONS;
    return CREATED_BY_OPTIONS.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [createdBySearch]);

  const filteredStatusOptions = useMemo(() => {
    const keyword = String(statusSearch || "").trim().toLowerCase();
    if (!keyword) return STATUS_OPTIONS;
    return STATUS_OPTIONS.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [statusSearch]);

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2 xl:flex-1 xl:grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto_auto_auto]">
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
              className={`inline-flex h-9 min-w-[126px] items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] font-medium transition ${
                optionFilterOpen || draftFilters.type
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">
                {draftFilters.type ? FILTER_OPTIONS.find((option) => option.value === draftFilters.type)?.label || "Option Type" : "Option Type"}
              </span>
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
                setScopeFilterOpen(false);
                setCreatedByFilterOpen(false);
                setStatusFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[108px] items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] font-medium transition ${
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

          <div ref={scopeFilterRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setScopeFilterOpen((prev) => !prev);
                setOptionFilterOpen(false);
                setPublishedFilterOpen(false);
                setCreatedByFilterOpen(false);
                setStatusFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[110px] items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] font-medium transition ${
                scopeFilterOpen || draftFilters.scope
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">
                {draftFilters.scope
                  ? SCOPE_OPTIONS.find((option) => option.value === draftFilters.scope)?.label || "Scope"
                  : "Scope"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>

            <FilterPopover
              open={scopeFilterOpen}
              title="Scope"
              placeholder="Scope"
              options={filteredScopeOptions}
              selectedValue={draftFilters.scope}
              searchValue={scopeSearch}
              onSearchChange={setScopeSearch}
              onSelect={(value) => {
                onDraftFiltersChange?.((prev) => ({ ...prev, scope: value }));
                setScopeFilterOpen(false);
              }}
            />
          </div>

          <div ref={createdByFilterRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setCreatedByFilterOpen((prev) => !prev);
                setOptionFilterOpen(false);
                setPublishedFilterOpen(false);
                setScopeFilterOpen(false);
                setStatusFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[126px] items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] font-medium transition ${
                createdByFilterOpen || draftFilters.createdByRole
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">
                {draftFilters.createdByRole
                  ? CREATED_BY_OPTIONS.find((option) => option.value === draftFilters.createdByRole)?.label || "Created By"
                  : "Created By"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>

            <FilterPopover
              open={createdByFilterOpen}
              title="Created By"
              placeholder="Created By"
              options={filteredCreatedByOptions}
              selectedValue={draftFilters.createdByRole}
              searchValue={createdBySearch}
              onSearchChange={setCreatedBySearch}
              onSelect={(value) => {
                onDraftFiltersChange?.((prev) => ({ ...prev, createdByRole: value }));
                setCreatedByFilterOpen(false);
              }}
            />
          </div>

          <div ref={statusFilterRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setStatusFilterOpen((prev) => !prev);
                setOptionFilterOpen(false);
                setPublishedFilterOpen(false);
                setScopeFilterOpen(false);
                setCreatedByFilterOpen(false);
              }}
              className={`inline-flex h-9 min-w-[112px] items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[13px] font-medium transition ${
                statusFilterOpen || draftFilters.status
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">
                {draftFilters.status
                  ? STATUS_OPTIONS.find((option) => option.value === draftFilters.status)?.label || "Status"
                  : "Status"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>

            <FilterPopover
              open={statusFilterOpen}
              title="Status"
              placeholder="Status"
              options={filteredStatusOptions}
              selectedValue={draftFilters.status}
              searchValue={statusSearch}
              onSearchChange={setStatusSearch}
              onSelect={(value) => {
                onDraftFiltersChange?.((prev) => ({ ...prev, status: value }));
                setStatusFilterOpen(false);
              }}
            />
          </div>

          <input
            type="search"
            value={draftFilters.storeId}
            onChange={(event) =>
              onDraftFiltersChange?.((prev) => ({ ...prev, storeId: event.target.value }))
            }
            placeholder="Store ID"
            className="h-9 min-w-[100px] rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
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
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
                    ["scope", "Scope"],
                    ["store", "Store"],
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

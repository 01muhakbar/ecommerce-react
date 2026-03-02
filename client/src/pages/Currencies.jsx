import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, X } from "lucide-react";
import {
  bulkDeleteAdminCurrencies,
  createAdminCurrency,
  deleteAdminCurrency,
  fetchAdminCurrencies,
  updateAdminCurrency,
} from "../lib/adminApi.js";

const btnBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus-visible:ring-slate-300`;
const btnGreen = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300`;
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300`;
const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const tableHeadCell =
  "px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500";
const tableCell = "px-4 py-3 align-middle text-sm text-slate-700";

function SearchIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M9 15a6 6 0 1 1 0-12 6 6 0 0 1 0 12ZM13.5 13.5l3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CURRENCY_PRESETS = [
  {
    name: "Indonesian Rupiah",
    displayName: "Indonesian Rupiah",
    code: "IDR",
    symbol: "Rp",
    exchangeRate: "1",
  },
  {
    name: "US Dollar",
    displayName: "US Dollar",
    code: "USD",
    symbol: "$",
    exchangeRate: "0.000062",
  },
  {
    name: "Euro",
    displayName: "Euro",
    code: "EUR",
    symbol: "€",
    exchangeRate: "0.000057",
  },
  {
    name: "British Pound",
    displayName: "British Pound",
    code: "GBP",
    symbol: "£",
    exchangeRate: "0.000049",
  },
  {
    name: "Singapore Dollar",
    displayName: "Singapore Dollar",
    code: "SGD",
    symbol: "S$",
    exchangeRate: "0.000084",
  },
];

const defaultForm = {
  selectedPreset: "",
  name: "",
  code: "",
  symbol: "",
  exchangeRate: "1",
  published: true,
};

const normalizeCurrency = (item) => ({
  id: Number(item?.id || 0),
  name: String(item?.name || ""),
  code: String(item?.code || "").toUpperCase(),
  symbol: String(item?.symbol || ""),
  exchangeRate: String(item?.exchangeRate || "1"),
  published: Boolean(item?.published),
  createdAt: item?.createdAt || null,
  updatedAt: item?.updatedAt || null,
});

const toPayload = (form) => ({
  name: String(form.name || "").trim(),
  code: String(form.code || "").trim().toUpperCase(),
  symbol: String(form.symbol || "").trim(),
  exchangeRate: String(form.exchangeRate || "").trim() || "1",
  published: Boolean(form.published),
});

export default function CurrenciesPage() {
  const queryClient = useQueryClient();
  const presetMenuRef = useRef(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState("");
  const [pendingToggleId, setPendingToggleId] = useState(null);
  const [drawer, setDrawer] = useState({
    open: false,
    mode: "add",
    currencyId: null,
  });
  const [form, setForm] = useState(defaultForm);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const currenciesQuery = useQuery({
    queryKey: ["admin-currencies", search],
    queryFn: () => fetchAdminCurrencies({ search }),
  });

  const currencies = useMemo(
    () => (currenciesQuery.data?.data || []).map(normalizeCurrency),
    [currenciesQuery.data]
  );

  useEffect(() => {
    const existing = new Set(currencies.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [currencies]);

  const createMutation = useMutation({ mutationFn: createAdminCurrency });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCurrency(id, payload),
  });
  const deleteMutation = useMutation({ mutationFn: deleteAdminCurrency });
  const bulkDeleteMutation = useMutation({ mutationFn: bulkDeleteAdminCurrencies });
  const togglePublishedMutation = useMutation({
    mutationFn: ({ id, published }) => updateAdminCurrency(id, { published }),
  });

  const allSelected =
    currencies.length > 0 && currencies.every((item) => selectedIds.has(item.id));

  const closeDrawer = () => {
    setDrawer({ open: false, mode: "add", currencyId: null });
    setForm(defaultForm);
    setFormError("");
    setPresetMenuOpen(false);
  };

  useEffect(() => {
    if (!drawer.open) return undefined;
    const prevOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawer.open]);

  const openAddDrawer = () => {
    setFeedback(null);
    setFormError("");
    setPresetMenuOpen(false);
    setForm({
      ...defaultForm,
      selectedPreset: "IDR",
      name: "Indonesian Rupiah",
      code: "IDR",
      symbol: "Rp",
      exchangeRate: "1",
      published: true,
    });
    setDrawer({ open: true, mode: "add", currencyId: null });
  };

  const openEditDrawer = (currency) => {
    setFeedback(null);
    setFormError("");
    setPresetMenuOpen(false);
    setForm({
      selectedPreset: currency.code,
      name: currency.name,
      code: currency.code,
      symbol: currency.symbol,
      exchangeRate: currency.exchangeRate || "1",
      published: Boolean(currency.published),
    });
    setDrawer({ open: true, mode: "edit", currencyId: currency.id });
  };

  const handleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(currencies.map((item) => item.id));
    });
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePresetChange = (code) => {
    const preset = CURRENCY_PRESETS.find((item) => item.code === code);
    setForm((prev) => {
      if (!preset) return { ...prev, selectedPreset: "" };
      return {
        ...prev,
        selectedPreset: code,
        name: preset.name,
        code: preset.code,
        symbol: preset.symbol,
        exchangeRate: preset.exchangeRate,
      };
    });
    setPresetMenuOpen(false);
  };

  const selectedPreset = CURRENCY_PRESETS.find(
    (item) => item.code === form.selectedPreset
  );
  const selectedPresetLabel = selectedPreset
    ? `${selectedPreset.code} ${selectedPreset.displayName}`
    : "Select a currency";

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-currencies"] });

  const handleDeleteOne = (currency) => {
    if (!window.confirm(`Delete currency "${currency.name}"?`)) return;
    setFeedback(null);
    deleteMutation.mutate(currency.id, {
      onSuccess: async () => {
        await invalidateList();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(currency.id);
          return next;
        });
      },
      onError: (error) => {
        setFeedback({
          type: "error",
          message:
            error?.response?.data?.message ||
            error?.message ||
            "Failed to delete currency.",
        });
      },
    });
  };

  const executeBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected currencies?`)) return;
    setFeedback(null);
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: async () => {
        setSelectedIds(new Set());
        setBulkAction("");
        await invalidateList();
      },
      onError: (error) => {
        setFeedback({
          type: "error",
          message:
            error?.response?.data?.message ||
            error?.message ||
            "Bulk delete failed.",
        });
      },
    });
  };

  const handleBulkAction = () => {
    if (bulkAction !== "delete") return;
    executeBulkDelete();
  };

  const handleTogglePublished = (currency) => {
    setPendingToggleId(currency.id);
    setFeedback(null);
    togglePublishedMutation.mutate(
      { id: currency.id, published: !currency.published },
      {
        onSuccess: async () => {
          await invalidateList();
        },
        onError: (error) => {
          setFeedback({
            type: "error",
            message:
              error?.response?.data?.message ||
              error?.message ||
              "Failed to update published status.",
          });
        },
        onSettled: () => setPendingToggleId(null),
      }
    );
  };

  const handleSubmitDrawer = (event) => {
    event.preventDefault();
    setFormError("");
    const payload = toPayload(form);

    if (!payload.name) return setFormError("Name is required.");
    if (!payload.code) return setFormError("Code is required.");
    if (!payload.symbol) return setFormError("Symbol is required.");

    if (drawer.mode === "add") {
      createMutation.mutate(payload, {
        onSuccess: async () => {
          await invalidateList();
          closeDrawer();
        },
        onError: (error) => {
          setFormError(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to create currency."
          );
        },
      });
      return;
    }

    updateMutation.mutate(
      { id: drawer.currencyId, payload },
      {
        onSuccess: async () => {
          await invalidateList();
          closeDrawer();
        },
        onError: (error) => {
          setFormError(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to update currency."
          );
        },
      }
    );
  };

  const isSubmittingDrawer = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!presetMenuOpen) return undefined;
    const onMouseDown = (event) => {
      if (!presetMenuRef.current) return;
      if (!presetMenuRef.current.contains(event.target)) {
        setPresetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [presetMenuOpen]);

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 px-2 sm:px-3">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h1 className="text-[26px] font-semibold leading-tight text-slate-900">
          Currencies
        </h1>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 gap-y-2 xl:w-auto xl:max-w-[70%] xl:justify-end">
          <div className="relative shrink-0">
            <select
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value)}
              className={`${inputBase} w-[154px] appearance-none pr-8`}
            >
              <option value="">Bulk Action</option>
              <option value="delete">Delete Selected</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={bulkAction === "delete" ? executeBulkDelete : handleBulkAction}
            disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
            className={`${btnDanger} min-w-[108px] disabled:cursor-not-allowed disabled:bg-rose-300 disabled:opacity-60`}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>

          <button
            type="button"
            onClick={openAddDrawer}
            className={`${btnGreen} min-w-[128px]`}
          >
            <Plus className="h-4 w-4" />
            Add currency
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="relative">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by currency name and code"
            className={`${inputBase} pr-10`}
          />
          <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        {feedback ? (
          <p
            className={`mt-3 text-xs ${
              feedback.type === "error" ? "text-rose-500" : "text-emerald-600"
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </div>

      {currenciesQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          Loading currencies...
        </div>
      ) : currenciesQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {currenciesQuery.error?.response?.data?.message ||
            "Failed to load currencies."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={`${tableHeadCell} w-[4%]`}>
                    <input
                      type="checkbox"
                      aria-label="Select all currencies"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                    />
                  </th>
                  <th className={`${tableHeadCell} w-[32%]`}>Name</th>
                  <th className={`${tableHeadCell} w-[16%]`}>Code</th>
                  <th className={`${tableHeadCell} w-[12%]`}>Symbol</th>
                  <th className={`${tableHeadCell} w-[16%] text-center`}>Published</th>
                  <th className={`${tableHeadCell} w-[20%] text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currencies.length === 0 ? (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                      No currencies found.
                    </td>
                  </tr>
                ) : (
                  currencies.map((currency) => (
                    <tr
                      key={currency.id}
                      className="border-t border-slate-100 text-slate-700 transition hover:bg-slate-50/80"
                    >
                      <td className={tableCell}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${currency.name}`}
                          checked={selectedIds.has(currency.id)}
                          onChange={() => toggleSelectOne(currency.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
                        />
                      </td>
                      <td className={`${tableCell} font-semibold text-slate-900`}>
                        {currency.name}
                      </td>
                      <td className={`${tableCell} uppercase`}>{currency.code}</td>
                      <td className={`${tableCell}`}>{currency.symbol}</td>
                      <td className={`${tableCell} text-center`}>
                        <button
                          type="button"
                          onClick={() => handleTogglePublished(currency)}
                          disabled={
                            pendingToggleId === currency.id ||
                            togglePublishedMutation.isPending
                          }
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                            currency.published
                              ? "bg-emerald-500 ring-1 ring-emerald-500"
                              : "bg-slate-300 ring-1 ring-slate-300"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                          aria-label="Toggle published"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              currency.published ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className={`${tableCell} text-center`}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(currency)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                            title="Update currency"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(currency)}
                            disabled={deleteMutation.isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete currency"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawer.open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Close currency drawer overlay"
            onClick={closeDrawer}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-full border-l border-slate-200 bg-white shadow-2xl sm:max-w-[560px] lg:w-[40vw] lg:max-w-[640px]">
            <form className="flex h-full flex-col" onSubmit={handleSubmitDrawer}>
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {drawer.mode === "add" ? "Add Currency" : "Update Currency"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {drawer.mode === "add"
                        ? "Add your Currency necessary information from here"
                        : "Updated your Currency necessary information from here"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
                    aria-label="Close currency drawer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 pb-7">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Select Currency
                  </span>
                  <div className="relative mt-2" ref={presetMenuRef}>
                    <button
                      type="button"
                      onClick={() => setPresetMenuOpen((prev) => !prev)}
                      className={`${inputBase} justify-between px-3.5`}
                    >
                      <span className="truncate">{selectedPresetLabel}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                          presetMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {presetMenuOpen ? (
                      <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                        {CURRENCY_PRESETS.map((preset) => (
                          <button
                            key={preset.code}
                            type="button"
                            onClick={() => handlePresetChange(preset.code)}
                            className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                              form.selectedPreset === preset.code
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-slate-700"
                            }`}
                          >
                            {preset.code} {preset.displayName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Code
                  </span>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, code: event.target.value }))
                    }
                    className={`${inputBase} mt-2 uppercase`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Symbol
                  </span>
                  <input
                    type="text"
                    value={form.symbol}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, symbol: event.target.value }))
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Exchange Rate
                  </span>
                  <input
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    value={form.exchangeRate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))
                    }
                    className={`${inputBase} mt-2`}
                  />
                </label>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Published
                  </span>
                  <div className="mt-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, published: true }))
                      }
                      className={`h-9 rounded-lg px-4 text-sm font-semibold ${
                        form.published
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, published: false }))
                      }
                      className={`h-9 rounded-lg px-4 text-sm font-semibold ${
                        form.published
                          ? "text-slate-600 hover:bg-slate-100"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {formError ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {formError}
                  </p>
                ) : null}
              </div>

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
                <button type="button" className={btnOutline} onClick={closeDrawer}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDrawer}
                  className={`${btnGreen} min-w-[132px] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSubmittingDrawer
                    ? "Saving..."
                    : drawer.mode === "add"
                      ? "Add Currency"
                      : "Update Currency"}
                </button>
              </div>
            </form>
          </aside>
        </>
      ) : null}
    </div>
  );
}

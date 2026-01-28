export default function CouponForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
  isSubmitting,
  error,
}) {
  return (
    <form className="mt-4 space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="text-xs font-semibold text-slate-500">Code</label>
        <input
          value={form.code}
          onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="SAVE10"
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-500">Discount Type</label>
          <select
            value={form.discountType}
            onChange={(event) => onChange({ discountType: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => onChange({ amount: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            required
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-500">Min Spend</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.minSpend}
            onChange={(event) => onChange({ minSpend: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">Expires At</label>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(event) => onChange({ expiresAt: event.target.value })}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => onChange({ active: event.target.checked })}
        />
        Active
      </label>
      {error ? (
        <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          {isEdit ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

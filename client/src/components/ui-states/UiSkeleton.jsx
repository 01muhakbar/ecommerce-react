const DEFAULT_ROWS = {
  grid: 8,
  table: 8,
  invoice: 6,
};

function GridSkeleton({ rows }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`ui-grid-skeleton-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="aspect-square w-full animate-pulse bg-slate-100" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-10 w-48 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

function TableSkeleton({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={`ui-table-skeleton-${index}`} className="border-t border-slate-100">
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              </td>
              <td className="px-4 py-3">
                <div className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceSkeleton({ rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="space-y-4 bg-slate-100/60 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="space-y-3 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`ui-invoice-skeleton-item-${index}`}
            className="h-14 animate-pulse rounded-lg bg-slate-100"
          />
        ))}
      </div>
      <div className="grid gap-4 bg-emerald-50 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`ui-invoice-skeleton-total-${index}`} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-emerald-100" />
            <div className="h-4 w-28 animate-pulse rounded bg-emerald-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UiSkeleton({ variant = "grid", rows }) {
  const safeVariant = DEFAULT_ROWS[variant] ? variant : "grid";
  const safeRows = Number(rows) > 0 ? Number(rows) : DEFAULT_ROWS[safeVariant];

  if (safeVariant === "table") {
    return <TableSkeleton rows={safeRows} />;
  }

  if (safeVariant === "invoice") {
    return <InvoiceSkeleton rows={safeRows} />;
  }

  return <GridSkeleton rows={safeRows} />;
}

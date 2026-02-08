export default function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle,
  emptyHint,
  onRetry,
  children,
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  if (isError) {
    const message =
      error?.response?.data?.message || error?.message || "Terjadi kesalahan.";
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <div className="text-base font-semibold">Gagal memuat data</div>
        <div className="mt-2 text-rose-600">{message}</div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:border-rose-300"
          >
            Coba lagi
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </div>
        <div className="text-sm font-semibold text-slate-900">
          {emptyTitle || "Belum ada data"}
        </div>
        {emptyHint ? (
          <div className="text-xs text-slate-500">{emptyHint}</div>
        ) : null}
      </div>
    );
  }

  return children;
}

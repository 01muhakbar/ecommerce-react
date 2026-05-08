export default function UiErrorState({
  title = "Something went wrong. Please try again.",
  message = "",
  onRetry,
  retryLabel = "Try again",
  className = "",
}) {
  return (
    <div className={`rounded-xl border border-rose-200 bg-rose-50 p-5 sm:p-6 ${className}`.trim()}>
      <p className="text-base font-semibold text-rose-800">{title}</p>
      {message && message !== title ? <p className="mt-1 text-sm text-rose-700">{message}</p> : null}
      {typeof onRetry === "function" ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:border-rose-300"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

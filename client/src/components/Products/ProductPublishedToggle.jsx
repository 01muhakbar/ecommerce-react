function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ProductPublishedToggle({
  checked,
  disabled = false,
  onClick,
  title,
  ariaLabel,
  busy = false,
  className = "",
  thumbClassName = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={joinClasses(
        "relative inline-flex h-5 w-9 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-emerald-500" : "bg-slate-300",
        className,
      )}
      aria-label={ariaLabel ?? title}
      aria-busy={busy}
      title={title}
    >
      <span
        className={joinClasses(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-4" : "translate-x-0.5",
          thumbClassName,
        )}
      />
    </button>
  );
}

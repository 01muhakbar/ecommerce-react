function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ProductInventoryBadge({ label, title, className = "" }) {
  return (
    <span
      className={joinClasses(
        "inline-flex min-h-5 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
        className,
      )}
      title={title ?? label}
    >
      {label}
    </span>
  );
}

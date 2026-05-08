export default function UiUpdatingBadge({ label = "Updating..." }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
      <span className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-600" />
      {label}
    </span>
  );
}

export default function UiEmptyState({
  title,
  description,
  actions,
  className = "",
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white px-6 py-10 text-center ${className}`.trim()}
    >
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

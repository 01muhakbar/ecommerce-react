import UiEmptyState from "../ui-states/UiEmptyState.jsx";
import UiErrorState from "../ui-states/UiErrorState.jsx";

export const ADMIN_OPS_TONE_CLASS = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  attention: "border-amber-200 bg-amber-50 text-amber-700",
  submitted: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  missing: "border-rose-200 bg-rose-50 text-rose-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  needs_revision: "border-rose-200 bg-rose-50 text-rose-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  stone: "border-slate-200 bg-slate-100 text-slate-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-700",
};

export const getAdminOpsToneClass = (tone = "neutral") =>
  ADMIN_OPS_TONE_CLASS[String(tone || "").trim().toLowerCase()] ||
  ADMIN_OPS_TONE_CLASS.neutral;

export const getReadinessBadge = (isReady, { missing = false, inactive = false } = {}) => {
  if (inactive) return { label: "Inactive", tone: "inactive" };
  if (missing) return { label: "Missing", tone: "missing" };
  return isReady
    ? { label: "Ready", tone: "ready" }
    : { label: "Needs attention", tone: "attention" };
};

export const getActionBadge = (hasAction) =>
  hasAction
    ? { label: "Action needed", tone: "attention" }
    : { label: "Ready", tone: "ready" };

export function AdminOpsStatusBadge({ label, tone = "neutral", prefix = "", className = "" }) {
  const text = String(label || "-").trim() || "-";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getAdminOpsToneClass(
        tone
      )} ${className}`.trim()}
    >
      {prefix ? `${prefix} ${text}` : text}
    </span>
  );
}

export function AdminOpsPageHeader({ title, description, meta, badges, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold text-slate-800">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {meta ? (
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {meta}
          </div>
        ) : null}
        {actions}
      </div>
    </div>
  );
}

export function AdminOpsMetricCard({ label, value, helper, tone = "neutral", badgeLabel }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <AdminOpsStatusBadge label={badgeLabel || label} tone={tone} />
      <p className="mt-3 text-2xl font-semibold leading-none text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function AdminOpsLoadingState({ title = "Loading data..." }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`admin-ops-loading-${index}`}
            className="h-24 animate-pulse rounded-xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}

export function AdminOpsErrorState({ message, onRetry }) {
  return <UiErrorState message={message} onRetry={onRetry} />;
}

export function AdminOpsEmptyState({ title, description, actions }) {
  return <UiEmptyState title={title} description={description} actions={actions} />;
}

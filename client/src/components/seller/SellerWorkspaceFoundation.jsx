const joinClassNames = (...items) => items.filter(Boolean).join(" ");

export const sellerShellPageClass =
  "min-h-screen bg-slate-100 text-slate-900";

export const sellerShellPanelClass =
  "rounded-[26px] border border-slate-200 bg-white shadow-sm";

export const sellerShellInsetClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm";

export const sellerShellMutedClass =
  "rounded-2xl border border-slate-200 bg-slate-50";

export const sellerFieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const sellerTextareaClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const sellerDisabledFieldClass =
  "bg-slate-50 text-slate-500 disabled:cursor-not-allowed";

export const sellerSecondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerPrimaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerDangerButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerWarningButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerTableWrapClass =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";

export const sellerTableHeadCellClass =
  "px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";

export const sellerTableCellClass =
  "px-4 py-3.5 align-top text-sm text-slate-700";

export function SellerWorkspacePanel({ as: Element = "section", className = "", children }) {
  return <Element className={joinClassNames(sellerShellPanelClass, className)}>{children}</Element>;
}

export function SellerWorkspaceInset({ as: Element = "section", className = "", children }) {
  return <Element className={joinClassNames(sellerShellInsetClass, className)}>{children}</Element>;
}

export function SellerWorkspaceBadge({ label, tone = "slate", className = "" }) {
  const normalizedTone =
    tone === "success"
      ? "emerald"
      : tone === "warning"
        ? "amber"
        : tone === "danger"
          ? "rose"
          : tone === "neutral"
            ? "stone"
            : tone;

  const toneClass =
    normalizedTone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalizedTone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : normalizedTone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : normalizedTone === "teal"
            ? "border-teal-200 bg-teal-50 text-teal-700"
            : normalizedTone === "indigo"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : normalizedTone === "sky"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : normalizedTone === "stone"
            ? "border-stone-200 bg-stone-100 text-stone-700"
            : "border-slate-200 bg-white text-slate-700";

  return (
    <span
      className={joinClassNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        toneClass,
        className
      )}
    >
      {label}
    </span>
  );
}

export function SellerWorkspaceStatCard({ label, value, hint, Icon, tone = "slate" }) {
  const iconToneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <SellerWorkspacePanel className="px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-3 truncate text-2xl font-semibold text-slate-900">{value}</p>
          {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={joinClassNames(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              iconToneClass
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceSectionHeader({
  eyebrow,
  title,
  description,
  actions = null,
  children = null,
}) {
  return (
    <SellerWorkspacePanel className="px-5 py-4 sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceFilterBar({ children, className = "" }) {
  return (
    <SellerWorkspacePanel className={joinClassNames("p-4 sm:p-5", className)}>
      {children}
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceSectionCard({
  title,
  hint,
  Icon = null,
  actions = null,
  className = "",
  children,
}) {
  return (
    <SellerWorkspacePanel className={joinClassNames("p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {hint ? <p className="mt-1 text-sm leading-6 text-slate-500">{hint}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceDetailItem({ label, value, hint, className = "" }) {
  return (
    <SellerWorkspaceInset className={joinClassNames("px-4 py-4", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || "-"}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </SellerWorkspaceInset>
  );
}

export function SellerWorkspaceNotice({ type = "info", children, className = "" }) {
  const toneClass =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : type === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : type === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <div className={joinClassNames("rounded-2xl border px-4 py-3 text-sm", toneClass, className)}>
      {children}
    </div>
  );
}

export function SellerWorkspaceStatePanel({
  title,
  description,
  tone = "neutral",
  action = null,
  Icon = null,
  className = "",
}) {
  const iconToneClass =
    tone === "error"
      ? "bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : tone === "success"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-700";

  return (
    <SellerWorkspacePanel className={joinClassNames("p-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={joinClassNames(
                "flex h-10 w-10 items-center justify-center rounded-2xl",
                iconToneClass
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceEmptyState({ title, description, action = null, icon = null }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      {icon ? <div className="mb-3 flex justify-center text-slate-400">{icon}</div> : null}
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

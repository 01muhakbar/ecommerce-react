const joinClassNames = (...items) => items.filter(Boolean).join(" ");

export const sellerShellPageClass =
  "min-h-screen bg-[#f6f8fb] text-slate-900";

export const sellerShellPanelClass =
  "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]";

export const sellerShellInsetClass =
  "rounded-lg border border-slate-200 bg-white";

export const sellerShellMutedClass =
  "rounded-lg border border-slate-200 bg-slate-50";

export const sellerFieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const sellerTextareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const sellerDisabledFieldClass =
  "bg-slate-50 text-slate-500 disabled:cursor-not-allowed";

export const sellerSecondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerPrimaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerDangerButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3.5 text-sm font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerWarningButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 text-sm font-semibold text-amber-900 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60";

export const sellerTableWrapClass =
  "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]";

export const sellerTableHeadCellClass =
  "px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

export const sellerTableCellClass =
  "px-3.5 py-2.5 align-top text-sm text-slate-700";

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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em]",
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
    <SellerWorkspacePanel className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-[1.7rem] font-semibold leading-none text-slate-900">{value}</p>
          {hint ? <p className="mt-1.5 text-sm leading-5 text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={joinClassNames(
              "flex h-9 w-9 items-center justify-center rounded-lg",
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
    <SellerWorkspacePanel className="px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1.5 text-[1.3rem] font-semibold tracking-tight text-slate-900 sm:text-[1.45rem]">{title}</h2>
          {description ? (
            <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
          ) : null}
          {children ? <div className="mt-2.5">{children}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceFilterBar({ children, className = "" }) {
  return (
    <SellerWorkspacePanel className={joinClassNames("p-3 sm:p-3.5", className)}>
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
    <SellerWorkspacePanel className={joinClassNames("p-3.5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {hint ? <p className="mt-1 text-sm leading-5 text-slate-500">{hint}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </SellerWorkspacePanel>
  );
}

export function SellerWorkspaceDetailItem({ label, value, hint, className = "" }) {
  return (
    <SellerWorkspaceInset className={joinClassNames("px-3.5 py-3", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-5 text-slate-900">{value || "-"}</p>
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
    <div className={joinClassNames("rounded-lg border px-3.5 py-3 text-sm", toneClass, className)}>
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
    <SellerWorkspacePanel className={joinClassNames("p-3.5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div
              className={joinClassNames(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                iconToneClass
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
      {icon ? <div className="mb-3 flex justify-center text-slate-400">{icon}</div> : null}
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

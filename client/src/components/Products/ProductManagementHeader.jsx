function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ProductManagementHeader({
  title,
  subtitle,
  actions,
  children,
  className = "",
  contentClassName = "",
  titleBlockClassName = "",
  titleClassName = "",
  subtitleClassName = "",
  actionsClassName = "",
}) {
  return (
    <div
      className={joinClasses(
        "rounded-[18px] border border-slate-200 bg-white px-5 py-3 shadow-sm",
        className,
      )}
    >
      <div
        className={joinClasses(
          "flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between",
          contentClassName,
        )}
      >
        <div className={joinClasses("min-w-0 flex-1 space-y-1", titleBlockClassName)}>
          <h1
            className={joinClasses(
              "text-[24px] font-semibold tracking-tight text-slate-900",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className={joinClasses("text-[12px] leading-4 text-slate-500", subtitleClassName)}>
              {subtitle}
            </p>
          ) : null}
        </div>

        <div
          className={joinClasses(
            "flex w-full flex-wrap items-center justify-end gap-1 xl:w-auto xl:flex-nowrap xl:gap-1 xl:shrink-0",
            actionsClassName,
          )}
        >
          {actions ?? children}
        </div>
      </div>
    </div>
  );
}

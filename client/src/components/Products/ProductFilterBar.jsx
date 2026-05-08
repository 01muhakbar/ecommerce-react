function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ProductFilterBar({
  controls,
  actions,
  footer,
  className = "",
  layoutClassName = "",
  controlsClassName = "",
  actionsClassName = "",
  footerClassName = "",
}) {
  return (
    <div
      className={joinClasses(
        "rounded-[18px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        className,
      )}
    >
      <div
        className={joinClasses(
          "flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between",
          layoutClassName,
        )}
      >
        <div className={joinClasses("min-w-0 flex-1", controlsClassName)}>{controls}</div>
        <div
          className={joinClasses(
            "flex shrink-0 items-center justify-end gap-2",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      </div>
      {footer ? <div className={joinClasses("mt-3", footerClassName)}>{footer}</div> : null}
    </div>
  );
}

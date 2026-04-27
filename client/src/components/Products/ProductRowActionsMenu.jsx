import { MoreHorizontal } from "lucide-react";

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export default function ProductRowActionsMenu({
  open,
  onToggle,
  children,
  disabled = false,
  triggerTitle = "Row actions",
  containerClassName = "",
  triggerClassName = "",
  menuPositionClassName = "absolute right-0 top-full z-20 mt-2",
  menuClassName = "",
  menuStyle,
  containerProps = {},
  triggerIcon,
}) {
  return (
    <div className={joinClasses("relative inline-flex", containerClassName)} {...containerProps}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={joinClasses(
          "inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
          triggerClassName,
        )}
        title={triggerTitle}
      >
        {triggerIcon ?? <MoreHorizontal className="h-3 w-3" />}
      </button>
      {open ? (
        <div
          className={joinClasses(
            menuPositionClassName,
            "w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg",
            menuClassName,
          )}
          style={menuStyle}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

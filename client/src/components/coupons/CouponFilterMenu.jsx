import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

export default function CouponFilterMenu({
  label,
  value,
  options,
  onChange,
  defaultValue = "all",
  widthClass = "min-w-[156px]",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedCount = value !== defaultValue ? 1 : 0;

  useEffect(() => {
    if (!open) return undefined;

    const handleClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${widthClass}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-[13px] font-medium transition ${
          selectedCount > 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
        }`}
        aria-expanded={open}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current/30">
          <Plus className="h-2.5 w-2.5" />
        </span>
        <span className="truncate">
          {label}
          {selectedCount > 0 ? ` (${selectedCount})` : ""}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-12 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-1 mb-1 flex h-8 items-center border-b border-slate-100 px-2 text-[11px] font-medium text-slate-400">
            <span>{label}</span>
          </div>
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
                  checked
                    ? "bg-emerald-50 font-medium text-emerald-800"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

const toText = (value) => String(value ?? "").trim();

export default function VariantInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Press enter to add variant",
}) {
  const [input, setInput] = useState("");

  const chips = useMemo(
    () =>
      Array.isArray(value)
        ? value
            .map((entry) => toText(entry))
            .filter(Boolean)
        : [],
    [value]
  );

  const commitInput = () => {
    const nextValue = toText(input);
    if (!nextValue) {
      setInput("");
      return;
    }
    const dedupeKey = nextValue.toLowerCase();
    const hasDuplicate = chips.some((entry) => entry.toLowerCase() === dedupeKey);
    if (!hasDuplicate) {
      onChange?.([...chips, nextValue]);
    }
    setInput("");
  };

  const removeValue = (target) => {
    const next = chips.filter((entry) => entry.toLowerCase() !== String(target).toLowerCase());
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex min-h-[38px] items-center gap-2">
          <Plus className="h-4 w-4 text-slate-300" />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitInput();
              }
            }}
            onBlur={commitInput}
            disabled={disabled}
            placeholder={placeholder}
            className="h-8 w-full border-0 bg-transparent px-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {chips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
            {chips.map((entry) => (
              <span
                key={entry.toLowerCase()}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
              >
                {entry}
                <button
                  type="button"
                  onClick={() => removeValue(entry)}
                  disabled={disabled}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Remove ${entry}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Press <span className="font-semibold text-slate-700">Enter</span> to add a value. Duplicate
        labels are ignored.
      </p>
    </div>
  );
}

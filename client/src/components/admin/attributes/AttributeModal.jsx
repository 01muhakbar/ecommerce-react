import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import VariantInput from "./VariantInput.jsx";

const toText = (value) => String(value ?? "").trim();

const optionTypeOptions = [
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
];

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50";

function FieldRow({ label, children }) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
      <label className="pt-2 text-sm font-medium text-slate-700">{label}</label>
      <div>{children}</div>
    </div>
  );
}

export default function AttributeModal({
  open,
  mode = "create",
  attribute,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitError = "",
}) {
  const [language, setLanguage] = useState("en");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [optionType, setOptionType] = useState("dropdown");
  const [variants, setVariants] = useState([]);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextName = toText(attribute?.name);
    setName(nextName);
    setDisplayName(toText(attribute?.displayName ?? attribute?.display_name) || nextName);
    setOptionType(toText(attribute?.type).toLowerCase() || "dropdown");
    setVariants(
      Array.isArray(attribute?.values)
        ? attribute.values.map((entry) => toText(entry)).filter(Boolean)
        : []
    );
    setValidationError("");
    setLanguage("en");
  }, [open, attribute]);

  const heading = mode === "edit" ? "Update Attribute" : "Add Attribute";
  const actionLabel = mode === "edit" ? "Update Attribute" : "Add Attribute";
  const finalError = validationError || submitError;
  const isValid = useMemo(
    () =>
      Boolean(toText(name)) &&
      Boolean(toText(optionType)) &&
      Array.isArray(variants) &&
      variants.length > 0,
    [name, optionType, variants]
  );

  if (!open) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose?.();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedName = toText(name);
    if (!trimmedName) {
      setValidationError("Attribute title is required.");
      return;
    }
    if (!toText(optionType)) {
      setValidationError("Option type is required.");
      return;
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      setValidationError("Add at least one variant value.");
      return;
    }

    setValidationError("");
    onSubmit?.({
      name: trimmedName,
      displayName: toText(displayName) || trimmedName,
      type: optionType,
      values: variants,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <button
        type="button"
        onClick={handleClose}
        className="absolute inset-0 cursor-default"
        aria-label="Close attribute modal"
      />

      <aside className="absolute right-0 top-0 z-10 flex h-full w-full max-w-[820px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[31px] leading-none font-semibold tracking-tight text-slate-900">
                {heading}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Add your attribute values and necessary information from here
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  disabled={isSubmitting}
                  className="h-10 appearance-none rounded-lg border border-emerald-200 bg-white pl-3 pr-9 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  <option value="en">en</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-rose-50 text-rose-500 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Close attribute modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-200">
            <FieldRow label="Attribute Title">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                placeholder="Color or Size or Dimension or Material or Fabric"
                className={fieldClass}
              />
            </FieldRow>

            <FieldRow label="Display Name">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={isSubmitting}
                placeholder="Display Name"
                className={fieldClass}
              />
            </FieldRow>

            <FieldRow label="Options">
              <select
                value={optionType}
                onChange={(event) => setOptionType(event.target.value)}
                disabled={isSubmitting}
                className={`${fieldClass} appearance-none`}
              >
                {optionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldRow>

            <FieldRow label="Variants">
              <VariantInput
                value={variants}
                onChange={setVariants}
                disabled={isSubmitting}
                placeholder="Press enter to add variant"
              />
            </FieldRow>
          </div>

          {finalError ? (
            <div className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {finalError}
            </div>
          ) : null}
        </form>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || !isValid}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : actionLabel}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

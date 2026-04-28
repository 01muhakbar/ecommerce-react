import { useEffect, useRef, useState } from "react";
import { FileJson, Upload, X } from "lucide-react";

export default function CouponImportModal({
  open,
  onClose,
  onImport,
  title = "Import coupons",
  description = "Upload a JSON file to import coupon campaigns.",
  helperText = "Only JSON exports from this workspace are supported.",
  unavailableMessage = "",
  confirmLabel = "Import Now",
  accept = "application/json,.json",
  selectPrompt = "Choose JSON coupon file",
  isSubmitting = false,
  errorMessage = "",
}) {
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
    }
  }, [open]);

  if (!open) return null;

  const canImport = typeof onImport === "function" && !unavailableMessage;

  const handlePickFile = () => {
    if (!canImport || isSubmitting) return;
    inputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setSelectedFile(file);
  };

  const handleConfirm = () => {
    if (!canImport || !selectedFile || isSubmitting) return;
    onImport(selectedFile);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55"
        onClick={() => !isSubmitting && onClose?.()}
        disabled={isSubmitting}
        aria-label="Close import modal"
      />

      <div className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => !isSubmitting && onClose?.()}
          disabled={isSubmitting}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Upload className="h-6 w-6" />
        </div>

        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>

        {canImport ? (
          <div className="mt-5 space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handlePickFile}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileJson className="h-5 w-5 text-slate-400" />
              <span>{selectedFile?.name || selectPrompt}</span>
            </button>

            <p className="text-xs text-slate-500">{helperText}</p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            {unavailableMessage || "Import is currently unavailable."}
          </div>
        )}

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
          {canImport ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedFile || isSubmitting}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Importing..." : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

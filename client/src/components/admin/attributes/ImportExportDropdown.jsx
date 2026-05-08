import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Plus, Upload } from "lucide-react";

const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[11px] font-medium transition";
const btnOutline = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const btnSoft = `${btnBase} bg-slate-50 text-slate-600 hover:bg-slate-100`;
const btnBlue = `${btnBase} bg-sky-500 text-white hover:bg-sky-600`;

export default function ImportExportDropdown({
  pendingImportFileName = "",
  pendingImportCount = 0,
  isImporting = false,
  exportingFormat = "",
  onImportFileSelect,
  onImportNow,
  onExport,
}) {
  const exportMenuRef = useRef(null);
  const importInputRef = useRef(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importPickerVisible, setImportPickerVisible] = useState(false);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [exportMenuOpen]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={exportMenuRef} className="relative">
        <button
          type="button"
          className={btnOutline}
          onClick={() => setExportMenuOpen((prev) => !prev)}
          disabled={Boolean(exportingFormat)}
        >
          <Download className="h-4 w-4" />
          {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {exportMenuOpen ? (
          <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false);
                onExport?.("csv");
              }}
              className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Export to CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false);
                onExport?.("json");
              }}
              className="block w-full px-3 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Export to JSON
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={btnSoft}
        onClick={() => setImportPickerVisible(true)}
        disabled={isImporting}
      >
        <Upload className="h-4 w-4" />
        Import
      </button>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          onImportFileSelect?.(file);
          if (file) {
            setImportPickerVisible(true);
          }
          event.target.value = "";
        }}
      />

      {importPickerVisible ? (
        <>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-9 min-w-[168px] max-w-[260px] items-center rounded-lg border border-dashed border-teal-400 bg-white px-3 text-[11px] font-medium text-slate-500 transition hover:border-teal-500 hover:bg-teal-50"
            title={pendingImportFileName || "Select JSON attribute file"}
          >
            <span className="truncate">
              {pendingImportFileName || "SelectYourJSON Attribute File"}
            </span>
          </button>

          {pendingImportFileName ? (
            <button
              type="button"
              className={btnBlue}
              disabled={isImporting}
              onClick={onImportNow}
            >
              <Plus className="h-4 w-4" />
              {isImporting ? "Importing..." : "Import Now"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

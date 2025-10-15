import { useMemo } from "react";
import { createPortal } from "react-dom";

function normalizeRoutes(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.filter((x): x is string => typeof x === "string");
  }
  if (typeof input === "string") {
    // coba parse JSON dulu; kalau gagal, split comma
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {}
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (input && typeof input === "object") {
    // kadang tersimpan sebagai object indeks -> ambil nilai stringnya
    return Object.values(input as Record<string, unknown>).filter(
      (v): v is string => typeof v === "string"
    );
  }
  return [];
}

export default function AccessRoutesModal({
  open,
  routes,
  onClose,
}: {
  open: boolean;
  routes: unknown; // ⬅ terima apa saja
  onClose: () => void;
}) {
  if (!open) return null;

  const list = useMemo(() => normalizeRoutes(routes), [routes]);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white w-[520px] max-w-[92vw] rounded-xl shadow-xl">
          <div className="p-5 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">Access Routes</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="p-5">
            {list.length ? (
              <ul className="grid grid-cols-2 gap-2">
                {list.map((r) => (
                  <li key={r} className="px-3 py-2 bg-gray-50 rounded border">
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No routes.</p>
            )}
          </div>
          <div className="p-4 border-t text-right">
            <button onClick={onClose} className="px-4 py-2 rounded border">
              Close
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

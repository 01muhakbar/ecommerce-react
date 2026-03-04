import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../../api/axios.ts";
import { GENERIC_ERROR, UPDATING } from "../../../constants/uiMessages.js";

function toText(value) {
  return String(value ?? "").trim();
}

const sectionCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export default function EditAttributeDrawer({
  open,
  attribute,
  onClose,
  onUpdated,
}) {
  const [language, setLanguage] = useState("en");
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !attribute) return;
    const nextName = toText(attribute?.name);
    const nextDisplay = toText(attribute?.displayName ?? attribute?.display_name) || nextName;
    setName(nextName);
    setDisplayName(nextDisplay);
    setError("");
  }, [open, attribute]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.patch(`/admin/attributes/${attribute.id}`, payload);
      return data;
    },
    onSuccess: (result) => {
      setError("");
      if (typeof onUpdated === "function") {
        onUpdated(result?.data || null);
      }
    },
    onError: (err) => {
      setError(err?.response?.data?.message || GENERIC_ERROR);
    },
  });

  if (!open || !attribute) return null;

  const isPending = updateMutation.isPending;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isPending) return;
    const trimmedName = toText(name);
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    updateMutation.mutate({
      name: trimmedName,
      displayName: toText(displayName) || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={() => {
          if (isPending) return;
          onClose?.();
        }}
        aria-label="Close update attribute drawer"
        className="absolute inset-0 bg-black/30"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Admin / Attributes / Edit
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Update Attribute
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Update your attribute title and display naming.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
              >
                <option value="en">en</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (isPending) return;
                  onClose?.();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <form
          id="edit-attribute-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto px-6 py-5"
        >
          <section className={sectionCardClass}>
            <h3 className="text-base font-semibold text-slate-900">Basic Info</h3>
            <p className="mt-1 text-xs text-slate-500">
              Maintain the attribute title and customer-facing display label.
            </p>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Attribute Title
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isPending}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Attribute title"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Display Name
                </label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={isPending}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Display name"
                />
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          ) : null}
        </form>

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                if (isPending) return;
                onClose?.();
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-attribute-form"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isPending || !toText(name)}
            >
              {isPending ? UPDATING : "Update Attribute"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

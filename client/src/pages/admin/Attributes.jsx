import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/axios.ts";
import { useState } from "react";

const fetchAdminAttributes = async () => {
  const { data } = await api.get("/admin/attributes");
  return data;
};

const getHttpStatus = (err) => err?.response?.status;

export default function AdminAttributesPage() {
  const qc = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [valuesOpen, setValuesOpen] = useState(false);
  const [activeAttribute, setActiveAttribute] = useState(null);
  const [valueInput, setValueInput] = useState("");
  const [valueError, setValueError] = useState("");
  const [valueDeleteError, setValueDeleteError] = useState("");
  const [deletingValueId, setDeletingValueId] = useState(null);

  const attributesQuery = useQuery({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/admin/attributes", payload);
      return data;
    },
    onSuccess: () => {
      setNameInput("");
      setSubmitError("");
      setIsOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (err) => {
      setSubmitError(
        err?.response?.data?.message || "Failed to create attribute."
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/attributes/${id}`);
      return data;
    },
    onSuccess: () => {
      setDeleteError("");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "attributes"] });
    },
    onError: (err) => {
      setDeleteError(
        err?.response?.data?.message || "Failed to delete attribute."
      );
      setDeletingId(null);
    },
  });

  const valuesQuery = useQuery({
    queryKey: ["admin", "attribute-values", activeAttribute?.id],
    queryFn: async () => {
      const { data } = await api.get(
        `/admin/attributes/${activeAttribute.id}/values`,
      );
      return data;
    },
    enabled: Boolean(valuesOpen && activeAttribute?.id),
  });

  const createValueMutation = useMutation({
    mutationFn: async ({ attributeId, value }) => {
      const { data } = await api.post(
        `/admin/attributes/${attributeId}/values`,
        { value },
      );
      return data;
    },
    onSuccess: () => {
      setValueInput("");
      setValueError("");
      qc.invalidateQueries({
        queryKey: ["admin", "attribute-values", activeAttribute?.id],
      });
    },
    onError: (err) => {
      setValueError(
        err?.response?.data?.message || "Failed to create value.",
      );
    },
  });

  const deleteValueMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/admin/attribute-values/${id}`);
      return data;
    },
    onSuccess: () => {
      setValueDeleteError("");
      setDeletingValueId(null);
      qc.invalidateQueries({
        queryKey: ["admin", "attribute-values", activeAttribute?.id],
      });
    },
    onError: (err) => {
      setValueDeleteError(
        err?.response?.data?.message || "Failed to delete value.",
      );
      setDeletingValueId(null);
    },
  });

  const attributes = attributesQuery.data?.data || [];
  const warning = attributesQuery.data?.warning || "";
  const status = getHttpStatus(attributesQuery.error);
  const valuesWarning = valuesQuery.data?.warning || "";
  const values = valuesQuery.data?.data || [];
  const valuesStatus = getHttpStatus(valuesQuery.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Attributes</h1>
          <p className="text-sm text-slate-500">
            Manage attribute sets for your products.
          </p>
        </div>
      </div>

      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          Warning: {warning}
        </div>
      ) : null}
      {deleteError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {deleteError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Attributes</span>
          <button
            type="button"
            onClick={() => {
              setSubmitError("");
              setIsOpen(true);
            }}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Add Attribute
          </button>
        </div>
        {attributesQuery.isLoading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading...</div>
        ) : attributesQuery.isError ? (
          <div className="px-4 py-6 text-sm text-rose-600">
            {status === 401
              ? "Unauthorized. Please login as admin."
              : "Failed to load attributes."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Values</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {attributes.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={3}>
                    No attributes yet.
                  </td>
                </tr>
              ) : (
                attributes.map((attr) => (
                  <tr key={attr.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{attr.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {(() => {
                        const cached = qc.getQueryData([
                          "admin",
                          "attribute-values",
                          attr.id,
                        ]);
                        const count = cached?.data?.length ?? null;
                        return typeof count === "number" ? `${count} values` : "—";
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAttribute(attr);
                            setValuesOpen(true);
                            setValueInput("");
                            setValueError("");
                            setValueDeleteError("");
                          }}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                        >
                          Manage Values
                        </button>
                        <button
                          type="button"
                          disabled
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`Delete attribute "${attr.name}"?`)) {
                              return;
                            }
                            setDeleteError("");
                            setDeletingId(attr.id);
                            deleteMutation.mutate(attr.id);
                          }}
                          disabled={deleteMutation.isPending && deletingId === attr.id}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 disabled:text-slate-400"
                        >
                          {deleteMutation.isPending && deletingId === attr.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Attribute</h2>
              <button type="button" onClick={() => setIsOpen(false)}>
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Size"
                />
              </div>
              {submitError ? (
                <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {submitError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createMutation.mutate({ name: nameInput })}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={createMutation.isPending || !nameInput.trim()}
                >
                  {createMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {valuesOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Manage Values</h2>
                <p className="text-xs text-slate-500">
                  {activeAttribute?.name || "-"}
                </p>
              </div>
              <button type="button" onClick={() => setValuesOpen(false)}>
                ✕
              </button>
            </div>

            {valuesWarning ? (
              <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Warning: {valuesWarning}
              </div>
            ) : null}

            {valueError ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueError}
              </div>
            ) : null}

            {valueDeleteError ? (
              <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {valueDeleteError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={valueInput}
                onChange={(event) => setValueInput(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="New value"
              />
              <button
                type="button"
                onClick={() =>
                  createValueMutation.mutate({
                    attributeId: activeAttribute.id,
                    value: valueInput,
                  })
                }
                disabled={createValueMutation.isPending || !valueInput.trim()}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createValueMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="mt-4">
              {valuesQuery.isLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : valuesQuery.isError ? (
                <div className="text-sm text-rose-600">
                  {valuesStatus === 401
                    ? "Unauthorized. Please login as admin."
                    : "Failed to load values."}
                </div>
              ) : values.length === 0 ? (
                <div className="text-sm text-slate-500">No values yet.</div>
              ) : (
                <ul className="space-y-2">
                  {values.map((val) => (
                    <li
                      key={val.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
                      <span>{val.value}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(`Delete value "${val.value}"?`)
                          ) {
                            return;
                          }
                          setValueDeleteError("");
                          setDeletingValueId(val.id);
                          deleteValueMutation.mutate(val.id);
                        }}
                        disabled={
                          deleteValueMutation.isPending &&
                          deletingValueId === val.id
                        }
                        className="text-xs text-rose-600 disabled:text-rose-300"
                      >
                        {deleteValueMutation.isPending &&
                        deletingValueId === val.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

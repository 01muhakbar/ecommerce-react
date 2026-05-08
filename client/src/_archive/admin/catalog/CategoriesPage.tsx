import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { http } from "@/lib/http";

type Category = { id: number; name: string; description?: string | null };

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const list = useQuery<{ status: string; data: Category[] }>({
    queryKey: ["admin", "categories"],
    queryFn: () => http("/admin/categories"),
    retry: 1,
    staleTime: 10_000,
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to load categories";
      toast.error(msg);
    },
  });

  const create = useMutation({
    mutationFn: () =>
      http<{ status: string; data: Category }>("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name, description: description || undefined }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success("Category created");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to create category";
      toast.error(msg);
    },
  });

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const update = useMutation({
    mutationFn: (payload: { id: number; name: string; description?: string }) =>
      http<{ status: string; data: Category }>(`/admin/categories/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: payload.name, description: payload.description }),
      }),
    onMutate: (p: { id: number }) => setUpdatingId(p.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success("Category updated");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to update category";
      toast.error(msg);
    },
    onSettled: () => setUpdatingId(null),
  });

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; name: string } | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => http(`/admin/categories/${id}`, { method: "DELETE" }),
    onMutate: (id: number) => setRemovingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      toast.success("Category deleted");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || "Failed to delete category";
      toast.error(msg);
    },
    onSettled: () => setRemovingId(null),
  });

  const cats: Category[] = list.data?.data ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold mb-3">Add Category</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border px-3 py-2"
          />
          <button
            className="rounded-md bg-emerald-600 text-white px-4 py-2 font-medium disabled:opacity-50"
            onClick={() => create.mutate()}
            disabled={!name || create.isPending}
          >
            {create.isPending ? "Saving..." : "Create"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="p-4 border-b font-semibold">Categories</div>
        {list.isLoading ? (
          <div className="p-4">Loading…</div>
        ) : cats.length === 0 ? (
          <div className="p-4 text-slate-500">No categories yet.</div>
        ) : (
          <table className="min-w-full table-auto">
            <thead>
              <tr className="text-left text-sm text-slate-600">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 text-sm">{c.id}</td>
                  <td className="px-4 py-2">
                    <InlineEdit
                      value={c.name}
                      saving={updatingId === c.id}
                      onSave={(v) => update.mutate({ id: c.id, name: v })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <InlineEdit
                      value={c.description || ""}
                      saving={updatingId === c.id}
                      onSave={(v) => update.mutate({ id: c.id, name: c.name, description: v })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="text-red-600 hover:underline text-sm disabled:opacity-50"
                      disabled={removingId === c.id}
                      onClick={() => setConfirm({ id: c.id, name: c.name })}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setConfirm(null)} />
          <div className="relative bg-white rounded-xl shadow-xl border w-[min(92vw,480px)] p-5">
            <h3 className="text-lg font-semibold mb-2">Hapus Kategori?</h3>
            <p className="text-slate-600 mb-4">
              Anda akan menghapus kategori "{confirm.name}". Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded border"
                onClick={() => setConfirm(null)}
                disabled={removingId === confirm.id}
              >
                Batal
              </button>
              <button
                className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
                onClick={() => {
                  setRemovingId(confirm.id);
                  remove.mutate(confirm.id, {
                    onSettled: () => {
                      setConfirm(null);
                      setRemovingId(null);
                    },
                  });
                }}
                disabled={removingId === confirm.id}
              >
                {removingId === confirm.id ? "Menghapus…" : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineEdit({ value, onSave, saving }: { value: string; onSave: (v: string) => void; saving?: boolean }) {
  const [v, setV] = useState(value);
  const [editing, setEditing] = useState(false);
  return editing ? (
    <div className="flex items-center gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm disabled:bg-slate-50"
        autoFocus
        disabled={!!saving}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(v.trim());
            setEditing(false);
          } else if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          }
        }}
      />
      <button
        className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50"
        onClick={() => {
          onSave(v.trim());
          setEditing(false);
        }}
        disabled={!!saving}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        className="text-xs px-2 py-1 rounded border disabled:opacity-50"
        onClick={() => {
          setV(value);
          setEditing(false);
        }}
        disabled={!!saving}
      >
        Cancel
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-sm">{value || <em className="text-slate-400">(empty)</em>}</span>
      <button className="text-xs underline" onClick={() => setEditing(true)}>
        Edit
      </button>
    </div>
  );
}

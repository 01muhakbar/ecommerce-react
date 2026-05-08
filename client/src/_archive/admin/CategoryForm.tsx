import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import * as svc from "@/api/categories";

export default function CategoryForm({ mode }: { mode: "create" | "edit" }) {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = mode === "edit";

  const { data: parents } = useQuery({
    queryKey: ["categories", { parentsOnly: true }],
    queryFn: () => svc.listCategories({ parentsOnly: true, pageSize: 100 }),
  });

  const { data } = useQuery({
    enabled: isEdit && !!id,
    queryKey: ["category", id],
    queryFn: () => svc.getCategory(Number(id)),
  });

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    icon: "",
    parent_id: "",
    published: true,
  });

  useEffect(() => {
    if (data?.data) {
      const c = data.data;
      setForm({
        code: c.code || "",
        name: c.name || "",
        description: c.description || "",
        icon: c.icon || "",
        parent_id: c.parent?.id ? String(c.parent.id) : "",
        published: !!c.published,
      });
    }
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        code: form.code || undefined,
        name: form.name,
        description: form.description || undefined,
        icon: form.icon || undefined,
        parent_id: form.parent_id ? Number(form.parent_id) : undefined,
        published: !!form.published,
      };
      if (isEdit) await svc.updateCategory(Number(id), payload);
      else await svc.createCategory(payload);
      toast.success("Saved");
      nav("/admin/catalog/categories");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Save failed");
    }
  };

  return (
    <div className="p-4">
      <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
        <h1 className="text-xl font-semibold">{isEdit ? "Edit" : "Create"} Category</h1>
        <div>
          <label className="block text-sm mb-1">Code</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.code}
            onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
            placeholder="e.g. 0C24"
            maxLength={32}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            maxLength={255}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Icon (emoji or URL)</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={form.icon}
            onChange={(e) => setForm((s) => ({ ...s, icon: e.target.value }))}
            maxLength={255}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Parent</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={form.parent_id}
            onChange={(e) => setForm((s) => ({ ...s, parent_id: e.target.value }))}
          >
            <option value="">(none)</option>
            {(parents?.data || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((s) => ({ ...s, published: e.target.checked }))}
          />
          Published
        </label>

        <div className="flex gap-2">
          <button className="rounded bg-emerald-600 text-white px-4 py-2">Save</button>
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => nav("/admin/catalog/categories")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}


import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/axios";
import type { Staff } from "../types/staff";
import AddStaffDrawer from "../components/admin/AddStaffDrawer";
import EditStaffDrawer from "../components/admin/EditStaffDrawer";
import AccessRoutesModal from "../components/admin/AccessRoutesModal";
import Badge from "../components/ui/Badge";
import IconButton from "../components/ui/IconButton";
import { Eye, Pencil, Trash2, Search } from "lucide-react";

const ROLE_OPTIONS = [
  "All",
  "Super Admin",
  "Admin",
  "Manager",
  "Staff",
] as const;

export default function AdminStaffPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("All");
  const [openAdd, setOpenAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [routesOf, setRoutesOf] = useState<Staff | null>(null);

  const { data = [], isFetching } = useQuery({
    queryKey: ["staff", q, role],
    queryFn: async () => {
      const res = await api.get("/admin/staff", {
        params: { q, role: role === "All" ? undefined : role },
      });
      return res.data as Staff[];
    },
  });

  const patchPublished = useMutation({
    mutationFn: async ({ id, published }: { id: number; published: boolean }) =>
      (await api.patch(`/admin/staff/${id}/published`, { published })).data,
    onMutate: async ({ id, published }) => {
      await qc.cancelQueries({ queryKey: ["staff", q, role] });
      const prev = qc.getQueryData<any>(["staff", q, role]);
      qc.setQueryData(["staff", q, role], (old: any[] = []) =>
        old.map((s) =>
          s.id === id
            ? { ...s, published, status: published ? "Active" : "Inactive" }
            : s
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["staff", q, role], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["staff", q, role] }),
  });

  const delStaff = useMutation({
    mutationFn: async (id: number) =>
      (await api.delete(`/admin/staff/${id}`)).data,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["staff"] });
      const previousStaff = qc.getQueryData(["staff"]);
      qc.setQueryData(["staff"], (old: Staff[] | undefined) =>
        old ? old.filter((s) => s.id !== id) : []
      );
      return { previousStaff };
    },
    onError: (_err, _id, context) => {
      context && qc.setQueryData(["staff"], context.previousStaff);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });

  const onFilter = () => qc.invalidateQueries({ queryKey: ["staff"] });
  const onReset = () => {
    setQ("");
    setRole("All");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">All Staff</h1>
        <button
          onClick={() => setOpenAdd(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
        >
          + Add Staff
        </button>
      </div>

      {/* Filters row */}
      <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch">
        <div className="relative md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name/email/phone"
            className="w-full border rounded-lg pl-9 pr-3 py-2"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="border rounded-lg px-3 py-2 md:w-60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "Staff Role" : r}
            </option>
          ))}
        </select>
        <button
          onClick={onFilter}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
        >
          Filter
        </button>
        <button onClick={onReset} className="px-4 py-2 rounded-lg border">
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-3">NAME</th>
              <th className="p-3">EMAIL</th>
              <th className="p-3">CONTACT</th>
              <th className="p-3">JOINING DATE</th>
              <th className="p-3">ROLE</th>
              <th className="p-3">STATUS</th>
              <th className="p-3">PUBLISHED</th>
              <th className="p-3">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.name}</td>
                <td className="p-3">{s.email}</td>
                <td className="p-3">{s.contactNumber ?? "-"}</td>
                <td className="p-3">
                  {s.joiningDate
                    ? new Date(s.joiningDate).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "-"}
                </td>
                <td className="p-3">{s.role}</td>
                <td className="p-3">
                  <Badge tone={s.status === "Active" ? "green" : "red"}>
                    {s.status ?? "Inactive"}
                  </Badge>
                </td>
                <td className="p-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!!s.published}
                      onChange={(e) =>
                        patchPublished.mutate({
                          id: s.id,
                          published: e.target.checked,
                        })
                      }
                      disabled={patchPublished.isPending}
                    />
                    <div
                      className={`w-10 h-5 rounded-full transition ${
                        s.published ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 bg-white rounded-full shadow transform transition ${
                          s.published ? "translate-x-5" : ""
                        }`}
                      />
                    </div>
                  </label>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <IconButton
                      title="View Access Route"
                      onClick={() => setRoutesOf(s)}
                    >
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton title="Edit" onClick={() => setEditTarget(s)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title="Delete"
                      onClick={() => {
                        if (confirm("Delete this staff?"))
                          delStaff.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  {isFetching ? "Loading..." : "No staff found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddStaffDrawer open={openAdd} onClose={() => setOpenAdd(false)} />
      <EditStaffDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        staff={editTarget}
      />
      <AccessRoutesModal
        open={!!routesOf}
        routes={routesOf?.routes ?? []}
        onClose={() => setRoutesOf(null)}
      />
    </div>
  );
}

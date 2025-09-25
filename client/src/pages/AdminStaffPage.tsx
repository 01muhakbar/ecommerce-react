import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fetchStaff, createStaff, updateStaff, deleteStaff, type StaffItem, type StaffRole
} from "@/api/adminStaff";

// Define roles based on the imported type
const ROLES: StaffRole[] = [
  "Super Admin", "Admin", "Cashier", "CEO", "Manager", "Accountant", "Driver", "Security Guard", "Delivery Person"
];

const pageLimit = 10;

export default function AdminStaffPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<StaffRole | ''>( '');
  const [q, setQ] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-staff', { page, q, role }],
    queryFn: () => fetchStaff({ page, limit: pageLimit, q, role }),
    keepPreviousData: true,
  });

  const staff = data?.data ?? [];
  const meta = data?.meta ?? { page, totalPages: 1, total: 0, limit: pageLimit };

  // Mutations (toggle & delete)
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateStaff(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
  const togglePublished = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      updateStaff(id, { isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteStaff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-staff'] }),
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Staff</h1>
        <AddStaffButton onCreated={() => qc.invalidateQueries({ queryKey: ['admin-staff'] })} />
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
          <input
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Search by name/email/phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-gray-200 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole | '')}
        >
          <option value="">Staff Role</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={() => setPage(1)}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700"
        >
          Filter
        </button>
        <button
          onClick={() => { setQ(''); setRole(''); setPage(1); }}
          className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50"
        >
          Reset
        </button>
      </div>

      {/* Alerts */}
      {isError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Failed to fetch staff: {(error as any)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 w-12"> </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Joining date</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">Loading…</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">No staff found.</td></tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      {(s.name ?? 'S').charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{s.email}</td>
                  <td className="px-4 py-3">{s.phoneNumber ?? '-'}</td>
                  <td className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={s.isActive}
                        onChange={(e) => toggleActive.mutate({ id: s.id, isActive: e.target.checked })}
                      />
                      <span className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-emerald-600 transition"></span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={s.isPublished}
                        onChange={(e) => togglePublished.mutate({ id: s.id, isPublished: e.target.checked })}
                      />
                      <span className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-emerald-600 transition"></span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton title="View"><Eye className="h-4 w-4" /></IconButton>
                      <IconButton title="Edit"><Pencil className="h-4 w-4" /></IconButton>
                      <IconButton
                        title="Delete"
                        onClick={() => { if (confirm('Delete this staff?')) del.mutate(s.id); }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">
          <button
            disabled={meta.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
          >Prev</button>
          <button
            disabled={meta.page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-50"
          >Next</button>
        </div>
      </div>
    </div>
  );
}

/* UI bits */
function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50"
    />
  );
}

/* Add Staff Modal (simple inline version) */
const addSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  role: z.enum(ROLES as [StaffRole, ...StaffRole[]]),
  password: z.string().min(8),
});
type AddForm = z.infer<typeof addSchema>;

function AddStaffButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { role: 'Admin' as StaffRole } });

  const m = useMutation({ mutationFn: createStaff, onSuccess: () => { onCreated(); setOpen(false); reset(); } });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" /> Add Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Add Staff</h2>
            <form
              onSubmit={handleSubmit((v) => m.mutate(v))}
              className="grid grid-cols-1 gap-3"
            >
              <input className="input" placeholder="Name" {...register('name')} />
              {errors.name && <FieldError msg={errors.name.message} />}
              <input className="input" placeholder="Email" {...register('email')} />
              {errors.email && <FieldError msg={errors.email.message} />}
              <input className="input" placeholder="Phone" {...register('phoneNumber')} />
              <select className="input" {...register('role')}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input className="input" type="password" placeholder="Password" {...register('password')} />
              {errors.password && <FieldError msg={errors.password.message} />}

              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-3 py-2">
                  Cancel
                </button>
                <button disabled={isSubmitting || m.isPending}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">
                  {m.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-600 -mt-2">{msg}</p>;
}
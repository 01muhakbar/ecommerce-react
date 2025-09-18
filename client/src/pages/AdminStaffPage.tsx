import { useEffect, useMemo, useState } from 'react';
import { fetchStaff, createStaff, updateStaff, deleteStaff, toggleActive, togglePublished } from '../api/adminStaff';
import type { StaffItem, StaffRole } from '../api/adminStaff';

const ROLES: StaffRole[] = ['Super Admin','Admin','Cashier','CEO','Manager','Accountant','Driver','Security Guard','Delivery Person', 'user', 'seller'];

export default function AdminStaffPage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<StaffItem[]>([]);
  const [meta, setMeta] = useState({ page:1, limit:10, total:0, totalPages:1 });
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string>('');
  const [error, setError] = useState<string>('');

  const load = async (page = 1) => {
    try {
      setLoading(true); setError('');
      const { data } = await fetchStaff({ page, limit:10, q, role, sortBy:'createdAt', sort:'DESC' });
      setRows(data.data); setMeta(data.meta);
    } catch (e:any) {
      setError(e?.response?.data?.message || 'Failed to fetch staff');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, [q, role]);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">All Staff</h1>

      <div className="flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name/email/phone" className="border px-3 py-2 rounded w-[360px]"/>
        <select value={role} onChange={e=>setRole(e.target.value)} className="border px-3 py-2 rounded">
          <option value="">Staff Role</option>
          {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={()=>{ setQ(''); setRole(''); }} className="border px-3 py-2 rounded">Reset</button>
        <AddStaffButton onAdded={()=>load(meta.page)} />
      </div>

      {error && <div className="bg-red-50 text-red-600 px-3 py-2 rounded">{error}</div>}

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Contact</th>
              <th className="p-3 text-left">Joining Date</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Published</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={8}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-4" colSpan={8}>No staff found.</td></tr>
            ) : rows.map(r=>(
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.phoneNumber ?? '-'}</td>
                <td className="p-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="p-3">{r.role}</td>
                <td className="p-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={r.isActive} onChange={async()=>{ await toggleActive(r.id); load(meta.page); }} />
                    <span>{r.isActive?'Active':'Inactive'}</span>
                  </label>
                </td>
                <td className="p-3">
                  <input type="checkbox" checked={r.isPublished} onChange={async()=>{ await togglePublished(r.id); load(meta.page); }} />
                </td>
                <td className="p-3 flex gap-2">
                  <EditStaffButton staff={r} onSaved={()=>load(meta.page)} />
                  <button className="text-red-600" onClick={async()=>{ if(confirm('Delete staff?')){ await deleteStaff(r.id); load(meta.page); } }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <span>Page {meta.page} of {meta.totalPages}</span>
        <button disabled={meta.page<=1} onClick={()=>load(meta.page-1)} className="border px-3 py-1 rounded disabled:opacity-50">Prev</button>
        <button disabled={meta.page>=meta.totalPages} onClick={()=>load(meta.page+1)} className="border px-3 py-1 rounded disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

function AddStaffButton({ onAdded }:{ onAdded: ()=>void }) {
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({ name:'',email:'',phone:'',role:'Admin' as StaffRole,password:'' });
  const submit=async()=>{
    await createStaff(form);
    setOpen(false);
    onAdded();
  };
  return <>
    <button onClick={()=>setOpen(true)} className="bg-emerald-600 text-white px-3 py-2 rounded">+ Add Staff</button>
    {open&&(
      <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
        <div className="bg-white p-4 rounded w-[420px] space-y-3">
          <h3 className="text-lg font-medium">Add Staff</h3>
          <input className="border p-2 w-full" placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="border p-2 w-full" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <input className="border p-2 w-full" placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <select className="border p-2 w-full" value={form.role} onChange={e=>setForm({...form,role:e.target.value as StaffRole})}>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <input className="border p-2 w-full" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="bg-emerald-600 text-white px-3 py-2 rounded" onClick={submit}>Save</button>
          </div>
        </div>
      </div>
    )}
  </>;
}

function EditStaffButton({ staff, onSaved }:{ staff: StaffItem; onSaved: ()=>void }) {
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({ name: staff.name, email: staff.email, phone: staff.phoneNumber ?? '', role: staff.role as StaffRole });
  const submit=async()=>{
    await updateStaff(staff.id, form);
    setOpen(false);
    onSaved();
  };
  return <>
    <button className="text-blue-600" onClick={()=>setOpen(true)}>Edit</button>
    {open&&(
      <div className="fixed inset-0 bg-black/30 grid place-items-center z-50">
        <div className="bg-white p-4 rounded w-[420px] space-y-3">
          <h3 className="text-lg font-medium">Edit Staff</h3>
          <input className="border p-2 w-full" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="border p-2 w-full" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
          <input className="border p-2 w-full" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <select className="border p-2 w-full" value={form.role} onChange={e=>setForm({...form,role:e.target.value as StaffRole})}>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="bg-emerald-600 text-white px-3 py-2 rounded" onClick={submit}>Save</button>
          </div>
        </div>
      </div>
    )}
  </>;
}

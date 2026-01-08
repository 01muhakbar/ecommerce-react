import { useState } from "react";
import { useStaff } from "@/features/staff/useStaff";
import { toast } from "react-hot-toast";
import type { Staff } from "@/types/admin";

export default function StaffPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, isLoading, error, isFetching } = useStaff({
    page,
    pageSize: 10,
    q,
  });

  if (error) {
    const msg =
      (error as any)?.response?.data?.message ?? "Failed to load staff";
    toast.error(msg);
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Search name/email/role"
          className="input input-bordered w-full max-w-sm p-2 border rounded"
        />
      </div>

      {isLoading ? (
        <div>Loading staff…</div>
      ) : (
        <>
          <div className="text-sm opacity-70 mb-2">
            {isFetching ? "Updating…" : `Total: ${data?.meta.total ?? 0}`}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="table w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((s: Staff) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3">{s.email}</td>
                    <td className="p-3">{s.role}</td>
                    <td className="p-3">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!data?.data?.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center">
                      No staff yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span>
              Page {data?.meta.page ?? page} / {data?.meta.totalPages ?? 1}
            </span>
            <button
              disabled={(data?.meta.page ?? 1) >= (data?.meta.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

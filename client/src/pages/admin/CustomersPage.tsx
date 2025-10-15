import { useState } from "react";
import { useCustomers } from "@/features/customers/useCustomers";
import { toast } from "react-hot-toast"; // Assuming you use react-hot-toast

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, isLoading, error, isFetching } = useCustomers({
    page,
    pageSize: 10,
    q,
  });

  if (error) {
    const msg =
      (error as any)?.response?.data?.message ?? "Failed to load customers";
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
          placeholder="Search name/email/phone"
          className="input input-bordered w-full max-w-sm p-2 border rounded"
        />
      </div>

      {isLoading ? (
        <div>Loading customers…</div>
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
                  <th className="p-3 text-left">Phone</th>
                  <th className="p-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3">{c.name}</td>
                    <td className="p-3">{c.email}</td>
                    <td className="p-3">{c.phone || "-"}</td>
                    <td className="p-3">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!data?.data?.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center">
                      No customers yet.
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

import { useState } from "react";
import { useOrders } from "@/features/orders/useOrders";
import { toast } from "react-hot-toast";
import type { Order } from "@/types/admin";

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading, error, isFetching } = useOrders({
    page,
    pageSize: 10,
    q,
    status,
  });

  if (error) {
    const msg =
      (error as any)?.response?.data?.message ?? "Failed to load orders";
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
          placeholder="Search customer name/email"
          className="input input-bordered w-full max-w-xs p-2 border rounded"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="p-2 border rounded"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading && <div>Loading orders…</div>}
      {!isLoading && (
        <div className="text-sm opacity-70 mb-2">
          {isFetching ? "Updating…" : `Total: ${data?.meta.total ?? 0}`}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="table w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 text-left">Order ID</th>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((o: Order) => (
              <tr key={o.id} className="border-t">
                <td className="p-3">#{o.id}</td>
                <td className="p-3">{(o as any).customer?.name || "N/A"}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3">{o.total}</td>
                <td className="p-3">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!data?.data?.length && (
              <tr>
                <td colSpan={5} className="py-6 text-center">
                  No orders yet.
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
    </div>
  );
}

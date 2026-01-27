import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminCustomers } from "../lib/adminApi.js";

export default function Customers() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const params = useMemo(
    () => ({ page, limit, q: debouncedSearch || undefined }),
    [page, limit, debouncedSearch]
  );

  const customersQuery = useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => fetchAdminCustomers(params),
    keepPreviousData: true,
  });

  const payload = customersQuery.data?.data || {};
  const items = payload.items || [];
  const meta = payload.meta || { page, limit, total: items.length };
  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / limit));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-slate-500">Review customer accounts.</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customers"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
      </div>

      {customersQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading customers...
        </div>
      ) : customersQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {customersQuery.error?.response?.data?.message || "Failed to load customers."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No customers found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((customer) => (
                <tr key={customer.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {customer.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{customer.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {customer.phone_number || customer.phone || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("id-ID") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/customers/${customer.id}`}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page <= 1}
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
        >
          Previous
        </button>
        <span className="text-slate-500">
          Page {meta.page} of {totalPages}
        </span>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1"
          disabled={meta.page >= totalPages}
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

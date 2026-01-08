import { useEffect, useMemo, useState } from "react";
import {
  fetchCustomers,
  exportCustomers,
  deleteCustomer,
} from "../api/adminCustomers";
import type { CustomerRow } from "../api/adminCustomers";
import dayjs from "dayjs";

const PAGE_SIZE = 10;

function Th({ label, onSort }: { label: string; onSort?: () => void }) {
  return (
    <th
      scope="col"
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
    >
      <button
        className="flex items-center gap-1"
        onClick={onSort}
        disabled={!onSort}
      >
        <span>{label}</span>
        {onSort && <span className="text-gray-400">⇅</span>}
      </button>
    </th>
  );
}

export default function AdminCustomersPage() {
  const [data, setData] = useState<CustomerRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "email">(
    "createdAt"
  );
  const [sort, setSort] = useState<"ASC" | "DESC">("DESC");
  const [error, setError] = useState<string | undefined>();

  const query = useMemo(
    () => ({ page, limit, q, from, to, sortBy, sort }),
    [page, limit, q, from, to, sortBy, sort]
  );

  const loadData = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const { data: responseData } = await fetchCustomers(query);
      setData(responseData.data);
      setTotalPages(
        responseData.totalPages ||
          Math.max(1, Math.ceil(responseData.total / responseData.limit))
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e.message || "Failed to fetch customers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData();
    return () => {
      controller.abort();
    };
  }, [query]);

  const onReset = () => {
    setQ("");
    setFrom(undefined);
    setTo(undefined);
    setSortBy("createdAt");
    setSort("DESC");
    setPage(1);
  };

  const onExport = async () => {
    try {
      const resp = await exportCustomers();
      const blob = new Blob([resp.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customers.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e.message || "Failed to export customers"
      );
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?"))
      return;
    try {
      await deleteCustomer(id);
      await loadData(); // Refetch data
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e.message || "Failed to delete customer"
      );
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Customers</h1>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <input
            className="border rounded-md px-3 py-2 w-full"
            placeholder="Search by name/email/phone"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex gap-2">
            <button
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 w-full"
              onClick={onReset}
            >
              Reset
            </button>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full"
              onClick={onExport}
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th label="ID" />
              <Th
                label="Joining Date"
                onSort={() => {
                  setSortBy("createdAt");
                  setSort((s) => (s === "ASC" ? "DESC" : "ASC"));
                }}
              />
              <Th
                label="Name"
                onSort={() => {
                  setSortBy("name");
                  setSort((s) => (s === "ASC" ? "DESC" : "ASC"));
                }}
              />
              <Th
                label="Email"
                onSort={() => {
                  setSortBy("email");
                  setSort((s) => (s === "ASC" ? "DESC" : "ASC"));
                }}
              />
              <Th label="Phone" />
              <Th label="Actions" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && data.length === 0 ? (
              <tr>
                <td className="p-4 text-center" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td className="p-4 text-center" colSpan={6}>
                  No customers found.
                </td>
              </tr>
            ) : (
              data.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {c.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {dayjs(c.joiningDate).format("D MMM YYYY")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.phone || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                    <button
                      title="View"
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </button>
                    <button
                      title="Edit"
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                    <button
                      title="Delete"
                      className="text-red-600 hover:text-red-900"
                      onClick={() => onDelete(c.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            className="border px-3 py-1 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <button
            className="border px-3 py-1 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

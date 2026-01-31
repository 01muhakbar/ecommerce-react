import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStaff, deleteStaff, fetchStaff, updateStaff } from "../../api/adminStaff.ts";
import { useAuth } from "../../auth/useAuth.js";

export default function AdminStaffPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState("");
  const [pendingUpdateId, setPendingUpdateId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "staff",
    isActive: true,
    password: "",
  });
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const params = useMemo(
    () => ({
      page,
      limit,
      q: submittedSearch || undefined,
    }),
    [page, limit, submittedSearch]
  );

  const staffQuery = useQuery({
    queryKey: ["admin-staff", params],
    queryFn: () => fetchStaff(params),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      setIsModalOpen(false);
      setFormError("");
      setFormData({ name: "", email: "", role: "staff", isActive: true, password: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (error) => {
      setFormError(
        error?.response?.data?.message ?? error?.message ?? "Failed to create staff."
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateStaff(id, payload),
    onSuccess: () => {
      setRowError("");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onSettled: () => {
      setPendingUpdateId(null);
    },
    onError: (error) => {
      setRowError(
        error?.response?.data?.message ?? error?.message ?? "Failed to update staff."
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteStaff(id),
    onSuccess: () => {
      setRowError("");
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onSettled: () => {
      setPendingDeleteId(null);
    },
    onError: (error) => {
      setRowError(
        error?.response?.data?.message ?? error?.message ?? "Failed to delete staff."
      );
    },
  });

  const items = staffQuery.data?.rows || [];
  const meta = staffQuery.data || { page: 1, limit, count: 0, totalPages: 1 };
  const totalPages = Math.max(1, Number(meta.totalPages || 1));

  const onSearch = (event) => {
    event.preventDefault();
    setSubmittedSearch(search.trim());
    setPage(1);
  };

  const onOpenModal = () => {
    setIsModalOpen(true);
    setFormError("");
  };

  const onCloseModal = () => {
    if (createMutation.isPending) return;
    setIsModalOpen(false);
  };

  const onToggleActive = (staff) => {
    setRowError("");
    setPendingUpdateId(staff.id);
    updateMutation.mutate({ id: staff.id, payload: { isActive: !staff.isActive } });
  };

  const onAskDelete = (staff) => {
    setRowError("");
    setDeleteTarget(staff);
    setIsDeleteOpen(true);
  };

  const onCancelDelete = () => {
    if (deleteMutation.isPending) return;
    setIsDeleteOpen(false);
    setDeleteTarget(null);
  };

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    setPendingDeleteId(deleteTarget.id);
    deleteMutation.mutate(deleteTarget.id);
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const name = formData.name.trim();
    const email = formData.email.trim();
    const password = formData.password;
    if (!name || !email || !password) {
      setFormError("Name, email, and password are required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFormError("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setFormError("");
    createMutation.mutate({
      name,
      email,
      role: formData.role,
      isActive: formData.isActive,
      password,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-slate-500">View staff accounts.</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={onOpenModal}
        >
          Add Staff
        </button>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search staff"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      {staffQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading staff...
        </div>
      ) : staffQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {staffQuery.error?.response?.data?.message ??
            staffQuery.error?.message ??
            "Failed to load staff."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No staff found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((staff) => {
                const role = String(staff.role || "").toLowerCase();
                const isProtectedRole =
                  role === "admin" ||
                  role === "super_admin" ||
                  role === "super admin" ||
                  role === "super-admin";
                const isSelf =
                  currentUser?.email &&
                  String(currentUser.email).toLowerCase() ===
                    String(staff.email || "").toLowerCase();
                const canDelete = !isProtectedRole && !isSelf;
                const canToggle = !isProtectedRole && !isSelf;
                const isUpdating = pendingUpdateId === staff.id;
                const isDeleting = pendingDeleteId === staff.id;
                return (
                <tr key={staff.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {staff.name || `#${staff.id}`}
                  </td>
                  <td className="px-4 py-3">{staff.email || "-"}</td>
                  <td className="px-4 py-3">{staff.role || "-"}</td>
                  <td className="px-4 py-3">{staff.isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {staff.createdAt
                      ? new Date(staff.createdAt).toLocaleString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                        onClick={() => onToggleActive(staff)}
                        disabled={!canToggle || isUpdating}
                        title={
                          !canToggle
                            ? "Cannot change status for this account."
                            : undefined
                        }
                      >
                        {isUpdating ? "Saving..." : staff.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                        onClick={() => onAskDelete(staff)}
                        disabled={!canDelete || isDeleting}
                        title={
                          !canDelete
                            ? "Cannot delete this account."
                            : undefined
                        }
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rowError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {rowError}
        </div>
      ) : null}

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

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Staff</h2>
              <button
                type="button"
                className="text-sm text-slate-500"
                onClick={onCloseModal}
              >
                Close
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-sm text-slate-600">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Role</label>
                <select
                  value={formData.role}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, role: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
                Active
              </label>

              {formError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {formError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                  onClick={onCloseModal}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isDeleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Delete staff?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This will remove{" "}
              <span className="font-semibold text-slate-900">
                {deleteTarget?.name || deleteTarget?.email || "this staff"}
              </span>
              .
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={onCancelDelete}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
                onClick={onConfirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  updateAdminCoupon,
} from "../../lib/adminApi.js";
import { formatCurrency } from "../../utils/format.js";
import CouponForm from "../../components/admin/CouponForm.jsx";

const formatDiscount = (coupon) => {
  if (!coupon) return "-";
  if (coupon.discountType === "percent") {
    return `${Number(coupon.amount || 0)}%`;
  }
  return formatCurrency(Number(coupon.amount || 0));
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function AdminCouponsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    code: "",
    discountType: "percent",
    amount: "",
    minSpend: "",
    expiresAt: "",
    active: true,
  });

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

  const couponsQuery = useQuery({
    queryKey: ["admin-coupons", params],
    queryFn: () => fetchAdminCoupons(params),
    keepPreviousData: true,
  });

  const createMutation = useMutation({
    mutationFn: createAdminCoupon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setNotice("Coupon created.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAdminCoupon(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setNotice("Coupon updated.");
      setIsFormOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCoupon,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      setNotice("Coupon deleted.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => updateAdminCoupon(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
  });

  const items = couponsQuery.data?.data?.items || [];
  const meta = couponsQuery.data?.data?.meta || { page: 1, limit, total: 0 };
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: "",
      discountType: "percent",
      amount: "",
      minSpend: "",
      expiresAt: "",
      active: true,
    });
    setIsFormOpen(true);
  };

  const openEdit = (coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code || "",
      discountType: coupon.discountType || "percent",
      amount: coupon.amount ?? "",
      minSpend: coupon.minSpend ?? "",
      expiresAt: formatDateInput(coupon.expiresAt),
      active: Boolean(coupon.active),
    });
    setIsFormOpen(true);
  };

  const handleFormChange = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      amount: Number(form.amount || 0),
      minSpend: Number(form.minSpend || 0),
      active: Boolean(form.active),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Coupons</h1>
          <p className="text-sm text-slate-500">Create discounts for store checkout.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          New Coupon
        </button>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search coupon codes"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none md:w-64"
        />
      </div>

      {couponsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading coupons...
        </div>
      ) : couponsQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {couponsQuery.error?.response?.data?.message || "Failed to load coupons."}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No coupons found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min Spend</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((coupon) => (
                <tr key={coupon.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{coupon.code}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDiscount(coupon)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatCurrency(Number(coupon.minSpend || 0))}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {coupon.expiresAt
                      ? new Date(coupon.expiresAt).toLocaleDateString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        toggleMutation.mutate({ id: coupon.id, active: !coupon.active })
                      }
                      className={`rounded-full px-3 py-1 text-xs ${
                        coupon.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {coupon.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(coupon)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete ${coupon.code}?`)) {
                            deleteMutation.mutate(coupon.id);
                          }
                        }}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-600"
                      >
                        Delete
                      </button>
                    </div>
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

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editing ? "Edit Coupon" : "New Coupon"}
              </h2>
              <button type="button" onClick={() => setIsFormOpen(false)}>
                x
              </button>
            </div>
            <CouponForm
              form={form}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              onCancel={() => setIsFormOpen(false)}
              isEdit={Boolean(editing)}
              isSubmitting={createMutation.isLoading || updateMutation.isLoading}
              error={
                createMutation.error?.response?.data?.message ||
                updateMutation.error?.response?.data?.message ||
                ""
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Plus,
  RotateCcw,
  Save,
  TicketPercent,
} from "lucide-react";
import {
  createSellerCoupon,
  listSellerCoupons,
  updateSellerCoupon,
} from "../../api/sellerCoupons.ts";
import {
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerTableCellClass,
  sellerTableHeadCellClass,
  sellerTableWrapClass,
  SellerWorkspaceBadge,
  SellerWorkspaceDetailItem,
  SellerWorkspaceEmptyState,
  SellerWorkspaceNotice,
  SellerWorkspaceSectionCard,
  SellerWorkspaceSectionHeader,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { formatCurrency } from "../../utils/format.js";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

const createFormState = (coupon = null, canManageStatus = true) => ({
  code: coupon?.code || "",
  discountType: coupon?.discountType || "percent",
  amount: coupon?.amount ? String(Number(coupon.amount)) : "",
  minSpend: coupon?.minSpend ? String(Number(coupon.minSpend)) : "",
  startsAt: coupon?.startsAt ? String(coupon.startsAt).slice(0, 10) : "",
  expiresAt: coupon?.expiresAt ? String(coupon.expiresAt).slice(0, 10) : "",
  active: coupon ? Boolean(coupon.active) : Boolean(canManageStatus),
});

const formatDateLabel = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(parsed);
};

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Failed to update seller coupon.";

function CouponStatusBadge({ status }) {
  const tone = status?.tone || "stone";
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {status?.label || "Unknown"}
    </span>
  );
}

export default function SellerCouponsPage() {
  const queryClient = useQueryClient();
  const { sellerContext, workspaceStoreId: storeId } = useSellerWorkspaceRoute();
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canView = permissionKeys.includes("COUPON_VIEW");

  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(createFormState(null));

  const couponsQuery = useQuery({
    queryKey: ["seller", "coupons", storeId],
    queryFn: () => listSellerCoupons(storeId),
    enabled: Boolean(storeId) && canView,
    retry: false,
  });

  const governance = couponsQuery.data?.governance || {};
  const canCreate = Boolean(governance.sellerCanCreate ?? permissionKeys.includes("COUPON_CREATE"));
  const canEdit = Boolean(governance.sellerCanEdit ?? permissionKeys.includes("COUPON_EDIT"));
  const canManageStatus = Boolean(
    governance.sellerCanManageStatus ?? permissionKeys.includes("COUPON_STATUS_MANAGE")
  );
  const items = Array.isArray(couponsQuery.data?.items) ? couponsQuery.data.items : [];
  const editingCoupon = items.find((coupon) => Number(coupon.id) === Number(editingId)) || null;
  const effectiveStore = couponsQuery.data?.store || sellerContext?.store || null;
  const formMode = editingCoupon ? "edit" : "create";

  useEffect(() => {
    setForm(createFormState(editingCoupon, canManageStatus));
  }, [editingCoupon, canManageStatus]);

  const createMutation = useMutation({
    mutationFn: (payload) => createSellerCoupon(storeId, payload),
    onSuccess: async () => {
      setNotice({ type: "success", message: "Store coupon created." });
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) => setNotice({ type: "error", message: getErrorMessage(error) }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ couponId, payload }) => updateSellerCoupon(storeId, couponId, payload),
    onSuccess: async () => {
      setNotice({ type: "success", message: "Store coupon updated." });
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) => setNotice({ type: "error", message: getErrorMessage(error) }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ couponId, active }) => updateSellerCoupon(storeId, couponId, { active }),
    onSuccess: async (_data, variables) => {
      setNotice({
        type: "success",
        message: variables.active ? "Coupon activated." : "Coupon deactivated.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "coupons", storeId] });
    },
    onError: (error) => setNotice({ type: "error", message: getErrorMessage(error) }),
  });

  const isBusy =
    createMutation.isPending || updateMutation.isPending || toggleMutation.isPending;

  const buildPayload = () => ({
    code: String(form.code || "").trim().toUpperCase(),
    discountType: form.discountType,
    amount: Number(form.amount || 0),
    minSpend: Number(form.minSpend || 0),
    startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : null,
    expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
    active: canManageStatus ? Boolean(form.active) : true,
  });

  const formReady = useMemo(
    () => String(form.code || "").trim() && Number(form.amount || 0) > 0,
    [form]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(createFormState(null, canManageStatus));
  };

  if (!canView) {
    return (
      <SellerWorkspaceSectionCard
        title="Coupon access is unavailable"
        hint="Your current seller access does not include store coupon visibility."
        Icon={TicketPercent}
      />
    );
  }

  if (couponsQuery.isLoading) {
    return (
      <SellerWorkspaceSectionCard
        title="Loading store coupons"
        hint="Fetching store-scoped coupons for the active seller workspace."
        Icon={TicketPercent}
      />
    );
  }

  if (couponsQuery.isError) {
    return (
      <SellerWorkspaceSectionCard
        title="Failed to load seller coupons"
        hint={getSellerRequestErrorMessage(couponsQuery.error, {
          permissionMessage: "Your current seller access does not include this coupon module.",
          fallbackMessage: "Failed to load seller coupons.",
        })}
        Icon={TicketPercent}
      />
    );
  }

  return (
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Store Coupons"
        title="Seller coupon baseline"
        description="This lane manages only store-scoped coupons for the active store. Platform coupons stay under admin authority, and storefront validation remains scope-aware."
        actions={[
          <SellerWorkspaceBadge key="scope" label="STORE only" tone="teal" />,
          <SellerWorkspaceBadge
            key="count"
            label={`${items.length} coupon${items.length === 1 ? "" : "s"}`}
            tone="stone"
          />,
        ]}
      />

      {notice ? (
        <SellerWorkspaceNotice type={notice.type === "error" ? "error" : "success"}>
          {notice.message}
        </SellerWorkspaceNotice>
      ) : null}

      <section className="grid gap-3.5 lg:grid-cols-3">
        <SellerWorkspaceSectionCard
          title="Store Scope"
          hint="Seller coupon lane is hard-bound to the active store from workspace context."
          Icon={BadgeCheck}
        >
          <div className="grid gap-3">
            <SellerWorkspaceDetailItem
              label="Store"
              value={effectiveStore?.name || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Store Slug"
              value={effectiveStore?.slug || "-"}
            />
            <SellerWorkspaceDetailItem
              label="Governance"
              value="Seller-owned / admin-governed"
              hint={governance.adminAuthority || "Admin can still view and manage these coupons from the admin lane."}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Seller Permissions"
          hint="Permission boundary stays aligned with the active seller role."
          Icon={BadgeCheck}
        >
          <div className="flex flex-wrap gap-2">
            <SellerWorkspaceBadge label={canCreate ? "Create" : "Create locked"} tone={canCreate ? "emerald" : "stone"} />
            <SellerWorkspaceBadge label={canEdit ? "Edit" : "Edit locked"} tone={canEdit ? "emerald" : "stone"} />
            <SellerWorkspaceBadge
              label={canManageStatus ? "Status manage" : "Status locked"}
              tone={canManageStatus ? "emerald" : "stone"}
            />
          </div>
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title="Storefront Boundary"
          hint="Public validation still uses the shared coupon foundation."
          Icon={TicketPercent}
        >
          <SellerWorkspaceNotice type="info">
            {items[0]?.governance?.storefrontBoundary ||
              "Storefront only accepts these coupons for this linked store and within the valid active window."}
          </SellerWorkspaceNotice>
        </SellerWorkspaceSectionCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <SellerWorkspaceSectionCard
          title="Store Coupon List"
          hint="Only coupons bound to the active store are visible here."
          Icon={TicketPercent}
        >
          {items.length === 0 ? (
            <SellerWorkspaceEmptyState
              title="No store coupons yet"
              description={
                canCreate
                  ? "Create the first store-scoped coupon for this active seller workspace."
                  : "This store has no coupons yet and your current seller role cannot create one."
              }
              action={
                canCreate ? (
                  <button
                    type="button"
                    className={sellerPrimaryButtonClass}
                    onClick={resetForm}
                  >
                    <Plus className="h-4 w-4" />
                    New Coupon
                  </button>
                ) : null
              }
              icon={<TicketPercent className="h-5 w-5" />}
            />
          ) : (
            <div className={sellerTableWrapClass}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={sellerTableHeadCellClass}>Coupon</th>
                      <th className={sellerTableHeadCellClass}>Discount</th>
                      <th className={sellerTableHeadCellClass}>Window</th>
                      <th className={sellerTableHeadCellClass}>Status</th>
                      <th className={`${sellerTableHeadCellClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((coupon) => (
                      <tr key={coupon.id} className="border-t border-slate-100">
                        <td className={sellerTableCellClass}>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">{coupon.code}</p>
                            <p className="text-xs text-slate-500">
                              Store #{coupon.storeId} · {coupon.scopeType}
                            </p>
                          </div>
                        </td>
                        <td className={sellerTableCellClass}>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900">
                              {coupon.discountType === "percent"
                                ? `${Number(coupon.amount)}%`
                                : formatCurrency(Number(coupon.amount || 0))}
                            </p>
                            <p className="text-xs text-slate-500">
                              {Number(coupon.minSpend || 0) > 0
                                ? `Min ${formatCurrency(Number(coupon.minSpend || 0))}`
                                : "No minimum"}
                            </p>
                          </div>
                        </td>
                        <td className={sellerTableCellClass}>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-900">
                              {formatDateLabel(coupon.startsAt)} - {formatDateLabel(coupon.expiresAt)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {coupon.status?.description || "Storefront validation follows the active window."}
                            </p>
                          </div>
                        </td>
                        <td className={sellerTableCellClass}>
                          <CouponStatusBadge status={coupon.status} />
                        </td>
                        <td className={`${sellerTableCellClass} text-right`}>
                          <div className="flex justify-end gap-2">
                            {canEdit ? (
                              <button
                                type="button"
                                className={sellerSecondaryButtonClass}
                                onClick={() => setEditingId(coupon.id)}
                                disabled={isBusy}
                              >
                                Edit
                              </button>
                            ) : null}
                            {canManageStatus ? (
                              <button
                                type="button"
                                className={sellerSecondaryButtonClass}
                                onClick={() =>
                                  toggleMutation.mutate({
                                    couponId: coupon.id,
                                    active: !coupon.active,
                                  })
                                }
                                disabled={isBusy}
                              >
                                {coupon.active ? "Deactivate" : "Activate"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SellerWorkspaceSectionCard>

        <SellerWorkspaceSectionCard
          title={formMode === "edit" ? "Edit Store Coupon" : "Create Store Coupon"}
          hint="Seller can only create and update store-scoped coupons for the active store."
          Icon={Plus}
        >
          {!canCreate && !editingCoupon ? (
            <SellerWorkspaceNotice type="warning">
              Your current seller role cannot create store coupons.
            </SellerWorkspaceNotice>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Coupon Code
                  </span>
                  <input
                    className={`${sellerFieldClass} mt-2`}
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value.toUpperCase().replace(/\s+/g, ""),
                      }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Discount Type
                  </span>
                  <select
                    className={`${sellerFieldClass} mt-2`}
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, discountType: event.target.value }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Discount Value
                  </span>
                  <input
                    type="number"
                    min="0"
                    className={`${sellerFieldClass} mt-2`}
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, amount: event.target.value }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Minimum Spend
                  </span>
                  <input
                    type="number"
                    min="0"
                    className={`${sellerFieldClass} mt-2`}
                    value={form.minSpend}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, minSpend: event.target.value }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Start Date
                  </span>
                  <input
                    type="date"
                    className={`${sellerFieldClass} mt-2`}
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startsAt: event.target.value }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    End Date
                  </span>
                  <input
                    type="date"
                    className={`${sellerFieldClass} mt-2`}
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, expiresAt: event.target.value }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                </label>
              </div>

              {canManageStatus ? (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.active)}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.checked }))
                    }
                    disabled={isBusy || (formMode === "create" ? !canCreate : !canEdit)}
                  />
                  Active on save
                </label>
              ) : (
                <SellerWorkspaceNotice type="info">
                  Coupon status stays unchanged here because your current seller role cannot manage activation.
                </SellerWorkspaceNotice>
              )}

              <SellerWorkspaceNotice type="info">
                Seller coupons are always created as `STORE` coupons and automatically bound to the active store. Platform coupon ownership stays in admin workspace.
              </SellerWorkspaceNotice>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={sellerSecondaryButtonClass}
                  onClick={resetForm}
                  disabled={isBusy}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="button"
                  className={sellerPrimaryButtonClass}
                  onClick={() => {
                    setNotice(null);
                    if (formMode === "edit" && editingCoupon) {
                      updateMutation.mutate({
                        couponId: editingCoupon.id,
                        payload: buildPayload(),
                      });
                      return;
                    }
                    createMutation.mutate(buildPayload());
                  }}
                  disabled={
                    isBusy ||
                    !formReady ||
                    (formMode === "create" ? !canCreate : !canEdit)
                  }
                >
                  <Save className="h-4 w-4" />
                  {formMode === "edit"
                    ? updateMutation.isPending
                      ? "Saving..."
                      : "Save Changes"
                    : createMutation.isPending
                      ? "Creating..."
                      : "Create Coupon"}
                </button>
              </div>
            </div>
          )}
        </SellerWorkspaceSectionCard>
      </section>
    </div>
  );
}

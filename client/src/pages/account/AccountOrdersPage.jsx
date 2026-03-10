import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/axios.ts";
import { getStoreCustomization } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  normalizeOrderStatus,
} from "../../utils/orderStatus.js";
import {
  CheckoutModeBadge,
  PaymentStatusBadge,
} from "../../components/payments/PaymentReadModelBadges.jsx";

const fetchOrders = async (page) => {
  const { data } = await api.get("/store/my/orders", {
    params: { page },
  });
  return data;
};

const money = (value) => formatCurrency(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getOrderDateValue = (order) =>
  order?.createdAt || order?.created_at || order?.orderTime || null;

const getOrderRef = (order) => order?.invoiceNo || order?.orderId || order?.id || null;

const toText = (value, fallback) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeDashboardSettingCopy = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object" ? source.dashboard : {};
  return {
    myOrderValue: toText(dashboard.myOrderValue, "My Orders"),
  };
};

export default function AccountOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dashboardSettingQuery = useQuery({
    queryKey: ["store-customization", "dashboard-setting", "en"],
    queryFn: () => getStoreCustomization({ lang: "en", include: "dashboardSetting" }),
    staleTime: 60_000,
  });
  const dashboardSettingCopy = normalizeDashboardSettingCopy(
    dashboardSettingQuery.data?.customization?.dashboardSetting
  );
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["account", "orders", "my", page],
    queryFn: () => fetchOrders(page),
  });

  const response = data ?? {};
  const orders = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  const meta = response?.meta || response?.pagination || response?.pageInfo || null;
  const totalPages =
    meta?.totalPages ??
    meta?.total_pages ??
    meta?.lastPage ??
    meta?.totalPage ??
    null;
  const hasNext =
    typeof meta?.hasNext === "boolean"
      ? meta.hasNext
      : typeof totalPages === "number"
        ? page < totalPages
        : true;
  const hasPrev = page > 1;

  const getStatusUI = (status) => {
    const normalized = normalizeOrderStatus(status);
    switch (normalized) {
      case "pending":
        return { label: "Pending", dot: "bg-amber-500", text: "text-amber-700" };
      case "processing":
        return { label: "Processing", dot: "bg-indigo-500", text: "text-indigo-700" };
      case "shipping":
        return { label: "Shipping", dot: "bg-sky-500", text: "text-sky-700" };
      case "complete":
        return { label: "Delivered", dot: "bg-emerald-500", text: "text-emerald-700" };
      case "cancelled":
        return { label: "Cancel", dot: "bg-rose-500", text: "text-rose-700" };
      default:
        return { label: "Unknown", dot: "bg-slate-400", text: "text-slate-600" };
    }
  };

  const setPage = (nextPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  };

  const isEmpty = !isLoading && !isError && orders.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {dashboardSettingCopy.myOrderValue}
        </h1>
        <div className="text-sm text-slate-500">Page {page}</div>
      </div>
      <div className="mt-4 border-t border-slate-100" />

      {isLoading ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "ORDER ID",
                  "ORDERTIME",
                  "METHOD",
                  "STATUS",
                  "SHIPPING",
                  "SHIPPING COST",
                  "TOTAL",
                  "ACTION",
                ].map((label) => (
                  <th key={label} className="px-5 py-4 font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="animate-pulse">
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="border-t border-slate-100">
                  {Array.from({ length: 8 }).map((__, cellIdx) => (
                    <td key={cellIdx} className="px-5 py-4">
                      <div className="h-3 w-full rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : isError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error?.response?.status === 401 ? (
            <>
              Please login.{" "}
              <Link to="/auth/login" className="font-medium text-rose-700 underline">
                Go to login
              </Link>
            </>
          ) : (
            "Failed to load orders."
          )}
        </div>
      ) : isEmpty ? (
        <div className="mt-6 rounded-xl border border-slate-200 p-6 text-sm text-slate-600">
          No orders found.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">ORDER ID</th>
                  <th className="px-5 py-4 font-semibold">ORDERTIME</th>
                  <th className="px-5 py-4 font-semibold">METHOD</th>
                  <th className="px-5 py-4 font-semibold">STATUS</th>
                  <th className="px-5 py-4 font-semibold">SHIPPING</th>
                  <th className="px-5 py-4 font-semibold">SHIPPING COST</th>
                  <th className="px-5 py-4 font-semibold">TOTAL</th>
                  <th className="px-5 py-4 text-right font-semibold">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const orderRef = getOrderRef(order);
                  const statusUI = getStatusUI(order.status);
                  const shippingProvider =
                    order.shippingProvider || order.shipping?.provider || "-";
                  const shippingCostRaw =
                    order.shippingCost ?? order.shipping?.cost ?? order.deliveryFee ?? null;
                  const totalAmount = order.totalAmount ?? order.total ?? 0;
                  const paymentMethod = order.paymentMethod || order.method || "COD";
                  return (
                    <tr key={order.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{orderRef || `#${order.id}`}</div>
                        <div className="mt-2">
                          <CheckoutModeBadge mode={order.checkoutMode} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {formatDate(getOrderDateValue(order))}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{paymentMethod || "-"}</td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <span className="flex items-center text-sm font-medium">
                            <span className={`h-2 w-2 rounded-full ${statusUI.dot}`} />
                            <span className={`ml-2 ${statusUI.text}`}>{statusUI.label}</span>
                          </span>
                          <PaymentStatusBadge status={order.paymentStatus} prefix="Payment" />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{shippingProvider}</td>
                      <td className="px-5 py-4 text-slate-700">
                        {shippingCostRaw != null && shippingCostRaw !== ""
                          ? money(shippingCostRaw)
                          : "-"}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {money(totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {orderRef ? (
                          <Link
                            to={`/order/${encodeURIComponent(orderRef)}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View order</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={!hasPrev}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        <div className="text-sm text-slate-500">Page {page}</div>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={!hasNext}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

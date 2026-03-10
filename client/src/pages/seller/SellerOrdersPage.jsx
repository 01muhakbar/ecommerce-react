import { useMemo } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingBag } from "lucide-react";
import { getSellerSuborders } from "../../api/sellerOrders.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

const STATUS_CLASS = {
  UNPAID: "border-stone-200 bg-stone-100 text-stone-700",
  PENDING_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-800",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  FAILED: "border-rose-200 bg-rose-50 text-rose-700",
  EXPIRED: "border-stone-300 bg-stone-200 text-stone-700",
  CANCELLED: "border-stone-300 bg-stone-200 text-stone-700",
  UNFULFILLED: "border-stone-200 bg-stone-100 text-stone-700",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-700",
  SHIPPED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const getStatusClass = (value) =>
  STATUS_CLASS[String(value || "").toUpperCase()] ||
  "border-stone-200 bg-stone-100 text-stone-700";

const formatMoney = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function StatusChip({ value }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
        value
      )}`}
    >
      {String(value || "-")}
    </span>
  );
}

export default function SellerOrdersPage() {
  const { storeId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const paymentStatus = String(searchParams.get("paymentStatus") || "").trim();
  const fulfillmentStatus = String(searchParams.get("fulfillmentStatus") || "").trim();
  const keyword = String(searchParams.get("keyword") || "").trim();
  const hasOrderPermission = sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW");

  const ordersQuery = useQuery({
    queryKey: [
      "seller",
      "suborders",
      storeId,
      {
        page,
        paymentStatus,
        fulfillmentStatus,
        keyword,
      },
    ],
    queryFn: () =>
      getSellerSuborders(storeId, {
        page,
        limit: 10,
        paymentStatus: paymentStatus || undefined,
        fulfillmentStatus: fulfillmentStatus || undefined,
        keyword: keyword || undefined,
      }),
    enabled: Boolean(storeId) && hasOrderPermission,
    retry: false,
  });

  const items = Array.isArray(ordersQuery.data?.items) ? ordersQuery.data.items : [];
  const pagination = ordersQuery.data?.pagination ?? { page: 1, limit: 10, total: 0 };
  const totalPages = Math.max(1, Math.ceil(Number(pagination.total || 0) / Number(pagination.limit || 10)));

  const activeFilters = useMemo(
    () =>
      [
        paymentStatus ? `Payment: ${paymentStatus}` : null,
        fulfillmentStatus ? `Fulfillment: ${fulfillmentStatus}` : null,
        keyword ? `Keyword: ${keyword}` : null,
      ].filter(Boolean),
    [paymentStatus, fulfillmentStatus, keyword]
  );

  const patchSearch = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch)) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  if (!hasOrderPermission) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include order visibility.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#fef3c7_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Seller Orders
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Read-only suborder overview
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This module only shows suborders belonging to the current store. All access stays
              tenant-scoped and enforced by the backend seller access resolver.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Payment
              </span>
              <select
                value={paymentStatus}
                onChange={(event) => patchSearch({ paymentStatus: event.target.value, page: 1 })}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
              >
                <option value="">All</option>
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING_CONFIRMATION">PENDING_CONFIRMATION</option>
                <option value="PAID">PAID</option>
                <option value="FAILED">FAILED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Fulfillment
              </span>
              <select
                value={fulfillmentStatus}
                onChange={(event) =>
                  patchSearch({ fulfillmentStatus: event.target.value, page: 1 })
                }
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700"
              >
                <option value="">All</option>
                <option value="UNFULFILLED">UNFULFILLED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Search
              </span>
              <div className="flex items-center rounded-2xl border border-stone-200 bg-white px-4">
                <Search className="h-4 w-4 text-stone-400" />
                <input
                  value={keyword}
                  onChange={(event) => patchSearch({ keyword: event.target.value, page: 1 })}
                  placeholder="Suborder or buyer"
                  className="h-12 w-full bg-transparent px-3 text-sm outline-none"
                />
              </div>
            </label>
          </div>
        </div>
      </section>

      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((item) => (
            <span
              key={item}
              className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {ordersQuery.isLoading ? (
        <section className={cardClass}>
          <p className="text-sm text-stone-500">Loading seller suborders...</p>
        </section>
      ) : null}

      {ordersQuery.isError ? (
        <section className={cardClass}>
          <p className="text-sm text-rose-600">
            {ordersQuery.error?.response?.data?.message ||
              ordersQuery.error?.message ||
              "Failed to load seller suborders."}
          </p>
        </section>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length === 0 ? (
        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">No suborders found</h3>
              <p className="mt-1 text-sm text-stone-500">
                This store does not have suborders matching the current filters yet.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.isError && items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.suborderId} className={cardClass}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                      {item.suborderNumber}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-stone-950">
                      Order {item.orderNumber}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip value={item.paymentStatus} />
                    <StatusChip value={item.fulfillmentStatus} />
                  </div>
                  <div className="grid gap-3 text-sm text-stone-600 sm:grid-cols-2 xl:grid-cols-4">
                    <p>
                      <span className="font-semibold text-stone-900">Buyer:</span>{" "}
                      {item.buyer?.name || "-"}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Items:</span> {item.itemCount}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Total:</span>{" "}
                      {formatMoney(item.totalAmount)}
                    </p>
                    <p>
                      <span className="font-semibold text-stone-900">Created:</span>{" "}
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600 xl:w-[280px]">
                  <p className="font-semibold text-stone-900">Payment Summary</p>
                  <p className="mt-2">
                    Status:{" "}
                    <span className="font-semibold text-stone-900">
                      {item.paymentSummary?.status || "No payment yet"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Reference:{" "}
                    <span className="font-medium text-stone-900">
                      {item.paymentSummary?.internalReference || "-"}
                    </span>
                  </p>
                  <p className="mt-1">
                    Proof Review:{" "}
                    <span className="font-medium text-stone-900">
                      {item.paymentSummary?.proof?.reviewStatus || "-"}
                    </span>
                  </p>

                  <Link
                    to={`/seller/stores/${storeId}/orders/${item.suborderId}`}
                    className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
                  >
                    View detail
                  </Link>
                </div>
              </div>
            </article>
          ))}

          <section className="flex items-center justify-between gap-3 rounded-[22px] border border-stone-200 bg-white px-5 py-4">
            <p className="text-sm text-stone-500">
              Page {pagination.page} of {totalPages} • {pagination.total} suborders
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => patchSearch({ page: Math.max(1, pagination.page - 1) })}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= totalPages}
                onClick={() => patchSearch({ page: Math.min(totalPages, pagination.page + 1) })}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

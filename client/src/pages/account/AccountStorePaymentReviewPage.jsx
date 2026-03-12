import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSellerSuborders,
  reviewSellerPayment,
} from "../../api/sellerPayments.ts";
import { formatCurrency } from "../../utils/format.js";

const FILTERS = [
  { value: "PENDING_CONFIRMATION", label: "Pending Confirmation" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
];

const statusBadgeClass = (status = "") => {
  const value = String(status || "").toUpperCase().trim();
  if (value === "PAID") return "bg-emerald-100 text-emerald-700";
  if (value === "PENDING_CONFIRMATION") return "bg-amber-100 text-amber-700";
  if (value === "FAILED" || value === "REJECTED") return "bg-rose-100 text-rose-700";
  if (value === "EXPIRED") return "bg-orange-100 text-orange-700";
  if (value === "CANCELLED") return "bg-slate-200 text-slate-700";
  if (value === "UNPAID" || value === "CREATED") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-600";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const normalizeScopeOptions = (error) => {
  const stores = error?.response?.data?.stores;
  if (!Array.isArray(stores)) return [];
  return stores
    .map((store) => ({
      id: Number(store?.id || 0),
      name: String(store?.name || "").trim() || "Store",
      slug: String(store?.slug || "").trim() || null,
      roleCode: String(store?.roleCode || "").trim() || "-",
      isOwner: Boolean(store?.isOwner),
      canReview: Boolean(store?.canReview),
    }))
    .filter((store) => Number.isInteger(store.id) && store.id > 0);
};

export default function AccountStorePaymentReviewPage({ mode = "account" }) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("PENDING_CONFIRMATION");
  const [notes, setNotes] = useState({});
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const isAdminMode = mode === "admin";
  const contextLabel = isAdminMode ? "Online Store" : "Seller Workspace";
  const backToStorePayment = isAdminMode
    ? "/admin/online-store/store-payment"
    : "/user/store-payment-profile";

  const reviewQuery = useQuery({
    queryKey: ["seller", "suborders", "review", activeFilter, selectedStoreId || "legacy"],
    queryFn: () =>
      fetchSellerSuborders(activeFilter, {
        storeId: selectedStoreId,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ paymentId, payload, storeId }) =>
      reviewSellerPayment(paymentId, payload, { storeId }),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "suborders"] }),
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment"] }),
        queryClient.invalidateQueries({ queryKey: ["payment", variables.paymentId] }),
      ]);
      setNotes((prev) => ({ ...prev, [variables.paymentId]: "" }));
    },
  });

  const handleReview = async (paymentId, action, storeId) => {
    const note = String(notes[paymentId] || "").trim();
    await reviewMutation.mutateAsync({
      paymentId,
      storeId: storeId || selectedStoreId || null,
      payload: {
        action,
        note: note || null,
      },
    });
  };

  if (reviewQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading seller payment reviews...
      </div>
    );
  }

  if (reviewQuery.isError) {
    const storeScopeOptions = normalizeScopeOptions(reviewQuery.error);
    const needsStoreScope =
      String(reviewQuery.error?.response?.data?.code || "").toUpperCase() ===
      "SELLER_STORE_SCOPE_REQUIRED";

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {reviewQuery.error?.response?.data?.message ||
            reviewQuery.error?.message ||
            "Failed to load seller payment reviews."}
        </div>
        {needsStoreScope && storeScopeOptions.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Select store scope</p>
            <p className="mt-1 text-sm text-slate-500">
              This legacy review page needs an explicit store scope before loading payment proofs.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {storeScopeOptions.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedStoreId(store.id)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {store.name} • {store.roleCode}
                  {store.canReview ? "" : " • Read only"}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const data = reviewQuery.data || { store: null, governance: null, items: [] };
  const store = data.store;
  const governance = data.governance || null;
  const actorCanReview = Boolean(governance?.canReview);
  const items = Array.isArray(data.items) ? data.items : [];

  if (!store) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-500">{contextLabel}</p>
          <h1 className="text-2xl font-semibold text-slate-900">Store Payment Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            This account does not have a linked store yet.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Set up a store and payment profile first before reviewing buyer payments.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{contextLabel}</p>
          <h1 className="text-2xl font-semibold text-slate-900">Store Payment Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review manual QRIS proof submissions for <span className="font-semibold text-slate-900">{store.name}</span>.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {store.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
          Scope: {store.name}
        </span>
        {governance?.roleCode ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            Role: {governance.roleCode}
          </span>
        ) : null}
        {selectedStoreId ? (
          <button
            type="button"
            onClick={() => setSelectedStoreId(null)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear scope
          </button>
        ) : null}
      </div>

      {governance?.note ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {governance.note}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveFilter(filter.value)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              activeFilter === filter.value
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          No payment records found for the selected status.
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((entry) => {
          const payment = entry.payment;
          const proof = payment?.proof;
          const reviewLocked =
            !actorCanReview ||
            !payment?.id ||
            String(payment?.status || "").toUpperCase() !== "PENDING_CONFIRMATION" ||
            String(proof?.reviewStatus || "").toUpperCase() !== "PENDING";
          const isMutating =
            reviewMutation.isPending && reviewMutation.variables?.paymentId === payment?.id;

          return (
            <section
              key={entry.suborderId}
              className="rounded-3xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{entry.suborderNumber}</h2>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                        payment?.status || entry.paymentStatus
                      )}`}
                    >
                      {payment?.status || entry.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Order {entry.orderNumber} • Buyer {entry.buyer.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Created {formatDateTime(entry.createdAt)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment Amount
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(payment?.amount || entry.totalAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Buyer
                      </p>
                      <div className="mt-3 space-y-1.5 text-slate-700">
                        <p className="font-semibold text-slate-900">{entry.buyer.name}</p>
                        {entry.buyer.email ? <p>{entry.buyer.email}</p> : null}
                        {entry.buyer.phone ? <p>{entry.buyer.phone}</p> : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment
                      </p>
                      <div className="mt-3 space-y-1.5 text-slate-700">
                        <p>Reference: {payment?.internalReference || "-"}</p>
                        <p>Channel: {payment?.paymentChannel || "-"}</p>
                        <p>Paid At: {formatDateTime(payment?.paidAt)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Items
                    </p>
                    <div className="mt-3 space-y-3">
                      {entry.items.map((item) => (
                        <div
                          key={`${entry.suborderId}-${item.id || item.productId}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-xs text-slate-500">
                              {item.qty} × {formatCurrency(item.price)}
                            </p>
                          </div>
                          <div className="font-semibold text-slate-900">
                            {formatCurrency(item.totalPrice)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Proof Summary
                    </p>
                    {proof ? (
                      <div className="mt-3 space-y-2">
                        <p>
                          <span className="font-semibold text-slate-900">Sender:</span>{" "}
                          {proof.senderName}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Wallet/Bank:</span>{" "}
                          {proof.senderBankOrWallet}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Amount:</span>{" "}
                          {formatCurrency(proof.transferAmount)}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Transfer Time:</span>{" "}
                          {formatDateTime(proof.transferTime)}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Review Status:</span>{" "}
                          {proof.reviewStatus}
                        </p>
                        {proof.note ? (
                          <p>
                            <span className="font-semibold text-slate-900">Buyer Note:</span>{" "}
                            {proof.note}
                          </p>
                        ) : null}
                        {proof.reviewNote ? (
                          <p>
                            <span className="font-semibold text-slate-900">Review Note:</span>{" "}
                            {proof.reviewNote}
                          </p>
                        ) : null}
                        {proof.reviewedAt ? (
                          <p>
                            <span className="font-semibold text-slate-900">Reviewed At:</span>{" "}
                            {formatDateTime(proof.reviewedAt)}
                          </p>
                        ) : null}
                        {proof.proofImageUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
                            <img
                              src={proof.proofImageUrl}
                              alt={`Payment proof ${entry.suborderNumber}`}
                              className="mx-auto max-h-60 w-full object-contain"
                            />
                            <a
                              href={proof.proofImageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex text-sm font-semibold text-emerald-700 underline"
                            >
                              Open proof image
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-slate-500">No proof submitted for this payment.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Review Note
                    </label>
                    <textarea
                      value={notes[payment?.id] || ""}
                      onChange={(event) =>
                        setNotes((prev) => ({
                          ...prev,
                          [payment?.id]: event.target.value,
                        }))
                      }
                      disabled={!payment?.id || isMutating}
                      placeholder="Optional note for approve/reject action"
                      className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none disabled:bg-slate-100"
                    />

                    {reviewMutation.isError && reviewMutation.variables?.paymentId === payment?.id ? (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {reviewMutation.error?.response?.data?.message ||
                          reviewMutation.error?.message ||
                          "Failed to review payment."}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={reviewLocked || isMutating}
                        onClick={() => handleReview(payment?.id, "APPROVE", entry.storeId)}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isMutating ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={reviewLocked || isMutating}
                        onClick={() => handleReview(payment?.id, "REJECT", entry.storeId)}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isMutating ? "Saving..." : "Reject"}
                      </button>
                    </div>

                    {reviewLocked ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {actorCanReview
                          ? (
                              <>
                                Review actions are available only while payment is in{" "}
                                <span className="font-semibold text-slate-900">PENDING_CONFIRMATION</span>{" "}
                                with a pending proof.
                              </>
                            )
                          : "This seller role can view payment review data, but mutation remains read-only for this store scope."}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to={backToStorePayment}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Store Payment Profile
        </Link>
      </div>
    </div>
  );
}

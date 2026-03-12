import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, ImageIcon } from "lucide-react";
import {
  getSellerPaymentReviewSuborders,
  reviewSellerStorePayment,
} from "../../api/sellerPayments.ts";
import { formatCurrency } from "../../utils/format.js";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";
import {
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerTextareaClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceFilterBar,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatePanel,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";

const FILTERS = [
  { value: "PENDING_CONFIRMATION", label: "Awaiting review" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
];

const PAYMENT_TONES = {
  PAID: "emerald",
  PENDING_CONFIRMATION: "amber",
  REJECTED: "rose",
  FAILED: "rose",
  EXPIRED: "stone",
  CANCELLED: "stone",
  UNPAID: "stone",
  CREATED: "sky",
};

const getStatusTone = (value) =>
  PAYMENT_TONES[String(value || "").trim().toUpperCase()] || "stone";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const buildReviewStats = (items) => ({
  total: items.length,
  awaitingReview: items.filter(
    (item) => String(item.payment?.status || item.paymentStatus).toUpperCase() === "PENDING_CONFIRMATION"
  ).length,
  settled: items.filter(
    (item) => String(item.payment?.status || item.paymentStatus).toUpperCase() === "PAID"
  ).length,
});

export default function SellerPaymentReviewPage() {
  const {
    sellerContext,
    workspaceStoreId: storeId,
    workspaceRoutes,
  } = useSellerWorkspaceRoute();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("PENDING_CONFIRMATION");
  const [notes, setNotes] = useState({});
  const hasViewPermission =
    sellerContext?.access?.permissionKeys?.includes("ORDER_VIEW") &&
    sellerContext?.access?.permissionKeys?.includes("PAYMENT_STATUS_VIEW");

  const reviewQuery = useQuery({
    queryKey: ["seller", "payment-review", storeId, activeFilter],
    queryFn: () => getSellerPaymentReviewSuborders(storeId, activeFilter),
    enabled: Boolean(storeId) && hasViewPermission,
    retry: false,
  });

  const items = Array.isArray(reviewQuery.data?.items) ? reviewQuery.data.items : [];
  const governance = reviewQuery.data?.governance ?? null;
  const actorCanReview = Boolean(governance?.canReview);
  const reviewStats = useMemo(() => buildReviewStats(items), [items]);

  const reviewMutation = useMutation({
    mutationFn: ({ paymentId, payload }) => reviewSellerStorePayment(storeId, paymentId, payload),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["seller", "payment-review", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "suborders", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "suborder", "detail", storeId] }),
        queryClient.invalidateQueries({ queryKey: ["account", "order", "payment"] }),
        queryClient.invalidateQueries({ queryKey: ["payment", variables.paymentId] }),
      ]);
      setNotes((prev) => ({ ...prev, [variables.paymentId]: "" }));
    },
  });

  const handleReview = async (paymentId, action) => {
    const note = String(notes[paymentId] || "").trim();
    await reviewMutation.mutateAsync({
      paymentId,
      payload: {
        action,
        note: note || null,
      },
    });
  };

  if (!hasViewPermission) {
    return (
      <SellerWorkspaceStatePanel
        title="Finance review access is unavailable"
        description="Your current seller access does not include seller finance review visibility."
        tone="error"
        Icon={CreditCard}
      />
    );
  }

  if (reviewQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading finance review lane"
        description="Fetching seller-scoped buyer payment proof records for the active store finance lane."
        Icon={CreditCard}
      />
    );
  }

  if (reviewQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load finance review lane"
        description={getSellerRequestErrorMessage(reviewQuery.error, {
          permissionMessage:
            "Your current seller access does not include seller finance review visibility.",
          fallbackMessage: "Failed to load seller finance review lane.",
        })}
        tone="error"
        Icon={CreditCard}
      />
    );
  }

  const store = reviewQuery.data?.store || sellerContext?.store || null;

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Finance"
        title="Payment review"
        description="This native seller finance lane reviews buyer payment proofs inside the active store workspace. Store scope comes directly from the seller route, so there is no multi-store ambiguity here. This lane does not calculate seller payout balance or settlement statements."
        actions={[
          <SellerWorkspaceBadge
            key="scope"
            label={store?.name || sellerContext?.store?.name || `Store #${storeId}`}
            tone="teal"
          />,
          <SellerWorkspaceBadge
            key="mode"
            label={actorCanReview ? "Review enabled" : "Read-only"}
            tone={actorCanReview ? "emerald" : "amber"}
          />,
          governance?.roleCode ? (
            <SellerWorkspaceBadge key="role" label={governance.roleCode} tone="sky" />
          ) : null,
        ].filter(Boolean)}
      >
        <p className="text-sm leading-6 text-slate-500">
          {governance?.note ||
            "Review state is driven by backend governance and remains store-scoped for the active seller finance lane."}
        </p>
      </SellerWorkspaceSectionHeader>

      <section className="grid gap-4 md:grid-cols-3">
        <SellerWorkspaceStatCard
          label="Visible Records"
          value={String(reviewStats.total)}
          hint="Payment review rows for the active filter and current store only."
          Icon={CreditCard}
        />
        <SellerWorkspaceStatCard
          label="Awaiting Review"
          value={String(reviewStats.awaitingReview)}
          hint="Rows whose latest payment snapshot still waits for seller review."
          Icon={BadgeCheck}
          tone="amber"
        />
        <SellerWorkspaceStatCard
          label="Settled"
          value={String(reviewStats.settled)}
          hint={actorCanReview ? "You can process pending proofs from this lane." : "This actor can observe outcomes only."}
          Icon={BadgeCheck}
          tone="emerald"
        />
      </section>

      <SellerWorkspaceFilterBar>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={
                activeFilter === filter.value
                  ? sellerPrimaryButtonClass
                  : sellerSecondaryButtonClass
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
      </SellerWorkspaceFilterBar>

      {!actorCanReview ? (
        <SellerWorkspaceNotice type="warning">
          This seller role can inspect payment review data for the active store, but mutation remains disabled. Store owners and store admins keep review authority in this phase.
        </SellerWorkspaceNotice>
      ) : null}

      {items.length === 0 ? (
        <SellerWorkspaceEmptyState
          title="No payment records match this filter"
          description="Try another payment filter or wait until buyers submit payment proof for this store."
          icon={<CreditCard className="h-5 w-5" />}
        />
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
            <SellerWorkspacePanel key={entry.suborderId} className="p-5 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4 xl:flex-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Seller payment review
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {entry.suborderNumber}
                      </h3>
                      <SellerWorkspaceBadge
                        label={payment?.status || entry.paymentStatus}
                        tone={getStatusTone(payment?.status || entry.paymentStatus)}
                      />
                      {proof?.reviewStatus ? (
                        <SellerWorkspaceBadge
                          label={`Proof ${proof.reviewStatus}`}
                          tone={getStatusTone(proof.reviewStatus)}
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Parent order {entry.orderNumber} • Buyer {entry.buyer.name}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment Snapshot
                      </p>
                      <div className="mt-3 space-y-2">
                        <p>
                          <span className="font-semibold text-slate-900">Amount:</span>{" "}
                          {formatCurrency(payment?.amount || entry.totalAmount)}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Reference:</span>{" "}
                          {payment?.internalReference || "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Channel:</span>{" "}
                          {payment?.paymentChannel || "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Created:</span>{" "}
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Buyer
                      </p>
                      <div className="mt-3 space-y-2">
                        <p className="font-semibold text-slate-900">{entry.buyer.name}</p>
                        <p>{entry.buyer.email || "-"}</p>
                        <p>{entry.buyer.phone || "-"}</p>
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
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{item.productName}</p>
                            <p className="text-xs text-slate-500">
                              {item.qty} x {formatCurrency(item.price)}
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

                <div className="space-y-4 xl:w-[360px]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Proof Summary
                    </p>
                    {proof ? (
                      <div className="mt-3 space-y-2">
                        <p>
                          <span className="font-semibold text-slate-900">Sender:</span>{" "}
                          {proof.senderName || "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-900">Wallet/Bank:</span>{" "}
                          {proof.senderBankOrWallet || "-"}
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
                        {proof.proofImageUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
                            <img
                              src={proof.proofImageUrl}
                              alt={`Payment proof ${entry.suborderNumber}`}
                              className="mx-auto max-h-64 w-full object-contain"
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
                        ) : (
                          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-slate-400">
                            <ImageIcon className="mx-auto h-5 w-5" />
                            <p className="mt-2 text-xs">Proof image is not available.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-slate-500">No proof submitted for this payment.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Review Action
                    </p>
                    {actorCanReview ? (
                      <>
                        <textarea
                          value={notes[payment?.id] || ""}
                          onChange={(event) =>
                            setNotes((prev) => ({
                              ...prev,
                              [payment?.id]: event.target.value,
                            }))
                          }
                          disabled={!payment?.id || isMutating}
                          placeholder="Optional review note for approve or reject"
                          className={`mt-3 h-24 ${sellerTextareaClass}`}
                        />

                        {reviewMutation.isError &&
                        reviewMutation.variables?.paymentId === payment?.id ? (
                          <SellerWorkspaceNotice type="error" className="mt-3">
                            {reviewMutation.error?.response?.data?.message ||
                              reviewMutation.error?.message ||
                              "Failed to review payment."}
                          </SellerWorkspaceNotice>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={reviewLocked || isMutating}
                            onClick={() => handleReview(payment?.id, "APPROVE")}
                            className={sellerPrimaryButtonClass}
                          >
                            {isMutating ? "Saving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={reviewLocked || isMutating}
                            onClick={() => handleReview(payment?.id, "REJECT")}
                            className={sellerSecondaryButtonClass}
                          >
                            {isMutating ? "Saving..." : "Reject"}
                          </button>
                        </div>

                        {reviewLocked ? (
                          <p className="mt-3 text-sm text-slate-500">
                            Review actions are available only while payment is in{" "}
                            <span className="font-semibold text-slate-900">
                              PENDING_CONFIRMATION
                            </span>{" "}
                            and the latest proof is still pending.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <SellerWorkspaceNotice type="warning" className="mt-3">
                        This actor can view the payment proof trail, but review mutation is not available in the current seller role.
                      </SellerWorkspaceNotice>
                    )}

                    <div className="mt-4">
                      <Link
                        to={workspaceRoutes.orderDetail(entry.suborderId)}
                        className={sellerSecondaryButtonClass}
                      >
                        Open seller order detail
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </SellerWorkspacePanel>
          );
        })}
      </div>
    </div>
  );
}

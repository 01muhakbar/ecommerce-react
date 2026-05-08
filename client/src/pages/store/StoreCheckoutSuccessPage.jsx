import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import QueryState from "../../components/primitives/ui/QueryState.jsx";
import {
  fetchStoreOrder,
  createStoreStripeCheckoutSession,
  verifyStoreStripeCheckoutSession,
} from "../../api/public/storeOrders.ts";
import {
  resolvePublicOrderReference,
  isPublicOrderReference,
  buildPublicOrderTrackingPath,
} from "../../utils/publicOrderReference.js";
import {
  getEnabledOrderContractAction,
  getOrderContractMeta,
  getOrderContractSummary,
} from "../../utils/orderContract.ts";
import { getSplitOperationalStatusSummary } from "../../utils/splitOperationalTruth.ts";

const cardClass =
  "mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-8";

const summarizeSplitOperationalTruth = (storeSplits) => {
  const summary = {
    awaitingPaymentCount: 0,
    underReviewCount: 0,
    finalNegativeCount: 0,
    shipmentLaneCount: 0,
  };

  (Array.isArray(storeSplits) ? storeSplits : []).forEach((split) => {
    const splitSummary = getSplitOperationalStatusSummary(split);
    const code = String(splitSummary?.code || "").trim().toUpperCase();
    const lane = String(splitSummary?.lane || "").trim().toUpperCase();
    if (code === "AWAITING_PAYMENT") {
      summary.awaitingPaymentCount += 1;
      return;
    }
    if (code === "UNDER_REVIEW") {
      summary.underReviewCount += 1;
      return;
    }
    if (Boolean(splitSummary?.isFinal) && ["FAILED", "EXPIRED", "CANCELLED", "RETURNED", "FAILED_DELIVERY"].includes(code)) {
      summary.finalNegativeCount += 1;
      return;
    }
    if (lane === "SHIPMENT") {
      summary.shipmentLaneCount += 1;
    }
  });

  return summary;
};

function StripeActionButton({ disabled, busy, onClick, label = "Continue Stripe Payment" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {busy ? "Opening Stripe..." : label}
    </button>
  );
}

export default function StoreCheckoutSuccessPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const refFromParams = resolvePublicOrderReference(
    params.get("invoiceNo"),
    params.get("ref")
  );
  const refFromState = resolvePublicOrderReference(
    location.state?.invoiceNo,
    location.state?.ref,
    location.state?.orderRef
  );
  const orderRef = resolvePublicOrderReference(refFromParams, refFromState);
  const hasOrderRef = isPublicOrderReference(orderRef);
  const trackingPath = buildPublicOrderTrackingPath(orderRef);
  const paymentMethod = String(params.get("method") || location.state?.method || "")
    .trim()
    .toUpperCase();
  const stripeSessionId = String(params.get("session_id") || "").trim();
  const stripeCancelled = params.get("cancelled") === "1";
  const isStripeFlow = paymentMethod === "STRIPE";
  const orderSnapshotQuery = useQuery({
    queryKey: ["store", "checkout-success", "order", orderRef],
    queryFn: () => fetchStoreOrder(orderRef),
    enabled: hasOrderRef && (!isStripeFlow || stripeCancelled || !stripeSessionId),
    retry: false,
  });

  const verifyStripeQuery = useQuery({
    queryKey: ["store", "checkout-success", "stripe", orderRef, stripeSessionId],
    queryFn: () => verifyStoreStripeCheckoutSession(orderRef, stripeSessionId),
    enabled: hasOrderRef && isStripeFlow && Boolean(stripeSessionId),
    retry: false,
  });

  const retryStripeMutation = useMutation({
    mutationFn: () => createStoreStripeCheckoutSession(orderRef),
    onSuccess: (response) => {
      const redirectUrl = String(response?.data?.checkoutRedirectUrl || "").trim();
      if (redirectUrl) {
        window.location.assign(redirectUrl);
      }
    },
  });

  const handleRetryStripe = () => {
    if (!hasOrderRef || retryStripeMutation.isPending) return;
    const existingCheckoutUrl = String(
      verifyStripeQuery.data?.data?.checkoutUrl || ""
    ).trim();
    if (existingCheckoutUrl) {
      window.location.assign(existingCheckoutUrl);
      return;
    }
    retryStripeMutation.mutate();
  };

  const stripeVerification = verifyStripeQuery.data?.data || null;
  const orderSnapshot = orderSnapshotQuery.data?.data || null;
  const orderStoreSplits = Array.isArray(orderSnapshot?.storeSplits) ? orderSnapshot.storeSplits : [];
  const splitTruthSummary = summarizeSplitOperationalTruth(orderStoreSplits);
  const stripeOrderSnapshot = isStripeFlow ? orderSnapshot : null;
  const stripeContract = stripeVerification?.contract || stripeOrderSnapshot?.contract || null;
  const stripeStatusSummary = getOrderContractSummary(stripeContract);
  const stripePaymentMeta =
    getOrderContractMeta(stripeContract, "paymentStatusMeta") ||
    stripeOrderSnapshot?.paymentStatusMeta ||
    null;
  const stripeOrderPaid = String(stripePaymentMeta?.code || stripeOrderSnapshot?.paymentStatus || "")
    .toUpperCase()
    .trim() === "PAID";
  const stripeContinueAction = getEnabledOrderContractAction(
    stripeContract,
    "CONTINUE_STRIPE_PAYMENT"
  );
  const stripePaid =
    Boolean(stripeVerification?.paid) ||
    stripeOrderPaid;
  const orderStatusSummary = getOrderContractSummary(orderSnapshot?.contract);
  const orderPaymentEntry = orderSnapshot?.paymentEntry || null;
  const orderContinueAction = getEnabledOrderContractAction(
    orderSnapshot?.contract,
    "CONTINUE_PAYMENT"
  );
  const nonStripePaymentPath =
    orderPaymentEntry?.visible && orderPaymentEntry?.targetPath
      ? orderPaymentEntry.targetPath
      : orderContinueAction?.targetPath || null;
  const nonStripeStatusLabel = orderStatusSummary?.label || "Order Created";
  const nonStripeOperationalLabel =
    splitTruthSummary.awaitingPaymentCount > 0
      ? "Split Payment Required"
      : splitTruthSummary.underReviewCount > 0
        ? "Split Payment Under Review"
        : splitTruthSummary.finalNegativeCount > 0
          ? "Split Status Updated"
          : nonStripeStatusLabel;
  const nonStripeStatusDescription =
    splitTruthSummary.awaitingPaymentCount > 0
      ? `Pay ${splitTruthSummary.awaitingPaymentCount} store split${splitTruthSummary.awaitingPaymentCount === 1 ? "" : "s"} from your account payment lane. Shipment will stay blocked per split until payment truth is settled.`
      : splitTruthSummary.underReviewCount > 0
        ? `${splitTruthSummary.underReviewCount} store split payment${splitTruthSummary.underReviewCount === 1 ? " is" : "s are"} under review. Wait for backend confirmation before expecting shipment progress.`
        : splitTruthSummary.finalNegativeCount > 0
          ? `${splitTruthSummary.finalNegativeCount} store split${splitTruthSummary.finalNegativeCount === 1 ? " is" : "s are"} already in a closed or failed state. Open tracking or My Orders for the latest per-split truth.`
          : orderStatusSummary?.description ||
            "Your order reference is ready. Continue with the latest backend-approved next step from your account.";
  const nonStripeOrderStatusError =
    orderSnapshotQuery.error?.response?.data?.message ||
    orderSnapshotQuery.error?.message ||
    "We could not load the latest checkout state yet.";
  const stripeActionLabel = stripeContinueAction?.label || "Continue Stripe Payment";
  const stripeVerificationError =
    verifyStripeQuery.error?.response?.data?.message ||
    verifyStripeQuery.error?.message ||
    "We could not verify your Stripe payment yet.";
  const stripeOrderStatusError =
    orderSnapshotQuery.error?.response?.data?.message ||
    orderSnapshotQuery.error?.message ||
    "We could not load the latest order payment status yet.";

  if (!hasOrderRef) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Order Confirmation</h1>
            <p className="mt-1 text-sm text-slate-500">
              We could not detect your order reference from this session.
            </p>
          </div>
          <QueryState
            isLoading={false}
            isError
            error={{ message: "Order reference is missing. We cannot open tracking yet." }}
            isEmpty={false}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/cart"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Cart
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isStripeFlow && stripeSessionId && verifyStripeQuery.isLoading) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600 sm:h-20 sm:w-20">
            <CreditCard className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-sky-600">
            Verifying Payment
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Confirming your Stripe session
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            We are asking the backend to verify the Stripe Checkout result before marking this order as paid.
          </p>
        </div>
      </section>
    );
  }

  if (isStripeFlow && !stripeSessionId && orderSnapshotQuery.isLoading) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600 sm:h-20 sm:w-20">
            <CreditCard className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-sky-600">
            Checking Order Status
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Confirming the latest Stripe payment state
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            The backend is checking whether Stripe already finalized this order through webhook sync.
          </p>
        </div>
      </section>
    );
  }

  if (!isStripeFlow && orderSnapshotQuery.isLoading) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600 sm:h-20 sm:w-20">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-sky-600">
            Checking Order Status
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Confirming the latest checkout state
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            The backend is loading the newest order contract before we show the next action.
          </p>
        </div>
      </section>
    );
  }

  if (!isStripeFlow && orderSnapshotQuery.isError) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            Status Unavailable
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            We could not confirm the latest checkout state
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            {nonStripeOrderStatusError}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
            <Link
              to="/account/orders"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open My Orders
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!isStripeFlow && !orderSnapshot) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            Status Unavailable
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            The latest checkout state is not available
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            We could not load the latest backend order snapshot, so this page will not claim payment or order completion.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
            <Link
              to="/account/orders"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open My Orders
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isStripeFlow && stripeSessionId && verifyStripeQuery.isError) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            Verification Pending
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Stripe payment could not be confirmed yet
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            {stripeVerificationError}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {stripeContinueAction?.enabled ? (
              <StripeActionButton
                onClick={handleRetryStripe}
                disabled={retryStripeMutation.isPending}
                busy={retryStripeMutation.isPending}
                label={stripeContinueAction.label || "Open Stripe Again"}
              />
            ) : null}
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
          </div>
          {!stripeContinueAction?.enabled ? (
            <p className="mt-3 text-center text-sm text-slate-500">
              We could not confirm the latest payment actionability yet. Open tracking for the newest backend status.
            </p>
          ) : null}
          {retryStripeMutation.isError ? (
            <p className="mt-3 text-center text-sm text-rose-600">
              {retryStripeMutation.error?.response?.data?.message ||
                retryStripeMutation.error?.message ||
                "We could not reopen Stripe Checkout."}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (isStripeFlow && !stripeSessionId && orderSnapshotQuery.isError) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            Status Unavailable
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            We could not confirm the latest Stripe order status
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            {stripeOrderStatusError}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {stripeContinueAction?.enabled ? (
              <StripeActionButton
                onClick={handleRetryStripe}
                disabled={retryStripeMutation.isPending}
                busy={retryStripeMutation.isPending}
                label={stripeContinueAction.label || "Continue Stripe Payment"}
              />
            ) : null}
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
          </div>
          {!stripeContinueAction?.enabled ? (
            <p className="mt-3 text-center text-sm text-slate-500">
              We could not confirm the latest payment actionability yet. Open tracking for the newest backend status.
            </p>
          ) : null}
          {retryStripeMutation.isError ? (
            <p className="mt-3 text-center text-sm text-rose-600">
              {retryStripeMutation.error?.response?.data?.message ||
                retryStripeMutation.error?.message ||
                "We could not reopen Stripe Checkout."}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (
    isStripeFlow &&
    !stripePaid &&
    stripeContinueAction?.enabled &&
    (stripeCancelled || Boolean(stripeSessionId) || orderSnapshotQuery.isSuccess)
  ) {
    const description = stripeCancelled
      ? "You returned before completing payment. The order still exists and you can reopen Stripe Checkout."
      : stripeStatusSummary?.description ||
        "This order is still waiting for Stripe payment completion.";
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <CreditCard className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            {stripeStatusSummary?.label || "Payment Incomplete"}
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Continue Stripe payment
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            {description}
          </p>
          <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Order Reference
            </p>
            <p className="mt-2 break-all rounded-xl border border-amber-200 bg-white px-3 py-2.5 font-mono text-lg font-bold text-slate-900 sm:text-2xl">
              {orderRef}
            </p>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <StripeActionButton
              onClick={handleRetryStripe}
              disabled={retryStripeMutation.isPending}
              busy={retryStripeMutation.isPending}
              label={stripeActionLabel}
            />
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
          </div>
          {retryStripeMutation.isError ? (
            <p className="mt-3 text-center text-sm text-rose-600">
              {retryStripeMutation.error?.response?.data?.message ||
                retryStripeMutation.error?.message ||
                "We could not reopen Stripe Checkout."}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (
    isStripeFlow &&
    !stripePaid &&
    !stripeContinueAction?.enabled &&
    (stripeCancelled || Boolean(stripeSessionId) || orderSnapshotQuery.isSuccess)
  ) {
    return (
      <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <div className={cardClass}>
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 sm:h-20 sm:w-20">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-center text-sm font-semibold uppercase tracking-[0.14em] text-amber-600">
            {stripeStatusSummary?.label || "Payment unavailable"}
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Stripe payment is not actionable
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500 sm:text-base">
            {stripeStatusSummary?.description ||
              "The backend no longer allows this Stripe payment to continue from the current state."}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={trackingPath}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Track Order
            </Link>
            <Link
              to="/account/orders"
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open My Orders
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1100px] px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:h-20 sm:w-20">
            <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-600">
            {isStripeFlow
              ? stripeStatusSummary?.label || "Payment Confirmed"
              : nonStripeOperationalLabel}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {isStripeFlow
              ? "Stripe payment completed"
              : splitTruthSummary.underReviewCount > 0
                ? "Payment Review In Progress"
                : nonStripePaymentPath
                ? "Continue Payment From Your Account"
                : "Order status updated"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500 sm:text-base">
            {isStripeFlow
              ? stripeStatusSummary?.description ||
                "Your Stripe session has been verified by the backend and the order is now marked as paid."
              : nonStripeStatusDescription}
          </p>

          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Order Reference
            </p>
            <p className="mt-2 break-all rounded-xl border border-emerald-200 bg-white px-3 py-2.5 font-mono text-lg font-bold text-slate-900 sm:text-2xl">
              {orderRef}
            </p>
          </div>

          <div className="mt-7 space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Next Actions
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to={trackingPath}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Track Order
              </Link>
              {nonStripePaymentPath ? (
                <Link
                  to={nonStripePaymentPath}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {orderPaymentEntry?.label || orderContinueAction?.label || "Continue Payment"}
                </Link>
              ) : (
                <Link
                  to="/account/orders"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Open My Orders
                </Link>
              )}
              <Link
                to="/"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, CheckCircle2, MailOpen, Store, UserRound, XCircle } from "lucide-react";
import {
  acceptSellerInvitation,
  declineSellerInvitation,
  getSellerInvitations,
} from "../../api/sellerInvitations.ts";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)]";

function Badge({ children, tone = "amber" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInvitationTone(item) {
  if (item?.invitationState === "EXPIRED") return "rose";
  return "amber";
}

function getInvitationMutationErrorMessage(error, fallbackMessage) {
  const code = String(error?.response?.data?.code || "").toUpperCase();
  if (code === "INVITATION_EXPIRED") {
    return "This invitation expired. Ask the store owner or admin to send it again.";
  }
  if (code === "INVITATION_ALREADY_ACCEPTED") {
    return "This invitation was already accepted. Open the seller workspace from your active stores.";
  }
  if (code === "INVITATION_ALREADY_DECLINED") {
    return "This invitation was already declined or closed. A new re-invite is required before you can act again.";
  }
  if (code === "INVITATION_NOT_FOUND") {
    return "Invitation not found for this account.";
  }
  if (code === "INVALID_MEMBER_ID") {
    return "Invitation reference is invalid.";
  }
  return error?.response?.data?.message || error?.message || fallbackMessage;
}

export default function AccountStoreInvitationsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState(null);
  const [busyActionKey, setBusyActionKey] = useState("");

  const invitationsQuery = useQuery({
    queryKey: ["seller", "invitations"],
    queryFn: getSellerInvitations,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: (memberId) => acceptSellerInvitation(memberId),
    onMutate: (memberId) => {
      setFeedback(null);
      setBusyActionKey(`accept:${Number(memberId)}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Store invitation accepted.",
        store: result?.data?.store || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team"] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: getInvitationMutationErrorMessage(
          error,
          "Failed to accept store invitation."
        ),
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const declineMutation = useMutation({
    mutationFn: (memberId) => declineSellerInvitation(memberId),
    onMutate: (memberId) => {
      setFeedback(null);
      setBusyActionKey(`decline:${Number(memberId)}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Store invitation declined.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team"] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: getInvitationMutationErrorMessage(
          error,
          "Failed to decline store invitation."
        ),
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const items = Array.isArray(invitationsQuery.data?.items)
    ? invitationsQuery.data.items
    : [];
  const actionableCount = items.filter((item) => item.isActionable).length;

  if (invitationsQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-slate-500">Loading your seller invitations...</p>
      </section>
    );
  }

  if (invitationsQuery.isError) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {invitationsQuery.error?.response?.data?.message ||
            invitationsQuery.error?.message ||
            "Failed to load seller invitations."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_45%,#ecfdf5_100%)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Seller Invitations
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">
              Accept store access invitations
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              These invitations are for existing accounts only. Accepting an invitation activates
              your seller membership for the target store. Invitations in this phase live on the
              membership row itself, so pending, expired, accepted, and declined outcomes stay
              aligned with seller team lifecycle and audit.
            </p>
          </div>
          <Badge tone={actionableCount > 0 ? "amber" : "rose"}>
            {actionableCount} Actionable
          </Badge>
        </div>
      </section>

      {feedback ? (
        <section
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span>{feedback.message}</span>
            {feedback.type === "success" && (feedback.store?.slug || feedback.store?.id) ? (
              <Link
                to={createSellerWorkspaceRoutes(feedback.store).home()}
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                Open workspace
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {items.length === 0 ? (
        <section className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <MailOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">No pending store invitations</h2>
              <p className="mt-1 text-sm text-slate-600">
                When a store owner or admin invites this account, it will appear here until you
                accept it.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {items.map((item) => (
            <article key={item.memberId} className={cardClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">
                        {item.store?.name || "Store"}
                      </h2>
                      <Badge tone={getInvitationTone(item)}>
                        {item.stateMeta?.label || item.invitationState || item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Role on action:{" "}
                      <span className="font-medium text-slate-700">
                        {item.roleName || item.roleCode}
                      </span>
                    </p>
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <Store className="h-3.5 w-3.5" />
                        Store
                      </dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">
                        {item.store?.slug || "-"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <UserRound className="h-3.5 w-3.5" />
                        Invited By
                      </dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">
                        {item.invitedBy?.email || item.invitedBy?.name || "-"}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Invited At
                      </dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">
                        {formatDateTime(item.invitedAt)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <BriefcaseBusiness className="h-3.5 w-3.5" />
                        Invitation State
                      </dt>
                      <dd className="mt-2 text-sm font-medium text-slate-900">
                        {item.stateMeta?.description || "Seller workspace activates after acceptance"}
                      </dd>
                      {item.expiresAt ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Expires: {formatDateTime(item.expiresAt)}
                        </p>
                      ) : null}
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 flex-col gap-3 lg:w-56">
                  <button
                    type="button"
                    onClick={() => acceptMutation.mutate(item.memberId)}
                    disabled={busyActionKey !== "" || !item.isActionable}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {busyActionKey === `accept:${Number(item.memberId)}` ? "Accepting..." : "Accept"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => declineMutation.mutate(item.memberId)}
                    disabled={busyActionKey !== "" || !item.isActionable}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>
                      {busyActionKey === `decline:${Number(item.memberId)}` ? "Declining..." : "Decline"}
                    </span>
                  </button>
                  <p className="text-xs leading-5 text-slate-500">
                    {item.isActionable
                      ? "Decline closes this invitation for now. This phase still does not include email-token acceptance."
                      : "This invitation is no longer actionable from the account lane. Ask the store owner or admin to send it again."}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

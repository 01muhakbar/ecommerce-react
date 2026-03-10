import { useQuery } from "@tanstack/react-query";
import { History, ShieldCheck, UserRound } from "lucide-react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { getSellerStoreMemberLifecycle } from "../../api/sellerTeam.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

function Badge({ children, tone = "stone" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : tone === "sky"
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-stone-200 bg-stone-100 text-stone-700";

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

function summarizeDelta(beforeState, afterState) {
  const changes = [];

  if ((beforeState?.roleCode || null) !== (afterState?.roleCode || null)) {
    changes.push(`${beforeState?.roleCode || "-"} -> ${afterState?.roleCode || "-"}`);
  }

  if ((beforeState?.status || null) !== (afterState?.status || null)) {
    changes.push(`${beforeState?.status || "-"} -> ${afterState?.status || "-"}`);
  }

  if (changes.length === 0 && afterState?.status) {
    changes.push(`Status ${afterState.status}`);
  }

  return changes.length > 0 ? changes.join(" | ") : "Snapshot recorded";
}

function actionLabel(action) {
  if (action === "TEAM_MEMBER_INVITE") return "Invitation created";
  if (action === "TEAM_MEMBER_INVITE_ACCEPT") return "Invitation accepted";
  if (action === "TEAM_MEMBER_INVITE_DECLINE") return "Invitation declined";
  if (action === "TEAM_MEMBER_REINVITE") return "Invitation sent again";
  if (action === "TEAM_MEMBER_ATTACH") return "Member attached directly";
  if (action === "TEAM_MEMBER_ROLE_CHANGE") return "Role changed";
  if (action === "TEAM_MEMBER_DISABLE") return "Member disabled";
  if (action === "TEAM_MEMBER_REACTIVATE") return "Member reactivated";
  if (action === "TEAM_MEMBER_REMOVE") return "Member removed by store";
  return action || "Recorded action";
}

function currentStateSummary(member, lifecycle) {
  if (member?.status === "REMOVED") {
    if (lifecycle?.removedSource === "INVITE_DECLINE") {
      return "This membership is closed because the invited user declined the store invitation.";
    }
    if (lifecycle?.removedSource === "OPERATIONAL_REMOVE") {
      return "This membership is closed because a store operator removed the member from the team.";
    }
    return "This membership is closed. Check the latest timeline entry for the removal source.";
  }

  if (member?.status === "INVITED") {
    return "This membership is waiting for the invited user to accept before seller access becomes active.";
  }

  if (member?.status === "ACTIVE") {
    return "This membership currently has active seller access for the store.";
  }

  if (member?.status === "DISABLED") {
    return "This membership stays in the team record, but seller access is temporarily disabled.";
  }

  return "Current lifecycle state is available below.";
}

function statusTone(status) {
  if (status === "ACTIVE") return "emerald";
  if (status === "INVITED") return "amber";
  if (status === "REMOVED") return "rose";
  return "stone";
}

function actionTone(action) {
  if (action === "TEAM_MEMBER_ATTACH") return "emerald";
  if (action === "TEAM_MEMBER_REACTIVATE") return "emerald";
  if (action === "TEAM_MEMBER_ROLE_CHANGE") return "sky";
  if (action === "TEAM_MEMBER_INVITE" || action === "TEAM_MEMBER_REINVITE") return "amber";
  if (action === "TEAM_MEMBER_INVITE_DECLINE" || action === "TEAM_MEMBER_REMOVE") return "rose";
  return "stone";
}

export default function SellerMemberLifecyclePage() {
  const { storeId, memberId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewLifecycle =
    permissionKeys.includes("STORE_MEMBERS_MANAGE") ||
    permissionKeys.includes("STORE_ROLES_MANAGE");

  const lifecycleQuery = useQuery({
    queryKey: ["seller", "team", "lifecycle", storeId, memberId],
    queryFn: () => getSellerStoreMemberLifecycle(storeId, memberId),
    enabled: Boolean(storeId) && Boolean(memberId) && canViewLifecycle,
    retry: false,
  });

  if (!canViewLifecycle) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include member lifecycle visibility.
        </p>
      </section>
    );
  }

  if (lifecycleQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading member lifecycle...</p>
      </section>
    );
  }

  if (lifecycleQuery.isError) {
    const statusCode = Number(lifecycleQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {statusCode === 404
            ? "Member not found."
            : lifecycleQuery.error?.response?.data?.message ||
              lifecycleQuery.error?.message ||
              "Failed to load member lifecycle."}
        </p>
      </section>
    );
  }

  const data = lifecycleQuery.data;
  const member = data?.member || null;
  const historyItems = Array.isArray(data?.history?.items) ? data.history.items : [];
  const lifecycle = data?.lifecycle || {};

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#fafaf9_0%,#ffffff_45%,#eff6ff_100%)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Member Lifecycle
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              {member?.name || `User #${member?.userId || memberId}`}
            </h2>
            <p className="mt-2 text-sm text-stone-500">{member?.email || "-"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(member?.status)}>{member?.status || "UNKNOWN"}</Badge>
            <Badge tone="sky">{member?.roleCode || "-"}</Badge>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm leading-6 text-stone-600">
            {currentStateSummary(member, lifecycle)}
          </p>
          {lifecycle?.removedSourceLabel ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
              Removal Source: {lifecycle.removedSourceLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-5">
          <Link
            to={`/seller/stores/${storeId}/team`}
            className="text-sm font-semibold text-stone-700 underline"
          >
            Back to team
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-stone-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Invited
              </p>
              <p className="mt-2 text-sm font-medium text-stone-900">
                {formatDateTime(lifecycle.invitedAt)}
              </p>
            </div>
          </div>
        </article>
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5 text-stone-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Accepted
              </p>
              <p className="mt-2 text-sm font-medium text-stone-900">
                {formatDateTime(lifecycle.acceptedAt)}
              </p>
            </div>
          </div>
        </article>
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-stone-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Disabled
              </p>
              <p className="mt-2 text-sm font-medium text-stone-900">
                {formatDateTime(lifecycle.disabledAt)}
              </p>
            </div>
          </div>
        </article>
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-stone-700" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Removed
              </p>
              <p className="mt-2 text-sm font-medium text-stone-900">
                {formatDateTime(lifecycle.removedAt)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-stone-950">Lifecycle Timeline</h3>
        <p className="mt-1 text-sm text-stone-500">
          Lightweight timeline from the current membership row and team audit trail.
        </p>

        {historyItems.length > 0 ? (
          <div className="mt-5 space-y-3">
            {historyItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={actionTone(item.action)}>{actionLabel(item.action)}</Badge>
                    <span className="text-xs text-stone-500">Log #{item.id}</span>
                  </div>
                  <span className="text-xs text-stone-500">{formatDateTime(item.createdAt)}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-stone-900">
                  {summarizeDelta(item.beforeState, item.afterState)}
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  Actor: {item.actor?.name || item.actor?.email || "System"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Before: {item.beforeState ? JSON.stringify(item.beforeState) : "-"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  After: {item.afterState ? JSON.stringify(item.afterState) : "-"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-stone-900">No lifecycle history yet</p>
            <p className="mt-2 text-sm text-stone-600">
              This member has current lifecycle timestamps, but no matching audit entries yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

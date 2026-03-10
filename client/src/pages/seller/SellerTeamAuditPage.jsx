import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ShieldCheck } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";
import { getSellerTeamAudit } from "../../api/sellerTeamAudit.ts";

const cardClass =
  "rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_16px_36px_-28px_rgba(28,25,23,0.28)]";

function Badge({ children, tone = "stone" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "sky"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function formatActor(user) {
  if (!user) return "System";
  return user.name || user.email || `User #${user.id}`;
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

function actionTone(action) {
  if (action === "TEAM_MEMBER_INVITE") return "amber";
  if (action === "TEAM_MEMBER_INVITE_ACCEPT") return "emerald";
  if (action === "TEAM_MEMBER_INVITE_DECLINE") return "stone";
  if (action === "TEAM_MEMBER_REINVITE") return "amber";
  if (action === "TEAM_MEMBER_ATTACH") return "emerald";
  if (action === "TEAM_MEMBER_ROLE_CHANGE") return "sky";
  if (action === "TEAM_MEMBER_DISABLE") return "amber";
  if (action === "TEAM_MEMBER_REACTIVATE") return "emerald";
  if (action === "TEAM_MEMBER_REMOVE") return "stone";
  return "stone";
}

export default function SellerTeamAuditPage() {
  const { storeId } = useParams();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewAudit = permissionKeys.includes("AUDIT_LOG_VIEW");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const auditQuery = useQuery({
    queryKey: ["seller", "team", "audit", storeId, actionFilter, page],
    queryFn: () =>
      getSellerTeamAudit(storeId, {
        action: actionFilter || undefined,
        page,
        limit: 10,
      }),
    enabled: Boolean(storeId) && canViewAudit,
    retry: false,
  });

  const items = Array.isArray(auditQuery.data?.items) ? auditQuery.data.items : [];
  const actionOptions = useMemo(
    () => ["", ...(auditQuery.data?.actionOptions || [])],
    [auditQuery.data]
  );
  const pagination = auditQuery.data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  if (!canViewAudit) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include the team audit viewer.
        </p>
      </section>
    );
  }

  if (auditQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading seller team audit logs...</p>
      </section>
    );
  }

  if (auditQuery.isError) {
    const statusCode = Number(auditQuery.error?.response?.status || 0);
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {statusCode === 404
            ? "Store not found."
            : auditQuery.error?.response?.data?.message ||
              auditQuery.error?.message ||
              "Failed to load seller team audit logs."}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#f0f9ff_0%,#ffffff_46%,#fff7ed_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Team Audit
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Read-only team mutation trail
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This viewer reads tenant-scoped team mutation logs from the seller audit trail.
              It covers invite, re-invite, invite acceptance, invite decline, attach, role
              change, disable, reactivate, and operational remove events only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="sky">{sellerContext?.access?.roleCode || "UNKNOWN"}</Badge>
            <Badge tone="amber">AUDIT_LOG_VIEW</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <History className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Audit Rows
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-950">
                {String(pagination.total || 0)}
              </p>
            </div>
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Scope
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Tenant-scoped by store id. Backend access remains the final authority.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Filters</h3>
            <p className="mt-1 text-sm text-stone-500">
              Narrow the audit trail to one mutation action if needed.
            </p>
          </div>

          <div className="w-full sm:w-[320px]">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            >
              {actionOptions.map((action) => (
                <option key={action || "ALL"} value={action}>
                  {action || "All team actions"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Audit Timeline</h3>
            <p className="mt-1 text-sm text-stone-500">
              Lightweight operational history for seller team mutations.
            </p>
          </div>
          <Badge tone="stone">Page {pagination.page} of {pagination.totalPages}</Badge>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1.4fr_0.9fr] gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <span>Action</span>
              <span>Actor</span>
              <span>Target</span>
              <span>Change</span>
              <span>Timestamp</span>
            </div>
            <div className="divide-y divide-stone-200 bg-white">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.1fr_1fr_1fr_1.4fr_0.9fr] gap-3 px-4 py-4 text-sm text-stone-700"
                >
                  <div className="space-y-2">
                    <Badge tone={actionTone(item.action)}>{actionLabel(item.action)}</Badge>
                    <p className="text-xs text-stone-500">Log #{item.id}</p>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">{formatActor(item.actor)}</p>
                    <p className="mt-1 text-xs text-stone-500">{item.actor?.email || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">
                      {formatActor(item.target?.user)}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.target?.roleCode || "-"} {item.target?.memberId ? `• Member #${item.target.memberId}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">
                      {summarizeDelta(item.beforeState, item.afterState)}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Before: {item.beforeState ? JSON.stringify(item.beforeState) : "-"}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      After: {item.afterState ? JSON.stringify(item.afterState) : "-"}
                    </p>
                  </div>
                  <div className="text-xs text-stone-500">
                    {item.createdAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(item.createdAt))
                      : "-"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-stone-950">No team audit rows yet</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              This viewer will fill when seller team mutations succeed and write audit logs.
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                current < Number(pagination.totalPages || 1) ? current + 1 : current
              )
            }
            disabled={page >= Number(pagination.totalPages || 1)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

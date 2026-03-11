import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ShieldCheck } from "lucide-react";
import { useOutletContext, useParams } from "react-router-dom";
import { getSellerTeamAudit } from "../../api/sellerTeamAudit.ts";
import {
  sellerFieldClass,
  sellerSecondaryButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceFilterBar,
  SellerWorkspacePanel,
  SellerWorkspaceStatePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

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

function formatActionOption(action) {
  return actionLabel(action);
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
      <SellerWorkspaceStatePanel
        title="Team audit visibility is unavailable"
        description="Your current seller access does not include the team audit viewer."
        tone="error"
        Icon={History}
      />
    );
  }

  if (auditQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading seller team audit logs"
        description="Fetching tenant-scoped team mutation history for the active store."
        Icon={History}
      />
    );
  }

  if (auditQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller team audit logs"
        description={getSellerRequestErrorMessage(auditQuery.error, {
          permissionMessage:
            "Your current seller access does not include the team audit viewer.",
          fallbackMessage: "Failed to load seller team audit logs.",
        })}
        tone="error"
        Icon={History}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Team Audit"
        title="Read-only team mutation trail"
        description="This viewer reads tenant-scoped team mutation logs from the seller audit trail. It covers invite, re-invite, invite acceptance, invite decline, attach, role change, disable, reactivate, and operational remove events only."
        actions={[
          <SellerWorkspaceBadge
            key="role"
            label={sellerContext?.access?.roleCode || "UNKNOWN"}
            tone="sky"
          />,
          <SellerWorkspaceBadge key="perm" label="AUDIT_LOG_VIEW" tone="amber" />,
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <SellerWorkspaceStatCard
          label="Audit Rows"
          value={String(pagination.total || 0)}
          hint="Tenant-scoped mutation history rows for the active store."
          Icon={History}
        />
        <SellerWorkspaceStatCard
          label="Scope"
          value="Store scoped"
          hint="Tenant-scoped by store id. Backend access remains the final authority."
          Icon={ShieldCheck}
          tone="emerald"
        />
      </section>

      <SellerWorkspaceFilterBar>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
            <p className="mt-1 text-sm text-slate-500">
              Narrow the audit trail to one mutation action if needed.
            </p>
          </div>

          <div className="w-full sm:w-[320px]">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
              className={`mt-2 ${sellerFieldClass}`}
            >
              {actionOptions.map((action) => (
                <option key={action || "ALL"} value={action}>
                  {action ? formatActionOption(action) : "All team actions"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SellerWorkspaceFilterBar>

      <SellerWorkspacePanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Audit Timeline</h3>
            <p className="mt-1 text-sm text-slate-500">
              Lightweight operational history for seller team mutations.
            </p>
          </div>
          <SellerWorkspaceBadge
            label={`Page ${pagination.page} of ${pagination.totalPages}`}
            tone="stone"
          />
        </div>

        {items.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1.4fr_0.9fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Action</span>
              <span>Actor</span>
              <span>Target</span>
              <span>Change</span>
              <span>Timestamp</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1.1fr_1fr_1fr_1.4fr_0.9fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div className="space-y-2">
                    <SellerWorkspaceBadge
                      label={item.actionMeta?.label || actionLabel(item.action)}
                      tone={item.actionMeta?.tone || actionTone(item.action)}
                    />
                    <p className="text-xs text-slate-500">Log #{item.id}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{formatActor(item.actor)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.actor?.email || "-"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatActor(item.target?.user)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.target?.snapshot?.roleCode || item.target?.roleCode || "-"}{" "}
                      {item.target?.snapshot?.status ? `• ${item.target.snapshot.status}` : ""}
                      {item.target?.memberId ? ` • Member #${item.target.memberId}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {summarizeDelta(item.beforeState, item.afterState)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Before: {item.beforeState ? JSON.stringify(item.beforeState) : "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      After: {item.afterState ? JSON.stringify(item.afterState) : "-"}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
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
          <div className="mt-5">
            <SellerWorkspaceEmptyState
              title={
                actionFilter ? "No team audit rows match this action filter" : "No team audit rows yet"
              }
              description={
                actionFilter
                  ? "Try widening the audit action filter for this store."
                  : "This viewer will fill when seller team mutations succeed and write audit logs."
              }
              icon={<History className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className={sellerSecondaryButtonClass}
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
            className={sellerSecondaryButtonClass}
          >
            Next
          </button>
        </div>
      </SellerWorkspacePanel>
    </div>
  );
}

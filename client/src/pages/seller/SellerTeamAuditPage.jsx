import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, ShieldCheck } from "lucide-react";
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
import { useSellerWorkspaceRoute } from "../../utils/sellerWorkspaceRoute.js";

function formatActor(user) {
  if (!user) return "System";
  return user.name || user.email || `User #${user.id}`;
}

function summarizeDelta(beforeState, afterState) {
  const changes = [];

  if ((beforeState?.roleCode || null) !== (afterState?.roleCode || null)) {
    const beforeRole = formatRoleLabel(beforeState?.roleCode);
    const afterRole = formatRoleLabel(afterState?.roleCode);
    changes.push(beforeRole ? `Role ${beforeRole} -> ${afterRole || "-"}` : `Role set to ${afterRole || "-"}`);
  }

  if ((beforeState?.status || null) !== (afterState?.status || null)) {
    const beforeStatus = formatRoleLabel(beforeState?.status);
    const afterStatus = formatRoleLabel(afterState?.status);
    changes.push(
      beforeStatus ? `Status ${beforeStatus} -> ${afterStatus || "-"}` : `Status set to ${afterStatus || "-"}`
    );
  }

  if (changes.length === 0 && afterState?.status) {
    changes.push(`Status ${formatRoleLabel(afterState.status)}`);
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

function formatRoleLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SellerTeamAuditPage() {
  const { sellerContext, workspaceStoreId: storeId } = useSellerWorkspaceRoute();
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
        title="Loading team activity"
        description="Fetching recent team changes."
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
    <div className="space-y-5">
      <SellerWorkspaceSectionHeader
        eyebrow="Team Audit"
        title="Team activity"
        description="Review team access changes in a read-only timeline."
        actions={[
          <SellerWorkspaceBadge
            key="role"
            label={formatRoleLabel(sellerContext?.access?.roleCode) || "Role pending"}
            tone="sky"
          />,
          <SellerWorkspaceBadge key="perm" label="Can view audit" tone="amber" />,
        ]}
      />

      <section className="grid gap-3.5 md:grid-cols-2">
        <SellerWorkspaceStatCard
          label="Audit Rows"
          value={String(pagination.total || 0)}
          hint="Activity records."
          Icon={History}
        />
        <SellerWorkspaceStatCard
          label="Scope"
          value="This store"
          hint="Store-only history."
          Icon={ShieldCheck}
          tone="emerald"
        />
      </section>

      <SellerWorkspaceFilterBar>
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Filter activity</h3>
            <p className="mt-1 text-sm text-slate-500">
              Show one action type.
            </p>
          </div>

          <div className="w-full sm:w-[320px]">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Action
            </label>
            <div className="mt-2 flex gap-2">
              <select
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setPage(1);
                }}
                className={sellerFieldClass}
              >
                {actionOptions.map((action) => (
                  <option key={action || "ALL"} value={action}>
                    {action ? formatActionOption(action) : "All team actions"}
                  </option>
                ))}
              </select>
              {actionFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionFilter("");
                    setPage(1);
                  }}
                  className={sellerSecondaryButtonClass}
                >
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </SellerWorkspaceFilterBar>

      <SellerWorkspacePanel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
            <p className="mt-1 text-sm text-slate-500">
              Recent team changes.
            </p>
          </div>
          <SellerWorkspaceBadge
            label={`Page ${pagination.page} of ${pagination.totalPages}`}
            tone="stone"
          />
        </div>

        {items.length > 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative grid grid-cols-1 gap-3 border-l border-slate-200 py-3 pl-5 text-sm text-slate-700 md:grid-cols-[1.2fr_1fr_1fr_1.2fr]"
                >
                  <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full border border-white bg-slate-400" />
                  <div className="space-y-2">
                    <SellerWorkspaceBadge
                      label={
                        item.readModel?.title ||
                        item.actionMeta?.label ||
                        actionLabel(item.action)
                      }
                      tone={
                        item.readModel?.tone ||
                        item.actionMeta?.tone ||
                        actionTone(item.action)
                      }
                    />
                    <p className="text-xs text-slate-500">
                      {item.createdAt
                        ? new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(item.createdAt))
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actor
                    </p>
                    <p className="font-medium text-slate-900">{formatActor(item.actor)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.actor?.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Target
                    </p>
                    <p className="font-medium text-slate-900">
                      {formatActor(item.target?.user)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatRoleLabel(item.target?.snapshot?.roleCode || item.target?.roleCode) || "-"}{" "}
                      {item.target?.snapshot?.status
                        ? `- ${formatRoleLabel(item.target.snapshot.status)}`
                        : ""}
                      {item.target?.memberId ? ` - Member ID ${item.target.memberId}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Change
                    </p>
                    <p className="font-medium text-slate-900">
                      {summarizeDelta(item.beforeState, item.afterState)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.readModel?.summary ||
                        "Team activity recorded for this store."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <SellerWorkspaceEmptyState
              title={
                actionFilter ? "No activity for this filter" : "No team changes yet"
              }
              description={
                actionFilter
                  ? "Reset the filter to see all activity."
                  : "Invites, role changes, and access updates will appear here."
              }
              action={
                actionFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionFilter("");
                      setPage(1);
                    }}
                    className={sellerSecondaryButtonClass}
                  >
                    Reset filter
                  </button>
                ) : null
              }
              icon={<History className="h-5 w-5" />}
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
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

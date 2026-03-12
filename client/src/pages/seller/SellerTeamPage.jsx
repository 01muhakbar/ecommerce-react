import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw,
  ShieldCheck,
  UserRound,
  Users,
  UserCog,
  Lock,
  Save,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import {
  createSellerStoreMember,
  getSellerTeamSummary,
  inviteSellerStoreMember,
  removeSellerStoreMember,
  reinviteSellerStoreMember,
  updateSellerStoreMemberRole,
  updateSellerStoreMemberStatus,
} from "../../api/sellerTeam.ts";
import {
  sellerDangerButtonClass,
  sellerFieldClass,
  sellerPrimaryButtonClass,
  sellerSecondaryButtonClass,
  sellerWarningButtonClass,
  SellerWorkspaceBadge,
  SellerWorkspaceEmptyState,
  SellerWorkspaceFilterBar,
  SellerWorkspaceInset,
  SellerWorkspaceNotice,
  SellerWorkspacePanel,
  SellerWorkspaceStatePanel,
  SellerWorkspaceSectionHeader,
  SellerWorkspaceStatCard,
} from "../../components/seller/SellerWorkspaceFoundation.jsx";
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

function getRemovedSourceHint(member) {
  if (member?.status !== "REMOVED") return null;
  if (member?.removedSource === "INVITE_DECLINE") {
    return "Closed because the invited user declined the store invitation.";
  }
  if (member?.removedSource === "OPERATIONAL_REMOVE") {
    return "Closed by a store operator through the operational remove lane.";
  }
  return "Closed membership row. Check lifecycle history for the latest removal event.";
}

function getInvitationHint(member) {
  if (member?.status !== "INVITED") return null;
  return (
    member?.invitation?.description ||
    "This membership is waiting for the invited user to respond from the account invitation lane."
  );
}

function getRoleMeaning(member) {
  return (
    member?.readModel?.primaryRole?.summary ||
    member?.role?.description ||
    "Seller role snapshot"
  );
}

function getLifecycleMeaning(member) {
  return (
    member?.readModel?.lifecycle?.summary ||
    (member?.status === "REMOVED"
      ? getRemovedSourceHint(member)
      : getInvitationHint(member) || member?.statusMeta?.description) ||
    "Operational team status"
  );
}

export default function SellerTeamPage() {
  const { storeId } = useParams();
  const queryClient = useQueryClient();
  const { sellerContext } = useOutletContext() || {};
  const permissionKeys = sellerContext?.access?.permissionKeys || [];
  const canViewTeam = permissionKeys.includes("STORE_MEMBERS_MANAGE");
  const canManageMembers = permissionKeys.includes("STORE_MEMBERS_MANAGE");
  const canManageRoles = permissionKeys.includes("STORE_ROLES_MANAGE");
  const actorRoleCode = sellerContext?.access?.roleCode || "";
  const actorMemberId = sellerContext?.access?.memberId || null;
  const [attachForm, setAttachForm] = useState({ email: "", roleCode: "CATALOG_MANAGER" });
  const [inviteForm, setInviteForm] = useState({ email: "", roleCode: "CATALOG_MANAGER" });
  const [feedback, setFeedback] = useState(null);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [busyActionKey, setBusyActionKey] = useState("");

  const teamQuery = useQuery({
    queryKey: ["seller", "team", storeId],
    queryFn: () => getSellerTeamSummary(storeId),
    enabled: Boolean(storeId) && canViewTeam,
    retry: false,
  });

  const accessGroups = useMemo(() => {
    const keys = teamQuery.data?.currentAccess?.permissionKeys || [];
    return [
      {
        title: "Team Access",
        items: keys.filter(
          (key) => key.startsWith("STORE_") || key.startsWith("AUDIT_")
        ),
      },
      {
        title: "Operational Access",
        items: keys.filter(
          (key) => key.startsWith("ORDER_") || key.startsWith("PAYMENT_")
        ),
      },
    ].filter((group) => group.items.length > 0);
  }, [teamQuery.data]);

  const manageableRoleOptions = useMemo(() => {
    const allRoles = teamQuery.data?.roles || [];
    const manageableRoleCodes =
      teamQuery.data?.currentAccess?.capabilities?.manageableRoleCodes || [];
    if (!Array.isArray(manageableRoleCodes) || manageableRoleCodes.length === 0) {
      return [];
    }
    return allRoles.filter((role) => manageableRoleCodes.includes(role.code));
  }, [teamQuery.data]);

  const statusContract = teamQuery.data?.statusContract || {
    active: "ACTIVE",
    disabled: "DISABLED",
    persistenceDisabled: "INACTIVE",
  };

  const createMemberMutation = useMutation({
    mutationFn: (payload) => createSellerStoreMember(storeId, payload),
    onMutate: () => {
      setBusyActionKey("attach");
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Member attached to this store.",
      });
      setAttachForm({
        email: "",
        roleCode: manageableRoleOptions[0]?.code || "CATALOG_MANAGER",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to attach member.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const inviteMemberMutation = useMutation({
    mutationFn: (payload) => inviteSellerStoreMember(storeId, payload),
    onMutate: () => {
      setBusyActionKey("invite");
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Existing user invited to this store.",
      });
      setInviteForm({
        email: "",
        roleCode: manageableRoleOptions[0]?.code || "CATALOG_MANAGER",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", "audit"] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to invite member.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, roleCode }) =>
      updateSellerStoreMemberRole(storeId, memberId, { roleCode }),
    onMutate: ({ memberId }) => {
      setBusyActionKey(`role:${memberId}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Member role updated.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to update member role.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ memberId, status }) =>
      updateSellerStoreMemberStatus(storeId, memberId, { status }),
    onMutate: ({ memberId }) => {
      setBusyActionKey(`status:${memberId}`);
    },
    onSuccess: async (_data, variables) => {
      setFeedback({
        type: "success",
        message:
          _data?.message ||
          (variables.status === "ACTIVE" ? "Member reactivated." : "Member disabled."),
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to update member status.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const reinviteMemberMutation = useMutation({
    mutationFn: ({ memberId, roleCode }) =>
      reinviteSellerStoreMember(storeId, memberId, { roleCode }),
    onMutate: ({ memberId }) => {
      setBusyActionKey(`reinvite:${memberId}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Member re-invited to this store.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", "audit"] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to re-invite member.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ memberId }) => removeSellerStoreMember(storeId, memberId),
    onMutate: ({ memberId }) => {
      setBusyActionKey(`remove:${memberId}`);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: result?.message || "Member removed from this store.",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["seller", "team", "audit"] });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message:
          error?.response?.data?.message || error?.message || "Failed to remove member.",
      });
    },
    onSettled: () => {
      setBusyActionKey("");
    },
  });

  const canManageTarget = (member) => {
    if (!member) return false;
    if (Number(member.id) === Number(actorMemberId || -1)) return false;
    if (member.roleCode === "STORE_OWNER") return false;
    if (!["ACTIVE", "DISABLED"].includes(member.status)) return false;

    if (actorRoleCode === "STORE_OWNER") {
      return ["STORE_ADMIN", "CATALOG_MANAGER", "MARKETING_MANAGER", "ORDER_MANAGER", "FINANCE_VIEWER", "CONTENT_MANAGER"].includes(
        member.roleCode
      );
    }

    if (actorRoleCode === "STORE_ADMIN") {
      return ["CATALOG_MANAGER", "MARKETING_MANAGER", "ORDER_MANAGER", "FINANCE_VIEWER", "CONTENT_MANAGER"].includes(
        member.roleCode
      );
    }

    return false;
  };

  const canReinviteTarget = (member) => {
    if (!member) return false;
    if (!canManageMembers || !canManageRoles) return false;
    if (Number(member.id) === Number(actorMemberId || -1)) return false;
    if (member.status !== "REMOVED") return false;
    if (member.roleCode === "STORE_OWNER") return false;

    if (actorRoleCode === "STORE_OWNER") {
      return [
        "STORE_ADMIN",
        "CATALOG_MANAGER",
        "MARKETING_MANAGER",
        "ORDER_MANAGER",
        "FINANCE_VIEWER",
        "CONTENT_MANAGER",
      ].includes(member.roleCode);
    }

    if (actorRoleCode === "STORE_ADMIN") {
      return [
        "CATALOG_MANAGER",
        "MARKETING_MANAGER",
        "ORDER_MANAGER",
        "FINANCE_VIEWER",
        "CONTENT_MANAGER",
      ].includes(member.roleCode);
    }

    return false;
  };

  const handleAttachSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    await createMemberMutation.mutateAsync({
      email: String(attachForm.email || "").trim(),
      roleCode: String(attachForm.roleCode || "").trim(),
    });
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    await inviteMemberMutation.mutateAsync({
      email: String(inviteForm.email || "").trim(),
      roleCode: String(inviteForm.roleCode || "").trim(),
    });
  };

  const handleRoleDraftChange = (memberId, nextRoleCode) => {
    setRoleDrafts((current) => ({ ...current, [memberId]: nextRoleCode }));
  };

  const handleRoleSave = async (member) => {
    const nextRoleCode = roleDrafts[member.id] || member.roleCode;
    if (!nextRoleCode || nextRoleCode === member.roleCode) return;
    setFeedback(null);
    await updateRoleMutation.mutateAsync({
      memberId: member.id,
      roleCode: nextRoleCode,
    });
  };

  const handleStatusToggle = async (member) => {
    setFeedback(null);
    await updateStatusMutation.mutateAsync({
      memberId: member.id,
      status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
    });
  };

  const handleReinvite = async (member) => {
    const nextRoleCode = roleDrafts[member.id] || member.roleCode;
    if (!nextRoleCode) return;
    setFeedback(null);
    await reinviteMemberMutation.mutateAsync({
      memberId: member.id,
      roleCode: nextRoleCode,
    });
  };

  const handleRemove = async (member) => {
    const confirmed = window.confirm(
      `Remove ${member.name || member.email || `member #${member.id}`} from this store? They will lose seller access and can only return through re-invite.`
    );
    if (!confirmed) return;

    setFeedback(null);
    await removeMemberMutation.mutateAsync({
      memberId: member.id,
    });
  };

  if (!canViewTeam) {
    return (
      <SellerWorkspaceStatePanel
        title="Team workspace visibility is unavailable"
        description="Your current seller access does not include the team workspace shell."
        tone="error"
        Icon={Users}
      />
    );
  }

  if (teamQuery.isLoading) {
    return (
      <SellerWorkspaceStatePanel
        title="Loading seller team summary"
        description="Fetching team membership, access, and governance data for the active store."
        Icon={Users}
      />
    );
  }

  if (teamQuery.isError) {
    return (
      <SellerWorkspaceStatePanel
        title="Failed to load seller team summary"
        description={getSellerRequestErrorMessage(teamQuery.error, {
          permissionMessage:
            "Your current seller access does not include the team workspace shell.",
          fallbackMessage: "Failed to load seller team summary.",
        })}
        tone="error"
        Icon={Users}
      />
    );
  }

  const team = teamQuery.data;
  const members = Array.isArray(team?.members) ? team.members : [];
  const teamCapabilities = team?.currentAccess?.capabilities || {};
  const statusTone = (status) => {
    if (status === "ACTIVE") return "emerald";
    if (status === "INVITED") return "amber";
    if (status === "REMOVED") return "rose";
    return "stone";
  };
  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value))
      : "-";

  return (
    <div className="space-y-6">
      <SellerWorkspaceSectionHeader
        eyebrow="Seller Team"
        title="Seller team governance overview"
        description="This page explains who owns the store, which memberships are active, how lifecycle states work, and which team actions are open for the current actor in this tenant-scoped store."
        actions={[
          <SellerWorkspaceBadge
            key="access-mode"
            label={team?.currentAccess?.accessMode || "UNKNOWN"}
            tone="amber"
          />,
          <SellerWorkspaceBadge
            key="role"
            label={team?.currentAccess?.roleCode || "UNKNOWN"}
            tone="emerald"
          />,
        ]}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Phase 1 status contract: {statusContract.active} / {statusContract.disabled}
        </p>
      </SellerWorkspaceSectionHeader>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SellerWorkspaceStatCard
          label="Members"
          value={String(team?.summary?.totalMembers ?? 0)}
          hint={`Active: ${team?.summary?.activeMembers ?? 0} | Invited: ${team?.summary?.invitedMembers ?? 0} | Disabled: ${team?.summary?.disabledMembers ?? 0} | Removed: ${team?.summary?.removedMembers ?? 0}`}
          Icon={Users}
        />
        <SellerWorkspaceStatCard
          label="Current Access"
          value={team?.currentAccess?.membershipStatus || "-"}
          hint={
            team?.currentAccess?.readModel?.authority?.label ||
            (team?.summary?.hasVirtualOwnerBridge
              ? "Owner bridge is still virtual for this store."
              : "Resolved from active store membership.")
          }
          Icon={ShieldCheck}
          tone="emerald"
        />
        <SellerWorkspaceStatCard
          label="Current Role"
          value={
            team?.currentAccess?.readModel?.primaryRole?.label ||
            team?.currentAccess?.roleCode ||
            "-"
          }
          hint={
            team?.currentAccess?.readModel?.primaryRole?.summary ||
            "Resolved by the backend seller access layer."
          }
          Icon={UserRound}
        />
        <SellerWorkspaceStatCard
          label="System Roles"
          value={String(team?.summary?.systemRolesAvailable ?? 0)}
          hint="Available seller roles seeded in the foundation."
          Icon={UserCog}
          tone="amber"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <SellerWorkspacePanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Current Access Summary</h3>
              <p className="text-sm text-slate-500">
                Backend-resolved seller access for the current store context.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <SellerWorkspaceInset className="px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Membership Status
              </dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {team?.currentAccess?.readModel?.authority?.label ||
                  team?.currentAccess?.membershipStatus ||
                  "-"}
              </dd>
              <p className="mt-2 text-xs text-slate-500">
                {team?.currentAccess?.readModel?.authority?.description ||
                  (teamCapabilities.canInviteMembers || teamCapabilities.canAttachMembers
                    ? "This actor can open the current phase-1 member mutation lanes."
                    : "This actor can observe the team shell, but mutation lanes stay closed.")}
              </p>
            </SellerWorkspaceInset>
            <SellerWorkspaceInset className="px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Member Reference
              </dt>
              <dd className="mt-2 text-base font-semibold text-slate-900">
                {team?.currentAccess?.memberId ?? "Virtual owner"}
              </dd>
              <p className="mt-2 text-xs text-slate-500">
                {team?.currentAccess?.readModel?.membershipBoundary || "Current access boundary."}
              </p>
            </SellerWorkspaceInset>
          </dl>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {accessGroups.map((group) => (
              <SellerWorkspaceInset key={group.title} className="px-4 py-4">
                <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((permissionKey) => (
                    <SellerWorkspaceBadge
                      key={permissionKey}
                      label={permissionKey}
                      tone="emerald"
                    />
                  ))}
                </div>
              </SellerWorkspaceInset>
            ))}
          </div>
        </SellerWorkspacePanel>

        <SellerWorkspacePanel className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Team Actions</h3>
              <p className="text-sm text-slate-500">Phase 1 subset only</p>
            </div>
          </div>

          {feedback ? (
            <SellerWorkspaceNotice
              type={feedback.type === "success" ? "success" : "error"}
              className="mt-5"
            >
              {feedback.message}
            </SellerWorkspaceNotice>
          ) : null}

          {canManageMembers && canManageRoles ? (
            <div className="mt-5 space-y-4">
              <form onSubmit={handleInviteSubmit}>
                <SellerWorkspaceFilterBar className="border-amber-200 bg-amber-50 shadow-none">
                  <p className="text-sm font-semibold text-slate-900">Invite Existing User</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This creates a pending membership with status <code>INVITED</code>. The target
                    user must already have an account, and no email automation is sent yet.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="member@example.com"
                      className={sellerFieldClass}
                      disabled={inviteMemberMutation.isPending}
                    />
                    <select
                      value={inviteForm.roleCode}
                      onChange={(event) =>
                        setInviteForm((current) => ({ ...current, roleCode: event.target.value }))
                      }
                      className={sellerFieldClass}
                      disabled={inviteMemberMutation.isPending}
                    >
                      {manageableRoleOptions.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        inviteMemberMutation.isPending ||
                        busyActionKey === "invite" ||
                        !String(inviteForm.email || "").trim() ||
                        !String(inviteForm.roleCode || "").trim()
                      }
                      className={sellerWarningButtonClass}
                    >
                      <UserPlus className="h-4 w-4" />
                      {inviteMemberMutation.isPending ? "Inviting..." : "Invite User"}
                    </button>
                  </div>
                </SellerWorkspaceFilterBar>
              </form>

              <form onSubmit={handleAttachSubmit}>
                <SellerWorkspaceFilterBar className="shadow-none">
                  <p className="text-sm font-semibold text-slate-900">Attach Existing User</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Use this lane only when the user should become active immediately. This keeps
                    the existing phase 1 behavior.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="email"
                      value={attachForm.email}
                      onChange={(event) =>
                        setAttachForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="member@example.com"
                      className={sellerFieldClass}
                      disabled={createMemberMutation.isPending}
                    />
                    <select
                      value={attachForm.roleCode}
                      onChange={(event) =>
                        setAttachForm((current) => ({ ...current, roleCode: event.target.value }))
                      }
                      className={sellerFieldClass}
                      disabled={createMemberMutation.isPending}
                    >
                      {manageableRoleOptions.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        createMemberMutation.isPending ||
                        busyActionKey === "attach" ||
                        !String(attachForm.email || "").trim() ||
                        !String(attachForm.roleCode || "").trim()
                      }
                      className={sellerPrimaryButtonClass}
                    >
                      <UserPlus className="h-4 w-4" />
                      {createMemberMutation.isPending ? "Attaching..." : "Attach Member"}
                    </button>
                  </div>
                </SellerWorkspaceFilterBar>
              </form>
            </div>
          ) : (
            <SellerWorkspaceNotice type="warning" className="mt-5">
              Team mutations remain permission-gated. This actor can read the membership shell,
              but cannot perform attach, role change, or status change operations.
            </SellerWorkspaceNotice>
          )}
        </SellerWorkspacePanel>
      </section>

      <SellerWorkspacePanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Store Members</h3>
            <p className="mt-1 text-sm text-slate-500">
              Tenant-scoped rows from <code>store_members</code> with store role snapshots.
            </p>
          </div>
          {team?.summary?.hasVirtualOwnerBridge ? (
            <SellerWorkspaceBadge label="Virtual owner bridge active" tone="amber" />
          ) : null}
        </div>

        {members.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr_1.3fr_0.9fr_1fr_1.2fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Member</span>
              <span>Role</span>
              <span>Status</span>
              <span>Joined</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              {members.map((member) => {
                const reinvitable = Boolean(member.governance?.canReinvite);
                const editableRole = Boolean(member.governance?.canEditRole);
                const roleValue = roleDrafts[member.id] || member.roleCode;
                const roleBusy = busyActionKey === `role:${member.id}`;
                const statusBusy = busyActionKey === `status:${member.id}`;
                const reinviteBusy = busyActionKey === `reinvite:${member.id}`;
                const removeBusy = busyActionKey === `remove:${member.id}`;
                return (
                <div
                  key={member.id}
                  className="grid grid-cols-[1.4fr_1.3fr_0.9fr_1fr_1.2fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{member.name || `User #${member.userId}`}</p>
                    <p className="mt-1 text-xs text-slate-500">{member.email || "-"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {member.invitedAt ? `Invited ${formatDate(member.invitedAt)}` : "No invite timestamp"}
                      {member.acceptedAt ? ` • Accepted ${formatDate(member.acceptedAt)}` : ""}
                      {member.disabledAt ? ` • Disabled ${formatDate(member.disabledAt)}` : ""}
                      {member.removedAt ? ` • Removed ${formatDate(member.removedAt)}` : ""}
                    </p>
                  </div>
                  <div>
                    {(editableRole || reinvitable) && canManageRoles ? (
                      <div className="space-y-2">
                        <select
                          value={roleValue}
                          onChange={(event) => handleRoleDraftChange(member.id, event.target.value)}
                          className={sellerFieldClass}
                          disabled={
                            updateRoleMutation.isPending ||
                            roleBusy ||
                            reinviteMemberMutation.isPending ||
                            reinviteBusy
                          }
                        >
                          {manageableRoleOptions.map((role) => (
                            <option key={role.id} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRoleSave(member)}
                          disabled={
                            !editableRole ||
                            updateRoleMutation.isPending ||
                            roleBusy ||
                            !roleValue ||
                            roleValue === member.roleCode
                          }
                          className={sellerSecondaryButtonClass}
                        >
                          <Save className="h-3.5 w-3.5" />
                          {roleBusy ? "Saving..." : "Save Role"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {member.readModel?.primaryRole?.label ||
                              member.roleName ||
                              member.roleCode ||
                              "-"}
                          </p>
                          {member.roleCode ? (
                            <SellerWorkspaceBadge label={member.roleCode} tone="stone" />
                          ) : null}
                          {member.readModel?.primaryRole?.category ? (
                            <SellerWorkspaceBadge
                              label={member.readModel.primaryRole.category}
                              tone={member.readModel.primaryRole.tone || "stone"}
                            />
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {getRoleMeaning(member)}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <SellerWorkspaceBadge
                      label={member.statusMeta?.label || member.status}
                      tone={statusTone(member.status)}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      {getLifecycleMeaning(member)}
                    </p>
                    {member.readModel?.lifecycle?.nextStep ? (
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {member.readModel.lifecycle.nextStep}
                      </p>
                    ) : null}
                    {member.status === "INVITED" && member.invitation?.expiresAt ? (
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        Expires {formatDate(member.invitation.expiresAt)}
                      </p>
                    ) : null}
                    {member.status === "REMOVED" && member.removedSourceLabel ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                        {member.removedSourceLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {member.joinedAt
                      ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
                          new Date(member.joinedAt)
                        )
                      : "-"}
                  </div>
                  <div className="flex items-start">
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        to={`/seller/stores/${storeId}/team/${member.id}`}
                        className="text-xs font-semibold text-slate-700 underline"
                      >
                        View lifecycle
                      </Link>
                      {member.governance?.canToggleStatus && canManageMembers ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(member)}
                            disabled={updateStatusMutation.isPending || statusBusy}
                            className={sellerSecondaryButtonClass}
                          >
                            {statusBusy
                              ? "Saving..."
                              : member.status === "ACTIVE"
                                ? "Disable"
                                : "Reactivate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(member)}
                            disabled={removeMemberMutation.isPending || removeBusy}
                            className={sellerDangerButtonClass}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            {removeBusy ? "Removing..." : "Remove"}
                          </button>
                        </>
                      ) : reinvitable ? (
                        <button
                          type="button"
                          onClick={() => handleReinvite(member)}
                          disabled={
                            reinviteMemberMutation.isPending ||
                            reinviteBusy ||
                            !String(roleValue || "").trim()
                          }
                          className={sellerWarningButtonClass}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {reinviteBusy ? "Re-inviting..." : "Re-invite"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {member.readModel?.authority?.label ||
                            member.governance?.restrictionReason ||
                            (member.status === "INVITED"
                              ? member.invitation?.state === "EXPIRED"
                                ? "Invitation expired"
                                : "Pending invitation in account lane"
                              : "Protected")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <SellerWorkspaceEmptyState
              title="No store members yet"
              description="The seller workspace can still operate through owner bridge access even when the membership table is empty. Team management will fill this area in a later phase."
              icon={<Users className="h-5 w-5" />}
            />
          </div>
        )}
      </SellerWorkspacePanel>

      <SellerWorkspacePanel className="p-5">
        <h3 className="text-lg font-semibold text-slate-900">Seeded Seller Roles</h3>
        <p className="mt-1 text-sm text-slate-500">
          System roles currently available from the seller foundation seed.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(team?.roles || []).map((role) => (
            <SellerWorkspaceInset key={role.id} className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{role.name}</h4>
                  <p className="mt-1 text-xs text-slate-500">{role.code}</p>
                </div>
                <SellerWorkspaceBadge
                  label={role.isActive ? "Active" : "Inactive"}
                  tone={role.isActive ? "emerald" : "stone"}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {role.description || "No description available."}
              </p>
            </SellerWorkspaceInset>
          ))}
        </div>
      </SellerWorkspacePanel>
    </div>
  );
}

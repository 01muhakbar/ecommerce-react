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
import { getSellerRequestErrorMessage } from "./sellerAccessState.js";

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
        : "border-stone-200 bg-stone-100 text-stone-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, hint, Icon }) {
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-stone-950">{value}</p>
          {hint ? <p className="mt-2 text-sm leading-6 text-stone-600">{hint}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

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
    if (actorRoleCode === "STORE_OWNER") {
      return allRoles.filter((role) => role.code !== "STORE_OWNER");
    }
    if (actorRoleCode === "STORE_ADMIN") {
      return allRoles.filter((role) =>
        ["CATALOG_MANAGER", "MARKETING_MANAGER", "ORDER_MANAGER", "FINANCE_VIEWER", "CONTENT_MANAGER"].includes(role.code)
      );
    }
    return [];
  }, [actorRoleCode, teamQuery.data]);

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
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          Your current seller access does not include the team workspace shell.
        </p>
      </section>
    );
  }

  if (teamQuery.isLoading) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-stone-500">Loading seller team summary...</p>
      </section>
    );
  }

  if (teamQuery.isError) {
    return (
      <section className={cardClass}>
        <p className="text-sm text-rose-600">
          {getSellerRequestErrorMessage(teamQuery.error, {
            permissionMessage:
              "Your current seller access does not include the team workspace shell.",
            fallbackMessage: "Failed to load seller team summary.",
          })}
        </p>
      </section>
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
      <section className="rounded-[26px] border border-stone-200 bg-[linear-gradient(135deg,#fefce8_0%,#ffffff_46%,#ecfeff_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              Seller Team
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Team mutation and invite lanes are active
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              This page now supports direct attach, first-time invite, removed-member
              re-invite, expired-invite re-issue, and operational remove. Remove closes an active
              or disabled membership with <code className="mx-1">REMOVED</code> while preserving
              the row for a future re-invite. Email automation, restore-general flow, owner
              transfer, and advanced lifecycle actions remain closed.
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
              Phase 1 status contract: {statusContract.active} / {statusContract.disabled}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="amber">{team?.currentAccess?.accessMode || "UNKNOWN"}</Badge>
            <Badge tone="emerald">{team?.currentAccess?.roleCode || "UNKNOWN"}</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Members"
          value={String(team?.summary?.totalMembers ?? 0)}
          hint={`Active: ${team?.summary?.activeMembers ?? 0} | Invited: ${team?.summary?.invitedMembers ?? 0} | Disabled: ${team?.summary?.disabledMembers ?? 0} | Removed: ${team?.summary?.removedMembers ?? 0}`}
          Icon={Users}
        />
        <StatCard
          label="Current Access"
          value={team?.currentAccess?.membershipStatus || "-"}
          hint={
            team?.summary?.hasVirtualOwnerBridge
              ? "Owner bridge is still virtual for this store."
              : "Resolved from active store membership."
          }
          Icon={ShieldCheck}
        />
        <StatCard
          label="Current Role"
          value={team?.currentAccess?.roleCode || "-"}
          hint="Resolved by the backend seller access layer."
          Icon={UserRound}
        />
        <StatCard
          label="System Roles"
          value={String(team?.summary?.systemRolesAvailable ?? 0)}
          hint="Available seller roles seeded in the foundation."
          Icon={UserCog}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-amber-50">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Current Access Summary</h3>
              <p className="text-sm text-stone-500">
                Backend-resolved seller access for the current store context.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Membership Status
              </dt>
              <dd className="mt-2 text-base font-semibold text-stone-900">
                {team?.currentAccess?.membershipStatus || "-"}
              </dd>
              <p className="mt-2 text-xs text-stone-500">
                {teamCapabilities.canInviteMembers || teamCapabilities.canAttachMembers
                  ? "This actor can open the current phase-1 member mutation lanes."
                  : "This actor can observe the team shell, but mutation lanes stay closed."}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Member Reference
              </dt>
              <dd className="mt-2 text-base font-semibold text-stone-900">
                {team?.currentAccess?.memberId ?? "Virtual owner"}
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {accessGroups.map((group) => (
              <section
                key={group.title}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4"
              >
                <h4 className="text-sm font-semibold text-stone-900">{group.title}</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((permissionKey) => (
                    <Badge key={permissionKey} tone="emerald">
                      {permissionKey}
                    </Badge>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-950">Team Actions</h3>
              <p className="text-sm text-stone-500">Phase 1 subset only</p>
            </div>
          </div>

          {feedback ? (
            <div
              className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          {canManageMembers && canManageRoles ? (
            <div className="mt-5 space-y-4">
              <form onSubmit={handleInviteSubmit}>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-stone-900">Invite Existing User</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
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
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      disabled={inviteMemberMutation.isPending}
                    />
                    <select
                      value={inviteForm.roleCode}
                      onChange={(event) =>
                        setInviteForm((current) => ({ ...current, roleCode: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
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
                      className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserPlus className="h-4 w-4" />
                      {inviteMemberMutation.isPending ? "Inviting..." : "Invite User"}
                    </button>
                  </div>
                </div>
              </form>

              <form onSubmit={handleAttachSubmit}>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-sm font-semibold text-stone-900">Attach Existing User</p>
                <p className="mt-1 text-sm leading-6 text-stone-600">
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
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                    disabled={createMemberMutation.isPending}
                  />
                  <select
                    value={attachForm.roleCode}
                    onChange={(event) =>
                      setAttachForm((current) => ({ ...current, roleCode: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
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
                    className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserPlus className="h-4 w-4" />
                    {createMemberMutation.isPending ? "Attaching..." : "Attach Member"}
                  </button>
                </div>
              </div>
              </form>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
              Team mutations remain permission-gated. This actor can read the membership shell,
              but cannot perform attach, role change, or status change operations.
            </div>
          )}
        </article>
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-950">Store Members</h3>
            <p className="mt-1 text-sm text-stone-500">
              Tenant-scoped rows from <code>store_members</code> with store role snapshots.
            </p>
          </div>
          {team?.summary?.hasVirtualOwnerBridge ? (
            <Badge tone="amber">Virtual owner bridge active</Badge>
          ) : null}
        </div>

        {members.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200">
            <div className="grid grid-cols-[1.4fr_1.3fr_0.9fr_1fr_1.2fr] gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              <span>Member</span>
              <span>Role</span>
              <span>Status</span>
              <span>Joined</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-stone-200 bg-white">
              {members.map((member) => {
                const manageable = Boolean(
                  member.governance?.canToggleStatus || member.governance?.canRemove
                );
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
                  className="grid grid-cols-[1.4fr_1.3fr_0.9fr_1fr_1.2fr] gap-3 px-4 py-4 text-sm text-stone-700"
                >
                  <div>
                    <p className="font-semibold text-stone-950">{member.name || `User #${member.userId}`}</p>
                    <p className="mt-1 text-xs text-stone-500">{member.email || "-"}</p>
                    <p className="mt-2 text-xs text-stone-500">
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
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
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
                            updateRoleMutation.isPending ||
                            roleBusy ||
                            !roleValue ||
                            roleValue === member.roleCode
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {roleBusy ? "Saving..." : "Save Role"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-stone-900">{member.roleName || member.roleCode || "-"}</p>
                          {member.roleCode ? <Badge tone="stone">{member.roleCode}</Badge> : null}
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
                          {member.role?.permissionKeys?.length
                            ? `${member.role.permissionKeys.length} permission keys in this role snapshot`
                            : "Current seller role snapshot"}
                        </p>
                      </>
                    )}
                  </div>
                  <div>
                    <Badge tone={statusTone(member.status)}>
                      {member.statusMeta?.label || member.status}
                    </Badge>
                    <p className="mt-2 text-xs text-stone-500">
                      {member.status === "REMOVED"
                        ? getRemovedSourceHint(member)
                        : getInvitationHint(member) ||
                          member.statusMeta?.description ||
                          "Operational team status"}
                    </p>
                    {member.status === "INVITED" && member.invitation?.expiresAt ? (
                      <p className="mt-2 text-xs font-medium text-stone-500">
                        Expires {formatDate(member.invitation.expiresAt)}
                      </p>
                    ) : null}
                    {member.status === "REMOVED" && member.removedSourceLabel ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                        {member.removedSourceLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-xs text-stone-500">
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
                        className="text-xs font-semibold text-stone-700 underline"
                      >
                        View lifecycle
                      </Link>
                      {member.governance?.canToggleStatus && canManageMembers ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(member)}
                            disabled={updateStatusMutation.isPending || statusBusy}
                            className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {reinviteBusy ? "Re-inviting..." : "Re-invite"}
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">
                          {member.governance?.restrictionReason ||
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
          <div className="mt-5 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-stone-950">No store members yet</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              The seller workspace can still operate through owner bridge access even when the
              membership table is empty. Team management will fill this area in a later phase.
            </p>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-semibold text-stone-950">Seeded Seller Roles</h3>
        <p className="mt-1 text-sm text-stone-500">
          System roles currently available from the seller foundation seed.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(team?.roles || []).map((role) => (
            <article key={role.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900">{role.name}</h4>
                  <p className="mt-1 text-xs text-stone-500">{role.code}</p>
                </div>
                <Badge tone={role.isActive ? "emerald" : "stone"}>
                  {role.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {role.description || "No description available."}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

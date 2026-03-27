import { fn, col, Op } from "sequelize";
import { Product, StoreMember } from "../models/index.js";
import {
  serializeStorePaymentProfileActiveSnapshot,
  serializeStorePaymentProfilePendingRequest,
} from "./sharedContracts/storePaymentProfileState.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const hasText = (value: unknown) => String(value || "").trim().length > 0;

const storeProfileReadinessFields = [
  { key: "description", label: "Store description" },
  { key: "email", label: "Store email" },
  { key: "phone", label: "Store phone" },
  { key: "logoUrl", label: "Logo URL" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "city", label: "City" },
  { key: "province", label: "Province" },
  { key: "country", label: "Country" },
] as const;

const createChecklistStatus = (
  code: string,
  label: string,
  tone: string,
  description: string
) => ({
  code,
  label,
  tone,
  description,
});

const createChecklistCta = (
  label: string,
  lane: string,
  actor: string,
  description: string
) => ({
  label,
  lane,
  actor,
  description,
});

type ProductPipelineSummary = {
  totalProducts: number;
  drafts: number;
  readyToSubmit: number;
  active: number;
  inactive: number;
  submitted: number;
  needsRevision: number;
  reviewQueue: number;
  storefrontVisible: number;
  publishedBlocked: number;
  internalOnly: number;
};

type TeamWorkspaceSummary = {
  activeMembers: number;
  invitedMembers: number;
  disabledMembers: number;
  removedMembers: number;
};

const emptyProductPipelineSummary = (): ProductPipelineSummary => ({
  totalProducts: 0,
  drafts: 0,
  readyToSubmit: 0,
  active: 0,
  inactive: 0,
  submitted: 0,
  needsRevision: 0,
  reviewQueue: 0,
  storefrontVisible: 0,
  publishedBlocked: 0,
  internalOnly: 0,
});

const emptyTeamWorkspaceSummary = (): TeamWorkspaceSummary => ({
  activeMembers: 0,
  invitedMembers: 0,
  disabledMembers: 0,
  removedMembers: 0,
});

const mapGroupedCounts = (rows: any[]) => {
  const map = new Map<number, number>();
  for (const row of rows) {
    const storeId = Number(getAttr(row, "storeId") || 0);
    if (!storeId) continue;
    const count = Number(getAttr(row, "count") || 0);
    map.set(storeId, count);
  }
  return map;
};

const countProductsByStoreIds = async (storeIds: number[], where: any) => {
  if (!storeIds.length) return new Map<number, number>();

  const rows = await Product.findAll({
    attributes: ["storeId", [fn("COUNT", col("id")), "count"]],
    where: {
      storeId: { [Op.in]: storeIds },
      ...where,
    } as any,
    group: ["storeId"],
    raw: true,
  });

  return mapGroupedCounts(rows as any[]);
};

const countMembersByStoreIds = async (storeIds: number[], status: string) => {
  if (!storeIds.length) return new Map<number, number>();

  const rows = await StoreMember.findAll({
    attributes: ["storeId", [fn("COUNT", col("id")), "count"]],
    where: {
      storeId: { [Op.in]: storeIds },
      status,
    } as any,
    group: ["storeId"],
    raw: true,
  });

  return mapGroupedCounts(rows as any[]);
};

const buildStoreProfileChecklistItem = (store: any, canEdit: boolean) => {
  const missingFields = storeProfileReadinessFields
    .filter((field) => !hasText(getAttr(store, field.key)))
    .map((field) => ({
      key: field.key,
      label: field.label,
    }));
  const totalFields = storeProfileReadinessFields.length;
  const completedFields = totalFields - missingFields.length;
  const isStoreActive = String(getAttr(store, "status") || "ACTIVE").toUpperCase() === "ACTIVE";

  let status = createChecklistStatus(
    "READY",
    "Ready",
    "emerald",
    "Store identity, contact, and address fields are complete enough for seller operations."
  );
  let cta = createChecklistCta(
    "Review store profile",
    "STORE_PROFILE",
    "SELLER",
    "Open the store profile lane to review or maintain the active store identity."
  );
  let isComplete = true;

  if (!isStoreActive) {
    status = createChecklistStatus(
      "INACTIVE",
      "Inactive",
      "stone",
      "Store status is inactive. Store metadata can still be reviewed, but activation stays outside this seller checklist."
    );
    cta = createChecklistCta(
      "Follow up store activation",
      "STORE_PROFILE",
      "ADMIN",
      "Store status activation remains outside seller readiness self-service."
    );
    isComplete = false;
  } else if (missingFields.length > 0) {
    status = createChecklistStatus(
      "INCOMPLETE",
      "Needs update",
      "amber",
      "Some core store profile fields are still missing and should be completed before the store is treated as operationally ready."
    );
    cta = createChecklistCta(
      canEdit ? "Complete store profile" : "Ask owner or admin to update profile",
      "STORE_PROFILE",
      canEdit ? "SELLER_EDITOR" : "STORE_OWNER_OR_ADMIN",
      canEdit
        ? "Complete the core store profile fields in seller workspace."
        : "This role can review the profile, but only store editors can complete the missing fields."
    );
    isComplete = false;
  }

  return {
    key: "store_profile",
    label: "Store profile",
    required: true,
    infoOnly: false,
    visible: true,
    isComplete,
    status,
    progress: {
      completed: completedFields,
      total: totalFields,
      missingFields,
    },
    cta,
    governance: {
      canEdit,
      managedBy: "SELLER_PROFILE_WITH_ADMIN_CORE_GOVERNANCE",
      note: canEdit
        ? "Seller may update only the editable store profile fields."
        : "This seller role can review store profile state, but cannot edit it.",
    },
    meta: {
      storeStatus: String(getAttr(store, "status") || "ACTIVE"),
    },
  };
};

const buildPaymentProfileChecklistItem = (
  activeProfile: any,
  pendingRequest: any,
  canEdit: boolean,
  canView: boolean
) => {
  const activeSnapshot = serializeStorePaymentProfileActiveSnapshot(activeProfile);
  const request = serializeStorePaymentProfilePendingRequest(pendingRequest, activeProfile);
  const readiness = request?.readiness || activeSnapshot?.readiness || null;
  const reviewStatus = request
    ? {
        code: String(request.requestStatus || "DRAFT"),
        label:
          request.requestStatus === "SUBMITTED"
            ? "Pending review"
            : request.requestStatus === "NEEDS_REVISION"
              ? "Needs revision"
              : "Draft",
        tone:
          request.requestStatus === "NEEDS_REVISION"
            ? "rose"
            : request.requestStatus === "SUBMITTED"
              ? "amber"
              : "sky",
        description:
          request.requestStatus === "SUBMITTED"
            ? "Admin review is still pending for the current seller request."
            : request.requestStatus === "NEEDS_REVISION"
              ? "Admin reviewed the request and asked the seller to revise it."
              : "A seller draft request already exists for this store.",
      }
    : activeSnapshot?.verificationMeta || null;

  let status = createChecklistStatus(
    "NOT_CONFIGURED",
    "Not configured",
    "amber",
    "No seller payment setup request or active snapshot is available yet."
  );
  let cta = createChecklistCta(
    canEdit ? "Start payment setup" : "Review payment setup",
    "PAYMENT_PROFILE",
    canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
    canEdit
      ? "Open the seller payment setup lane and prepare the first store-scoped request."
      : "Open payment setup to review what is still blocking readiness."
  );
  let isComplete = false;

  if (!canView) {
    status = createChecklistStatus(
      "ACCESS_DENIED",
      "Locked",
      "stone",
      "Payment profile readiness is hidden unless this seller role can view finance setup."
    );
    cta = createChecklistCta(
      "Payment access required",
      "PAYMENT_PROFILE",
      "STORE_OWNER_OR_ADMIN",
      "Payment readiness belongs to seller roles with finance setup visibility."
    );
  } else if (activeSnapshot?.readiness?.isReady) {
    status = createChecklistStatus(
      "READY",
      "Ready",
      "emerald",
      "An active approved payment snapshot is already available for this store."
    );
    cta = createChecklistCta(
      "Review payment setup",
      "PAYMENT_PROFILE",
      "SELLER",
      "Payment setup is ready. Open the payment lane to review the active snapshot or admin feedback."
    );
    isComplete = true;
  } else if (request?.requestStatus === "SUBMITTED") {
    status = createChecklistStatus(
      "PENDING_REVIEW",
      "Pending review",
      "amber",
      "The latest seller payment setup request has already been submitted and is waiting for admin review."
    );
    cta = createChecklistCta(
      "Wait for admin review",
      "PAYMENT_PROFILE",
      "ADMIN",
      "The request is locked while admin review is in progress."
    );
  } else if (request?.requestStatus === "NEEDS_REVISION") {
    status = createChecklistStatus(
      "NEEDS_REVISION",
      "Needs revision",
      "rose",
      "Admin asked the seller to revise the latest payment setup request."
    );
    cta = createChecklistCta(
      canEdit ? "Revise payment setup" : "Ask editor to revise payment setup",
      "PAYMENT_PROFILE",
      canEdit ? "SELLER_EDITOR" : "STORE_OWNER_OR_ADMIN",
      canEdit
        ? "Open the payment setup lane, update the request, then resubmit it."
        : "A seller with payment edit access must revise and resubmit the request."
    );
  } else if (request?.requestStatus === "DRAFT") {
    if (request.readiness?.isIncomplete) {
      status = createChecklistStatus(
        "DRAFT_INCOMPLETE",
        "Draft incomplete",
        "amber",
        "A seller payment setup draft exists, but some required fields are still missing."
      );
      cta = createChecklistCta(
        canEdit ? "Complete draft" : "Review payment draft",
        "PAYMENT_PROFILE",
        canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
        canEdit
          ? "Complete the required payment fields in the current draft."
          : "Open the payment setup lane to review the current draft state."
      );
    } else {
      status = createChecklistStatus(
        "READY_TO_SUBMIT",
        "Ready to submit",
        "sky",
        "The seller payment setup draft is complete and ready to be submitted for admin review."
      );
      cta = createChecklistCta(
        canEdit ? "Submit payment setup" : "Review payment draft",
        "PAYMENT_PROFILE",
        canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
        canEdit
          ? "Submit the current payment setup draft for admin review."
          : "Open the payment setup lane to review the current draft state."
      );
    }
  } else if (activeSnapshot?.readiness?.code === "INCOMPLETE") {
    status = createChecklistStatus(
      "INCOMPLETE",
      "Needs update",
      "amber",
      "The current payment snapshot is still incomplete."
    );
    cta = createChecklistCta(
      canEdit ? "Update payment setup" : "Review payment setup",
      "PAYMENT_PROFILE",
      canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canEdit
        ? "Start a seller payment request to complete the missing payment fields."
        : "Open payment setup to review the missing fields and current governance."
    );
  } else if (activeSnapshot?.verificationStatus === "REJECTED") {
    status = createChecklistStatus(
      "REJECTED",
      "Rejected",
      "rose",
      "The latest active payment snapshot was rejected or remains blocked."
    );
    cta = createChecklistCta(
      canEdit ? "Prepare revised payment setup" : "Review payment setup",
      "PAYMENT_PROFILE",
      canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canEdit
        ? "Open the payment setup lane and prepare a revised seller request."
        : "Open payment setup to review the rejection state."
    );
  } else if (activeSnapshot?.readiness?.code === "INACTIVE") {
    status = createChecklistStatus(
      "INACTIVE",
      "Inactive",
      "stone",
      "A payment snapshot exists, but it is not active for seller operations yet."
    );
    cta = createChecklistCta(
      canEdit ? "Follow payment setup" : "Review payment setup",
      "PAYMENT_PROFILE",
      canEdit ? "SELLER_EDITOR" : "SELLER_VIEWER",
      "Open payment setup to see why activation is still blocked."
    );
  }

  return {
    key: "payment_profile",
    label: "Payment profile",
    required: true,
    infoOnly: false,
    visible: canView,
    isComplete,
    status,
    progress: {
      completed: Number(readiness?.completedFields || 0),
      total: Number(readiness?.totalFields || 0),
      missingFields: Array.isArray(readiness?.missingFields) ? readiness.missingFields : [],
    },
    cta,
    governance: {
      canEdit,
      managedBy: "SELLER_REQUEST_ADMIN_FINAL_APPROVAL",
      note:
        "Seller may prepare store-scoped payment requests, but admin remains the final approval and activation authority.",
    },
    reviewStatus,
    meta: {
      activeSnapshot,
      pendingRequest: request,
    },
  };
};

const buildProductChecklistItem = (
  summary: ProductPipelineSummary,
  canCreateDraft: boolean,
  canViewCatalog: boolean
) => {
  let status = createChecklistStatus(
    "NO_PRODUCTS",
    "No products yet",
    "amber",
    "The store does not have any seller-scoped products yet."
  );
  let cta = createChecklistCta(
    canCreateDraft ? "Add first product" : "Review catalog",
    "CATALOG",
    canCreateDraft ? "SELLER_EDITOR" : "SELLER_VIEWER",
    canCreateDraft
      ? "Create the first product draft for this store."
      : "Open the catalog lane to review product readiness."
  );
  let isComplete = false;

  if (summary.storefrontVisible > 0) {
    status = createChecklistStatus(
      "READY",
      "Ready",
      "emerald",
      "At least one product is already visible in storefront and the catalog has an operational baseline."
    );
    cta = createChecklistCta(
      "Manage catalog",
      "CATALOG",
      "SELLER",
      "Catalog already has a visible product. Open the seller catalog to continue managing it."
    );
    isComplete = true;
  } else if (summary.needsRevision > 0) {
    status = createChecklistStatus(
      "NEEDS_REVISION",
      "Needs revision",
      "rose",
      "At least one seller product still needs revision before it can move forward."
    );
    cta = createChecklistCta(
      canCreateDraft ? "Revise product" : "Review catalog",
      "CATALOG",
      canCreateDraft ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canCreateDraft
        ? "Open catalog and revise the product that still needs seller changes."
        : "Open catalog to review the revision-required product state."
    );
  } else if (summary.submitted > 0) {
    status = createChecklistStatus(
      "PENDING_REVIEW",
      "Pending review",
      "amber",
      "At least one product is already in the review queue."
    );
    cta = createChecklistCta(
      "Wait for product review",
      "CATALOG",
      "ADMIN",
      "The current product submission is waiting for the next review outcome."
    );
  } else if (summary.readyToSubmit > 0) {
    status = createChecklistStatus(
      "READY_TO_SUBMIT",
      "Ready to submit",
      "sky",
      "At least one draft product is complete enough to move into the next seller submission step."
    );
    cta = createChecklistCta(
      canCreateDraft ? "Submit product" : "Review catalog",
      "CATALOG",
      canCreateDraft ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canCreateDraft
        ? "Open catalog and submit a ready draft product."
        : "Open catalog to review the current product pipeline."
    );
  } else if (summary.publishedBlocked > 0 || summary.internalOnly > 0 || summary.active > 0) {
    status = createChecklistStatus(
      "CATALOG_IN_PROGRESS",
      "In progress",
      "sky",
      "Products already exist, but none are visible in storefront yet."
    );
    cta = createChecklistCta(
      canCreateDraft ? "Publish product" : "Review catalog",
      "CATALOG",
      canCreateDraft ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canCreateDraft
        ? "Open catalog and move one product to a storefront-ready state."
        : "Open catalog to review the current product visibility state."
    );
  } else if (summary.drafts > 0 || summary.inactive > 0) {
    status = createChecklistStatus(
      "DRAFT_IN_PROGRESS",
      "Draft in progress",
      "amber",
      "The store already has product drafts, but none are ready for storefront visibility yet."
    );
    cta = createChecklistCta(
      canCreateDraft ? "Complete product draft" : "Review catalog",
      "CATALOG",
      canCreateDraft ? "SELLER_EDITOR" : "SELLER_VIEWER",
      canCreateDraft
        ? "Open catalog and continue the draft product flow."
        : "Open catalog to review the current draft state."
    );
  }

  return {
    key: "products",
    label: "Products",
    required: true,
    infoOnly: false,
    visible: canViewCatalog,
    isComplete,
    status: canViewCatalog
      ? status
      : createChecklistStatus(
          "ACCESS_DENIED",
          "Locked",
          "stone",
          "Product readiness is hidden unless this seller role can view the catalog."
        ),
    progress: {
      completed: summary.storefrontVisible > 0 ? 1 : 0,
      total: 1,
      missingFields: [],
    },
    cta: canViewCatalog
      ? cta
      : createChecklistCta(
          "Catalog access required",
          "CATALOG",
          "STORE_OWNER_OR_ADMIN",
          "Product readiness belongs to seller roles with catalog visibility."
        ),
    governance: {
      canEdit: canCreateDraft,
      managedBy: "SELLER_PRODUCT_WORKSPACE",
      note:
        "Product readiness follows the existing seller catalog and submission workflow without introducing a new approval state machine.",
    },
    meta: summary,
  };
};

const buildTeamChecklistItem = (
  teamSummary: TeamWorkspaceSummary,
  canManageTeam: boolean
) => {
  const collaboratorCount = 1 + Number(teamSummary.activeMembers || 0);
  const invitedMembers = Number(teamSummary.invitedMembers || 0);

  let status = createChecklistStatus(
    "OWNER_ONLY",
    "Owner only",
    "stone",
    "The store is currently handled only by the owner bridge or a single operator."
  );
  let cta = createChecklistCta(
    canManageTeam ? "Manage team" : "Review team access",
    "HOME",
    canManageTeam ? "SELLER_MANAGER" : "STORE_OWNER_OR_ADMIN",
    canManageTeam
      ? "Open the team lane if this store needs more collaborators."
      : "Team management remains outside this role."
  );

  if (invitedMembers > 0) {
    status = createChecklistStatus(
      "INVITATIONS_PENDING",
      "Invitations pending",
      "sky",
      "The store already has pending team invitations. This item stays informational only."
    );
  } else if (collaboratorCount > 1) {
    status = createChecklistStatus(
      "TEAM_ACTIVE",
      "Team active",
      "emerald",
      "More than one active collaborator exists on this store."
    );
  }

  return {
    key: "team",
    label: "Team",
    required: false,
    infoOnly: true,
    visible: true,
    isComplete: collaboratorCount > 1,
    status,
    progress: {
      completed: collaboratorCount,
      total: collaboratorCount + invitedMembers,
      missingFields: [],
    },
    cta,
    governance: {
      canEdit: canManageTeam,
      managedBy: "SELLER_TEAM_GOVERNANCE",
      note: "Team readiness is informational only and does not block store onboarding.",
    },
    meta: {
      collaboratorCount,
      invitedMembers,
      disabledMembers: Number(teamSummary.disabledMembers || 0),
      removedMembers: Number(teamSummary.removedMembers || 0),
    },
  };
};

const pickWorkspaceNextStep = (checklist: any[]) => {
  const requiredItems = checklist.filter((item) => item.required && item.visible !== false);
  const firstNeedsAction = requiredItems.find((item) => !item.isComplete);
  if (firstNeedsAction?.cta) {
    return {
      code: String(firstNeedsAction.status?.code || "NEXT_STEP"),
      label: String(firstNeedsAction.cta.label || "Follow next step"),
      lane: String(firstNeedsAction.cta.lane || "HOME"),
      actor: String(firstNeedsAction.cta.actor || "SELLER"),
      description:
        String(firstNeedsAction.cta.description || firstNeedsAction.status?.description || "") ||
        null,
    };
  }

  return {
    code: "NO_ACTION_REQUIRED",
    label: "No action required",
    lane: "HOME",
    actor: "SELLER",
    description: "The minimum onboarding checklist is already complete for the active store.",
  };
};

const buildWorkspaceSummaryStatus = (checklist: any[]) => {
  const requiredItems = checklist.filter((item) => item.required && item.visible !== false);
  const completedItems = requiredItems.filter((item) => item.isComplete).length;
  const totalItems = requiredItems.length;
  const incompleteItems = requiredItems.filter((item) => !item.isComplete);

  let status = createChecklistStatus(
    "READY",
    "Ready to operate",
    "emerald",
    "The minimum seller onboarding checklist is complete for this store."
  );

  if (incompleteItems.length > 0) {
    const hasHardBlock = incompleteItems.some((item) =>
      ["NEEDS_REVISION", "INCOMPLETE", "NO_PRODUCTS", "NOT_CONFIGURED", "INACTIVE"].includes(
        String(item.status?.code || "")
      )
    );
    const allWaitingReview = incompleteItems.every((item) =>
      ["PENDING_REVIEW", "SUBMITTED", "WAITING_REVIEW"].includes(String(item.status?.code || ""))
    );

    if (allWaitingReview) {
      status = createChecklistStatus(
        "WAITING_REVIEW",
        "Waiting for review",
        "amber",
        "Some onboarding items are already submitted and currently waiting for the next review outcome."
      );
    } else if (hasHardBlock) {
      status = createChecklistStatus(
        "ACTION_REQUIRED",
        "Action required",
        "amber",
        "Some required onboarding items still need seller follow-up before the store can be treated as ready."
      );
    } else {
      status = createChecklistStatus(
        "IN_PROGRESS",
        "In progress",
        "sky",
        "The store has started onboarding, but at least one required item is still in progress."
      );
    }
  }

  return {
    ...status,
    completedItems,
    totalItems,
    completionPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
  };
};

const buildWorkspaceReadinessSummary = (input: {
  store: any;
  activePaymentProfile?: any;
  pendingPaymentRequest?: any;
  productSummary?: ProductPipelineSummary | null;
  teamSummary?: TeamWorkspaceSummary | null;
  sellerAccess?: any;
  includeTeamInfo?: boolean;
}) => {
  const permissionKeys = Array.isArray(input.sellerAccess?.permissionKeys)
    ? input.sellerAccess.permissionKeys
    : [];
  const canEditStore = permissionKeys.includes("STORE_EDIT");
  const canViewPaymentProfile = permissionKeys.includes("PAYMENT_PROFILE_VIEW");
  const canEditPayment = permissionKeys.includes("PAYMENT_PROFILE_EDIT");
  const canViewCatalog = permissionKeys.includes("PRODUCT_VIEW");
  const canCreateProduct = permissionKeys.includes("PRODUCT_CREATE");
  const canManageTeam =
    permissionKeys.includes("STORE_MEMBERS_MANAGE") || permissionKeys.includes("STORE_ROLES_MANAGE");

  const storeItem = buildStoreProfileChecklistItem(input.store, canEditStore);
  const paymentItem = buildPaymentProfileChecklistItem(
    input.activePaymentProfile || null,
    input.pendingPaymentRequest || null,
    canEditPayment,
    canViewPaymentProfile
  );
  const productItem = buildProductChecklistItem(
    input.productSummary || emptyProductPipelineSummary(),
    canCreateProduct,
    canViewCatalog
  );

  const checklist: any[] = [storeItem, paymentItem, productItem];
  if (input.includeTeamInfo) {
    checklist.push(
      buildTeamChecklistItem(input.teamSummary || emptyTeamWorkspaceSummary(), canManageTeam)
    );
  }

  const summary = buildWorkspaceSummaryStatus(checklist);
  const nextStep = pickWorkspaceNextStep(checklist);

  return {
    summary,
    checklist,
    nextStep,
    boundaries: {
      sourceOfTruth:
        "Workspace readiness is derived from backend store profile completeness, payment profile workflow, and seller product pipeline data.",
      adminAuthority:
        "Readiness highlights next steps, but it does not transfer final payment approval or other admin-owned authority into seller workspace.",
      storefrontBoundary:
        "Public storefront behavior still follows the existing store and product visibility contracts. This checklist does not change storefront rules.",
    },
  };
};

const loadProductPipelineSummaryByStoreIds = async (storeIds: number[]) => {
  if (!storeIds.length) return new Map<number, ProductPipelineSummary>();

  const [
    totalProducts,
    drafts,
    readyToSubmit,
    active,
    inactive,
    submitted,
    needsRevision,
    storefrontVisible,
    publishedBlocked,
    internalOnly,
  ] = await Promise.all([
    countProductsByStoreIds(storeIds, {}),
    countProductsByStoreIds(storeIds, { status: "draft" }),
    countProductsByStoreIds(storeIds, {
      status: "draft",
      sellerSubmissionStatus: "none",
    }),
    countProductsByStoreIds(storeIds, { status: "active" }),
    countProductsByStoreIds(storeIds, { status: "inactive" }),
    countProductsByStoreIds(storeIds, { sellerSubmissionStatus: "submitted" }),
    countProductsByStoreIds(storeIds, { sellerSubmissionStatus: "needs_revision" }),
    countProductsByStoreIds(storeIds, {
      isPublished: true,
      status: "active",
      sellerSubmissionStatus: "none",
    }),
    countProductsByStoreIds(storeIds, {
      isPublished: true,
      [Op.or]: [
        { status: { [Op.ne]: "active" } },
        { sellerSubmissionStatus: { [Op.in]: ["submitted", "needs_revision"] } },
      ],
    }),
    countProductsByStoreIds(storeIds, {
      isPublished: false,
    }),
  ]);

  const summaryMap = new Map<number, ProductPipelineSummary>();
  for (const storeId of storeIds) {
    const result = {
      totalProducts: totalProducts.get(storeId) || 0,
      drafts: drafts.get(storeId) || 0,
      readyToSubmit: readyToSubmit.get(storeId) || 0,
      active: active.get(storeId) || 0,
      inactive: inactive.get(storeId) || 0,
      submitted: submitted.get(storeId) || 0,
      needsRevision: needsRevision.get(storeId) || 0,
      reviewQueue: (submitted.get(storeId) || 0) + (needsRevision.get(storeId) || 0),
      storefrontVisible: storefrontVisible.get(storeId) || 0,
      publishedBlocked: publishedBlocked.get(storeId) || 0,
      internalOnly: internalOnly.get(storeId) || 0,
    };
    summaryMap.set(storeId, result);
  }

  return summaryMap;
};

const loadTeamWorkspaceSummaryByStoreIds = async (storeIds: number[]) => {
  if (!storeIds.length) return new Map<number, TeamWorkspaceSummary>();

  const [activeMembers, invitedMembers, disabledMembers, removedMembers] = await Promise.all([
    countMembersByStoreIds(storeIds, "ACTIVE"),
    countMembersByStoreIds(storeIds, "INVITED"),
    countMembersByStoreIds(storeIds, "DISABLED"),
    countMembersByStoreIds(storeIds, "REMOVED"),
  ]);

  const summaryMap = new Map<number, TeamWorkspaceSummary>();
  for (const storeId of storeIds) {
    summaryMap.set(storeId, {
      activeMembers: activeMembers.get(storeId) || 0,
      invitedMembers: invitedMembers.get(storeId) || 0,
      disabledMembers: disabledMembers.get(storeId) || 0,
      removedMembers: removedMembers.get(storeId) || 0,
    });
  }

  return summaryMap;
};

export {
  buildWorkspaceReadinessSummary,
  emptyProductPipelineSummary,
  emptyTeamWorkspaceSummary,
  loadProductPipelineSummaryByStoreIds,
  loadTeamWorkspaceSummaryByStoreIds,
};

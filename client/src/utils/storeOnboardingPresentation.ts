export type StoreApplicationStatusCode =
  | "draft"
  | "submitted"
  | "under_review"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "cancelled";

type Tone = "stone" | "amber" | "sky" | "emerald" | "rose";

type StatusInput = {
  code?: string | null;
  label?: string | null;
  tone?: string | null;
  description?: string | null;
};

type ReadinessInput = {
  storeStatus?: string | null;
  hasStore?: boolean;
  sellerAccessReady?: boolean;
};

const APPLICATION_STATUS_COPY: Record<
  StoreApplicationStatusCode,
  {
    label: string;
    tone: Tone;
    description: string;
    shortDescription: string;
  }
> = {
  draft: {
    label: "Draft",
    tone: "stone",
    description: "Complete the required details before you submit.",
    shortDescription: "Keep filling in the application.",
  },
  submitted: {
    label: "Submitted",
    tone: "amber",
    description: "The application was sent and is waiting for review.",
    shortDescription: "Submitted and waiting for review.",
  },
  under_review: {
    label: "In Review",
    tone: "sky",
    description: "The application is currently being reviewed.",
    shortDescription: "Review is in progress.",
  },
  revision_requested: {
    label: "Needs Revision",
    tone: "rose",
    description: "Update the requested changes and submit again.",
    shortDescription: "Changes are required before resubmission.",
  },
  approved: {
    label: "Approved",
    tone: "emerald",
    description: "Seller access was approved.",
    shortDescription: "Seller access is approved.",
  },
  rejected: {
    label: "Rejected",
    tone: "rose",
    description: "This application was closed by review.",
    shortDescription: "The application was rejected.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "stone",
    description: "This application was cancelled.",
    shortDescription: "The application was cancelled.",
  },
};

const READINESS_COPY = {
  active: {
    label: "Active",
    tone: "emerald" as Tone,
    description: "Seller access is available for this store.",
  },
  inactive: {
    label: "Inactive",
    tone: "stone" as Tone,
    description: "The store exists, but it is not active yet.",
  },
  pending_setup: {
    label: "Pending Setup",
    tone: "amber" as Tone,
    description: "Approval is recorded, but seller store setup is still syncing.",
  },
  not_public: {
    label: "Not Public",
    tone: "stone" as Tone,
    description: "The store is not public yet.",
  },
} as const;

export const STORE_APPLICATION_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: APPLICATION_STATUS_COPY.draft.label },
  { value: "submitted", label: APPLICATION_STATUS_COPY.submitted.label },
  { value: "under_review", label: APPLICATION_STATUS_COPY.under_review.label },
  {
    value: "revision_requested",
    label: APPLICATION_STATUS_COPY.revision_requested.label,
  },
  { value: "approved", label: APPLICATION_STATUS_COPY.approved.label },
  { value: "rejected", label: APPLICATION_STATUS_COPY.rejected.label },
  { value: "cancelled", label: APPLICATION_STATUS_COPY.cancelled.label },
] as const;

export const normalizeStoreApplicationStatusCode = (
  value: unknown
): StoreApplicationStatusCode => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "submitted") return "submitted";
  if (normalized === "under_review") return "under_review";
  if (normalized === "revision_requested") return "revision_requested";
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "cancelled") return "cancelled";
  return "draft";
};

export const presentStoreApplicationStatus = (
  value: StatusInput | string | null | undefined,
  fallbackCode: StoreApplicationStatusCode = "draft"
) => {
  const raw =
    value && typeof value === "object" ? value.code || fallbackCode : value || fallbackCode;
  const code = normalizeStoreApplicationStatusCode(raw);
  const copy = APPLICATION_STATUS_COPY[code];
  return {
    code,
    label: copy.label,
    tone: copy.tone,
    description: copy.description,
    shortDescription: copy.shortDescription,
  };
};

export const presentStoreReadiness = (input: ReadinessInput | null | undefined) => {
  const storeStatus = String(input?.storeStatus || "").trim().toUpperCase();
  if (storeStatus === "ACTIVE") {
    return {
      code: "active",
      ...READINESS_COPY.active,
    };
  }
  if (storeStatus === "INACTIVE") {
    return {
      code: "inactive",
      ...READINESS_COPY.inactive,
    };
  }
  if (input?.sellerAccessReady) {
    return {
      code: "pending_setup",
      ...READINESS_COPY.pending_setup,
    };
  }
  return {
    code: "not_public",
    ...READINESS_COPY.not_public,
  };
};

export const getStoreOnboardingPrimaryAction = (status: unknown, hasWorkspace: boolean) => {
  const code = normalizeStoreApplicationStatusCode(status);
  if (hasWorkspace) return "Go to Seller Workspace";
  if (code === "revision_requested") return "Review Changes";
  if (code === "submitted" || code === "under_review") return "View Status";
  if (code === "approved") return "View Status";
  if (code === "rejected" || code === "cancelled") return "Start New Application";
  if (code === "draft") return "Continue Application";
  return "Start Selling";
};

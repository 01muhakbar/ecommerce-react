import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Save,
  SendHorizonal,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { listSellerWorkspaceStores } from "../../api/sellerWorkspace.ts";
import {
  cancelUserStoreApplication,
  createEmptyStoreApplicationSnapshots,
  createUserStoreApplicationDraft,
  getCurrentUserStoreApplication,
  resubmitUserStoreApplication,
  submitUserStoreApplication,
  updateUserStoreApplicationDraft,
} from "../../api/userStoreApplications.ts";
import { createSellerWorkspaceRoutes } from "../../utils/sellerWorkspaceRoute.js";
import {
  presentStoreApplicationStatus,
  presentStoreReadiness,
} from "../../utils/storeOnboardingPresentation.ts";

const QUERY_KEY = ["user", "store-application", "current"];
const SELLER_STORES_QUERY_KEY = ["seller", "workspace", "stores"];

const STEP_CONFIG = [
  {
    code: "owner_identity",
    label: "Owner Details",
    description: "Owner identity and primary contact.",
  },
  {
    code: "store_information",
    label: "Store Information",
    description: "Store name, category, and business summary.",
  },
  {
    code: "operational_address",
    label: "Business Address",
    description: "Business contact and operating address.",
  },
  {
    code: "payout_payment",
    label: "Payout Details",
    description: "Payout method and account details.",
  },
  {
    code: "compliance",
    label: "Compliance",
    description: "Support details, declarations, and consent.",
  },
  {
    code: "review",
    label: "Review & Submit",
    description: "Review the application before submission.",
  },
];

const STATUS_BADGE_CLASS = {
  stone: "bg-slate-100 text-slate-700",
  warning: "bg-amber-100 text-amber-700",
  amber: "bg-amber-100 text-amber-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

const SECTION_CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-5";
const FIELD_CLASS =
  "mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const TEXTAREA_CLASS = `${FIELD_CLASS} min-h-[112px]`;

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toNullableText = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const createFormState = (application, user) => {
  const empty = createEmptyStoreApplicationSnapshots();
  if (!application) {
    return {
      ...empty,
      ownerIdentitySnapshot: {
        ...empty.ownerIdentitySnapshot,
        fullName: toNullableText(user?.name),
        operationalContactName: toNullableText(user?.name),
        email: toNullableText(user?.email),
        phoneNumber: toNullableText(user?.phoneNumber || user?.phone),
      },
      operationalAddressSnapshot: {
        ...empty.operationalAddressSnapshot,
        country: "Indonesia",
      },
      complianceSnapshot: {
        ...empty.complianceSnapshot,
        supportEmail: toNullableText(user?.email),
        supportPhone: toNullableText(user?.phoneNumber || user?.phone),
      },
    };
  }

  return {
    ownerIdentitySnapshot: {
      ...empty.ownerIdentitySnapshot,
      ...(application.ownerIdentitySnapshot || {}),
    },
    storeInformationSnapshot: {
      ...empty.storeInformationSnapshot,
      ...(application.storeInformationSnapshot || {}),
    },
    operationalAddressSnapshot: {
      ...empty.operationalAddressSnapshot,
      ...(application.operationalAddressSnapshot || {}),
    },
    payoutPaymentSnapshot: {
      ...empty.payoutPaymentSnapshot,
      ...(application.payoutPaymentSnapshot || {}),
    },
    complianceSnapshot: {
      ...empty.complianceSnapshot,
      ...(application.complianceSnapshot || {}),
    },
  };
};

const buildDraftPayload = (form, currentStep) => ({
  currentStep,
  ownerIdentitySnapshot: {
    fullName: toNullableText(form.ownerIdentitySnapshot.fullName),
    operationalContactName: toNullableText(form.ownerIdentitySnapshot.operationalContactName),
    email: toNullableText(form.ownerIdentitySnapshot.email),
    phoneNumber: toNullableText(form.ownerIdentitySnapshot.phoneNumber),
    birthDate: toNullableText(form.ownerIdentitySnapshot.birthDate),
    identityType: toNullableText(form.ownerIdentitySnapshot.identityType),
    identityLegalName: toNullableText(form.ownerIdentitySnapshot.identityLegalName),
  },
  storeInformationSnapshot: {
    storeName: toNullableText(form.storeInformationSnapshot.storeName),
    storeSlug: toNullableText(form.storeInformationSnapshot.storeSlug),
    storeCategory: toNullableText(form.storeInformationSnapshot.storeCategory),
    description: toNullableText(form.storeInformationSnapshot.description),
    sellerType: toNullableText(form.storeInformationSnapshot.sellerType),
    isSelfProduced: Boolean(form.storeInformationSnapshot.isSelfProduced),
    initialProductCount: toNumberOrNull(form.storeInformationSnapshot.initialProductCount),
  },
  operationalAddressSnapshot: {
    contactName: toNullableText(form.operationalAddressSnapshot.contactName),
    phoneNumber: toNullableText(form.operationalAddressSnapshot.phoneNumber),
    addressLine1: toNullableText(form.operationalAddressSnapshot.addressLine1),
    addressLine2: toNullableText(form.operationalAddressSnapshot.addressLine2),
    city: toNullableText(form.operationalAddressSnapshot.city),
    province: toNullableText(form.operationalAddressSnapshot.province),
    district: toNullableText(form.operationalAddressSnapshot.district),
    postalCode: toNullableText(form.operationalAddressSnapshot.postalCode),
    country: toNullableText(form.operationalAddressSnapshot.country),
    notes: toNullableText(form.operationalAddressSnapshot.notes),
  },
  payoutPaymentSnapshot: {
    payoutMethod: toNullableText(form.payoutPaymentSnapshot.payoutMethod),
    accountHolderName: toNullableText(form.payoutPaymentSnapshot.accountHolderName),
    accountNumber: toNullableText(form.payoutPaymentSnapshot.accountNumber),
    bankName: toNullableText(form.payoutPaymentSnapshot.bankName),
    qrisImageUrl: toNullableText(form.payoutPaymentSnapshot.qrisImageUrl),
    accountHolderMatchesIdentity: Boolean(
      form.payoutPaymentSnapshot.accountHolderMatchesIdentity
    ),
  },
  complianceSnapshot: {
    supportEmail: toNullableText(form.complianceSnapshot.supportEmail),
    supportPhone: toNullableText(form.complianceSnapshot.supportPhone),
    taxId: toNullableText(form.complianceSnapshot.taxId),
    identityNumber: toNullableText(form.complianceSnapshot.identityNumber),
    productTypes: toNullableText(form.complianceSnapshot.productTypes),
    brandOwnershipType: toNullableText(form.complianceSnapshot.brandOwnershipType),
    authenticityConfirmed: Boolean(form.complianceSnapshot.authenticityConfirmed),
    prohibitedGoodsConfirmed: Boolean(form.complianceSnapshot.prohibitedGoodsConfirmed),
    websiteUrl: toNullableText(form.complianceSnapshot.websiteUrl),
    socialMediaUrl: toNullableText(form.complianceSnapshot.socialMediaUrl),
    notes: toNullableText(form.complianceSnapshot.notes),
    agreedToTerms: Boolean(form.complianceSnapshot.agreedToTerms),
    agreedToAdminReview: Boolean(form.complianceSnapshot.agreedToAdminReview),
    agreedToPlatformPolicy: Boolean(form.complianceSnapshot.agreedToPlatformPolicy),
    understandsStoreInactiveUntilApproved: Boolean(
      form.complianceSnapshot.understandsStoreInactiveUntilApproved
    ),
  },
});

const buildLocalCompleteness = (form) => {
  const missingFields = [];

  if (!toText(form.ownerIdentitySnapshot.fullName)) {
    missingFields.push({ key: "ownerIdentitySnapshot.fullName", label: "Full name" });
  }
  if (!toText(form.ownerIdentitySnapshot.email)) {
    missingFields.push({ key: "ownerIdentitySnapshot.email", label: "Email address" });
  }
  if (!toText(form.storeInformationSnapshot.storeName)) {
    missingFields.push({ key: "storeInformationSnapshot.storeName", label: "Store name" });
  }
  if (!toText(form.operationalAddressSnapshot.addressLine1)) {
    missingFields.push({
      key: "operationalAddressSnapshot.addressLine1",
      label: "Business address",
    });
  }
  if (!toText(form.operationalAddressSnapshot.city)) {
    missingFields.push({ key: "operationalAddressSnapshot.city", label: "City" });
  }
  if (!toText(form.operationalAddressSnapshot.province)) {
    missingFields.push({ key: "operationalAddressSnapshot.province", label: "Province" });
  }
  if (!toText(form.operationalAddressSnapshot.country)) {
    missingFields.push({ key: "operationalAddressSnapshot.country", label: "Country" });
  }
  if (!toText(form.payoutPaymentSnapshot.payoutMethod)) {
    missingFields.push({ key: "payoutPaymentSnapshot.payoutMethod", label: "Payout method" });
  }
  if (!toText(form.payoutPaymentSnapshot.accountHolderName)) {
    missingFields.push({
      key: "payoutPaymentSnapshot.accountHolderName",
      label: "Account holder name",
    });
  }
  if (!toText(form.complianceSnapshot.supportEmail)) {
    missingFields.push({ key: "complianceSnapshot.supportEmail", label: "Support email" });
  }
  if (!form.complianceSnapshot.agreedToTerms) {
    missingFields.push({
      key: "complianceSnapshot.agreedToTerms",
      label: "Terms confirmation",
    });
  }
  if (!form.complianceSnapshot.agreedToAdminReview) {
    missingFields.push({
      key: "complianceSnapshot.agreedToAdminReview",
      label: "Admin review consent",
    });
  }
  if (!form.complianceSnapshot.agreedToPlatformPolicy) {
    missingFields.push({
      key: "complianceSnapshot.agreedToPlatformPolicy",
      label: "Platform policy consent",
    });
  }
  if (!form.complianceSnapshot.understandsStoreInactiveUntilApproved) {
    missingFields.push({
      key: "complianceSnapshot.understandsStoreInactiveUntilApproved",
      label: "Inactive until approval confirmation",
    });
  }
  if (!form.complianceSnapshot.authenticityConfirmed) {
    missingFields.push({
      key: "complianceSnapshot.authenticityConfirmed",
      label: "Authenticity confirmation",
    });
  }
  if (!form.complianceSnapshot.prohibitedGoodsConfirmed) {
    missingFields.push({
      key: "complianceSnapshot.prohibitedGoodsConfirmed",
      label: "Prohibited goods confirmation",
    });
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
};

const getRequestErrorMessage = (error, fallback) => {
  const payload = error?.response?.data || {};
  if (String(payload?.code || "").toUpperCase() === "STORE_APPLICATION_INCOMPLETE") {
    const labels = Array.isArray(payload?.details?.missingFields)
      ? payload.details.missingFields.map((entry) => entry?.label).filter(Boolean)
      : [];
    if (labels.length) {
      return `Complete the required fields before submission: ${labels.join(", ")}.`;
    }
  }
  if (String(payload?.code || "").toUpperCase() === "OPEN_STORE_APPLICATION_EXISTS") {
    return "An active store application already exists for this account.";
  }
  if (String(payload?.code || "").toUpperCase() === "STORE_ALREADY_EXISTS_FOR_USER") {
    return "This account already has a store. Use the available seller workspace.";
  }
  return payload?.message || error?.message || fallback;
};

function StatusBadge({ label, tone = "stone" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_BADGE_CLASS[tone] || STATUS_BADGE_CLASS.stone
      }`}
    >
      {label}
    </span>
  );
}

function Field({ label, hint, multiline = false, className = "", ...props }) {
  return (
    <label className={className}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {multiline ? (
        <textarea {...props} className={TEXTAREA_CLASS} />
      ) : (
        <input {...props} className={FIELD_CLASS} />
      )}
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

function SelectField({ label, hint, options, className = "", ...props }) {
  return (
    <label className={className}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select {...props} className={FIELD_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </label>
  );
}

function CheckboxField({ label, hint, checked, onChange, disabled = false }) {
  return (
    <label className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
      />
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{toText(value, "-")}</p>
    </div>
  );
}

function InfoNotice({ tone = "info", children }) {
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${toneClass}`}>{children}</div>;
}

function SectionHeader({ title, description, eyebrow = "Store Application" }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export default function AccountStoreApplicationPage() {
  const queryClient = useQueryClient();
  const { user } = useOutletContext() || {};
  const [activeStep, setActiveStep] = useState("owner_identity");
  const [form, setForm] = useState(() => createFormState(null, user));
  const [flash, setFlash] = useState(null);

  const applicationQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCurrentUserStoreApplication,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const sellerStoresQuery = useQuery({
    queryKey: SELLER_STORES_QUERY_KEY,
    queryFn: listSellerWorkspaceStores,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const application = applicationQuery.data || null;
  const sellerStores = Array.isArray(sellerStoresQuery.data) ? sellerStoresQuery.data : [];

  const ownerStore = useMemo(() => {
    const owned = sellerStores.filter((entry) => entry?.access?.isOwner);
    return (
      owned.sort((left, right) => {
        const leftActive = String(left?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        const rightActive =
          String(right?.store?.status || "").toUpperCase() === "ACTIVE" ? 1 : 0;
        if (leftActive !== rightActive) return rightActive - leftActive;
        return String(left?.store?.name || "").localeCompare(String(right?.store?.name || ""));
      })[0] || null
    );
  }, [sellerStores]);

  const workspaceHref = ownerStore
    ? createSellerWorkspaceRoutes(ownerStore.store).home()
    : sellerStores[0]
      ? createSellerWorkspaceRoutes(sellerStores[0].store).home()
      : null;
  const applicationPresentation = application
    ? presentStoreApplicationStatus(application.statusMeta, application.status)
    : presentStoreApplicationStatus("draft");
  const readinessPresentation = presentStoreReadiness({
    storeStatus: ownerStore?.store?.status || application?.activation?.storeStatus || null,
    hasStore: Boolean(ownerStore || sellerStores[0] || application?.activation?.storeId),
    sellerAccessReady: Boolean(application?.activation?.sellerAccessReady),
  });

  useEffect(() => {
    setForm(createFormState(application, user));
    setActiveStep(application?.currentStep || "owner_identity");
  }, [application, user]);

  const editable = application?.workflow?.canEdit ?? false;
  const currentStepIndex = STEP_CONFIG.findIndex((step) => step.code === activeStep);
  const localCompleteness = useMemo(() => buildLocalCompleteness(form), [form]);

  const updateSection = (sectionKey, field, value) => {
    setForm((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [field]: value,
      },
    }));
  };

  const hydrateApplication = (nextApplication, successMessage) => {
    queryClient.setQueryData(QUERY_KEY, nextApplication);
    setFlash(successMessage ? { type: "success", message: successMessage } : null);
  };

  const createDraftMutation = useMutation({
    mutationFn: () =>
      createUserStoreApplicationDraft({
        ownerIdentitySnapshot: {
          fullName: toNullableText(user?.name),
          operationalContactName: toNullableText(user?.name),
          email: toNullableText(user?.email),
          phoneNumber: toNullableText(user?.phoneNumber || user?.phone),
        },
        operationalAddressSnapshot: {
          country: "Indonesia",
        },
        complianceSnapshot: {
          supportEmail: toNullableText(user?.email),
          supportPhone: toNullableText(user?.phoneNumber || user?.phone),
        },
      }),
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Draft created.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(
          error,
          "Failed to create the draft."
        ),
      });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      if (!application?.id) throw new Error("Store application draft is missing.");
      return updateUserStoreApplicationDraft(
        application.id,
        buildDraftPayload(form, activeStep)
      );
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Draft saved.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Failed to save the draft."),
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!application?.id) throw new Error("Store application draft is missing.");
      await updateUserStoreApplicationDraft(
        application.id,
        buildDraftPayload(form, "review")
      );
      return application.status === "revision_requested"
        ? resubmitUserStoreApplication(application.id)
        : submitUserStoreApplication(application.id);
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(
        nextApplication,
        application?.status === "revision_requested"
          ? "Application resubmitted for review."
          : "Application submitted for review."
      );
      setActiveStep("review");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Failed to submit the application."),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!application?.id) throw new Error("Store application is missing.");
      return cancelUserStoreApplication(application.id);
    },
    onSuccess: (nextApplication) => {
      hydrateApplication(nextApplication, "Application cancelled.");
    },
    onError: (error) => {
      setFlash({
        type: "error",
        message: getRequestErrorMessage(error, "Failed to cancel the application."),
      });
    },
  });

  const isBusy =
    createDraftMutation.isPending ||
    saveDraftMutation.isPending ||
    submitMutation.isPending ||
    cancelMutation.isPending;

  const handleRestart = () => {
    setFlash(null);
    createDraftMutation.mutate();
  };

  const handleCancelApplication = () => {
    if (!application?.workflow?.canCancel || isBusy) return;
    if (!window.confirm("Cancel this store application?")) {
      return;
    }
    setFlash(null);
    cancelMutation.mutate();
  };

  const renderOwnerSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Owner Details</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add the owner identity and primary contact used for review.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Full Name"
          value={form.ownerIdentitySnapshot.fullName || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "fullName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Full name"
        />
        <Field
          label="Primary Contact"
          value={form.ownerIdentitySnapshot.operationalContactName || ""}
          onChange={(event) =>
            updateSection(
              "ownerIdentitySnapshot",
              "operationalContactName",
              event.target.value
            )
          }
          disabled={!editable || isBusy}
          placeholder="Primary contact name"
        />
        <Field
          label="Email Address"
          value={form.ownerIdentitySnapshot.email || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "email", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="name@email.com"
          type="email"
        />
        <Field
          label="Phone Number"
          value={form.ownerIdentitySnapshot.phoneNumber || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "phoneNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="+62..."
        />
        <Field
          label="Birth Date"
          value={form.ownerIdentitySnapshot.birthDate || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "birthDate", event.target.value)
          }
          disabled={!editable || isBusy}
          type="date"
        />
        <SelectField
          label="ID Type"
          value={form.ownerIdentitySnapshot.identityType || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "identityType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Select an ID type" },
            { value: "KTP", label: "National ID" },
            { value: "SIM", label: "Driver License" },
            { value: "PASSPORT", label: "Passport" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Field
          label="ID Number"
          value={form.complianceSnapshot.identityNumber || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "identityNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="ID number"
        />
        <Field
          label="Legal Name"
          value={form.ownerIdentitySnapshot.identityLegalName || ""}
          onChange={(event) =>
            updateSection("ownerIdentitySnapshot", "identityLegalName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Legal name"
        />
      </div>
    </section>
  );

  const renderStoreSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Store Information</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add the main store profile details for review.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Store Name"
          value={form.storeInformationSnapshot.storeName || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Store name"
        />
        <Field
          label="Store Slug"
          value={form.storeInformationSnapshot.storeSlug || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeSlug", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="example-store"
          hint="Optional. Use lowercase letters and hyphens."
        />
        <Field
          label="Business Category"
          value={form.storeInformationSnapshot.storeCategory || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "storeCategory", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Fashion, food, electronics, and more"
        />
        <SelectField
          label="Seller Type"
          value={form.storeInformationSnapshot.sellerType || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "sellerType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Select a seller type" },
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "UMKM", label: "SME" },
            { value: "COMPANY", label: "Company" },
            { value: "DISTRIBUTOR", label: "Distributor" },
          ]}
        />
        <SelectField
          label="Self Produced"
          value={form.storeInformationSnapshot.isSelfProduced ? "yes" : "no"}
          onChange={(event) =>
            updateSection(
              "storeInformationSnapshot",
              "isSelfProduced",
              event.target.value === "yes"
            )
          }
          disabled={!editable || isBusy}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />
        <Field
          label="Initial Product Count"
          value={form.storeInformationSnapshot.initialProductCount ?? ""}
          onChange={(event) =>
            updateSection(
              "storeInformationSnapshot",
              "initialProductCount",
              event.target.value
            )
          }
          disabled={!editable || isBusy}
          placeholder="0"
          type="number"
          min="0"
        />
        <Field
          label="Store Description"
          multiline
          className="md:col-span-2"
          value={form.storeInformationSnapshot.description || ""}
          onChange={(event) =>
            updateSection("storeInformationSnapshot", "description", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Briefly describe the store and what you sell"
        />
      </div>
    </section>
  );

  const renderAddressSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Business Address</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add the operating contact and address for the business.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Contact Name"
          value={form.operationalAddressSnapshot.contactName || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "contactName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Contact name"
        />
        <Field
          label="Business Phone"
          value={form.operationalAddressSnapshot.phoneNumber || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "phoneNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="+62..."
        />
        <Field
          label="Address Line 1"
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.addressLine1 || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "addressLine1", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Street address"
        />
        <Field
          label="Address Line 2"
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.addressLine2 || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "addressLine2", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Unit, block, or landmark"
        />
        <Field
          label="Province"
          value={form.operationalAddressSnapshot.province || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "province", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Province"
        />
        <Field
          label="City"
          value={form.operationalAddressSnapshot.city || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "city", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="City"
        />
        <Field
          label="District"
          value={form.operationalAddressSnapshot.district || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "district", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="District"
        />
        <Field
          label="Postal Code"
          value={form.operationalAddressSnapshot.postalCode || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "postalCode", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Postal code"
        />
        <Field
          label="Country"
          value={form.operationalAddressSnapshot.country || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "country", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Indonesia"
        />
        <Field
          label="Address Notes"
          multiline
          className="md:col-span-2"
          value={form.operationalAddressSnapshot.notes || ""}
          onChange={(event) =>
            updateSection("operationalAddressSnapshot", "notes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Optional notes for address verification"
        />
      </div>
    </section>
  );

  const renderPayoutSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Payout Details</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add the payout method and account details used by the business.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Account Holder Name"
          value={form.payoutPaymentSnapshot.accountHolderName || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "accountHolderName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Name on the account"
        />
        <Field
          label="Bank or Channel"
          value={form.payoutPaymentSnapshot.bankName || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "bankName", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="BCA, BRI, SeaBank, QRIS"
        />
        <Field
          label="Payout Method"
          value={form.payoutPaymentSnapshot.payoutMethod || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "payoutMethod", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Bank transfer, QRIS, e-wallet"
        />
        <Field
          label="Account Number"
          value={form.payoutPaymentSnapshot.accountNumber || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "accountNumber", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Account number"
        />
        <Field
          label="Tax ID"
          value={form.complianceSnapshot.taxId || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "taxId", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Optional"
        />
        <Field
          label="URL QRIS"
          value={form.payoutPaymentSnapshot.qrisImageUrl || ""}
          onChange={(event) =>
            updateSection("payoutPaymentSnapshot", "qrisImageUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://..."
          hint="Optional. Add this only if QRIS is part of the payout setup."
        />
        <div className="md:col-span-2">
          <CheckboxField
            label="The account holder matches the legal identity"
            hint="Use this when the payout account is under the same legal name."
            checked={Boolean(form.payoutPaymentSnapshot.accountHolderMatchesIdentity)}
            onChange={(event) =>
              updateSection(
                "payoutPaymentSnapshot",
                "accountHolderMatchesIdentity",
                event.target.checked
              )
            }
            disabled={!editable || isBusy}
          />
        </div>
      </div>
    </section>
  );

  const renderComplianceSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <h2 className="text-lg font-semibold text-slate-950">Compliance</h2>
      <p className="mt-2 text-sm text-slate-600">
        Add support details and complete the required declarations.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Support Email"
          value={form.complianceSnapshot.supportEmail || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "supportEmail", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="support@store.com"
          type="email"
        />
        <Field
          label="Support Phone"
          value={form.complianceSnapshot.supportPhone || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "supportPhone", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="+62..."
        />
        <Field
          label="Product Types"
          value={form.complianceSnapshot.productTypes || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "productTypes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Examples: apparel, frozen food, gadgets"
        />
        <SelectField
          label="Brand Ownership"
          value={form.complianceSnapshot.brandOwnershipType || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "brandOwnershipType", event.target.value)
          }
          disabled={!editable || isBusy}
          options={[
            { value: "", label: "Select brand ownership" },
            { value: "OWN_BRAND", label: "Own Brand" },
            { value: "THIRD_PARTY", label: "Third Party" },
            { value: "MIXED", label: "Mixed" },
          ]}
        />
        <Field
          label="Website"
          value={form.complianceSnapshot.websiteUrl || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "websiteUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://..."
        />
        <Field
          label="Social Profile"
          value={form.complianceSnapshot.socialMediaUrl || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "socialMediaUrl", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="https://instagram.com/..."
        />
        <Field
          label="Additional Notes"
          multiline
          className="md:col-span-2"
          value={form.complianceSnapshot.notes || ""}
          onChange={(event) =>
            updateSection("complianceSnapshot", "notes", event.target.value)
          }
          disabled={!editable || isBusy}
          placeholder="Optional notes for review"
        />
      </div>

      <div className="mt-5 grid gap-3">
        <CheckboxField
          label="I confirm the products are authentic."
          checked={Boolean(form.complianceSnapshot.authenticityConfirmed)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "authenticityConfirmed",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="I confirm the store does not sell prohibited goods."
          checked={Boolean(form.complianceSnapshot.prohibitedGoodsConfirmed)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "prohibitedGoodsConfirmed",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="I confirm the submitted information is accurate."
          checked={Boolean(form.complianceSnapshot.agreedToTerms)}
          onChange={(event) =>
            updateSection("complianceSnapshot", "agreedToTerms", event.target.checked)
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="I agree to admin review."
          checked={Boolean(form.complianceSnapshot.agreedToAdminReview)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "agreedToAdminReview",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="I agree to the seller and platform policies."
          checked={Boolean(form.complianceSnapshot.agreedToPlatformPolicy)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "agreedToPlatformPolicy",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
        <CheckboxField
          label="I understand the store stays inactive until approval."
          checked={Boolean(form.complianceSnapshot.understandsStoreInactiveUntilApproved)}
          onChange={(event) =>
            updateSection(
              "complianceSnapshot",
              "understandsStoreInactiveUntilApproved",
              event.target.checked
            )
          }
          disabled={!editable || isBusy}
        />
      </div>
    </section>
  );

  const renderReviewSection = () => (
    <section className={SECTION_CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Review & Submit</h2>
          <p className="mt-2 text-sm text-slate-600">
            Review the application before you save or submit it.
          </p>
        </div>
        {application?.statusMeta ? (
          <StatusBadge
            label={application.statusMeta.label}
            tone={application.statusMeta.tone}
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">1. Owner Details</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Full Name" value={form.ownerIdentitySnapshot.fullName} />
            <SummaryItem
              label="Primary Contact"
              value={form.ownerIdentitySnapshot.operationalContactName}
            />
            <SummaryItem label="Email Address" value={form.ownerIdentitySnapshot.email} />
            <SummaryItem label="Phone Number" value={form.ownerIdentitySnapshot.phoneNumber} />
            <SummaryItem label="Birth Date" value={form.ownerIdentitySnapshot.birthDate} />
            <SummaryItem label="ID Type" value={form.ownerIdentitySnapshot.identityType} />
            <SummaryItem label="ID Number" value={form.complianceSnapshot.identityNumber} />
            <SummaryItem
              label="Legal Name"
              value={form.ownerIdentitySnapshot.identityLegalName}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">2. Store Information</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Store Name" value={form.storeInformationSnapshot.storeName} />
            <SummaryItem label="Store Slug" value={form.storeInformationSnapshot.storeSlug} />
            <SummaryItem
              label="Business Category"
              value={form.storeInformationSnapshot.storeCategory}
            />
            <SummaryItem label="Seller Type" value={form.storeInformationSnapshot.sellerType} />
            <SummaryItem
              label="Self Produced"
              value={form.storeInformationSnapshot.isSelfProduced ? "Yes" : "No"}
            />
            <SummaryItem
              label="Initial Product Count"
              value={
                form.storeInformationSnapshot.initialProductCount !== null
                  ? String(form.storeInformationSnapshot.initialProductCount)
                  : null
              }
            />
            <SummaryItem
              label="Store Description"
              value={form.storeInformationSnapshot.description}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">3. Business Address</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem
              label="Contact Name"
              value={form.operationalAddressSnapshot.contactName}
            />
            <SummaryItem
              label="Business Phone"
              value={form.operationalAddressSnapshot.phoneNumber}
            />
            <SummaryItem
              label="Address Line 1"
              value={form.operationalAddressSnapshot.addressLine1}
            />
            <SummaryItem
              label="Address Line 2"
              value={form.operationalAddressSnapshot.addressLine2}
            />
            <SummaryItem label="Province" value={form.operationalAddressSnapshot.province} />
            <SummaryItem label="City" value={form.operationalAddressSnapshot.city} />
            <SummaryItem label="District" value={form.operationalAddressSnapshot.district} />
            <SummaryItem label="Postal Code" value={form.operationalAddressSnapshot.postalCode} />
            <SummaryItem label="Country" value={form.operationalAddressSnapshot.country} />
            <SummaryItem label="Address Notes" value={form.operationalAddressSnapshot.notes} />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">4. Payout Details</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem
              label="Account Holder Name"
              value={form.payoutPaymentSnapshot.accountHolderName}
            />
            <SummaryItem label="Bank or Channel" value={form.payoutPaymentSnapshot.bankName} />
            <SummaryItem
              label="Payout Method"
              value={form.payoutPaymentSnapshot.payoutMethod}
            />
            <SummaryItem label="Account Number" value={form.payoutPaymentSnapshot.accountNumber} />
            <SummaryItem label="Tax ID" value={form.complianceSnapshot.taxId} />
            <SummaryItem label="URL QRIS" value={form.payoutPaymentSnapshot.qrisImageUrl} />
            <SummaryItem
              label="Account Matches Identity"
              value={
                form.payoutPaymentSnapshot.accountHolderMatchesIdentity ? "Yes" : "No"
              }
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">5. Compliance</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <SummaryItem label="Support Email" value={form.complianceSnapshot.supportEmail} />
            <SummaryItem label="Support Phone" value={form.complianceSnapshot.supportPhone} />
            <SummaryItem label="Product Types" value={form.complianceSnapshot.productTypes} />
            <SummaryItem label="Brand Ownership" value={form.complianceSnapshot.brandOwnershipType} />
            <SummaryItem label="Website" value={form.complianceSnapshot.websiteUrl} />
            <SummaryItem label="Social Profile" value={form.complianceSnapshot.socialMediaUrl} />
            <SummaryItem label="Additional Notes" value={form.complianceSnapshot.notes} />
            <SummaryItem
              label="Authentic Products"
              value={form.complianceSnapshot.authenticityConfirmed ? "Yes" : "No"}
            />
            <SummaryItem
              label="No Prohibited Goods"
              value={form.complianceSnapshot.prohibitedGoodsConfirmed ? "Yes" : "No"}
            />
            <SummaryItem
              label="Information Confirmed"
              value={form.complianceSnapshot.agreedToTerms ? "Yes" : "No"}
            />
            <SummaryItem
              label="Admin Review Consent"
              value={form.complianceSnapshot.agreedToAdminReview ? "Yes" : "No"}
            />
            <SummaryItem
              label="Platform Policy Consent"
              value={form.complianceSnapshot.agreedToPlatformPolicy ? "Yes" : "No"}
            />
            <SummaryItem
              label="Inactive Until Approval"
              value={
                form.complianceSnapshot.understandsStoreInactiveUntilApproved ? "Yes" : "No"
              }
            />
          </div>
        </div>
      </div>
    </section>
  );

  const renderCurrentStep = () => {
    switch (activeStep) {
      case "owner_identity":
        return renderOwnerSection();
      case "store_information":
        return renderStoreSection();
      case "operational_address":
        return renderAddressSection();
      case "payout_payment":
        return renderPayoutSection();
      case "compliance":
        return renderComplianceSection();
      default:
        return renderReviewSection();
    }
  };

  if (applicationQuery.isLoading || sellerStoresQuery.isLoading) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Store Application"
          description="Loading your store application."
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading store application...
        </div>
      </div>
    );
  }

  if (applicationQuery.isError) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Store Application"
          description="We could not load the current application."
        />
        <InfoNotice tone="error">
          {applicationQuery.error?.response?.data?.message ||
            applicationQuery.error?.message ||
            "Failed to load the store application."}
        </InfoNotice>
      </div>
    );
  }

  if (!application && ownerStore) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Seller Workspace Ready"
          description="This account already has seller access for a store."
        />
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
                Store Owner
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {ownerStore.store.name}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                The store is already available in seller workspace.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {workspaceHref ? (
                  <Link
                    to={workspaceHref}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Go to Seller Workspace
                  </Link>
                ) : null}
                <Link
                  to="/user/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-5">
        <SectionHeader
          title="Start Selling"
          description="Complete your store details and submit for review."
        />
        {flash ? (
          <InfoNotice tone={flash.type === "error" ? "error" : "info"}>
            {flash.message}
          </InfoNotice>
        ) : null}
        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">No application yet</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Start a draft first, then complete the remaining steps later.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setFlash(null);
                  createDraftMutation.mutate();
                }}
                disabled={createDraftMutation.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createDraftMutation.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Store className="h-4 w-4" />
                )}
                Start Application
              </button>
              <Link
                to="/user/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>
          </div>

          <aside className={SECTION_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-slate-950">Application Steps</h2>
            <div className="mt-4 grid gap-3">
              {STEP_CONFIG.map((step, index) => (
                <div key={step.code} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{step.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    );
  }

  const readOnlyStatus = !editable;
  const activeStepMeta = STEP_CONFIG[currentStepIndex] || STEP_CONFIG[0];
  const completionSummary = `${application.completeness.completedFields}/${application.completeness.totalFields}`;
  const submittedSummary = application.submittedAt ? formatDateTime(application.submittedAt) : null;
  const reviewedSummary = application.reviewedAt ? formatDateTime(application.reviewedAt) : null;
  const storeStatusValue = application.activation?.storeStatus || ownerStore?.store?.status || "-";
  const storePublicValue =
    readinessPresentation.code === "active" ? "Check storefront" : "Not Public";
  const storeAccessValue = application.activation?.sellerAccessReady ? "Ready" : "Not Ready";
  const canGoBack = editable && currentStepIndex > 0;
  const canContinue = editable && currentStepIndex < STEP_CONFIG.length - 1;
  const canSubmit = editable && activeStep === "review" && localCompleteness.isComplete;

  return (
    <div className="space-y-6 pb-32">
      <SectionHeader
        title="Store Application"
        description="Complete your store details and submit for review."
      />

      {flash ? (
        <InfoNotice tone={flash.type === "error" ? "error" : "info"}>{flash.message}</InfoNotice>
      ) : null}

      {application.revisionNote ? (
        <InfoNotice tone="warning">Revision note: {application.revisionNote}</InfoNotice>
      ) : null}

      {application.rejectReason ? (
        <InfoNotice tone="error">Rejection note: {application.rejectReason}</InfoNotice>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className={SECTION_CARD_CLASS}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Application Steps
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">{activeStepMeta.label}</h2>
                <p className="mt-1 text-sm text-slate-600">Move step by step and save when needed.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {Math.max(currentStepIndex + 1, 1)} / {STEP_CONFIG.length}
              </span>
            </div>

            <div className="mt-5 space-y-1">
              {STEP_CONFIG.map((step, index) => {
                const isActive = step.code === activeStep;
                const isComplete =
                  index < currentStepIndex ||
                  (step.code === "review" && localCompleteness.isComplete);
                const stateClass = isActive
                  ? "border-emerald-200 bg-emerald-50 shadow-sm"
                  : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50";
                const lineClass = isComplete
                  ? "bg-emerald-200"
                  : isActive
                    ? "bg-emerald-100"
                    : "bg-slate-200";
                return (
                  <button
                    key={step.code}
                    type="button"
                    onClick={() => setActiveStep(step.code)}
                    className={`relative flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${stateClass}`}
                  >
                    <div className="relative flex w-7 flex-col items-center">
                      <span
                        className={`z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                          isComplete
                            ? "border-emerald-200 bg-emerald-500 text-white"
                            : isActive
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </span>
                      {index < STEP_CONFIG.length - 1 ? (
                        <span className={`mt-1 h-8 w-px ${lineClass}`} aria-hidden="true" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            isComplete
                              ? "text-emerald-600"
                              : isActive
                                ? "text-emerald-700"
                                : "text-slate-400"
                          }`}
                        >
                          {isComplete ? "Done" : isActive ? "Current" : "Next"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <div className="space-y-6">
          {readOnlyStatus ? (
            <InfoNotice tone="info">
              {application.status === "submitted" || application.status === "under_review"
                ? "This application is being reviewed. Editing is temporarily locked."
                : application.status === "approved"
                  ? workspaceHref
                    ? "This application is approved and seller workspace is available."
                    : "This application is approved. Seller workspace may still need a refresh."
                  : application.status === "rejected"
                    ? "This application was rejected. You can start a new one from this page."
                    : application.status === "cancelled"
                      ? "This application was cancelled. You can create a new draft any time."
                      : "Editing is not available for the current status."}
            </InfoNotice>
          ) : null}

          <section className={SECTION_CARD_CLASS}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Application Overview
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {applicationPresentation.label}
                  </h2>
                  <StatusBadge
                    label={applicationPresentation.label}
                    tone={applicationPresentation.tone}
                  />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {applicationPresentation.shortDescription}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {application.status === "approved" ? (
                  workspaceHref ? (
                    <Link
                      to={workspaceHref}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Go to Seller Workspace
                    </Link>
                  ) : (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                      Workspace syncing
                    </span>
                  )
                ) : null}

                {(application.status === "rejected" || application.status === "cancelled") &&
                !ownerStore ? (
                  <button
                    type="button"
                    onClick={handleRestart}
                    disabled={createDraftMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createDraftMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                    {application.status === "rejected" ? "Start New Application" : "Start Application"}
                  </button>
                ) : null}

                {application.workflow?.canCancel ? (
                  <button
                    type="button"
                    onClick={handleCancelApplication}
                    disabled={cancelMutation.isPending || isBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelMutation.isPending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancel Application
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem label="Application Status" value={applicationPresentation.label} />
              <SummaryItem label="Completion" value={completionSummary} />
              <SummaryItem label="Last Updated" value={formatDateTime(application.updatedAt)} />
              <SummaryItem label="Current Step" value={application.currentStepMeta.label} />
              {submittedSummary ? <SummaryItem label="Submitted" value={submittedSummary} /> : null}
              {reviewedSummary ? <SummaryItem label="Reviewed" value={reviewedSummary} /> : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
              <Link
                to="/user/dashboard"
                className="inline-flex items-center gap-2 font-semibold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              {application.status === "approved" && !workspaceHref ? (
                <span>Approval is recorded. Seller access may still be syncing.</span>
              ) : null}
              {(application.status === "submitted" || application.status === "under_review") && (
                <span>Review is in progress.</span>
              )}
            </div>
          </section>

          {renderCurrentStep()}

          <section className={SECTION_CARD_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Missing Required Fields</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Complete the required items before submission.
                </p>
              </div>
              <StatusBadge label={completionSummary} tone={localCompleteness.isComplete ? "emerald" : "amber"} />
            </div>

            {!localCompleteness.isComplete ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {localCompleteness.missingFields.map((field) => (
                  <li
                    key={field.key}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                  >
                    {field.label}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                All required fields are complete.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>
                {editable && activeStep !== "review"
                  ? "Submit from the final step."
                  : application.status === "revision_requested"
                    ? "Update the requested changes before resubmitting."
                    : "Ready for the next action."}
              </span>
            </div>
          </section>

          <section className={SECTION_CARD_CLASS}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Store Status</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Approval does not guarantee public visibility.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryItem label="Public" value={storePublicValue} />
              <SummaryItem label="Access" value={storeAccessValue} />
              <SummaryItem label="Status" value={storeStatusValue} />
            </div>
          </section>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-4 z-30 px-4">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {editable ? (
                <button
                  type="button"
                  onClick={() =>
                    canGoBack ? setActiveStep(STEP_CONFIG[currentStepIndex - 1].code) : null
                  }
                  disabled={isBusy || !canGoBack}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <Link
                  to="/user/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              )}

              {editable ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlash(null);
                    saveDraftMutation.mutate();
                  }}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveDraftMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Draft
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {editable && canContinue ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(STEP_CONFIG[currentStepIndex + 1].code)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}

              {editable ? (
                <button
                  type="button"
                  onClick={() => {
                    setFlash(null);
                    submitMutation.mutate();
                  }}
                  disabled={isBusy || !canSubmit}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitMutation.isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4" />
                  )}
                  {application.status === "revision_requested"
                    ? "Resubmit Application"
                    : "Submit Application"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

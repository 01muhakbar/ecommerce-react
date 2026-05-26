import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  fetchAdminStoreProfiles,
  updateAdminStoreProfile,
} from "../../api/adminStoreProfile.ts";
import {
  AdminOpsEmptyState,
  AdminOpsErrorState,
  AdminOpsLoadingState,
  AdminOpsStatusBadge,
} from "../../components/admin/AdminOpsPrimitives.jsx";

const textOrFallback = (value, fallback = "-") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const fieldLabel = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildPreviewValue = (snapshot, key) => {
  const value = snapshot?.[key];
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() || "-";
  return String(value);
};

const getFieldLabels = (fields = []) =>
  fields
    .map((field) => field?.label || fieldLabel(field?.field || field))
    .filter(Boolean);

const COMPACT_FIELD_LABELS = {
  "store description": "Description",
  description: "Description",
  "store email": "Email",
  email: "Email",
  "store phone": "Phone",
  phone: "Phone",
  "logo url": "Logo",
  logourl: "Logo",
  logo: "Logo",
  "address line 1": "Address",
  addressline1: "Address",
  address: "Address",
  city: "City",
  province: "Province",
  country: "Country",
  "origin phone": "Phone",
  originphone: "Phone",
  "origin address line 1": "Address",
  originaddressline1: "Address",
  "origin city": "City",
  origincity: "City",
  "origin province": "Province",
  originprovince: "Province",
  "origin postal code": "Postal code",
  originpostalcode: "Postal code",
  "postal code": "Postal code",
  postalcode: "Postal code",
  "origin country": "Country",
  origincountry: "Country",
};

const getCompactFieldLabel = (label) => {
  const normalized = String(label || "").trim().toLowerCase();
  const compactKey = normalized.replace(/\s+/g, "");
  return COMPACT_FIELD_LABELS[normalized] || COMPACT_FIELD_LABELS[compactKey] || label;
};

const hasPublicValue = (value) => String(value ?? "").trim().length > 0;

const getContactReady = (publicIdentity) =>
  Boolean(
    hasPublicValue(publicIdentity?.email) ||
      hasPublicValue(publicIdentity?.phone) ||
      hasPublicValue(publicIdentity?.whatsapp)
  );

const getAddressReady = (publicIdentity) =>
  Boolean(
    hasPublicValue(publicIdentity?.addressLine1) &&
      hasPublicValue(publicIdentity?.city) &&
      hasPublicValue(publicIdentity?.province) &&
      hasPublicValue(publicIdentity?.country)
  );

const GLASS_CARD =
  "border border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-md";

const getAiPlanText = (facts) => {
  const actions = [];
  if (facts.publicGateIssue || !facts.publicGateReady) actions.push("Resolve public gate");
  if (!facts.profileComplete || facts.profileMissingCount) actions.push("Complete profile");
  if (!facts.shippingReady || facts.shippingMissingCount) actions.push("Complete shipping");
  return actions.length ? actions.join(" -> ") : "Ready for publish review";
};

function CommandMetric({ label, value, badge }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/70 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <div className="mt-1.5 flex min-w-0 items-center gap-2">
        {badge}
        <p className="truncate text-sm font-semibold text-slate-900" title={String(value || "")}>
          {value}
        </p>
      </div>
    </div>
  );
}

function TableActionButton({ children, onClick, variant = "secondary", title }) {
  const variantClass =
    variant === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : variant === "ai"
        ? "border-sky-200 bg-sky-50/90 text-sky-700 hover:bg-sky-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 items-center justify-center rounded-full border px-2.5 text-xs font-semibold shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 ${variantClass}`}
    >
      {children}
    </button>
  );
}

function FieldChecklist({ title, fields, emptyText = "All clear" }) {
  const labels = getFieldLabels(fields).map(getCompactFieldLabel);
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.045)] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <AdminOpsStatusBadge
          label={labels.length ? `${labels.length} missing` : "Ready"}
          tone={labels.length ? "attention" : "ready"}
        />
      </div>
      {labels.length ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {labels.map((label, index) => (
            <div
              key={`${title}-${label}-${index}`}
              className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5"
              title={label}
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-md border border-amber-300 bg-amber-50"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-slate-700">{label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

function CompactFieldDetails({ title, fields, snapshot }) {
  return (
    <details className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800">{title}</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {fields.length > 0 ? (
          fields.map((field, index) => (
            <div
              key={`${title}-${field}-${index}`}
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {fieldLabel(field)}
              </p>
              <p
                className="mt-1 truncate text-sm text-slate-900"
                title={buildPreviewValue(snapshot, field)}
              >
                {buildPreviewValue(snapshot, field)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No fields available.</p>
        )}
      </div>
    </details>
  );
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "needs_attention", label: "Needs review" },
  { value: "profile_incomplete", label: "Profile incomplete" },
  { value: "shipping_incomplete", label: "Shipping incomplete" },
  { value: "public_gated", label: "Public gated" },
  { value: "operational", label: "Operational" },
];

const getStoreFacts = (entry, index = 0) => {
  const store = entry?.store || {};
  const publicIdentity = entry?.publicIdentity || {};
  const publicOperationalReadiness = publicIdentity?.summary?.operationalReadiness || null;
  const missingFields = store?.completeness?.missingFields || [];
  const shippingMissingFields = store?.missingShippingFields || [];
  const publicGateReady = Boolean(publicOperationalReadiness?.isReady);
  const profileComplete = Boolean(store?.completeness?.isComplete);
  const shippingReady = Boolean(store?.isShippingReady);
  const profileMissingCount = missingFields.length;
  const shippingMissingCount = shippingMissingFields.length;
  const publicGateIssue = Boolean(publicOperationalReadiness && !publicGateReady);
  const hasAttention = Boolean(
    profileMissingCount ||
      shippingMissingCount ||
      !profileComplete ||
      !shippingReady ||
      publicGateIssue ||
      store?.status !== "ACTIVE"
  );

  return {
    id: String(store?.id || index),
    store,
    publicIdentity,
    owner: entry?.owner || null,
    publicOperationalReadiness,
    missingFields,
    shippingMissingFields,
    publicGateReady,
    profileComplete,
    shippingReady,
    profileMissingCount,
    shippingMissingCount,
    publicGateIssue,
    hasAttention,
    completedFields: Number(store?.completeness?.completedFields || 0),
    totalFields: Number(store?.completeness?.totalFields || 0),
    storefrontHref: store?.slug ? `/store/${encodeURIComponent(store.slug)}` : null,
  };
};

const getPriorityStatus = (facts) => {
  const hasPrimaryBlocker = Boolean(
    facts.publicGateIssue ||
      !facts.publicGateReady ||
      !facts.profileComplete ||
      !facts.shippingReady ||
      facts.profileMissingCount ||
      facts.shippingMissingCount
  );
  if (hasPrimaryBlocker) return { label: "High", tone: "missing" };
  if (facts.hasAttention) return { label: "Medium", tone: "attention" };
  return { label: "Ready", tone: "ready" };
};

const getPriorityReason = (facts) => {
  const reasons = [];
  if (facts.publicGateIssue || !facts.publicGateReady) reasons.push("public gated");
  if (!facts.profileComplete || facts.profileMissingCount) reasons.push("profile incomplete");
  if (!facts.shippingReady || facts.shippingMissingCount) reasons.push("shipping incomplete");
  if (facts.store?.status !== "ACTIVE") reasons.push("inactive");
  return reasons.length ? reasons.join(" + ") : "ready";
};

function SummaryToolbar({ summary }) {
  const summaryItems = [
    {
      label: "Total stores",
      value: summary.total,
      accent: "from-slate-100/90 to-white/70",
      iconClass: "border-slate-200 bg-slate-100",
    },
    {
      label: "Need review",
      value: summary.needsAttention,
      accent: "from-amber-50/95 to-white/70",
      iconClass: "border-amber-200 bg-amber-100",
    },
    {
      label: "Profile incomplete",
      value: summary.profileIncomplete,
      accent: "from-sky-50/95 to-white/70",
      iconClass: "border-sky-200 bg-sky-100",
    },
    {
      label: "Shipping incomplete",
      value: summary.shippingIncomplete,
      accent: "from-rose-50/95 to-white/70",
      iconClass: "border-rose-200 bg-rose-100",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={`group min-w-0 rounded-3xl border border-white/70 bg-gradient-to-br ${item.accent} px-4 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.065)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_20px_46px_rgba(15,23,42,0.09)]`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 truncate text-3xl font-semibold leading-none text-slate-950">
                  {item.value}
                </p>
              </div>
              <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border ${item.iconClass}`}
                aria-hidden="true"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700/70" />
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}

function ReviewPriorities({ rows }) {
  const priorityRows = rows.slice(0, 3);
  return (
    <aside className="hidden 2xl:block">
      <div className={`sticky top-4 rounded-3xl p-4 ${GLASS_CARD}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Review Priorities</p>
            <p className="mt-1 text-xs text-slate-500">Based on current data.</p>
          </div>
          <AdminOpsStatusBadge label="Data-based" tone="info" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Minimalis & Bersih", "Personalisasi & AI"].map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-2.5">
          {priorityRows.length ? (
            priorityRows.map(({ facts }, index) => {
              const storeName = facts.store?.name || "Store";
              return (
                <div
                  key={`priority-${facts.id}`}
                  className="rounded-2xl border border-white/70 bg-white/70 px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur"
                >
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900" title={storeName}>
                        {storeName}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {getPriorityReason(facts)}
                      </p>
                      <p className="mt-2 rounded-xl bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700">
                        Suggested: {getAiPlanText(facts)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
              No priority blockers.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function QuickActionMenu({
  isOpen,
  onToggle,
  onReview,
  onAiRecommendPlan,
  storefrontHref,
  onCopySlug,
  onCopyOwnerEmail,
  ownerEmail,
}) {
  return (
    <div className="relative flex flex-col items-end">
      <TableActionButton onClick={onToggle} title="More actions">
        <span aria-hidden="true">...</span>
        <span className="sr-only">More</span>
      </TableActionButton>
      {isOpen ? (
        <div className="fixed inset-x-3 bottom-4 z-50 rounded-3xl border border-white/70 bg-white/95 p-2 text-left shadow-[0_22px_70px_rgba(15,23,42,0.24)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-48">
          <div className="mb-1 flex items-center justify-between px-2 py-1 sm:hidden">
            <span className="text-xs font-semibold text-slate-500">Quick actions</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
              Responsif
            </span>
          </div>
          <button
            type="button"
            onClick={onReview}
            className="block w-full rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Review
          </button>
          {storefrontHref ? (
            <Link
              to={storefrontHref}
              onClick={onToggle}
              className="block rounded-2xl px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onCopySlug}
            className="block w-full rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Copy slug
          </button>
          {ownerEmail ? (
            <button
              type="button"
              onClick={onCopyOwnerEmail}
              className="block w-full rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Copy owner email
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAiRecommendPlan}
            className="mt-1 block w-full rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-left text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            AI Recommend Plan
          </button>
          <p className="px-3 py-1 text-[11px] font-semibold text-slate-400">
            Mikro-interaksi
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StoreFilterToolbar({
  searchTerm,
  onSearchTermChange,
  filterMode,
  effectiveFilter,
  onFilterModeChange,
  sortMode,
  onSortModeChange,
  visibleCount,
  totalCount,
}) {
  return (
    <div className={`rounded-3xl px-3 py-3 ${GLASS_CARD}`}>
      <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_190px_auto] lg:items-center">
        <label className="min-w-0">
          <span className="sr-only">
            Search stores
          </span>
          <input
            className="h-10 w-full rounded-2xl border border-white/80 bg-white/75 px-3 text-sm text-slate-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus:border-slate-400"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search store, slug, owner"
          />
        </label>
        <label className="min-w-0">
          <span className="sr-only">
            Sort
          </span>
          <select
            className="h-10 w-full rounded-2xl border border-white/80 bg-white/75 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value)}
          >
            <option value="priority">Priority first</option>
            <option value="name">Store name</option>
          </select>
        </label>
        <div className="flex h-10 items-center rounded-2xl border border-white/70 bg-white/60 px-3 text-sm font-semibold text-slate-600">
          {visibleCount} visible
          {visibleCount !== totalCount ? (
            <span className="ml-1 text-slate-400">of {totalCount}</span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((option) => {
          const active = effectiveFilter === option.value && filterMode !== "auto";
          const autoActive = effectiveFilter === option.value && filterMode === "auto";
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterModeChange(option.value)}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition hover:-translate-y-0.5 ${
                active || autoActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-white/70 bg-white/70 text-slate-600 hover:bg-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminStoreProfilePage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState("auto");
  const [sortMode, setSortMode] = useState("priority");
  const [expandedStoreIds, setExpandedStoreIds] = useState({});
  const [openActionStoreId, setOpenActionStoreId] = useState("");
  const [aiAssistStoreIds, setAiAssistStoreIds] = useState({});

  const profilesQuery = useQuery({
    queryKey: ["admin-store-profiles"],
    queryFn: fetchAdminStoreProfiles,
  });

  const mutation = useMutation({
    mutationFn: ({ storeId, payload }) => updateAdminStoreProfile(storeId, payload),
    onSuccess: (entry) => {
      queryClient.setQueryData(["admin-store-profiles"], (current) => {
        const items = Array.isArray(current) ? current : [];
        return items.map((item) =>
          Number(item?.store?.id) === Number(entry?.store?.id) ? entry : item
        );
      });
      setDrafts((current) => ({
        ...current,
        [String(entry?.store?.id || "")]: {
          name: entry?.store?.name || "",
          slug: entry?.store?.slug || "",
          status: entry?.store?.status || "ACTIVE",
        },
      }));
    },
  });

  const items = useMemo(
    () => (Array.isArray(profilesQuery.data) ? profilesQuery.data : []),
    [profilesQuery.data]
  );
  const storeRows = useMemo(
    () => items.map((entry, index) => ({ entry, facts: getStoreFacts(entry, index) })),
    [items]
  );
  const profileSummary = useMemo(() => {
    const total = storeRows.length;
    const active = storeRows.filter(({ facts }) => facts.store?.status === "ACTIVE").length;
    const complete = storeRows.filter(({ facts }) => facts.profileComplete).length;
    const shippingReady = storeRows.filter(({ facts }) => facts.shippingReady).length;
    const operational = storeRows.filter(({ facts }) => !facts.hasAttention).length;
    const needsAttention = storeRows.filter(({ facts }) => facts.hasAttention).length;
    return {
      total,
      active,
      complete,
      shippingReady,
      operational,
      needsAttention,
      profileIncomplete: total - complete,
      shippingIncomplete: total - shippingReady,
    };
  }, [storeRows]);
  const effectiveFilter =
    filterMode === "auto"
      ? profileSummary.needsAttention > 0
        ? "needs_attention"
        : "all"
      : filterMode;

  const visibleRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesFilter = (facts) => {
      if (effectiveFilter === "needs_attention") return facts.hasAttention;
      if (effectiveFilter === "profile_incomplete") return !facts.profileComplete;
      if (effectiveFilter === "shipping_incomplete") {
        return !facts.shippingReady || facts.shippingMissingCount > 0;
      }
      if (effectiveFilter === "public_gated") return !facts.publicGateReady;
      if (effectiveFilter === "operational") return !facts.hasAttention;
      return true;
    };

    const filtered = storeRows.filter(({ facts }) => {
      if (!matchesFilter(facts)) return false;
      if (!normalizedSearch) return true;
      const searchable = [
        facts.store?.name,
        facts.store?.slug,
        facts.owner?.name,
        facts.owner?.email,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return searchable.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "name") {
        return String(a.facts.store?.name || "").localeCompare(String(b.facts.store?.name || ""));
      }
      if (a.facts.hasAttention !== b.facts.hasAttention) {
        return a.facts.hasAttention ? -1 : 1;
      }
      const aIssueCount =
        a.facts.profileMissingCount + a.facts.shippingMissingCount + (a.facts.publicGateIssue ? 1 : 0);
      const bIssueCount =
        b.facts.profileMissingCount + b.facts.shippingMissingCount + (b.facts.publicGateIssue ? 1 : 0);
      return bIssueCount - aIssueCount;
    });
  }, [effectiveFilter, searchTerm, sortMode, storeRows]);

  const priorityRows = useMemo(
    () =>
      [...storeRows]
        .filter(({ facts }) => facts.hasAttention)
        .sort((a, b) => {
          const aIssueCount =
            a.facts.profileMissingCount +
            a.facts.shippingMissingCount +
            (a.facts.publicGateIssue ? 1 : 0);
          const bIssueCount =
            b.facts.profileMissingCount +
            b.facts.shippingMissingCount +
            (b.facts.publicGateIssue ? 1 : 0);
          return bIssueCount - aIssueCount;
        }),
    [storeRows]
  );

  const getDraft = (entry) => {
    const key = String(entry?.store?.id || "");
    return (
      drafts[key] || {
        name: entry?.store?.name || "",
        slug: entry?.store?.slug || "",
        status: entry?.store?.status || "ACTIVE",
      }
    );
  };

  const updateDraft = (entry, nextPartial) => {
    const key = String(entry?.store?.id || "");
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...getDraft(entry),
        ...nextPartial,
      },
    }));
  };

  const toggleStoreDetails = (storeId) => {
    const key = String(storeId || "");
    if (!key) return;
    setExpandedStoreIds((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const openStoreDetails = (storeId) => {
    const key = String(storeId || "");
    if (!key) return;
    setExpandedStoreIds((current) => ({ ...current, [key]: true }));
    setOpenActionStoreId("");
  };

  const toggleAiAssist = (storeId) => {
    const key = String(storeId || "");
    if (!key) return;
    setAiAssistStoreIds((current) => ({ ...current, [key]: !current[key] }));
  };

  const openAiAssist = (storeId) => {
    const key = String(storeId || "");
    if (!key) return;
    setExpandedStoreIds((current) => ({ ...current, [key]: true }));
    setAiAssistStoreIds((current) => ({ ...current, [key]: true }));
    setOpenActionStoreId("");
  };

  const toggleActionMenu = (storeId) => {
    const key = String(storeId || "");
    if (!key) return;
    setOpenActionStoreId((current) => (current === key ? "" : key));
  };

  const copySlug = async (slug) => {
    setOpenActionStoreId("");
    if (
      !slug ||
      typeof navigator === "undefined" ||
      !navigator.clipboard?.writeText
    ) {
      return;
    }
    try {
      await navigator.clipboard.writeText(slug);
    } catch {
      // Clipboard permission can be unavailable in browser smoke or locked-down sessions.
    }
  };

  const copyOwnerEmail = async (email) => {
    setOpenActionStoreId("");
    if (
      !email ||
      typeof navigator === "undefined" ||
      !navigator.clipboard?.writeText
    ) {
      return;
    }
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      // Clipboard permission can be unavailable in browser smoke or locked-down sessions.
    }
  };

  const getErrorMessage = (error) =>
    error?.response?.data?.message ||
    error?.message ||
    "Failed to update store profile.";

  if (profilesQuery.isLoading) {
    return <AdminOpsLoadingState title="Loading store profiles..." />;
  }

  if (profilesQuery.isError) {
    return (
      <AdminOpsErrorState
        message={
          profilesQuery.error?.response?.data?.message ||
          profilesQuery.error?.message ||
          "Failed to load store profiles."
        }
        onRetry={() => profilesQuery.refetch()}
      />
    );
  }

  return (
    <div className="relative -m-2 min-w-0 space-y-5 overflow-hidden rounded-[28px] bg-slate-50/80 p-2 sm:m-0 sm:p-0">
      <div className={`rounded-[28px] px-4 py-4 sm:px-5 ${GLASS_CARD}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
              Store Profile
            </h1>
            <p className="mt-1 text-sm text-slate-500">Review stores before publishing.</p>
          </div>
        </div>
      </div>

      <SummaryToolbar summary={profileSummary} />

      {items.length === 0 ? (
        <AdminOpsEmptyState
          title="No stores found"
          description="Store profile rows will appear after sellers are provisioned."
        />
      ) : (
        <>
          <StoreFilterToolbar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            filterMode={filterMode}
            effectiveFilter={effectiveFilter}
            onFilterModeChange={setFilterMode}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            visibleCount={visibleRows.length}
            totalCount={items.length}
          />
          {visibleRows.length === 0 ? (
            <AdminOpsEmptyState
              title="No stores match this view. Clear search or change filter."
              description=""
            />
          ) : (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className={`min-w-0 overflow-hidden rounded-3xl ${GLASS_CARD}`}>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[260px]" />
                <col className="w-[200px]" />
                <col className="w-[112px]" />
                <col className="w-[124px]" />
                <col className="w-[128px]" />
                <col className="w-[112px]" />
                <col className="w-[170px]" />
              </colgroup>
              <thead className="sticky top-0 z-20 bg-white/90 text-xs font-semibold text-slate-500 backdrop-blur">
                <tr>
                  <th className="sticky left-0 z-30 bg-white/95 px-4 py-3 shadow-[1px_0_0_rgba(226,232,240,0.9)] backdrop-blur">
                    Store
                  </th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-3 py-3">Public</th>
                  <th className="px-3 py-3">Profile</th>
                  <th className="px-3 py-3">Shipping</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="sticky right-0 z-30 bg-white/95 px-3 py-3 text-right shadow-[-1px_0_0_rgba(226,232,240,0.9)] backdrop-blur">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
          {visibleRows.map(({ entry, facts }, index) => {
            const store = facts.store;
            const publicIdentity = facts.publicIdentity;
            const owner = facts.owner;
            const draft = getDraft(entry);
            const pendingStoreId = Number(mutation.variables?.storeId || 0);
            const isBusy = mutation.isPending && pendingStoreId === Number(store?.id || 0);
            const adminOwnedFields = store?.contract?.categories?.adminOwnedFields || [];
            const sellerEditableFields = store?.contract?.categories?.sellerEditableFields || [];
            const publicSafeFields = store?.contract?.categories?.publicSafeFields || [];
            const missingFields = facts.missingFields;
            const storefrontHref = facts.storefrontHref;
            const hasStorefrontRoute = Boolean(storefrontHref);
            const publicGateReady = facts.publicGateReady;
            const shippingMissingFields = facts.shippingMissingFields;
            const shippingMissingCount = facts.shippingMissingCount;
            const completedFields = facts.completedFields;
            const totalFields = facts.totalFields;
            const profileComplete = facts.profileComplete;
            const shippingReady = facts.shippingReady;
            const descriptionReady = hasPublicValue(publicIdentity?.description);
            const contactReady = getContactReady(publicIdentity);
            const addressReady = getAddressReady(publicIdentity);
            const publicGateIssue = facts.publicGateIssue;
            const hasBlockingIssues = facts.hasAttention;
            const issueAnchorId = `store-${facts.id}-issues`;
            const priorityStatus = getPriorityStatus(facts);
            const isExpanded = Boolean(expandedStoreIds[String(store?.id || "")]);
            const isActionMenuOpen = openActionStoreId === String(store?.id || "");
            const isAiAssistOpen = Boolean(aiAssistStoreIds[String(store?.id || "")]);
            const shippingHealthLabel = shippingMissingCount
              ? `${shippingMissingCount} missing`
              : shippingReady
                ? "Ready"
                : "Review";

            return (
              <Fragment
                key={`${store?.id || "store"}-${index}`}
              >
                <tr
                  className={`align-top transition ${
                    isExpanded
                      ? "bg-sky-50/55 hover:bg-sky-50/70"
                      : "bg-white/40 hover:bg-slate-50/80"
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 max-w-[260px] border-l-4 px-3 py-2.5 shadow-[1px_0_0_rgba(226,232,240,1)] ${
                      isExpanded
                        ? "border-sky-500 bg-sky-50/95"
                        : "border-transparent bg-white/95"
                    }`}
                  >
                    <p className="truncate font-semibold text-slate-900" title={store?.name || "Store"}>
                        {store?.name || "Store"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500" title={store?.slug || ""}>
                      @{textOrFallback(store?.slug)}
                    </p>
                  </td>
                  <td className="max-w-[200px] px-4 py-2.5">
                    <p className="truncate font-medium text-slate-700" title={owner?.name || ""}>
                      {textOrFallback(owner?.name)}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500" title={owner?.email || ""}>
                      {textOrFallback(owner?.email)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminOpsStatusBadge
                      label={publicGateReady ? "Operational" : "Gated"}
                      tone={publicGateReady ? "ready" : "missing"}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-800">
                        {completedFields}/{totalFields}
                      </span>
                      {!profileComplete ? (
                        <AdminOpsStatusBadge label="Incomplete" tone="attention" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminOpsStatusBadge
                      label={shippingHealthLabel}
                      tone={shippingReady ? "ready" : "attention"}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <AdminOpsStatusBadge label={priorityStatus.label} tone={priorityStatus.tone} />
                  </td>
                  <td
                    className={`sticky right-0 px-3 py-2.5 shadow-[-1px_0_0_rgba(226,232,240,1)] ${
                      isActionMenuOpen ? "z-30" : "z-10"
                    } ${
                      isExpanded ? "bg-sky-50/95" : "bg-white/95"
                    }`}
                  >
                    <div className="flex items-start justify-end gap-1">
                      <TableActionButton
                        variant="primary"
                        onClick={() => {
                          setOpenActionStoreId("");
                          toggleStoreDetails(store?.id);
                        }}
                      >
                        {isExpanded ? "Close" : "Review"}
                      </TableActionButton>
                      {hasStorefrontRoute ? (
                        <Link
                          to={storefrontHref}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      ) : (
                        <AdminOpsStatusBadge label="No slug" tone="missing" />
                      )}
                      <QuickActionMenu
                        isOpen={isActionMenuOpen}
                        onToggle={() => toggleActionMenu(store?.id)}
                        onReview={() => openStoreDetails(store?.id)}
                        onAiRecommendPlan={() => openAiAssist(store?.id)}
                        storefrontHref={storefrontHref}
                        ownerEmail={owner?.email}
                        onCopySlug={() => copySlug(store?.slug)}
                        onCopyOwnerEmail={() => copyOwnerEmail(owner?.email)}
                      />
                    </div>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr className="bg-sky-50/35">
                    <td colSpan={7} className="border-l-4 border-sky-500 px-3 py-3">

                <div
                  id={issueAnchorId}
                  className={`scroll-mt-4 rounded-3xl p-3 ${GLASS_CARD}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {store?.name || "Store"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500" title={store?.slug || ""}>
                        @{textOrFallback(store?.slug)}
                      </p>
                    </div>
                    <AdminOpsStatusBadge
                      label={hasBlockingIssues ? "Needs review" : "Ready"}
                      tone={hasBlockingIssues ? "attention" : "ready"}
                    />
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/70 bg-slate-50/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Needs Attention</p>
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">
                              Based on current data.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <AdminOpsStatusBadge
                              label={hasBlockingIssues ? "Action needed" : "Ready"}
                              tone={hasBlockingIssues ? "attention" : "ready"}
                            />
                            <button
                              type="button"
                              onClick={() => toggleAiAssist(store?.id)}
                              className="inline-flex h-7 items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              AI Suggest Fill
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 lg:grid-cols-2">
                          <FieldChecklist
                            title="Missing profile fields"
                            fields={missingFields}
                            emptyText="Profile fields complete."
                          />
                          <FieldChecklist
                            title="Missing shipping fields"
                            fields={shippingMissingFields}
                            emptyText="Shipping setup ready."
                          />
                        </div>
                        {isAiAssistOpen ? (
                          <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs font-semibold text-sky-800">
                            AI Suggest: {getAiPlanText(facts)}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Public Gate Issue
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {publicGateIssue
                                ? "Storefront remains gated until blockers are fixed."
                                : "Storefront is operational."}
                            </p>
                          </div>
                          <AdminOpsStatusBadge
                            label={publicGateReady ? "Operational" : "Gated"}
                            tone={publicGateReady ? "ready" : "missing"}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Core Identity</p>
                            <p className="mt-1 text-xs text-slate-500">Admin-governed fields.</p>
                          </div>
                          <AdminOpsStatusBadge label={draft.status || "ACTIVE"} tone="neutral" />
                        </div>

                        <form
                          className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
                          onSubmit={(event) => {
                            event.preventDefault();
                            mutation.mutate({
                              storeId: store.id,
                              payload: {
                                name: draft.name,
                                slug: draft.slug,
                                status: draft.status,
                              },
                            });
                          }}
                        >
                          <label className="min-w-0">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Store Name
                            </span>
                            <input
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                              value={draft.name}
                              onChange={(event) => updateDraft(entry, { name: event.target.value })}
                              disabled={isBusy}
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Slug
                            </span>
                            <input
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                              value={draft.slug}
                              onChange={(event) => updateDraft(entry, { slug: event.target.value })}
                              disabled={isBusy}
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Status
                            </span>
                            <select
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                              value={draft.status}
                              onChange={(event) => updateDraft(entry, { status: event.target.value })}
                              disabled={isBusy}
                            >
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="INACTIVE">INACTIVE</option>
                            </select>
                          </label>
                          <div className="flex min-w-0 items-end">
                            <button
                              type="submit"
                              disabled={isBusy}
                              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                              {isBusy ? "Saving..." : "Save Core Identity"}
                            </button>
                          </div>
                          {mutation.isError && pendingStoreId === Number(store?.id || 0) ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 sm:col-span-2">
                              {getErrorMessage(mutation.error)}
                            </div>
                          ) : null}
                        </form>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">Public Preview</p>
                            <p
                              className="mt-1 truncate text-sm text-slate-500"
                              title={publicIdentity?.name || store?.name || ""}
                            >
                              {textOrFallback(publicIdentity?.name || store?.name)}
                            </p>
                          </div>
                          <AdminOpsStatusBadge
                            label={publicGateReady ? "Operational" : "Gated"}
                            tone={publicGateReady ? "ready" : "missing"}
                          />
                        </div>
                        <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50">
                          {[
                            ["Description", descriptionReady],
                            ["Contact", contactReady],
                            ["Address", addressReady],
                          ].map(([label, ready]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                              <span className="text-xs font-semibold text-slate-500">{label}</span>
                              <span
                                className={`text-xs font-semibold ${
                                  ready ? "text-emerald-700" : "text-amber-700"
                                }`}
                              >
                                {ready ? "Ready" : "Missing"}
                              </span>
                            </div>
                          ))}
                        </div>
                        {hasStorefrontRoute ? (
                          <Link
                            to={storefrontHref}
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-3.5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white"
                          >
                            Open Storefront
                          </Link>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-sky-900">AI Assist</p>
                            <p className="mt-1 text-xs font-semibold text-sky-700">
                              Suggested, non-destructive.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAiAssist(store?.id)}
                            className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                          >
                            AI Suggest
                          </button>
                        </div>
                        {isAiAssistOpen ? (
                          <p className="mt-2 rounded-xl bg-white/75 px-3 py-2 text-xs font-semibold text-slate-700">
                            AI Recommend Plan: {getAiPlanText(facts)}
                          </p>
                        ) : null}
                      </div>

                      <details className="rounded-2xl border border-white/70 bg-slate-50/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                          Advanced details
                        </summary>
                        <div className="mt-3 space-y-3">
                          <CompactFieldDetails
                            title="Seller profile fields"
                            fields={sellerEditableFields}
                            snapshot={store}
                          />
                          <CompactFieldDetails
                            title="Public storefront fields"
                            fields={publicSafeFields}
                            snapshot={publicIdentity}
                          />
                          <details className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                              Shipping origin
                            </summary>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <CommandMetric
                                label="Origin Contact"
                                value={store?.shippingSetupSummary?.originContactName || "-"}
                                badge={
                                  <AdminOpsStatusBadge
                                    label={shippingReady ? "Ready" : "Review"}
                                    tone={shippingReady ? "ready" : "attention"}
                                  />
                                }
                              />
                              <CommandMetric
                                label="Origin Address"
                                value={store?.shippingSetupSummary?.originAddressLine || "-"}
                                badge={<AdminOpsStatusBadge label="Origin" tone="neutral" />}
                              />
                            </div>
                          </details>
                          <details className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                              Field ownership
                            </summary>
                            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                              <p>Admin: name, slug, status.</p>
                              <p>Seller: contact, media, address, shipping origin.</p>
                              <p>Storefront: public-safe fields only.</p>
                              <CompactFieldDetails
                                title="Admin governance fields"
                                fields={adminOwnedFields}
                                snapshot={store}
                              />
                            </div>
                          </details>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>

                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
              </tbody>
            </table>
          </div>
        </div>
        <ReviewPriorities rows={priorityRows} />
        </div>
          )}
        </>
      )}
    </div>
  );
}

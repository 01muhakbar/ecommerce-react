import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreCustomization } from "../../api/store.service.ts";
import { UiEmptyState, UiErrorState } from "../../components/ui-states/index.js";
import { sanitizeRichTextHtml } from "../../utils/sanitizeRichTextHtml.js";

const DEFAULT_LANG = "en";
const DEFAULT_POLICY = {
  enabled: true,
  pageHeaderBackgroundDataUrl: "",
  pageTitle: "Privacy Policy",
  pageTextHtml: "",
};

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizePolicy = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: toBool(source.enabled, DEFAULT_POLICY.enabled),
    pageHeaderBackgroundDataUrl: toText(
      source.pageHeaderBackgroundDataUrl ?? source.backgroundImageDataUrl ?? source.backgroundImage,
      DEFAULT_POLICY.pageHeaderBackgroundDataUrl
    ),
    pageTitle: toText(source.pageTitle, DEFAULT_POLICY.pageTitle),
    pageTextHtml: toText(source.pageTextHtml, DEFAULT_POLICY.pageTextHtml),
  };
};

function PolicyPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="h-48 animate-pulse rounded-3xl bg-slate-200 sm:h-56" />
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
        <div className="h-40 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function StorePrivacyPolicyPage() {
  const lang = DEFAULT_LANG;
  const policyQuery = useQuery({
    queryKey: ["store-customization", "privacy-policy", lang],
    queryFn: () => getStoreCustomization({ lang, include: "policy" }),
    staleTime: 60_000,
  });

  const pageRaw = policyQuery.data?.customization?.privacyPolicy;
  const page = useMemo(() => normalizePolicy(pageRaw), [pageRaw]);
  const safeHtml = useMemo(() => sanitizeRichTextHtml(page.pageTextHtml), [page.pageTextHtml]);

  if (policyQuery.isLoading) return <PolicyPageSkeleton />;

  if (policyQuery.isError) {
    const errorMessage =
      policyQuery.error?.response?.data?.message ||
      policyQuery.error?.message ||
      "Failed to load privacy policy.";
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title="Failed to load Privacy Policy."
          message={errorMessage}
          onRetry={() => policyQuery.refetch()}
        />
      </div>
    );
  }

  if (!pageRaw) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Content not configured yet."
          description="Privacy policy content is currently unavailable."
        />
      </div>
    );
  }

  if (!page.enabled) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="This page is disabled."
          description="Privacy policy is currently disabled."
        />
      </div>
    );
  }

  if (!safeHtml.trim()) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Content not configured yet."
          description="Privacy policy text has not been set."
        />
      </div>
    );
  }

  const hasBackground = Boolean(page.pageHeaderBackgroundDataUrl);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <header
        className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 px-6 py-12 text-white sm:px-8 sm:py-16"
        style={
          hasBackground
            ? {
                backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.58)), url(${page.pageHeaderBackgroundDataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <h1 className="text-3xl font-bold sm:text-4xl">{page.pageTitle}</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div
          className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-emerald-700"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </section>
    </div>
  );
}

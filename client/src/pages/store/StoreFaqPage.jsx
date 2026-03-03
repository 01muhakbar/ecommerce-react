import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { getStoreCustomization } from "../../api/store.service.ts";
import {
  UiEmptyState,
  UiErrorState,
} from "../../components/ui-states/index.js";

const DEFAULT_LANG = "en";
const FAQ_ITEMS_LENGTH = 8;
const DEFAULT_FAQS = {
  pageHeader: {
    enabled: true,
    backgroundImageDataUrl: "",
    pageTitle: "FAQs",
  },
  leftColumn: {
    enabled: true,
    leftImageDataUrl: "",
  },
  content: {
    enabled: true,
    items: Array.from({ length: FAQ_ITEMS_LENGTH }, (_, index) => ({
      title: `FAQ Title ${index + 1}`,
      description: `FAQ Description ${index + 1}`,
    })),
  },
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

const normalizeFaqs = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const pageHeader = source.pageHeader && typeof source.pageHeader === "object" ? source.pageHeader : {};
  const leftColumn = source.leftColumn && typeof source.leftColumn === "object" ? source.leftColumn : {};
  const content = source.content && typeof source.content === "object" ? source.content : {};
  const sourceItems = Array.isArray(content.items) ? content.items : [];

  return {
    pageHeader: {
      enabled: toBool(pageHeader.enabled, DEFAULT_FAQS.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeader.backgroundImageDataUrl ?? pageHeader.backgroundImage ?? pageHeader.imageDataUrl,
        DEFAULT_FAQS.pageHeader.backgroundImageDataUrl
      ),
      pageTitle: toText(pageHeader.pageTitle, DEFAULT_FAQS.pageHeader.pageTitle),
    },
    leftColumn: {
      enabled: toBool(leftColumn.enabled, DEFAULT_FAQS.leftColumn.enabled),
      leftImageDataUrl: toText(
        leftColumn.leftImageDataUrl ??
          leftColumn.imageDataUrl ??
          leftColumn.leftImage ??
          leftColumn.image,
        DEFAULT_FAQS.leftColumn.leftImageDataUrl
      ),
    },
    content: {
      enabled: toBool(content.enabled, DEFAULT_FAQS.content.enabled),
      items: Array.from({ length: FAQ_ITEMS_LENGTH }, (_, index) => {
        const fallback = DEFAULT_FAQS.content.items[index];
        const item =
          index < sourceItems.length && sourceItems[index] && typeof sourceItems[index] === "object"
            ? sourceItems[index]
            : {};
        return {
          title: toText(item.title ?? item.question, fallback.title),
          description: toText(item.description ?? item.answer, fallback.description),
        };
      }),
    },
  };
};

function FaqSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200 sm:h-56" />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`faq-skeleton-${index}`}
              className="h-16 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StoreFaqPage() {
  const lang = DEFAULT_LANG;
  const [openIndex, setOpenIndex] = useState(0);
  const faqQuery = useQuery({
    queryKey: ["store-customization", "faq-page", lang],
    queryFn: () => getStoreCustomization({ lang, include: "faq" }),
    staleTime: 60_000,
  });

  const faqsRaw = faqQuery.data?.customization?.faqs;
  const faqs = useMemo(() => normalizeFaqs(faqsRaw), [faqsRaw]);
  const items = useMemo(
    () =>
      faqs.content.items.filter(
        (item) => String(item.title || "").trim() || String(item.description || "").trim()
      ),
    [faqs]
  );

  if (faqQuery.isLoading) return <FaqSkeleton />;

  if (faqQuery.isError) {
    const errorMessage =
      faqQuery.error?.response?.data?.message ||
      faqQuery.error?.message ||
      "Failed to load FAQ content.";
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title="Failed to load FAQ."
          message={errorMessage}
          onRetry={() => faqQuery.refetch()}
        />
      </div>
    );
  }

  if (!faqsRaw) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="FAQ not configured yet."
          description="Please check back later."
        />
      </div>
    );
  }

  const hasAnyEnabledBlock =
    faqs.pageHeader.enabled || faqs.leftColumn.enabled || faqs.content.enabled;
  if (!hasAnyEnabledBlock) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="This page is disabled."
          description="All FAQ blocks are currently disabled."
        />
      </div>
    );
  }

  if (faqs.content.enabled && items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="FAQ not configured yet."
          description="No FAQ items are available."
        />
      </div>
    );
  }

  const hasHeaderBackground = Boolean(faqs.pageHeader.backgroundImageDataUrl);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {faqs.pageHeader.enabled ? (
        <header
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 px-6 py-12 text-white sm:px-8 sm:py-16"
          style={
            hasHeaderBackground
              ? {
                  backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.58)), url(${faqs.pageHeader.backgroundImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <h1 className="text-3xl font-bold sm:text-4xl">{faqs.pageHeader.pageTitle}</h1>
        </header>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          {faqs.leftColumn.enabled ? (
            faqs.leftColumn.leftImageDataUrl ? (
              <img
                src={faqs.leftColumn.leftImageDataUrl}
                alt="FAQ visual"
                className="h-full min-h-[280px] w-full rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500">
                Left image is not configured yet.
              </div>
            )
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
              Left column is disabled.
            </div>
          )}
        </div>

        <div className="space-y-3">
          {faqs.content.enabled ? (
            items.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <article
                  key={`faq-item-${index}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex((prev) => (prev === index ? -1 : index))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-900 sm:text-base">
                      {item.title}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden px-4 transition-all duration-200 ${
                      isOpen ? "max-h-80 pb-4 opacity-100" : "max-h-0 pb-0 opacity-0"
                    }`}
                  >
                    <p className="text-sm leading-6 text-slate-600">{item.description}</p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              FAQ content is currently disabled.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

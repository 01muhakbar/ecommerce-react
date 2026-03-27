import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import {
  UiEmptyState,
  UiErrorState,
} from "../../components/primitives/state/index.js";

const DEFAULT_LANG = "en";
const DEFAULT_ABOUT_US = {
  pageHeader: {
    enabled: true,
    backgroundImageDataUrl: "",
    pageTitle: "About Us",
  },
  topContentLeft: {
    enabled: true,
    topTitle: "Welcome to our KachaBazar shop",
    topDescription:
      "We help families shop fresh groceries and daily essentials with a faster, friendlier experience.",
    boxOne: {
      title: "10K",
      subtitle: "Listed Products",
      description: "Daily essentials and grocery selections in one place.",
    },
    boxTwo: {
      title: "8K",
      subtitle: "Lovely Customer",
      description: "Shoppers trust us for fresh products every day.",
    },
    boxThree: {
      title: "18K",
      subtitle: "Orders Delivered",
      description: "Orders delivered quickly with reliable service.",
    },
  },
  topContentRight: {
    enabled: true,
    imageDataUrl: "",
  },
  contentSection: {
    enabled: true,
    firstParagraph:
      "KachaBazar started as a neighborhood grocery service and continues to grow with strong quality and customer focus.",
    secondParagraph:
      "We work closely with suppliers, logistics partners, and support teams to keep your shopping flow smooth from browse to delivery.",
    contentImageDataUrl: "",
  },
  ourTeam: {
    enabled: true,
    title: "Our Team",
    description: "The people behind our day-to-day operations and customer happiness.",
    members: Array.from({ length: 6 }, (_, index) => ({
      imageDataUrl: "",
      title: `Team Member ${index + 1}`,
      subTitle: `Role ${index + 1}`,
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

const normalizeAboutUs = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const pageHeader = source.pageHeader && typeof source.pageHeader === "object" ? source.pageHeader : {};
  const topContentLeft =
    source.topContentLeft && typeof source.topContentLeft === "object"
      ? source.topContentLeft
      : {};
  const topContentRight =
    source.topContentRight && typeof source.topContentRight === "object"
      ? source.topContentRight
      : {};
  const contentSection =
    source.contentSection && typeof source.contentSection === "object"
      ? source.contentSection
      : {};
  const ourTeam = source.ourTeam && typeof source.ourTeam === "object" ? source.ourTeam : {};
  const boxOne =
    topContentLeft.boxOne && typeof topContentLeft.boxOne === "object" ? topContentLeft.boxOne : {};
  const boxTwo =
    topContentLeft.boxTwo && typeof topContentLeft.boxTwo === "object" ? topContentLeft.boxTwo : {};
  const boxThree =
    topContentLeft.boxThree && typeof topContentLeft.boxThree === "object"
      ? topContentLeft.boxThree
      : {};
  const members = Array.isArray(ourTeam.members) ? ourTeam.members : [];

  return {
    pageHeader: {
      enabled: toBool(pageHeader.enabled, DEFAULT_ABOUT_US.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeader.backgroundImageDataUrl,
        DEFAULT_ABOUT_US.pageHeader.backgroundImageDataUrl
      ),
      pageTitle: toText(pageHeader.pageTitle, DEFAULT_ABOUT_US.pageHeader.pageTitle),
    },
    topContentLeft: {
      enabled: toBool(topContentLeft.enabled, DEFAULT_ABOUT_US.topContentLeft.enabled),
      topTitle: toText(topContentLeft.topTitle, DEFAULT_ABOUT_US.topContentLeft.topTitle),
      topDescription: toText(
        topContentLeft.topDescription,
        DEFAULT_ABOUT_US.topContentLeft.topDescription
      ),
      boxOne: {
        title: toText(boxOne.title, DEFAULT_ABOUT_US.topContentLeft.boxOne.title),
        subtitle: toText(boxOne.subtitle, DEFAULT_ABOUT_US.topContentLeft.boxOne.subtitle),
        description: toText(
          boxOne.description,
          DEFAULT_ABOUT_US.topContentLeft.boxOne.description
        ),
      },
      boxTwo: {
        title: toText(boxTwo.title, DEFAULT_ABOUT_US.topContentLeft.boxTwo.title),
        subtitle: toText(boxTwo.subtitle, DEFAULT_ABOUT_US.topContentLeft.boxTwo.subtitle),
        description: toText(
          boxTwo.description,
          DEFAULT_ABOUT_US.topContentLeft.boxTwo.description
        ),
      },
      boxThree: {
        title: toText(boxThree.title, DEFAULT_ABOUT_US.topContentLeft.boxThree.title),
        subtitle: toText(boxThree.subtitle, DEFAULT_ABOUT_US.topContentLeft.boxThree.subtitle),
        description: toText(
          boxThree.description,
          DEFAULT_ABOUT_US.topContentLeft.boxThree.description
        ),
      },
    },
    topContentRight: {
      enabled: toBool(topContentRight.enabled, DEFAULT_ABOUT_US.topContentRight.enabled),
      imageDataUrl: toText(topContentRight.imageDataUrl, ""),
    },
    contentSection: {
      enabled: toBool(contentSection.enabled, DEFAULT_ABOUT_US.contentSection.enabled),
      firstParagraph: toText(
        contentSection.firstParagraph,
        DEFAULT_ABOUT_US.contentSection.firstParagraph
      ),
      secondParagraph: toText(
        contentSection.secondParagraph,
        DEFAULT_ABOUT_US.contentSection.secondParagraph
      ),
      contentImageDataUrl: toText(contentSection.contentImageDataUrl, ""),
    },
    ourTeam: {
      enabled: toBool(ourTeam.enabled, DEFAULT_ABOUT_US.ourTeam.enabled),
      title: toText(ourTeam.title, DEFAULT_ABOUT_US.ourTeam.title),
      description: toText(ourTeam.description, DEFAULT_ABOUT_US.ourTeam.description),
      members: DEFAULT_ABOUT_US.ourTeam.members.map((fallback, index) => {
        const member = members[index] && typeof members[index] === "object" ? members[index] : {};
        return {
          imageDataUrl: toText(member.imageDataUrl, ""),
          title: toText(member.title, fallback.title),
          subTitle: toText(member.subTitle ?? member.subtitle, fallback.subTitle),
        };
      }),
    },
  };
};

function AboutUsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200 sm:h-56" />
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="h-24 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`about-skeleton-stat-${index}`} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`about-skeleton-team-${index}`} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function StoreAboutUsPage() {
  const lang = DEFAULT_LANG;
  const aboutUsQuery = useQuery({
    queryKey: ["store-customization", "about-us", lang],
    queryFn: () => fetchStoreCustomization(lang),
    staleTime: 60_000,
  });

  const aboutUsRaw = aboutUsQuery.data?.customization?.aboutUs;
  const aboutUs = useMemo(() => normalizeAboutUs(aboutUsRaw), [aboutUsRaw]);

  if (aboutUsQuery.isLoading) {
    return <AboutUsSkeleton />;
  }

  if (aboutUsQuery.isError) {
    const errorMessage =
      aboutUsQuery.error?.response?.data?.message ||
      aboutUsQuery.error?.message ||
      "Failed to load About Us.";
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title="Failed to load About Us content."
          message={errorMessage}
          onRetry={() => aboutUsQuery.refetch()}
        />
      </div>
    );
  }

  if (!aboutUsRaw) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="About Us content is not configured yet."
          description="Please check back later."
        />
      </div>
    );
  }

  const hasTopContent = aboutUs.topContentLeft.enabled || aboutUs.topContentRight.enabled;
  const hasAnyEnabledBlock =
    aboutUs.pageHeader.enabled ||
    hasTopContent ||
    aboutUs.contentSection.enabled ||
    aboutUs.ourTeam.enabled;

  if (!hasAnyEnabledBlock) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="About Us content is not configured yet."
          description="All About Us blocks are currently disabled."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {aboutUs.pageHeader.enabled ? (
        <section
          className="relative overflow-hidden rounded-3xl border border-slate-200"
          style={
            aboutUs.pageHeader.backgroundImageDataUrl
              ? {
                  backgroundImage: `url(${aboutUs.pageHeader.backgroundImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div
            className={`absolute inset-0 ${
              aboutUs.pageHeader.backgroundImageDataUrl
                ? "bg-slate-900/55"
                : "bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100"
            }`}
          />
          <div className="relative px-4 py-12 text-center sm:px-8 sm:py-16">
            <h1
              className={`text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl ${
                aboutUs.pageHeader.backgroundImageDataUrl ? "text-white" : "text-slate-900"
              }`}
            >
              {aboutUs.pageHeader.pageTitle}
            </h1>
          </div>
        </section>
      ) : null}

      {hasTopContent ? (
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
          {aboutUs.topContentLeft.enabled ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                {aboutUs.topContentLeft.topTitle}
              </p>
              <p className="text-sm leading-7 text-slate-600 sm:text-base">
                {aboutUs.topContentLeft.topDescription}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[aboutUs.topContentLeft.boxOne, aboutUs.topContentLeft.boxTwo, aboutUs.topContentLeft.boxThree].map(
                  (item, index) => (
                    <article
                      key={`about-top-box-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="text-3xl font-extrabold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">{item.subtitle}</div>
                      <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
                        {item.description}
                      </p>
                    </article>
                  )
                )}
              </div>
            </div>
          ) : null}

          {aboutUs.topContentRight.enabled ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {aboutUs.topContentRight.imageDataUrl ? (
                <img
                  src={aboutUs.topContentRight.imageDataUrl}
                  alt="About Us top content"
                  className="h-full min-h-[260px] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-400">
                  Image not configured
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {aboutUs.contentSection.enabled ? (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            <p>{aboutUs.contentSection.firstParagraph}</p>
            <p>{aboutUs.contentSection.secondParagraph}</p>
          </div>
          {aboutUs.contentSection.contentImageDataUrl ? (
            <img
              src={aboutUs.contentSection.contentImageDataUrl}
              alt="About Us content"
              className="h-full min-h-[240px] w-full rounded-xl object-cover"
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-400">
              Content image not configured
            </div>
          )}
        </section>
      ) : null}

      {aboutUs.ourTeam.enabled ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{aboutUs.ourTeam.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{aboutUs.ourTeam.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {aboutUs.ourTeam.members.map((member, index) => (
              <article
                key={`about-team-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                {member.imageDataUrl ? (
                  <img
                    src={member.imageDataUrl}
                    alt={member.title}
                    className="h-44 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-400">
                    No image
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-base font-semibold text-slate-900">{member.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{member.subTitle}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import {
  UiEmptyState,
  UiErrorState,
} from "../../components/primitives/state/index.js";

const DEFAULT_LANG = "en";
const DEFAULT_ABOUT_US_DISABLED = {
  pageHeader: {
    enabled: false,
    backgroundImageDataUrl: "",
    pageTitle: "",
  },
  topContentLeft: {
    enabled: false,
    topTitle: "",
    topDescription: "",
    boxOne: {
      title: "",
      subtitle: "",
      description: "",
    },
    boxTwo: {
      title: "",
      subtitle: "",
      description: "",
    },
    boxThree: {
      title: "",
      subtitle: "",
      description: "",
    },
  },
  topContentRight: {
    enabled: false,
    imageDataUrl: "",
  },
  contentSection: {
    enabled: false,
    firstParagraph: "",
    secondParagraph: "",
    contentImageDataUrl: "",
  },
  ourTeam: {
    enabled: false,
    title: "",
    description: "",
    members: Array.from({ length: 6 }, (_, index) => ({
      imageDataUrl: "",
      title: "",
      subTitle: "",
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

const toImageDataUrl = (...values) => {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const hasText = (value) => String(value ?? "").trim().length > 0;

const hasAboutUsBoxContent = (item) =>
  hasText(item?.title) || hasText(item?.subtitle) || hasText(item?.description);

const isPlaceholderTeamTitle = (value) => /^name\s+\d+$/i.test(String(value ?? "").trim());

const isPlaceholderTeamSubtitle = (value) => /^role\s+\d+$/i.test(String(value ?? "").trim());

const buildDisplayOurTeamMember = (member) => {
  const title = isPlaceholderTeamTitle(member?.title) ? "" : toText(member?.title, "");
  const subTitle = isPlaceholderTeamSubtitle(member?.subTitle)
    ? ""
    : toText(member?.subTitle, "");
  const imageDataUrl = toImageDataUrl(member?.imageDataUrl, member?.image);
  return {
    imageDataUrl,
    title,
    subTitle,
  };
};

const hasDisplayOurTeamMemberContent = (member) =>
  hasText(member?.imageDataUrl) || hasText(member?.title) || hasText(member?.subTitle);

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
      enabled: toBool(pageHeader.enabled, DEFAULT_ABOUT_US_DISABLED.pageHeader.enabled),
      backgroundImageDataUrl: toImageDataUrl(
        pageHeader.backgroundImageDataUrl,
        pageHeader.backgroundImage,
        pageHeader.imageDataUrl,
        pageHeader.image
      ),
      pageTitle: toText(pageHeader.pageTitle, DEFAULT_ABOUT_US_DISABLED.pageHeader.pageTitle),
    },
    topContentLeft: {
      enabled: toBool(topContentLeft.enabled, DEFAULT_ABOUT_US_DISABLED.topContentLeft.enabled),
      topTitle: toText(topContentLeft.topTitle, DEFAULT_ABOUT_US_DISABLED.topContentLeft.topTitle),
      topDescription: toText(topContentLeft.topDescription, DEFAULT_ABOUT_US_DISABLED.topContentLeft.topDescription),
      boxOne: {
        title: toText(boxOne.title, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxOne.title),
        subtitle: toText(boxOne.subtitle, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxOne.subtitle),
        description: toText(boxOne.description, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxOne.description),
      },
      boxTwo: {
        title: toText(boxTwo.title, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxTwo.title),
        subtitle: toText(boxTwo.subtitle, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxTwo.subtitle),
        description: toText(boxTwo.description, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxTwo.description),
      },
      boxThree: {
        title: toText(boxThree.title, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxThree.title),
        subtitle: toText(boxThree.subtitle, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxThree.subtitle),
        description: toText(boxThree.description, DEFAULT_ABOUT_US_DISABLED.topContentLeft.boxThree.description),
      },
    },
    topContentRight: {
      enabled: toBool(topContentRight.enabled, DEFAULT_ABOUT_US_DISABLED.topContentRight.enabled),
      imageDataUrl: toImageDataUrl(topContentRight.imageDataUrl, topContentRight.image),
    },
    contentSection: {
      enabled: toBool(contentSection.enabled, DEFAULT_ABOUT_US_DISABLED.contentSection.enabled),
      firstParagraph: toText(contentSection.firstParagraph, DEFAULT_ABOUT_US_DISABLED.contentSection.firstParagraph),
      secondParagraph: toText(contentSection.secondParagraph, DEFAULT_ABOUT_US_DISABLED.contentSection.secondParagraph),
      contentImageDataUrl: toImageDataUrl(
        contentSection.contentImageDataUrl,
        contentSection.imageDataUrl,
        contentSection.image
      ),
    },
    ourTeam: {
      enabled: toBool(ourTeam.enabled, DEFAULT_ABOUT_US_DISABLED.ourTeam.enabled),
      title: toText(ourTeam.title, DEFAULT_ABOUT_US_DISABLED.ourTeam.title),
      description: toText(ourTeam.description, DEFAULT_ABOUT_US_DISABLED.ourTeam.description),
      members: DEFAULT_ABOUT_US_DISABLED.ourTeam.members.map((fallback, index) => {
        const member = members[index] && typeof members[index] === "object" ? members[index] : {};
        return {
          imageDataUrl: toImageDataUrl(member.imageDataUrl, member.image),
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
    queryFn: () => getStoreCustomization({ lang, include: "about-us" }),
    staleTime: 60_000,
  });

  const aboutUsRaw = aboutUsQuery.data?.customization?.aboutUs;
  const aboutUs = useMemo(() => normalizeAboutUs(aboutUsRaw), [aboutUsRaw]);
  const topContentLeftBoxes = useMemo(
    () =>
      [aboutUs.topContentLeft.boxOne, aboutUs.topContentLeft.boxTwo, aboutUs.topContentLeft.boxThree].filter(
        hasAboutUsBoxContent
      ),
    [aboutUs.topContentLeft.boxOne, aboutUs.topContentLeft.boxTwo, aboutUs.topContentLeft.boxThree]
  );
  const hasTopContentLeftContent =
    hasText(aboutUs.topContentLeft.topTitle) ||
    hasText(aboutUs.topContentLeft.topDescription) ||
    topContentLeftBoxes.length > 0;
  const shouldRenderTopContentLeft =
    aboutUs.topContentLeft.enabled && hasTopContentLeftContent;
  const shouldRenderTopContentRight = aboutUs.topContentRight.enabled;
  const contentParagraphs = [aboutUs.contentSection.firstParagraph, aboutUs.contentSection.secondParagraph].filter(
    hasText
  );
  const hasContentSectionContent =
    contentParagraphs.length > 0 || hasText(aboutUs.contentSection.contentImageDataUrl);
  const shouldRenderContentSection =
    aboutUs.contentSection.enabled && hasContentSectionContent;
  const displayOurTeamMembers = useMemo(
    () =>
      (Array.isArray(aboutUs.ourTeam.members) ? aboutUs.ourTeam.members : [])
        .map(buildDisplayOurTeamMember)
        .filter(hasDisplayOurTeamMemberContent),
    [aboutUs.ourTeam.members]
  );
  const hasOurTeamText =
    hasText(aboutUs.ourTeam.title) || hasText(aboutUs.ourTeam.description);
  const shouldRenderOurTeam =
    aboutUs.ourTeam.enabled && (hasOurTeamText || displayOurTeamMembers.length > 0);

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

  const hasTopContent = shouldRenderTopContentLeft || shouldRenderTopContentRight;
  const hasAnyEnabledBlock =
    aboutUs.pageHeader.enabled ||
    hasTopContent ||
    aboutUs.contentSection.enabled ||
    shouldRenderOurTeam;

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
          {shouldRenderTopContentLeft ? (
            <div className="space-y-4">
              {hasText(aboutUs.topContentLeft.topTitle) ? (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                  {aboutUs.topContentLeft.topTitle}
                </p>
              ) : null}
              {hasText(aboutUs.topContentLeft.topDescription) ? (
                <p className="text-sm leading-7 text-slate-600 sm:text-base">
                  {aboutUs.topContentLeft.topDescription}
                </p>
              ) : null}
              {topContentLeftBoxes.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {topContentLeftBoxes.map((item, index) => (
                    <article
                      key={`about-top-box-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      {hasText(item.title) ? (
                        <div className="text-3xl font-extrabold text-slate-900">{item.title}</div>
                      ) : null}
                      {hasText(item.subtitle) ? (
                        <div className="mt-1 text-sm font-semibold text-slate-800">{item.subtitle}</div>
                      ) : null}
                      {hasText(item.description) ? (
                        <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
                          {item.description}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {shouldRenderTopContentRight ? (
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

      {shouldRenderContentSection ? (
        <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
            {contentParagraphs.map((paragraph, index) => (
              <p key={`about-content-paragraph-${index}`}>{paragraph}</p>
            ))}
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

      {shouldRenderOurTeam ? (
        <section className="space-y-5">
          {hasOurTeamText ? (
            <div>
              {hasText(aboutUs.ourTeam.title) ? (
                <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {aboutUs.ourTeam.title}
                </h2>
              ) : null}
              {hasText(aboutUs.ourTeam.description) ? (
                <p className="mt-2 text-sm text-slate-500">{aboutUs.ourTeam.description}</p>
              ) : null}
            </div>
          ) : null}
          {displayOurTeamMembers.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayOurTeamMembers.map((member, index) => (
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
                  {hasText(member.title) ? (
                    <h3 className="text-base font-semibold text-slate-900">{member.title}</h3>
                  ) : null}
                  {hasText(member.subTitle) ? (
                    <p className="mt-1 text-sm text-slate-500">{member.subTitle}</p>
                  ) : null}
                </div>
              </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

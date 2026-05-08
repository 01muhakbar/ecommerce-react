import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroBannerImage from "../../assets/admin-login-hero.jpg";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeMainSliderImageFocus = (value, fallback = "right") => {
  const normalized = toText(value, fallback).toLowerCase();
  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }
  return fallback;
};

const normalizeMainSliderAutoplayDelaySeconds = (value, fallback = 5) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (parsed === 5 || parsed === 10 || parsed === 15) {
    return parsed;
  }
  return fallback === 10 || fallback === 15 ? fallback : 5;
};

const getCustomImagePositionClass = (value) => {
  const normalized = normalizeMainSliderImageFocus(value);
  if (normalized === "left") return "object-left";
  if (normalized === "center") return "object-center";
  return "object-right";
};

const normalizeLink = (value, fallback = "/search") => {
  const normalized = toText(value);
  if (!normalized) return fallback;
  if (normalized.startsWith("/")) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return fallback;
};

const isExternalLink = (value) => /^https?:\/\//i.test(toText(value));

export default function HomeHeroBanners({
  slides,
  activeSlide,
  setActiveSlide,
  options = {},
}) {
  const safeSlides = Array.isArray(slides) && slides.length > 0 ? slides : [];
  const slideIndex = Math.max(0, Math.min(activeSlide || 0, safeSlides.length - 1));
  const displaySlide = safeSlides[slideIndex] || {
    title: "Quality Freshness Guaranteed!",
    description: "Fresh groceries and essentials delivered to your doorstep.",
    buttonName: "Buy Now",
    buttonLink: "/search",
    imageDataUrl: "",
    imageFocus: "right",
    usesDefaultArtwork: true,
  };
  const heroSubtitle = toText(displaySlide.description ?? displaySlide.subtitle);
  const hasDescription = Boolean(heroSubtitle);
  const ctaLabel = toText(displaySlide.buttonName ?? displaySlide.cta);
  const hasCta = Boolean(ctaLabel);
  const ctaLink = hasCta ? normalizeLink(displaySlide.buttonLink, "/search") : "";
  const ctaIsExternal = isExternalLink(ctaLink);
  const resolvedCustomImage = resolveAssetUrl(displaySlide.imageDataUrl);
  const hasCustomImage = Boolean(resolvedCustomImage);
  const showDefaultArtwork = !hasCustomImage && displaySlide.usesDefaultArtwork === true;
  const imageSrc = hasCustomImage ? resolvedCustomImage : showDefaultArtwork ? heroBannerImage : "";
  const customImagePositionClass = getCustomImagePositionClass(displaySlide.imageFocus);
  const showArrows = options.showArrows === true;
  const showDots = options.showDots !== false;
  const autoplayEnabled = options.autoplayEnabled === true;
  const autoplayDelaySeconds = normalizeMainSliderAutoplayDelaySeconds(
    options.autoplayDelaySeconds,
    5
  );
  const contentWrapClass = showArrows
    ? "relative z-10 flex h-full max-w-full items-center pb-11 pl-16 pr-16 pt-6 sm:pb-13 sm:pl-20 sm:pr-20 sm:pt-8 lg:pb-14 lg:pl-24 lg:pr-24 lg:pt-10"
    : "relative z-10 flex h-full max-w-full items-center pb-11 pl-4 pr-4 pt-6 sm:pb-13 sm:pl-6 sm:pr-6 sm:pt-8 lg:pb-14 lg:pl-8 lg:pr-8 lg:pt-10";
  const defaultContentClass = showArrows
    ? "max-w-[58%] sm:max-w-[52%] lg:max-w-[46%] xl:max-w-[44%]"
    : "max-w-[72%] sm:max-w-[62%] lg:max-w-[60%] xl:max-w-[58%]";
  const customImageContentShellClass = hasCustomImage
    ? showArrows
      ? "max-w-[16rem] sm:max-w-[20rem] lg:max-w-[24rem] xl:max-w-[25rem]"
      : "max-w-[min(100%,31rem)]"
    : "";
  const titleClassName = showArrows
    ? "max-w-[16ch] overflow-hidden text-[clamp(1.55rem,2.4vw,2.8rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
    : "max-w-[20ch] overflow-hidden text-[clamp(1.75rem,2.85vw,3.1rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-slate-900 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]";
  const descriptionClassName = showArrows
    ? "mt-3 max-w-[32ch] overflow-hidden text-[12px] leading-[1.6] text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] sm:max-w-[34ch] sm:text-[13px] sm:leading-[1.65] lg:mt-3.5 lg:max-w-[36ch] lg:text-[0.98rem] lg:leading-[1.58]"
    : "mt-3 max-w-[42ch] overflow-hidden text-[13px] leading-[1.65] text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] sm:max-w-[42ch] sm:text-[14px] sm:leading-6 lg:mt-3.5 lg:max-w-[40ch] lg:text-[clamp(0.96rem,1.08vw,1.08rem)] lg:leading-[1.58]";
  const goToPrevSlide = () => {
    if (safeSlides.length <= 1) return;
    setActiveSlide?.((slideIndex - 1 + safeSlides.length) % safeSlides.length);
  };
  const goToNextSlide = () => {
    if (safeSlides.length <= 1) return;
    setActiveSlide?.((slideIndex + 1) % safeSlides.length);
  };
  const ctaClassName = `inline-flex min-h-10 w-fit max-w-[220px] items-center justify-center rounded-full bg-emerald-600 px-4 py-2.5 text-center text-[12px] font-semibold leading-tight whitespace-normal break-words text-white shadow-[0_10px_20px_-14px_rgba(5,150,105,0.85)] transition hover:bg-emerald-700 sm:min-h-11 sm:max-w-[260px] sm:px-5 sm:text-[13px] lg:min-h-[48px] lg:max-w-[300px] lg:px-6 lg:text-[13px] ${
    hasDescription ? "mt-4 sm:mt-5 lg:mt-5" : "mt-3 sm:mt-4 lg:mt-4"
  }`;

  useEffect(() => {
    if (!autoplayEnabled || safeSlides.length <= 1 || typeof setActiveSlide !== "function") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveSlide((current) => {
        const currentIndex = Number.isFinite(current) ? current : 0;
        return (currentIndex + 1) % safeSlides.length;
      });
    }, autoplayDelaySeconds * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoplayDelaySeconds, autoplayEnabled, safeSlides.length, setActiveSlide]);

  return (
    <section className="w-full">
      <article className="relative h-[230px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#eaf2f7] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.5)] sm:h-[290px] lg:h-[374px] xl:h-[386px]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={toText(displaySlide.title, "Fresh groceries")}
            className={`absolute right-0 top-0 h-full object-cover ${
              hasCustomImage
                ? `w-full ${customImagePositionClass}`
                : "w-[56%] sm:w-[53%] lg:w-[46%] xl:w-[44%]"
            }`}
          />
        ) : null}
        {imageSrc ? (
          <div
            className={`absolute inset-0 ${
              hasCustomImage
                ? "bg-transparent"
                : "bg-gradient-to-r from-[#eaf2f7] via-[#eaf2f7]/96 to-transparent"
            }`}
          />
        ) : null}
        {!hasCustomImage ? (
          <div className="pointer-events-none absolute -left-8 top-9 h-36 w-36 rounded-full bg-white/65 blur-3xl sm:h-48 sm:w-48" />
        ) : null}
        {showArrows && safeSlides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goToPrevSlide}
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 text-slate-700 shadow-sm transition hover:bg-white sm:left-3 lg:left-4"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goToNextSlide}
              aria-label="Next slide"
              className="absolute right-2 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 text-slate-700 shadow-sm transition hover:bg-white sm:right-3 lg:right-4"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className={contentWrapClass}>
          <div
            className={
              hasCustomImage
                ? customImageContentShellClass
                : defaultContentClass
            }
          >
            <h1 className={titleClassName}>
              {displaySlide.title}
            </h1>
            {heroSubtitle ? (
              <p className={descriptionClassName}>
                {heroSubtitle}
              </p>
            ) : null}

            {hasCta && ctaIsExternal ? (
              <a
                href={ctaLink}
                target="_blank"
                rel="noreferrer"
                className={ctaClassName}
              >
                {ctaLabel}
              </a>
            ) : null}
            {hasCta && !ctaIsExternal ? (
              <Link
                to={ctaLink}
                className={ctaClassName}
              >
                {ctaLabel}
              </Link>
            ) : null}
          </div>
        </div>

        {showDots ? (
          <div className="absolute bottom-5 left-14 z-10 flex items-center gap-1.5 sm:left-16 lg:bottom-6 lg:left-[4.75rem]">
            {Array.from({ length: Math.max(3, safeSlides.length || 0) || 3 }).map((_, index) => {
              const currentIndex = index % Math.max(1, safeSlides.length);
              const isActive = currentIndex === slideIndex;
              return (
                <button
                  key={`hero-dot-${index}`}
                  type="button"
                  onClick={() => setActiveSlide?.(currentIndex)}
                  aria-label={`Slide ${index + 1}`}
                  className={`rounded-full transition-all ${
                    isActive ? "h-2 w-5 bg-emerald-600" : "h-2 w-2 bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              );
            })}
          </div>
        ) : null}
      </article>
    </section>
  );
}

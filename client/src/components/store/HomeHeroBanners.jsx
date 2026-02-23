import { Link } from "react-router-dom";
import heroBannerImage from "../../assets/admin-login-hero.jpg";

export default function HomeHeroBanners({ slides, activeSlide, setActiveSlide }) {
  const safeSlides = Array.isArray(slides) && slides.length > 0 ? slides : [];
  const slideIndex = Math.max(0, Math.min(activeSlide || 0, safeSlides.length - 1));
  const displaySlide = safeSlides[slideIndex] || {
    title: "Quality Freshness Guaranteed!",
    subtitle: "Fresh groceries and essentials delivered to your doorstep.",
    cta: "Buy Now",
  };
  const heroSubtitle = displaySlide.subtitle || "Fresh groceries delivered every day.";
  const ctaLabel = displaySlide.cta || "Buy Now";

  return (
    <section className="w-full">
      <article className="relative h-[230px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#edf3f8] shadow-[0_22px_40px_-30px_rgba(15,23,42,0.42)] sm:h-[290px] lg:h-[380px] xl:h-[400px]">
        <img
          src={heroBannerImage}
          alt="Fresh groceries"
          className="absolute right-0 top-0 h-full w-[58%] object-cover sm:w-[54%] lg:w-[52%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#edf3f8] via-[#edf3f8]/95 to-transparent" />
        <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/60 blur-3xl sm:h-52 sm:w-52" />

        <div className="relative z-10 flex h-full max-w-[66%] flex-col justify-center px-5 pb-12 pt-5 sm:max-w-[56%] sm:px-8 sm:pb-14 sm:pt-8 lg:max-w-[50%] lg:px-10 lg:pb-16">
          <h1 className="text-[24px] font-bold leading-[1.1] text-slate-900 sm:text-[30px] lg:text-[42px]">
            {displaySlide.title}
          </h1>
          <p className="mt-2.5 text-[12px] leading-5 text-slate-600 sm:text-[13px] lg:mt-4 lg:text-sm">
            {heroSubtitle}
          </p>

          <Link
            to="/search?q=apple&page=1"
            className="mt-5 inline-flex w-fit items-center rounded-full bg-emerald-600 px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 lg:mt-7"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="absolute bottom-5 left-6 z-10 flex items-center gap-1.5 sm:left-8 lg:bottom-6 lg:left-10">
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
      </article>
    </section>
  );
}

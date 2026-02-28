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
      <article className="relative h-[230px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#eaf2f7] shadow-[0_16px_28px_-24px_rgba(15,23,42,0.5)] sm:h-[290px] lg:h-[374px] xl:h-[386px]">
        <img
          src={heroBannerImage}
          alt="Fresh groceries"
          className="absolute right-0 top-0 h-full w-[56%] object-cover sm:w-[53%] lg:w-[50%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#eaf2f7] via-[#eaf2f7]/96 to-transparent" />
        <div className="pointer-events-none absolute -left-8 top-9 h-36 w-36 rounded-full bg-white/65 blur-3xl sm:h-48 sm:w-48" />

        <div className="relative z-10 flex h-full max-w-[66%] flex-col justify-center px-5 pb-12 pt-5 sm:max-w-[56%] sm:px-8 sm:pb-14 sm:pt-8 lg:max-w-[52%] lg:px-10 lg:pb-16">
          <h1 className="text-[24px] font-extrabold leading-[1.05] tracking-[-0.01em] text-slate-900 sm:text-[32px] lg:text-[54px]">
            {displaySlide.title}
          </h1>
          <p className="mt-2.5 max-w-[34ch] text-[12px] leading-5 text-slate-600 sm:text-[13px] lg:mt-4 lg:text-[22px] lg:leading-7">
            {heroSubtitle}
          </p>

          <Link
            to="/search?q=apple&page=1"
            className="mt-5 inline-flex h-10 w-fit items-center rounded-full bg-emerald-600 px-6 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:h-11 sm:px-7 sm:text-[14px] lg:mt-7 lg:h-12 lg:px-8 lg:text-[16px]"
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

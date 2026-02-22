import { Link } from "react-router-dom";
import heroBannerImage from "../../assets/admin-login-hero.jpg";

export default function HomeHeroBanners({
  slides,
  activeSlide,
  setActiveSlide,
  promoClassName = "",
}) {
  const safeSlides = Array.isArray(slides) && slides.length > 0 ? slides : [];
  const slideIndex = Math.max(0, Math.min(activeSlide || 0, safeSlides.length - 1));
  const displaySlide = safeSlides[slideIndex] || {
    title: "The Best Quality Products Guaranteed!",
    subtitle: "Fresh groceries and essentials delivered to your doorstep.",
  };
  const heroSubtitle =
    displaySlide.subtitle || "Fresh groceries and essentials delivered to your doorstep.";

  return (
    <section className="space-y-4 px-3 pb-2 pt-4 sm:px-4 lg:px-0">
      <article className="relative h-[160px] overflow-hidden rounded-2xl border border-[#d7dee8] bg-[#edf3f8] shadow-sm sm:h-[176px] lg:h-[360px]">
        <img
          src={heroBannerImage}
          alt="Fresh groceries"
          className="absolute right-0 top-0 h-full w-[55%] object-cover lg:w-[52%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#edf3f8] via-[#edf3f8]/95 to-transparent" />

        <div className="relative z-10 max-w-[58%] p-4 sm:p-5 lg:max-w-[45%] lg:p-8">
          <h1 className="text-lg font-bold leading-6 text-slate-900 sm:text-2xl sm:leading-8 lg:text-4xl lg:leading-[1.15]">
            Quality Freshness Guaranteed!
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm">
            {heroSubtitle}
          </p>

          <Link
            to="/search?query=organic"
            className="mt-4 inline-flex rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 lg:mt-6 lg:px-6 lg:py-2.5"
          >
            Buy Now
          </Link>
        </div>

        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => {
            const isActive = index === (slideIndex % 5);
            return (
              <button
                key={`hero-dot-${index}`}
                type="button"
                onClick={() => setActiveSlide?.(index % Math.max(1, safeSlides.length))}
                aria-label={`Slide ${index + 1}`}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  isActive ? "bg-slate-800" : "bg-slate-300"
                }`}
              />
            );
          })}
        </div>
      </article>

      <article
        className={`relative overflow-hidden rounded-2xl border border-[#f1d2b3] bg-[#FDEEDC] p-5 shadow-sm sm:p-6 ${promoClassName}`}
      >
        <div className="pr-24">
          <h2 className="text-lg font-semibold leading-7 text-slate-900 sm:text-xl">
            100% Natural Quality Organic Product
          </h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            See our latest collection of organic products and healthy groceries for your family.
          </p>
        </div>
        <Link
          to="/search?query=organic"
          className="absolute right-5 top-1/2 inline-flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white shadow-md hover:bg-emerald-700"
        >
          <span className="text-center leading-[1.05rem]">
            Buy
            <br />
            Now
          </span>
        </Link>
      </article>
    </section>
  );
}

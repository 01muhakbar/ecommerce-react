export default function HeroSlider({
  heroSlide,
  slides,
  activeSlide,
  setActiveSlide,
  onCta,
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-8">
      <div className="absolute right-8 top-8 h-48 w-48 rounded-full bg-emerald-100/80 blur-2xl" />
      <div className="relative z-10 max-w-md">
        <p className="text-sm text-slate-600">{heroSlide.subtitle}</p>
        <h1 className="mt-4 text-4xl font-semibold text-slate-900">{heroSlide.title}</h1>
        <button
          type="button"
          onClick={onCta}
          className="mt-6 inline-flex rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Buy Now
        </button>
        <div className="mt-8 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={`h-2 w-2 rounded-full ${
                index === activeSlide ? "bg-emerald-600" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-y-0 right-6 top-10 hidden w-48 rounded-2xl bg-[radial-gradient(circle_at_top,#d1fae5,#a7f3d0,#ecfdf5)] opacity-80 shadow-lg lg:block" />
    </div>
  );
}

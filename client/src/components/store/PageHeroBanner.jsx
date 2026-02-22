export default function PageHeroBanner({ title, subtitle }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-10 sm:px-8 sm:py-14 lg:py-16">
      <div className="pointer-events-none absolute -left-12 top-6 h-28 w-28 rounded-full bg-emerald-200/70 blur-xl sm:h-40 sm:w-40" />
      <div className="pointer-events-none absolute -right-10 top-8 h-24 w-24 rounded-full bg-indigo-200/70 blur-xl sm:h-36 sm:w-36" />
      <div className="pointer-events-none absolute bottom-4 left-8 h-12 w-24 rounded-full bg-white/60 blur-lg sm:h-16 sm:w-32" />
      <div className="pointer-events-none absolute bottom-6 right-8 h-12 w-24 rounded-full bg-white/60 blur-lg sm:h-16 sm:w-32" />

      <div className="relative mx-auto flex min-h-[130px] max-w-3xl flex-col items-center justify-center text-center sm:min-h-[160px]">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
        ) : null}
      </div>
    </section>
  );
}

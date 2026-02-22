import PageHeroBanner from "../../components/store/PageHeroBanner.jsx";
import heroImage from "../../assets/admin-login-hero.jpg";

const STATS = [
  {
    value: "8K",
    title: "Lovely Customer",
    desc: "Shoppers trust us for fresh products every day.",
  },
  {
    value: "10K",
    title: "Listed Products",
    desc: "Daily essentials and grocery selections in one place.",
  },
  {
    value: "18K",
    title: "Orders Delivered",
    desc: "Orders delivered quickly with reliable service.",
  },
];

const TEAM = [
  { name: "Rina Saputra", role: "Founder & CEO" },
  { name: "Dimas Prakoso", role: "Operations Lead" },
  { name: "Sarah Amelia", role: "Product Manager" },
  { name: "Kevin Wijaya", role: "Customer Success" },
  { name: "Nadia Putri", role: "Supply Chain" },
  { name: "Rafi Nugraha", role: "Marketing Manager" },
];

export default function StoreAboutUsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <PageHeroBanner
        title="About Us"
        subtitle="Helping families shop fresh groceries and essentials with a faster and friendlier experience."
      />

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            Welcome to our KachaBazar shop
          </p>
          <h2 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            We deliver freshness and convenience straight to your doorstep.
          </h2>
          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            KachaBazar started as a small neighborhood grocery service. Today, we support
            thousands of customers with carefully selected produce, pantry items, and
            daily household essentials. Our mission is simple: make online grocery shopping
            easy, affordable, and dependable for every family.
          </p>
          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            We work closely with trusted suppliers, local farms, and fulfillment partners
            to maintain quality and speed. Every order is packed with care and delivered
            with a customer-first mindset.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <img
            src={heroImage}
            alt="Fresh products"
            className="h-40 w-full rounded-2xl object-cover sm:h-48"
          />
          <div className="flex h-40 items-end rounded-2xl bg-emerald-100 p-4 sm:h-48">
            <span className="text-sm font-semibold text-emerald-700">Farm-fresh daily</span>
          </div>
          <div className="flex h-40 items-end rounded-2xl bg-indigo-100 p-4 sm:h-48">
            <span className="text-sm font-semibold text-indigo-700">Fast local delivery</span>
          </div>
          <img
            src={heroImage}
            alt="Grocery team"
            className="h-40 w-full rounded-2xl object-cover sm:h-48"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATS.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-3xl font-extrabold text-slate-900">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.title}</div>
            <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">{item.desc}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Our Team</h2>
          <p className="mt-2 text-sm text-slate-500">
            The people behind our day-to-day operations and customer happiness.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((member, index) => (
            <article
              key={`${member.name}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <img
                src={heroImage}
                alt={member.name}
                className="h-44 w-full rounded-xl object-cover"
              />
              <div className="mt-4">
                <h3 className="text-base font-semibold text-slate-900">{member.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{member.role}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 leading-7 text-slate-600 sm:p-6">
        We continuously improve our operations, technology, and customer support so your
        shopping experience stays smooth from browse to delivery. Thanks for being part of
        our journey.
      </section>
    </div>
  );
}

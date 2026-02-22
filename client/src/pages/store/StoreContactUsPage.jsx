import { useState } from "react";
import { Clock3, Mail, MapPin, PhoneCall } from "lucide-react";
import PageHeroBanner from "../../components/store/PageHeroBanner.jsx";

const CONTACT_CARDS = [
  {
    title: "Email Us",
    primary: "support@kachabazar.com",
    desc: "We answer email inquiries every business day.",
    Icon: Mail,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Call Us",
    primary: "+62 812 3456 7890",
    desc: "Talk directly to our support team for urgent needs.",
    Icon: PhoneCall,
    color: "bg-sky-100 text-sky-700",
  },
  {
    title: "Location",
    primary: "59 Station Rd, Purls Bridge",
    desc: "Our central fulfillment and support office.",
    Icon: MapPin,
    color: "bg-amber-100 text-amber-700",
  },
  {
    title: "Business Hours",
    primary: "Mon - Sat, 08:00 - 21:00",
    desc: "Weekend support available with limited response time.",
    Icon: Clock3,
    color: "bg-violet-100 text-violet-700",
  },
];

export default function StoreContactUsPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Please complete all required fields.");
      return;
    }
    if (!emailOk) {
      setError("Please enter a valid email address.");
      return;
    }

    setNotice("Message sent (demo).");
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <PageHeroBanner
        title="Contact Us"
        subtitle="For any support, our team is ready to help and answer your questions."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CONTACT_CARDS.map((card) => {
          const Icon = card.Icon;
          return (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-1 text-sm font-medium text-slate-700">{card.primary}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{card.desc}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-2xl font-bold text-slate-900">For any support just send your query</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Support Team</p>
            <h3 className="mt-3 text-2xl font-bold leading-tight">
              We are here to support your grocery journey.
            </h3>
            <p className="mt-3 text-sm leading-7 text-emerald-100">
              Share your request, feedback, or any issue you face. Our team will get
              back to you with the best possible solution.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Your Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Your Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => onChange("email", event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(event) => onChange("subject", event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Message *</label>
              <textarea
                rows={5}
                value={form.message}
                onChange={(event) => onChange("message", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </div>
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

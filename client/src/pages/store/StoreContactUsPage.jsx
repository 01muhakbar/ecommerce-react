import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, PhoneCall } from "lucide-react";
import { getStoreCustomization } from "../../api/store.service.ts";
import { UiEmptyState, UiErrorState } from "../../components/ui-states/index.js";

const DEFAULT_LANG = "en";
const DEFAULT_CONTACT_US = {
  pageHeader: {
    enabled: true,
    backgroundImageDataUrl: "",
    pageTitle: "Contact Us",
  },
  emailBox: {
    enabled: true,
    title: "Email Us",
    email: "info@kachabazar.com",
    text: "Interactively grow empowered for process-centric total linkage.",
  },
  callBox: {
    enabled: true,
    title: "Call Us",
    phone: "029-00124667",
    text: "Distinctively disseminate focused solutions clicks-and-mortar ministerate.",
  },
  addressBox: {
    enabled: true,
    title: "Location",
    address: "Boho One, Bridge Street West, Middlesbrough, North Yorkshire, TS2 1AE.",
  },
  middleLeftColumn: {
    enabled: true,
    imageDataUrl: "",
  },
  contactForm: {
    enabled: true,
    title: "For any support just send your query",
    description:
      "Collaboratively promote client-focused convergence vis-a-vis customer-directed alignments via plagiarized strategic users and standardized infrastructures.",
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

const normalizeContactUs = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const pageHeader =
    source.pageHeader && typeof source.pageHeader === "object" ? source.pageHeader : {};
  const emailBox = source.emailBox && typeof source.emailBox === "object" ? source.emailBox : {};
  const callBox = source.callBox && typeof source.callBox === "object" ? source.callBox : {};
  const addressBox =
    source.addressBox && typeof source.addressBox === "object" ? source.addressBox : {};
  const middleLeftColumn =
    source.middleLeftColumn && typeof source.middleLeftColumn === "object"
      ? source.middleLeftColumn
      : {};
  const contactForm =
    source.contactForm && typeof source.contactForm === "object" ? source.contactForm : {};

  return {
    pageHeader: {
      enabled: toBool(pageHeader.enabled, DEFAULT_CONTACT_US.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeader.backgroundImageDataUrl ?? pageHeader.backgroundImage ?? pageHeader.imageDataUrl,
        DEFAULT_CONTACT_US.pageHeader.backgroundImageDataUrl
      ),
      pageTitle: toText(pageHeader.pageTitle, DEFAULT_CONTACT_US.pageHeader.pageTitle),
    },
    emailBox: {
      enabled: toBool(emailBox.enabled, DEFAULT_CONTACT_US.emailBox.enabled),
      title: toText(emailBox.title, DEFAULT_CONTACT_US.emailBox.title),
      email: toText(emailBox.email, DEFAULT_CONTACT_US.emailBox.email),
      text: toText(emailBox.text, DEFAULT_CONTACT_US.emailBox.text),
    },
    callBox: {
      enabled: toBool(callBox.enabled, DEFAULT_CONTACT_US.callBox.enabled),
      title: toText(callBox.title, DEFAULT_CONTACT_US.callBox.title),
      phone: toText(callBox.phone, DEFAULT_CONTACT_US.callBox.phone),
      text: toText(callBox.text, DEFAULT_CONTACT_US.callBox.text),
    },
    addressBox: {
      enabled: toBool(addressBox.enabled, DEFAULT_CONTACT_US.addressBox.enabled),
      title: toText(addressBox.title, DEFAULT_CONTACT_US.addressBox.title),
      address: toText(addressBox.address, DEFAULT_CONTACT_US.addressBox.address),
    },
    middleLeftColumn: {
      enabled: toBool(
        middleLeftColumn.enabled,
        DEFAULT_CONTACT_US.middleLeftColumn.enabled
      ),
      imageDataUrl: toText(middleLeftColumn.imageDataUrl, ""),
    },
    contactForm: {
      enabled: toBool(contactForm.enabled, DEFAULT_CONTACT_US.contactForm.enabled),
      title: toText(contactForm.title, DEFAULT_CONTACT_US.contactForm.title),
      description: toText(
        contactForm.description,
        DEFAULT_CONTACT_US.contactForm.description
      ),
    },
  };
};

function ContactUsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="h-48 animate-pulse rounded-3xl bg-slate-200 sm:h-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={`contact-skeleton-card-${index}`}
            className="h-36 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function StoreContactUsPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lang = DEFAULT_LANG;
  const contactQuery = useQuery({
    queryKey: ["store-customization", "contact-us", lang],
    queryFn: () => getStoreCustomization({ lang, include: "contactUs" }),
    staleTime: 60_000,
  });

  const contactUsRaw = contactQuery.data?.customization?.contactUs;
  const contactUs = useMemo(() => normalizeContactUs(contactUsRaw), [contactUsRaw]);

  const cards = useMemo(
    () => [
      contactUs.emailBox.enabled
        ? {
            key: "email",
            title: contactUs.emailBox.title,
            primary: contactUs.emailBox.email,
            text: contactUs.emailBox.text,
            Icon: Mail,
            iconClassName: "bg-emerald-100 text-emerald-700",
          }
        : null,
      contactUs.callBox.enabled
        ? {
            key: "call",
            title: contactUs.callBox.title,
            primary: contactUs.callBox.phone,
            text: contactUs.callBox.text,
            Icon: PhoneCall,
            iconClassName: "bg-sky-100 text-sky-700",
          }
        : null,
      contactUs.addressBox.enabled
        ? {
            key: "address",
            title: contactUs.addressBox.title,
            primary: contactUs.addressBox.address,
            text: "",
            Icon: MapPin,
            iconClassName: "bg-amber-100 text-amber-700",
          }
        : null,
    ].filter(Boolean),
    [contactUs]
  );

  const hasAnyEnabledSection =
    contactUs.pageHeader.enabled ||
    contactUs.emailBox.enabled ||
    contactUs.callBox.enabled ||
    contactUs.addressBox.enabled ||
    contactUs.middleLeftColumn.enabled ||
    contactUs.contactForm.enabled;

  const onChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !email || !message) {
      setFormError("Please complete all required fields.");
      return;
    }
    if (!isEmailValid) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      setForm({ name: "", email: "", message: "" });
      setFormSuccess("Thanks! We received your message.");
    }, 800);
  };

  if (contactQuery.isLoading) return <ContactUsSkeleton />;

  if (contactQuery.isError) {
    const errorMessage =
      contactQuery.error?.response?.data?.message ||
      contactQuery.error?.message ||
      "Failed to load contact page.";
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title="Failed to load Contact Us."
          message={errorMessage}
          onRetry={() => contactQuery.refetch()}
        />
      </div>
    );
  }

  if (!contactUsRaw) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Contact content is not configured yet."
          description="Please check back later."
        />
      </div>
    );
  }

  if (!hasAnyEnabledSection) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Contact page is disabled."
          description="All contact blocks are currently disabled."
        />
      </div>
    );
  }

  const hasHeroBackground = Boolean(contactUs.pageHeader.backgroundImageDataUrl);
  const showMiddleLeftImage =
    contactUs.middleLeftColumn.enabled && Boolean(contactUs.middleLeftColumn.imageDataUrl);
  const showContactForm = contactUs.contactForm.enabled;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {contactUs.pageHeader.enabled ? (
        <header
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 px-6 py-12 text-white sm:px-8 sm:py-16"
          style={
            hasHeroBackground
              ? {
                  backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.58)), url(${contactUs.pageHeader.backgroundImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <h1 className="text-3xl font-bold sm:text-4xl">{contactUs.pageHeader.pageTitle}</h1>
        </header>
      ) : null}

      {cards.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.key}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClassName}`}
              >
                <card.Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-1 text-sm font-medium text-slate-700">{card.primary}</p>
              {card.text ? (
                <p className="mt-2 text-xs leading-6 text-slate-500">{card.text}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {showMiddleLeftImage || showContactForm ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            {showMiddleLeftImage ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <img
                  src={contactUs.middleLeftColumn.imageDataUrl}
                  alt="Contact us"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}

            {showContactForm ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {contactUs.contactForm.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {contactUs.contactForm.description}
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
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
                  <div>
                    <label className="text-sm font-medium text-slate-700">Message *</label>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(event) => onChange("message", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  {formError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {formError}
                    </div>
                  ) : null}
                  {formSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {formSuccess}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

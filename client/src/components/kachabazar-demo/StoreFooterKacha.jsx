import { Link } from "react-router-dom";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const DEFAULT_FOOTER = {
  block1: {
    enabled: true,
    title: "Company",
    links: [
      { label: "About Us", href: "/about-us" },
      { label: "Contact Us", href: "/contact-us" },
      { label: "Careers", href: "#" },
      { label: "Latest News", href: "#" },
    ],
  },
  block2: {
    enabled: true,
    title: "Latest News",
    links: [
      { label: "Fish & Meat", href: "/search?category=fish-meat" },
      { label: "Soft Drink", href: "/search?category=drinks" },
      { label: "Milk & Dairy", href: "/search?category=milk-dairy" },
      { label: "Beauty & Health", href: "/search?category=beauty-health" },
    ],
  },
  block3: {
    enabled: true,
    title: "My Account",
    links: [
      { label: "Dashboard", href: "/user/dashboard" },
      { label: "My Orders", href: "/user/my-orders" },
      { label: "Recent Orders", href: "/user/dashboard" },
      { label: "Update Profile", href: "/user/update-profile" },
    ],
  },
  block4: {
    enabled: true,
    footerLogoDataUrl: "",
    address: "987 Andre Plain Suite High Street 838, Lake Hestertown, USA",
    phone: "02.356.1666",
    email: "ccruidk@test.com",
  },
  socialLinks: {
    enabled: true,
    facebook: "https://www.facebook.com/",
    twitter: "https://twitter.com/",
    pinterest: "https://www.pinterest.com/",
    linkedin: "https://www.linkedin.com/",
    whatsapp: "https://web.whatsapp.com/",
  },
  paymentMethod: {
    enabled: true,
    imageDataUrl: "",
  },
  bottomContact: {
    enabled: true,
    contactNumber: "+6599887766",
  },
};

const SOCIAL_LINKS = [
  { key: "facebook", label: "Facebook" },
  { key: "twitter", label: "Twitter" },
  { key: "pinterest", label: "Pinterest" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "whatsapp", label: "WhatsApp" },
];

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

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeFooterLinks = (rawLinks, fallbackLinks) => {
  const source = Array.isArray(rawLinks) ? rawLinks : fallbackLinks;
  return source
    .map((item, index) => {
      const sourceItem = isPlainObject(item) ? item : {};
      const fallbackItem = fallbackLinks[index] || { label: "", href: "" };
      return {
        label: toText(sourceItem.label, fallbackItem.label),
        href: toText(sourceItem.href, fallbackItem.href),
      };
    })
    .filter((item) => item.label && item.href);
};

const normalizeFooterConfig = (rawFooter) => {
  const source = isPlainObject(rawFooter) ? rawFooter : {};
  const block1 = isPlainObject(source.block1) ? source.block1 : {};
  const block2 = isPlainObject(source.block2) ? source.block2 : {};
  const block3 = isPlainObject(source.block3) ? source.block3 : {};
  const block4 = isPlainObject(source.block4) ? source.block4 : {};
  const socialLinks = isPlainObject(source.socialLinks) ? source.socialLinks : {};
  const paymentMethod = isPlainObject(source.paymentMethod) ? source.paymentMethod : {};
  const bottomContact = isPlainObject(source.bottomContact) ? source.bottomContact : {};

  return {
    block1: {
      enabled: toBool(block1.enabled, DEFAULT_FOOTER.block1.enabled),
      title: toText(block1.title, DEFAULT_FOOTER.block1.title),
      links: normalizeFooterLinks(block1.links, DEFAULT_FOOTER.block1.links),
    },
    block2: {
      enabled: toBool(block2.enabled, DEFAULT_FOOTER.block2.enabled),
      title: toText(block2.title, DEFAULT_FOOTER.block2.title),
      links: normalizeFooterLinks(block2.links, DEFAULT_FOOTER.block2.links),
    },
    block3: {
      enabled: toBool(block3.enabled, DEFAULT_FOOTER.block3.enabled),
      title: toText(block3.title, DEFAULT_FOOTER.block3.title),
      links: normalizeFooterLinks(block3.links, DEFAULT_FOOTER.block3.links),
    },
    block4: {
      enabled: toBool(block4.enabled, DEFAULT_FOOTER.block4.enabled),
      footerLogoDataUrl: toText(block4.footerLogoDataUrl),
      address: toText(block4.address, DEFAULT_FOOTER.block4.address),
      phone: toText(block4.phone, DEFAULT_FOOTER.block4.phone),
      email: toText(block4.email, DEFAULT_FOOTER.block4.email),
    },
    socialLinks: {
      enabled: toBool(socialLinks.enabled, DEFAULT_FOOTER.socialLinks.enabled),
      facebook: toText(socialLinks.facebook, DEFAULT_FOOTER.socialLinks.facebook),
      twitter: toText(socialLinks.twitter, DEFAULT_FOOTER.socialLinks.twitter),
      pinterest: toText(socialLinks.pinterest, DEFAULT_FOOTER.socialLinks.pinterest),
      linkedin: toText(socialLinks.linkedin, DEFAULT_FOOTER.socialLinks.linkedin),
      whatsapp: toText(socialLinks.whatsapp, DEFAULT_FOOTER.socialLinks.whatsapp),
    },
    paymentMethod: {
      enabled: toBool(paymentMethod.enabled, DEFAULT_FOOTER.paymentMethod.enabled),
      imageDataUrl: toText(paymentMethod.imageDataUrl),
    },
    bottomContact: {
      enabled: toBool(bottomContact.enabled, DEFAULT_FOOTER.bottomContact.enabled),
      contactNumber: toText(
        bottomContact.contactNumber,
        DEFAULT_FOOTER.bottomContact.contactNumber
      ),
    },
  };
};

const isInternalHref = (href) => /^\/(?!\/)/.test(String(href || "").trim());

function FooterLink({ href, children }) {
  if (isInternalHref(href)) {
    return (
      <Link to={href} className="text-sm text-slate-600 transition hover:text-emerald-600">
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-slate-600 transition hover:text-emerald-600"
    >
      {children}
    </a>
  );
}

function FooterLinkBlock({ title, links }) {
  if (!links.length) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-900">{title}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${link.label}-${link.href}`}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StoreFooterKacha({ footerConfig, brandingName = "TP PRENEURS" }) {
  const footer = normalizeFooterConfig(footerConfig);
  const footerLogoSrc = resolveAssetUrl(footer.block4.footerLogoDataUrl);
  const paymentImageSrc = resolveAssetUrl(footer.paymentMethod.imageDataUrl);
  const socialItems = SOCIAL_LINKS.filter(({ key }) => footer.socialLinks[key]);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="grid gap-10 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.85fr))]">
          {footer.block4.enabled ? (
            <section className="space-y-4">
              {footerLogoSrc ? (
                <img
                  src={footerLogoSrc}
                  alt={`${brandingName} footer logo`}
                  className="h-12 w-auto object-contain"
                />
              ) : (
                <p className="text-lg font-semibold text-slate-900">{brandingName}</p>
              )}
              <div className="space-y-2 text-sm text-slate-600">
                {footer.block4.address ? <p>{footer.block4.address}</p> : null}
                {footer.block4.phone ? <p>{footer.block4.phone}</p> : null}
                {footer.block4.email ? <p>{footer.block4.email}</p> : null}
              </div>
            </section>
          ) : null}

          {footer.block1.enabled ? (
            <FooterLinkBlock title={footer.block1.title} links={footer.block1.links} />
          ) : null}
          {footer.block2.enabled ? (
            <FooterLinkBlock title={footer.block2.title} links={footer.block2.links} />
          ) : null}
          {footer.block3.enabled ? (
            <FooterLinkBlock title={footer.block3.title} links={footer.block3.links} />
          ) : null}
        </div>

        {(footer.socialLinks.enabled || footer.paymentMethod.enabled || footer.bottomContact.enabled) ? (
          <div className="flex flex-col gap-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              {footer.socialLinks.enabled && socialItems.length > 0 ? (
                <>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Follow Us
                  </span>
                  {socialItems.map(({ key, label }) => (
                    <a
                      key={key}
                      href={footer.socialLinks[key]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600"
                    >
                      {label}
                    </a>
                  ))}
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-4 lg:justify-end">
              {footer.paymentMethod.enabled && paymentImageSrc ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Payment Method
                  </span>
                  <img
                    src={paymentImageSrc}
                    alt="Payment methods"
                    className="h-7 w-auto object-contain"
                  />
                </div>
              ) : null}
              {footer.bottomContact.enabled && footer.bottomContact.contactNumber ? (
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">Need help?</span>{" "}
                  <span>{footer.bottomContact.contactNumber}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </footer>
  );
}

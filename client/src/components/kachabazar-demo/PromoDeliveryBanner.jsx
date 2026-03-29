import { Link } from "react-router-dom";
import heroBannerImage from "../../assets/admin-login-hero.jpg";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const isExternalLink = (value) => /^https?:\/\//i.test(toText(value));

export default function PromoDeliveryBanner({
  subTitle = "",
  title = "Get Your Grocery Delivery Right at Your Doorstep",
  description = "Shop fresh products from our KachaBazar demo catalog and enjoy fast delivery with daily curated deals.",
  buttonName = "Shop Now",
  buttonLink = "/search",
  imageDataUrl = "",
}) {
  const eyebrow = toText(subTitle);
  const ctaLabel = toText(buttonName);
  const ctaLink = toText(buttonLink);
  const showCta = Boolean(ctaLabel) && Boolean(ctaLink);
  const ctaIsExternal = isExternalLink(ctaLink);
  const promoImageSrc = resolveAssetUrl(imageDataUrl) || heroBannerImage;

  return (
    <section className="rounded-3xl bg-emerald-600 p-4 shadow-[0_18px_38px_-30px_rgba(5,150,105,0.6)] sm:p-6">
      <div className="overflow-hidden rounded-[26px] bg-white p-5 sm:p-7">
        <div className="grid items-center gap-5 lg:grid-cols-2">
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
                {eyebrow}
              </p>
            ) : null}
            <h3 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
              {title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {description}
            </p>
            {showCta ? (
              <div className="mt-5">
                {ctaIsExternal ? (
                  <a
                    href={ctaLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {ctaLabel}
                  </a>
                ) : (
                  <Link
                    to={ctaLink}
                    className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {ctaLabel}
                  </Link>
                )}
              </div>
            ) : null}
          </div>
          <div className="relative min-h-[180px]">
            <div className="absolute inset-0 rounded-2xl bg-emerald-50" />
            <img
              src={promoImageSrc}
              alt="Delivery promo"
              className="relative z-10 h-full w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

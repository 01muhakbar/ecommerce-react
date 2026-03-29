import heroBannerImage from "../../assets/admin-login-hero.jpg";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeLink = (value) => {
  const normalized = toText(value);
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return "";
};

const isExternalLink = (value) => /^https?:\/\//i.test(toText(value));

function StoreBadgeLink({ imageDataUrl, link, label }) {
  const href = normalizeLink(link);
  const imageSrc = resolveAssetUrl(imageDataUrl);

  if (!href || !imageSrc) return null;

  return (
    <a
      href={href}
      target={isExternalLink(href) ? "_blank" : undefined}
      rel={isExternalLink(href) ? "noreferrer" : undefined}
      className="inline-flex rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      aria-label={label}
    >
      <img src={imageSrc} alt={label} className="h-11 w-auto rounded-xl object-contain sm:h-12" />
    </a>
  );
}

export default function GetYourDailyNeedsSection({
  title = "Get Your Daily Needs From Our Store",
  description = "",
  imageLeftDataUrl = "",
  imageRightDataUrl = "",
  button1 = {},
  button2 = {},
}) {
  const leftImage = resolveAssetUrl(imageLeftDataUrl);
  const rightImage = resolveAssetUrl(imageRightDataUrl);
  const showVisualRail = Boolean(leftImage || rightImage);

  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.35)] sm:p-7">
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,380px)] lg:gap-8">
        <div>
          <h2 className="max-w-[18ch] text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 max-w-[58ch] text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StoreBadgeLink
              imageDataUrl={button1?.imageDataUrl}
              link={button1?.link}
              label="Download on App Store"
            />
            <StoreBadgeLink
              imageDataUrl={button2?.imageDataUrl}
              link={button2?.link}
              label="Get it on Google Play"
            />
          </div>
        </div>

        <div className="relative min-h-[220px] overflow-hidden rounded-[28px] bg-slate-100">
          {showVisualRail ? (
            <>
              {leftImage ? (
                <img
                  src={leftImage}
                  alt="Daily needs visual left"
                  className="absolute left-4 top-5 h-[68%] w-[44%] rounded-[24px] object-cover shadow-[0_18px_30px_-24px_rgba(15,23,42,0.55)] sm:left-6"
                />
              ) : null}
              {rightImage ? (
                <img
                  src={rightImage}
                  alt="Daily needs visual right"
                  className="absolute bottom-4 right-4 h-[70%] w-[46%] rounded-[24px] object-cover shadow-[0_18px_30px_-24px_rgba(15,23,42,0.55)] sm:right-6"
                />
              ) : null}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_38%)]" />
            </>
          ) : (
            <img
              src={heroBannerImage}
              alt="Daily needs"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>
    </section>
  );
}

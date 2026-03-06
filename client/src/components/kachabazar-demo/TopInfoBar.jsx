import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const isSafeWhatsAppLink = (value) => {
  const normalized = toText(value);
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  return (
    lowered.startsWith("https://wa.me/") ||
    lowered.startsWith("https://api.whatsapp.com/")
  );
};

export default function TopInfoBar({
  headerText = "",
  phoneNumber = "",
  whatsAppLink = "",
  isHeaderLoading = false,
}) {
  const { isAuthenticated, logout } = useAuth() || {};
  const safeHeaderText = toText(headerText);
  const safePhoneNumber = toText(phoneNumber);
  const safeWhatsAppLink = toText(whatsAppLink);
  const hasWhatsAppLink = isSafeWhatsAppLink(safeWhatsAppLink);

  return (
    <div className="border-b border-slate-200 bg-slate-100 text-[12px] text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 md:px-6">
        <div className="flex items-center gap-1.5 leading-none">
          {isHeaderLoading ? (
            <span className="inline-block h-3 w-40 rounded bg-slate-300/70" />
          ) : null}
          {!isHeaderLoading && safeHeaderText ? <span>{safeHeaderText}</span> : null}
          {!isHeaderLoading && safePhoneNumber ? (
            hasWhatsAppLink ? (
              <a
                href={safeWhatsAppLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Contact us on WhatsApp"
                className="cursor-pointer font-semibold text-emerald-600 hover:underline focus:outline-none focus:underline"
              >
                {safePhoneNumber}
              </a>
            ) : (
              <span className="font-semibold text-emerald-600">{safePhoneNumber}</span>
            )
          ) : null}
        </div>
        <div className="flex flex-wrap items-center text-[12px] text-slate-500">
          <Link to="/about-us" className="transition hover:text-slate-700 hover:underline">
            About Us
          </Link>
          <span className="mx-2 text-slate-300">|</span>
          <Link to="/contact-us" className="transition hover:text-slate-700 hover:underline">
            Contact Us
          </Link>
          <span className="mx-2 text-slate-300">|</span>
          <Link to="/user/my-account" className="transition hover:text-slate-700 hover:underline">
            My Account
          </Link>
          <span className="mx-2 text-slate-300">|</span>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void logout?.()}
              className="transition hover:text-slate-700 hover:underline"
            >
              Logout
            </button>
          ) : (
            <Link to="/auth/login" className="transition hover:text-slate-700 hover:underline">
              Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

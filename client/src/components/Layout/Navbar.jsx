import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { fetchAdminLanguages } from "../../lib/adminApi.js";
import "./Navbar.css";

const ADMIN_LANGUAGE_KEY = "adminLanguage";

const normalizeLanguage = (item) => ({
  id: Number(item?.id || 0),
  name: String(item?.name || "").trim(),
  isoCode: String(item?.isoCode || "").trim().toLowerCase(),
  flag: String(item?.flag || "").trim().toUpperCase(),
  published:
    item?.published === true ||
    String(item?.published || "").toLowerCase() === "true" ||
    Number(item?.published) === 1,
});

const readStoredLanguage = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_LANGUAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.isoCode || !parsed.name) return null;
    return {
      isoCode: String(parsed.isoCode).trim().toLowerCase(),
      name: String(parsed.name).trim(),
      flag: String(parsed.flag || "").trim().toUpperCase(),
    };
  } catch {
    return null;
  }
};

const persistLanguage = (value) => {
  if (typeof window === "undefined" || !value) return;
  window.localStorage.setItem(ADMIN_LANGUAGE_KEY, JSON.stringify(value));
};

const pageTitleFromPath = (pathname) => {
  if (pathname === "/admin" || pathname === "/admin/dashboard") return "Dashboard";
  if (pathname.startsWith("/admin/products")) return "Products";
  if (pathname.startsWith("/admin/orders")) return "Orders";
  if (pathname.startsWith("/admin/customers")) return "Customers";
  if (pathname.startsWith("/admin/categories")) return "Categories";
  if (pathname.startsWith("/admin/attributes")) return "Attributes";
  if (pathname.startsWith("/admin/coupons")) return "Coupons";
  if (pathname.startsWith("/admin/our-staff")) return "Our Staff";
  if (pathname.startsWith("/admin/settings")) return "Settings";
  if (pathname.startsWith("/admin/languages")) return "Languages";
  if (pathname.startsWith("/admin/currencies")) return "Currencies";
  return "Admin";
};

export default function Navbar() {
  const { pathname } = useLocation();
  const pageTitle = pageTitleFromPath(pathname);
  const langDropdownRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(readStoredLanguage);

  const languagesQuery = useQuery({
    queryKey: ["admin-navbar-languages"],
    queryFn: () => fetchAdminLanguages(),
    staleTime: 60_000,
  });

  const publishedLanguages = useMemo(
    () =>
      (languagesQuery.data?.data || [])
        .map(normalizeLanguage)
        .filter((item) => item.name && item.isoCode && item.published),
    [languagesQuery.data]
  );

  useEffect(() => {
    if (!langOpen) return undefined;
    const onMouseDown = (event) => {
      if (!langDropdownRef.current?.contains(event.target)) {
        setLangOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [langOpen]);

  useEffect(() => {
    if (publishedLanguages.length === 0) return;

    const fromStorage = readStoredLanguage();
    const preferredIsoCode = fromStorage?.isoCode || selectedLanguage?.isoCode;
    const selectedFromList = preferredIsoCode
      ? publishedLanguages.find((item) => item.isoCode === preferredIsoCode)
      : null;

    const fallbackLanguage =
      selectedFromList ||
      publishedLanguages.find((item) => item.isoCode === "en") ||
      publishedLanguages[0];

    const nextValue = {
      isoCode: fallbackLanguage.isoCode,
      name: fallbackLanguage.name,
      flag: fallbackLanguage.flag,
    };

    if (
      !selectedLanguage ||
      selectedLanguage.isoCode !== nextValue.isoCode ||
      selectedLanguage.name !== nextValue.name ||
      selectedLanguage.flag !== nextValue.flag
    ) {
      setSelectedLanguage(nextValue);
      persistLanguage(nextValue);
    }
  }, [publishedLanguages, selectedLanguage]);

  const chipText = selectedLanguage
    ? `${selectedLanguage.flag || selectedLanguage.isoCode.toUpperCase()} ${selectedLanguage.name.toUpperCase()}`
    : "GB ENGLISH";

  const handleLanguageSelect = (language) => {
    const nextValue = {
      isoCode: language.isoCode,
      name: language.name,
      flag: language.flag,
    };
    setSelectedLanguage(nextValue);
    persistLanguage(nextValue);
    setLangOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar__left">
        <button className="navbar__menu" aria-label="Toggle menu">
          <span />
          <span />
          <span />
        </button>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
            Admin Panel
          </p>
          <p className="text-[15px] font-semibold text-slate-800">{pageTitle}</p>
        </div>
      </div>
      <div className="navbar__actions">
        <div className="navbar__lang-wrap" ref={langDropdownRef}>
          <button
            className={`navbar__lang ${langOpen ? "is-open" : ""}`}
            type="button"
            onClick={() => setLangOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={langOpen}
          >
            <span className="navbar__lang-text">{chipText}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="navbar__lang-caret">
              <path d="M7 10l5 5 5-5" />
            </svg>
          </button>
          {langOpen ? (
            <div className="navbar__lang-menu" role="menu">
              {languagesQuery.isLoading ? (
                <p className="navbar__lang-empty">Loading languages...</p>
              ) : publishedLanguages.length === 0 ? (
                <p className="navbar__lang-empty">No published languages.</p>
              ) : (
                publishedLanguages.map((language) => {
                  const isSelected = selectedLanguage?.isoCode === language.isoCode;
                  return (
                    <button
                      key={language.id || language.isoCode}
                      type="button"
                      role="menuitem"
                      className={`navbar__lang-item ${isSelected ? "is-selected" : ""}`}
                      onClick={() => handleLanguageSelect(language)}
                    >
                      <span className="navbar__lang-item-main">
                        {(language.flag || language.isoCode).toUpperCase()}{" "}
                        {language.name.toUpperCase()}
                      </span>
                      <span className="navbar__lang-item-iso">
                        {language.isoCode.toUpperCase()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
        <button className="navbar__icon" aria-label="Toggle theme">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.8 6.8 0 0 0 11.5 11.5Z" />
          </svg>
        </button>
        <button className="navbar__icon navbar__icon--notify" aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
            <path d="M13.7 20a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="navbar__badge">26</span>
        </button>
        <div className="navbar__avatar" aria-label="User avatar">
          A
        </div>
      </div>
    </header>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { fetchAdminLanguages } from "../../lib/adminApi.js";
import ThemeToggle from "../admin/ThemeToggle.jsx";
import AdminProfileMenu from "../admin/AdminProfileMenu.jsx";
import AdminNotifications from "../admin/AdminNotifications.jsx";
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

export default function Navbar({ theme = "light", onToggleTheme }) {
  const { pathname } = useLocation();
  const pageTitle = pageTitleFromPath(pathname);
  const langDropdownRef = useRef(null);
  const notifyDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
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
    if (!activeMenu) return undefined;
    const onMouseDown = (event) => {
      const targetRef =
        activeMenu === "notify"
          ? notifyDropdownRef
          : activeMenu === "profile"
            ? profileDropdownRef
            : null;
      if (targetRef?.current && !targetRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeMenu]);

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

  const toggleMenu = (menuName) => {
    setLangOpen(false);
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
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
            onClick={() => {
              setActiveMenu(null);
              setLangOpen((prev) => !prev);
            }}
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
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <AdminNotifications
          open={activeMenu === "notify"}
          onToggle={() => toggleMenu("notify")}
          containerRef={notifyDropdownRef}
        />
        <AdminProfileMenu
          open={activeMenu === "profile"}
          onToggle={() => toggleMenu("profile")}
          onClose={() => setActiveMenu(null)}
          containerRef={profileDropdownRef}
        />
      </div>
    </header>
  );
}

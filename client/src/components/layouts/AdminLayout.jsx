import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Layout/Sidebar.jsx";
import Navbar from "../Layout/Navbar.jsx";
import "../Layout/MainLayout.css";

const ADMIN_THEME_KEY = "admin_theme";

const readStoredTheme = () => {
  if (typeof window === "undefined") return "light";
  const value = String(window.localStorage.getItem(ADMIN_THEME_KEY) || "").trim();
  return value === "dark" ? "dark" : "light";
};

export default function AdminLayout() {
  const [theme, setTheme] = useState(readStoredTheme);
  const isDark = theme === "dark";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_THEME_KEY, theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div
      className={`layout admin-shell ${isDark ? "admin-theme-dark dark" : "admin-theme-light"}`}
      data-admin-theme={theme}
    >
      <Sidebar />
      <div className="layout__content admin-content">
        <Navbar theme={theme} onToggleTheme={handleToggleTheme} />
        <main className="layout__page admin-page-shell">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

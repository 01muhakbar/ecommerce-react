import "./Navbar.css";
import { useLocation } from "react-router-dom";

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
  return "Admin";
};

export default function Navbar() {
  const { pathname } = useLocation();
  const pageTitle = pageTitleFromPath(pathname);

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
        <button className="navbar__lang" type="button">
          GB ENGLISH
        </button>
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

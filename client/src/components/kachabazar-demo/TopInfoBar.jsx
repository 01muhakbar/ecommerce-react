import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";

export default function TopInfoBar() {
  const { isAuthenticated, logout } = useAuth() || {};

  return (
    <div className="border-b border-slate-200 bg-slate-100 text-[12px] text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 md:px-6">
        <div className="flex items-center gap-1.5 leading-none">
          <span>Need help?</span>
          <span className="font-semibold text-emerald-600">+62 812 3456 7890</span>
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

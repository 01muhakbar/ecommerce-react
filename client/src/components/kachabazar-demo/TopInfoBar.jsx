import { Link } from "react-router-dom";

export default function TopInfoBar() {
  return (
    <div className="bg-slate-100 text-[11px] text-slate-600">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-2">
        <div>
          We are available 24/7, Need help??{" "}
          <span className="font-semibold text-emerald-600">+62 812 3456 7890</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/about" className="hover:text-slate-900">
            About Us
          </Link>
          <Link to="/contact" className="hover:text-slate-900">
            Contact Us
          </Link>
          <Link to="/account" className="hover:text-slate-900">
            My Account
          </Link>
          <Link to="/auth/login" className="hover:text-slate-900">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}

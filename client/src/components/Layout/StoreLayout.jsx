import { useEffect, useState } from "react";
import { Home, Menu, ShoppingCart, UserRound } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import StoreHeaderKacha from "../kachabazar-demo/StoreHeaderKacha.jsx";
import { useCartStore } from "../../store/cart.store.ts";
import MobileMenuDrawer from "./MobileMenuDrawer.jsx";

export default function StoreLayout() {
  const location = useLocation();
  const isCheckoutRoute = location.pathname.startsWith("/checkout");
  const totalQty = useCartStore((state) => state.totalQty);
  const isHomeActive = location.pathname === "/";
  const isCartActive = location.pathname.startsWith("/cart");
  const isProfileActive =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/my-account");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <StoreHeaderKacha />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:pb-8">
        <Outlet />
      </main>
      {!isCheckoutRoute ? (
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-slate-500">
            Crafted for local storefront demos.
          </div>
        </footer>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-emerald-700/70 bg-emerald-600 px-4 py-2 text-white shadow-[0_-8px_20px_rgba(5,150,105,0.35)] sm:hidden">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            aria-expanded={isMenuOpen}
            aria-label="Open menu"
            className="flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] text-white/90 hover:bg-emerald-500"
          >
            <Menu className="h-[18px] w-[18px]" />
            <span className="leading-none">Menu</span>
          </button>
          <Link
            to="/"
            className={`flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isHomeActive
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <Home className="h-[18px] w-[18px]" />
            <span className="leading-none">Home</span>
          </Link>
          <Link
            to="/cart"
            className={`relative flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isCartActive
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <ShoppingCart className="h-[18px] w-[18px]" />
            <span className="leading-none">Cart</span>
            {totalQty > 0 ? (
              <span className="absolute right-3 top-1.5 inline-flex min-w-[17px] items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-bold text-slate-900">
                {totalQty}
              </span>
            ) : null}
          </Link>
          <Link
            to="/account"
            className={`flex h-full flex-col items-center justify-center rounded-lg text-xs tracking-[0.01em] hover:bg-emerald-500 ${
              isProfileActive
                ? "bg-emerald-500 font-semibold text-white"
                : "font-medium text-white/90"
            }`}
          >
            <UserRound className="h-[18px] w-[18px]" />
            <span className="leading-none">Profile</span>
          </Link>
        </div>
      </nav>
      <MobileMenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
}

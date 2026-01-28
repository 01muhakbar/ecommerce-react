import { Outlet } from "react-router-dom";
import StoreHeaderKacha from "../kachabazar-demo/StoreHeaderKacha.jsx";

export default function StoreLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <StoreHeaderKacha />
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-slate-500">
          Crafted for local storefront demos.
        </div>
      </footer>
    </div>
  );
}

import Sidebar from "@/components/admin/Sidebar";
import Topbar from "@/components/admin/Topbar";
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("admin.sidebarCollapsed");
    if (s) setSidebarCollapsed(s === "1");
  }, []);
  useEffect(() => {
    localStorage.setItem("admin.sidebarCollapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // width docked
  const W = sidebarCollapsed ? 72 : 260;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* Sidebar docked ≥lg */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-40">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v=>!v)} />
      </div>

      {/* Sidebar overlay <lg */}
      <Sidebar isOverlay open={overlayOpen} onClose={() => setOverlayOpen(false)} />

      {/* Content wrapper: memberi margin-left sesuai sidebar */}
      <div className="transition-all duration-200 ease-in-out" style={{ marginLeft: W }}>
        <Topbar onMenuClick={() => setOverlayOpen(true)} />
        <main className="w-full max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
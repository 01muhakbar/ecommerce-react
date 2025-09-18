import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useMutation } from "@tanstack/react-query";
import api from "../api/axios";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const logoutClient = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/admin/login", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/admin/logout");
    },
    onSuccess: () => {
      logoutClient(); // Clear client-side state
      // The useEffect will handle the redirect
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      // Even if backend logout fails, clear client state for UX
      logoutClient();
      // The useEffect will handle the redirect
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // While checking auth, you might want to show a loader
  // For now, we'll just render null to prevent flashing the layout
  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        isOpen={isSidebarOpen}
        handleLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      {/* Main Content Area */}
      <div
        className={`relative transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
        }`}
      >
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useMutation } from "@tanstack/react-query";
import api from "../api/axios";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const logoutClient = useAuthStore((state) => state.logout);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/admin/logout");
    },
    onSuccess: () => {
      logoutClient(); // Clear client-side state
      navigate("/admin/login"); // Redirect to login page
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      // Even if backend logout fails, clear client state for UX
      logoutClient();
      navigate("/admin/login");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

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

import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/axios";
import { useAuthStore } from "@/store/authStore";

const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const authStore = useAuthStore();

  const logoutMutation = useMutation({
    mutationFn: async () => (await api.post("/auth/admin/logout")).data,
    onSuccess: async () => {
      authStore.clear();
      await qc.removeQueries({ queryKey: ["auth"] });
      navigate("/admin/login", { replace: true });
      setTimeout(() => {
        if (!window.location.pathname.includes("/admin/login")) {
          window.location.assign("/admin/login");
        }
      }, 0);
    },
    onError: () => {
      authStore.clear();
      qc.removeQueries({ queryKey: ["auth"] });
      navigate("/admin/login", { replace: true });
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
      <div
        className={`relative transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "lg:pl-64" : "lg:pl-0"
        }`}
      >
        <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

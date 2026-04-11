import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

const ADMIN_AUTH_PATHS = new Set([
  "/admin/login",
  "/admin/create-account",
  "/admin/verify-account",
  "/admin/resend-verification",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/forbidden",
]);

const getWorkspaceToastScope = () => {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname;
  if (ADMIN_AUTH_PATHS.has(pathname)) return null;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  if (pathname.startsWith("/seller/stores/")) return "seller";
  return null;
};

const getMutationToastMessage = (data, workspace) => {
  const apiMessage = String(data?.message || data?.data?.message || "").trim();
  if (apiMessage && apiMessage.length <= 140) return apiMessage;
  return workspace === "seller" ? "Seller workspace updated." : "Admin workspace updated.";
};

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (data, _variables, _context, mutation) => {
      if (mutation?.options?.meta?.suppressGlobalToast) return;
      const workspace = getWorkspaceToastScope();
      if (!workspace) return;
      toast.success(getMutationToastMessage(data, workspace), {
        id: `${workspace}-workspace-updated`,
      });
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  </React.StrictMode>
);

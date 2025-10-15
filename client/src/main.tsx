import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import App from "./App";
import RootErrorBoundary from "@/components/dev/RootErrorBoundary";
import "@/index.css";

// 🔎 DEV: tangkap semua error tak tertangani
if (import.meta.env.DEV) {
  window.addEventListener("error", (e) => {
    console.error("[window.onerror]", e.error || e.message || e);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[unhandledrejection]", e.reason || e);
  });
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <BrowserRouter>
          <App />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        </BrowserRouter>
      </RootErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);

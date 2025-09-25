import React, { Suspense, useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import RequireAdmin from "@/components/RequireAdmin";
import AdminLayout from "@/layouts/AdminLayout";
import AuthLayout from "@/layouts/AuthLayout";

// Lazy load all pages
const AdminDashboardPage = React.lazy(() => import("@/pages/AdminDashboardPage"));
const AdminProductsPage  = React.lazy(() => import("@/pages/AdminProductsPage"));
const AdminOrdersPage    = React.lazy(() => import("@/pages/AdminOrdersPage"));
const AdminCustomersPage = React.lazy(() => import("@/pages/AdminCustomersPage"));
const AdminStaffPage     = React.lazy(() => import("@/pages/AdminStaffPage"));
const AdminLoginPage     = React.lazy(() => import("@/pages/AdminLoginPage"));

const router = createBrowserRouter([
  {
    path: "/admin/login",
    element: (
      <AuthLayout>
        <Suspense fallback={<div className="p-8">Loading…</div>}>
          <AdminLoginPage />
        </Suspense>
      </AuthLayout>
    ),
  },

  {
    path: "/admin",
    element: (
      <RequireAdmin allowedRoles={["Admin", "Super Admin"]}>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: "dashboard",        element: <Suspense fallback={<div>Loading...</div>}><AdminDashboardPage /></Suspense> },
      { path: "catalog/products", element: <Suspense fallback={<div>Loading...</div>}><AdminProductsPage /></Suspense> },
      { path: "orders",           element: <Suspense fallback={<div>Loading...</div>}><AdminOrdersPage /></Suspense> },
      { path: "customers",        element: <Suspense fallback={<div>Loading...</div>}><AdminCustomersPage /></Suspense> },
      { path: "our-staff",        element: <Suspense fallback={<div>Loading...</div>}><AdminStaffPage /></Suspense> },
    ],
  },

  // optional: redirect root ke login atau ke landing
  { path: "/", element: <Navigate to="/admin/login" replace /> },
]);

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init(); // cek session dari cookie/token
  }, [init]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
       <RouterProvider router={router} />
    </Suspense>
  );
}
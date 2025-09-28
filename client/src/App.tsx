import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RequireAdmin from "@/components/RequireAdmin";
import AdminLayout from "@/layouts/AdminLayout";
import AuthLayout from "@/layouts/AuthLayout";

// Lazy load all pages
const AdminDashboardPage = React.lazy(() => import("@/pages/AdminDashboardPage"));
const AdminProductsPage = React.lazy(() => import("@/pages/AdminProductsPage"));
const AdminOrdersPage = React.lazy(() => import("@/pages/AdminOrdersPage"));
const AdminCustomersPage = React.lazy(() => import("@/pages/AdminCustomersPage"));
const AdminStaffPage = React.lazy(() => import("@/pages/AdminStaffPage"));
const AdminLoginPage = React.lazy(() => import("@/pages/AdminLoginPage"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route
            path="/admin/login"
            element={
              <AuthLayout>
                <AdminLoginPage />
              </AuthLayout>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="catalog/products" element={<AdminProductsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="customers" element={<AdminCustomersPage />} />
            <Route path="our-staff" element={<AdminStaffPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

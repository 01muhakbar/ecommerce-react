// client/src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react"; // ✅ cukup lazy & Suspense. Tidak perlu default import React.

import RequireAdmin from "@/components/RequireAdmin";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/layouts/AdminLayout";

// ✅ Sesuaikan path dengan file yang benar (lihat log: HMR /src/pages/AdminDashboardPage.tsx)
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage")); // ← BUKAN /admin/...

// Catalog
const ProductsPage = lazy(() => import("@/pages/admin/catalog/ProductsPage"));
const AddProductForm = lazy(
  () => import("@/pages/admin/catalog/AddProductForm")
);
const ProductDetailsPage = lazy(
  () => import("@/pages/admin/catalog/ProductDetailsPage")
);
const CategoriesPage = lazy(
  () => import("@/pages/admin/catalog/CategoriesPage")
);
const AttributesPage = lazy(
  () => import("@/pages/admin/catalog/AttributesPage")
);
const CouponsPage = lazy(() => import("@/pages/admin/catalog/CouponsPage"));

// Other admin pages
const CustomersPage = lazy(() => import("@/pages/admin/CustomersPage"));
const OrdersPage = lazy(() => import("@/pages/admin/OrdersPage"));
const StaffPage = lazy(() => import("@/pages/admin/StaffPage"));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));

export default function App() {
  return (
    <Suspense fallback={<div className="p-6">Memuat…</div>}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="customers"
            element={
              <RequireAdmin>
                <CustomersPage />
              </RequireAdmin>
            }
          />
          <Route
            path="orders"
            element={
              <RequireAdmin>
                <OrdersPage />
              </RequireAdmin>
            }
          />
          <Route
            path="staff"
            element={
              <RequireAdmin>
                <StaffPage />
              </RequireAdmin>
            }
          />
          <Route
            path="settings"
            element={
              <RequireAdmin>
                <SettingsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="products"
            element={
              <RequireAdmin>
                <ProductsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="products/new"
            element={
              <RequireAdmin>
                <AddProductForm />
              </RequireAdmin>
            }
          />
          <Route
            path="products/:id"
            element={
              <RequireAdmin>
                <ProductDetailsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="categories"
            element={
              <RequireAdmin>
                <CategoriesPage />
              </RequireAdmin>
            }
          />
          <Route
            path="attributes"
            element={
              <RequireAdmin>
                <AttributesPage />
              </RequireAdmin>
            }
          />
          <Route
            path="coupons"
            element={
              <RequireAdmin>
                <CouponsPage />
              </RequireAdmin>
            }
          />
          {/* TODO: Pindahkan rute lain dari catalog ke sini jika diperlukan */}
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}

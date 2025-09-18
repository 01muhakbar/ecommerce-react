import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { Suspense, lazy } from 'react';

// Import Layouts, Guards, and Error Boundaries
import AdminLayout from "./layouts/AdminLayout";
import RequireAdmin from "./components/RequireAdmin";
import RouteError from "./components/RouteError";

// Lazy load all page components
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminOrdersPage = lazy(() => import('./pages/AdminOrdersPage'));
const AdminProductsPage = lazy(() => import('./pages/AdminProductsPage'));
const AdminCustomersPage = lazy(() => import('./pages/AdminCustomersPage'));
const AdminAddProductPage = lazy(() => import('./pages/AdminAddProductPage'));
const AdminStaffPage = lazy(() => import('./pages/AdminStaffPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Helper component for Suspense fallback
const PageLoader = () => <div style={{padding: 24}}>Loading page...</div>;

// Definisikan semua rute aplikasi
const router = createBrowserRouter([
  // Rute publik: tidak memerlukan login
  {
    path: "/admin/login",
    element: (
      <RouteError>
        <Suspense fallback={<PageLoader />}>
          <AdminLoginPage />
        </Suspense>
      </RouteError>
    ),
  },

  // Rute admin yang dilindungi
  {
    path: "/admin",
    element: <RequireAdmin />, // Guard akan memeriksa login
    children: [
      {
        // Layout ini hanya akan dirender jika login berhasil
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          {
            path: "dashboard",
            element: <Suspense fallback={<PageLoader />}><AdminDashboardPage /></Suspense>,
          },
          {
            path: "orders",
            element: <Suspense fallback={<PageLoader />}><AdminOrdersPage /></Suspense>,
          },
          {
            path: "catalog/products",
            element: <Suspense fallback={<PageLoader />}><AdminProductsPage /></Suspense>,
          },
          {
            path: "catalog/products/new",
            element: <Suspense fallback={<PageLoader />}><AdminAddProductPage /></Suspense>,
          },
          {
            path: "customers",
            element: <Suspense fallback={<PageLoader />}><AdminCustomersPage /></Suspense>,
          },
          {
            path: "our-staff",
            element: <Suspense fallback={<PageLoader />}><AdminStaffPage /></Suspense>,
          },
        ],
      },
    ],
  },

  // Redirect dari root ke area admin
  {
    path: "/",
    element: <Navigate to="/admin" replace />,
  },

  // Fallback untuk rute yang tidak ditemukan
  {
    path: "*",
    element: <Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense>,
  },
]);

function App() {
  return (
    <RouteError>
      <RouterProvider router={router} />
    </RouteError>
  );
}

export default App;

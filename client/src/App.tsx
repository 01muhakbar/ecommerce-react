import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";

// Import Pages
import AdminLoginPage from "./pages/AdminLoginPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminForgotPasswordPage from "./pages/AdminForgotPasswordPage";
import AdminResetPasswordPage from "./pages/AdminResetPasswordPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminAddProductPage from "./pages/AdminAddProductPage";

// Import Layouts
import AdminLayout from "./layouts/AdminLayout";

// Layout sederhana untuk rute-rute
// Anda bisa menambahkan komponen seperti Navbar atau Sidebar di sini
const RootLayout = () => (
  <>
    <main>
      <Outlet />
    </main>
  </>
);

// Definisikan semua rute aplikasi
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    // errorElement: <ErrorPage />, // Praktik yang baik untuk memiliki error boundary
    children: [
      // Rute publik lainnya bisa ditambahkan di sini (misal: Homepage)
      // { index: true, element: <HomePage /> },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "admin/login",
        element: <AdminLoginPage />,
      },
      {
        path: "admin/forgot-password",
        element: <AdminForgotPasswordPage />,
      },
      {
        path: "admin/reset-password/:token",
        element: <AdminResetPasswordPage />,
      },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        path: "dashboard",
        element: <AdminDashboardPage />,
      },
      {
        path: "orders",
        element: <AdminOrdersPage />,
      },
      {
        path: "catalog/products",
        element: <AdminProductsPage />,
      },
      {
        path: "catalog/products/new",
        element: <AdminAddProductPage />,
      },
      // Placeholder routes for other catalog pages
      // {
      //   path: "catalog/categories",
      //   element: <AdminCategoriesPage />,
      // },
      // ... etc for attributes and coupons
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

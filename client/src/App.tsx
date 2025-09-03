import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";

// Import Pages
import AdminLoginPage from "./pages/AdminLoginPage";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboardPage from "./pages/AdminDashboardPage"; // Halaman baru

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
        path: "admin/dashboard",
        element: <AdminDashboardPage />, // Halaman yang dituju setelah admin login
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;

import { Routes, Route } from "react-router-dom";
import MainLayout from "./components/Layout/MainLayout.jsx";
import StoreLayout from "./components/Layout/StoreLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import AdminOrderDetail from "./pages/admin/OrderDetail.jsx";
import Login from "./pages/Login.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import RoleRoute from "./routes/RoleRoute.jsx";
import StoreHomePage from "./pages/store/StoreHomePage.jsx";
import StoreCategoryPage from "./pages/store/StoreCategoryPage.jsx";
import StoreProductDetailPage from "./pages/store/StoreProductDetailPage.jsx";
import StoreCartPage from "./pages/store/StoreCartPage.jsx";
import StoreCheckoutPage from "./pages/store/StoreCheckoutPage.jsx";
import StoreLoginPage from "./pages/store/StoreLoginPage.jsx";
import StoreRegisterPage from "./pages/store/StoreRegisterPage.jsx";
import StoreCheckoutSuccessPage from "./pages/store/StoreCheckoutSuccessPage.jsx";
import StoreOrderTrackingPage from "./pages/store/StoreOrderTrackingPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<StoreHomePage />} />
          <Route path="category/:slug" element={<StoreCategoryPage />} />
          <Route path="product/:id" element={<StoreProductDetailPage />} />
          <Route path="cart" element={<StoreCartPage />} />
          <Route path="checkout" element={<StoreCheckoutPage />} />
          <Route path="checkout/success" element={<StoreCheckoutSuccessPage />} />
          <Route path="order/:ref" element={<StoreOrderTrackingPage />} />
          <Route path="auth/login" element={<StoreLoginPage />} />
          <Route path="auth/register" element={<StoreRegisterPage />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route element={<RoleRoute allowedRoles={["admin", "super_admin"]} />}>
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

import { Routes, Route } from "react-router-dom";
import StoreLayout from "./components/Layout/StoreLayout.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import StoreCategoryPage from "./pages/store/StoreCategoryPage.jsx";
import StoreProductDetailPage from "./pages/store/StoreProductDetailPage.jsx";
import StoreCartPage from "./pages/store/StoreCartPage.jsx";
import StoreCheckoutPage from "./pages/store/StoreCheckoutPage.jsx";
import StoreLoginPage from "./pages/store/StoreLoginPage.jsx";
import StoreRegisterPage from "./pages/store/StoreRegisterPage.jsx";
import StoreCheckoutSuccessPage from "./pages/store/StoreCheckoutSuccessPage.jsx";
import StoreOrderTrackingPage from "./pages/store/StoreOrderTrackingPage.jsx";
import StoreSearchPage from "./pages/store/StoreSearchPage.jsx";
import StoreOffersPage from "./pages/store/StoreOffersPage.jsx";
import KachaBazarDemoHomePage from "./pages/store/KachaBazarDemoHomePage.jsx";
import AdminGuard from "./components/AdminGuard.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Orders from "./pages/Orders.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import AdminOrderDetail from "./pages/admin/OrderDetail.jsx";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage.jsx";
import AdminCustomerDetailPage from "./pages/admin/AdminCustomerDetailPage.jsx";
import AdminCouponsPage from "./pages/admin/AdminCouponsPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/demo/kachabazar" element={<KachaBazarDemoHomePage />} />
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<KachaBazarDemoHomePage />} />
          <Route path="search" element={<StoreSearchPage />} />
          <Route path="category/:slug" element={<StoreCategoryPage />} />
          <Route path="product/:slug" element={<StoreProductDetailPage />} />
          <Route path="cart" element={<StoreCartPage />} />
          <Route path="checkout" element={<StoreCheckoutPage />} />
          <Route path="checkout/success" element={<StoreCheckoutSuccessPage />} />
          <Route path="order/:ref" element={<StoreOrderTrackingPage />} />
          <Route path="offers" element={<StoreOffersPage />} />
          <Route path="auth/login" element={<StoreLoginPage />} />
          <Route path="auth/register" element={<StoreRegisterPage />} />
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

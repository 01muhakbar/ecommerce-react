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
import AdminLayout from "./components/layouts/AdminLayout.jsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminProductsPage from "./pages/admin/Products.jsx";
import AdminProductForm from "./pages/admin/ProductForm.jsx";
import AdminOrdersPage from "./pages/admin/Orders.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import AdminOrderDetail from "./pages/admin/OrderDetail.jsx";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage.jsx";
import AdminCustomerDetailPage from "./pages/admin/AdminCustomerDetailPage.jsx";
import AdminCouponsPage from "./pages/admin/AdminCouponsPage.jsx";
import AccountGuard from "./components/AccountGuard.jsx";
import AccountLayout from "./layouts/AccountLayout.jsx";
import AccountDashboardPage from "./pages/account/AccountDashboardPage.jsx";
import AccountOrdersPage from "./pages/account/AccountOrdersPage.jsx";
import AccountOrderDetailPage from "./pages/account/AccountOrderDetailPage.jsx";
import AccountProfilePage from "./pages/account/AccountProfilePage.jsx";

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
          <Route path="account" element={<AccountGuard />}>
            <Route element={<AccountLayout />}>
              <Route index element={<AccountDashboardPage />} />
              <Route path="dashboard" element={<AccountDashboardPage />} />
              <Route path="orders" element={<AccountOrdersPage />} />
              <Route path="orders/:id" element={<AccountOrderDetailPage />} />
              <Route path="profile" element={<AccountProfilePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrdersPage />} />
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

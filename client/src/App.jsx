import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import StoreLayout from "./components/Layout/StoreLayout.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import StoreCategoryPage from "./pages/store/StoreCategoryPage.jsx";
import StoreProductDetailPage from "./pages/store/StoreProductDetailPage.jsx";
import StoreCartPage from "./pages/store/StoreCartPage.jsx";
import CheckoutPage from "./pages/store/Checkout.jsx";
import StoreLoginPage from "./pages/store/StoreLoginPage.jsx";
import StoreRegisterPage from "./pages/store/StoreRegisterPage.jsx";
import CheckoutSuccess from "./pages/store/CheckoutSuccess.jsx";
import StoreOrderTrackingPage from "./pages/store/StoreOrderTrackingPage.jsx";
import StoreSearchPage from "./pages/store/StoreSearchPage.jsx";
import StoreOffersPage from "./pages/store/StoreOffersPage.jsx";
import KachaBazarDemoHomePage from "./pages/store/KachaBazarDemoHomePage.jsx";
import AdminGuard from "./components/AdminGuard.jsx";
import AdminLayout from "./components/layouts/AdminLayout.jsx";
import AdminLoginPage from "./pages/admin/AdminLoginPage.jsx";
import RequirePerm from "./components/guards/RequirePerm.jsx";
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const AdminProductsPage = lazy(() => import("./pages/admin/Products.jsx"));
const AdminProductForm = lazy(() => import("./pages/admin/ProductForm.jsx"));
const AdminOrdersPage = lazy(() => import("./pages/admin/Orders.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const AdminOrderDetail = lazy(() => import("./pages/admin/OrderDetail.jsx"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage.jsx"));
const AdminCustomerDetailPage = lazy(() =>
  import("./pages/admin/AdminCustomerDetailPage.jsx")
);
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage.jsx"));
const ComingSoon = lazy(() => import("./pages/admin/ComingSoon.jsx"));
import AdminStaffPage from "./pages/admin/Staff.jsx";
const AdminForbiddenPage = lazy(() => import("./pages/admin/Forbidden.jsx"));
import AccountGuard from "./components/AccountGuard.jsx";
import AccountLayout from "./layouts/AccountLayout.jsx";
import AccountDashboardPage from "./pages/account/AccountDashboardPage.jsx";
import AccountOrdersPage from "./pages/account/AccountOrdersPage.jsx";
import AccountOrderDetailPage from "./pages/account/AccountOrderDetailPage.jsx";
import AccountProfilePage from "./pages/account/AccountProfilePage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-slate-500">Loading...</div>
        }
      >
        <Routes>
          <Route path="/demo/kachabazar" element={<KachaBazarDemoHomePage />} />
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<KachaBazarDemoHomePage />} />
            <Route path="search" element={<StoreSearchPage />} />
            <Route path="category/:slug" element={<StoreCategoryPage />} />
            <Route path="product/:slug" element={<StoreProductDetailPage />} />
            <Route path="cart" element={<StoreCartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<CheckoutSuccess />} />
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
          <Route path="/admin/forbidden" element={<AdminForbiddenPage />} />
          <Route path="/admin" element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route
                index
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <Dashboard />
                  </RequirePerm>
                }
              />
              <Route
                path="dashboard"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <Dashboard />
                  </RequirePerm>
                }
              />
              <Route
                path="products"
                element={
                  <RequirePerm perm="PRODUCTS_VIEW">
                    <AdminProductsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="products/new"
                element={
                  <RequirePerm perm="PRODUCTS_CREATE">
                    <AdminProductForm />
                  </RequirePerm>
                }
              />
              <Route
                path="products/:id"
                element={
                  <RequirePerm perm="PRODUCTS_UPDATE">
                    <AdminProductForm />
                  </RequirePerm>
                }
              />
              <Route
                path="orders"
                element={
                  <RequirePerm perm="ORDERS_VIEW">
                    <AdminOrdersPage />
                  </RequirePerm>
                }
              />
              <Route
                path="orders/:id"
                element={
                  <RequirePerm perm="ORDERS_VIEW">
                    <AdminOrderDetail />
                  </RequirePerm>
                }
              />
              <Route
                path="customers"
                element={
                  <RequirePerm perm="CUSTOMERS_VIEW">
                    <Customers />
                  </RequirePerm>
                }
              />
              <Route
                path="customers/:id"
                element={
                  <RequirePerm perm="CUSTOMERS_VIEW">
                    <AdminCustomerDetailPage />
                  </RequirePerm>
                }
              />
              <Route
                path="categories"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminCategoriesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="coupons"
                element={
                  <RequirePerm perm="COUPONS_CRUD">
                    <AdminCouponsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="attributes"
                element={
                  <RequirePerm perm="ATTRIBUTES_CRUD">
                    <ComingSoon title="Attributes" />
                  </RequirePerm>
                }
              />
              <Route
                path="staff"
                element={
                  <RequirePerm perm="STAFF_MANAGE">
                    <AdminStaffPage />
                  </RequirePerm>
                }
              />
              <Route
                path="languages"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <ComingSoon title="Languages" />
                  </RequirePerm>
                }
              />
              <Route
                path="store-customization"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <ComingSoon title="Store Customization" />
                  </RequirePerm>
                }
              />
              <Route
                path="store-settings"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <ComingSoon title="Store Settings" />
                  </RequirePerm>
                }
              />
              <Route
                path="settings"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <Settings />
                  </RequirePerm>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

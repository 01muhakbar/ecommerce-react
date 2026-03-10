import { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import StoreLayout from "./components/Layout/StoreLayout.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import StoreCategoryPage from "./pages/store/StoreCategoryPage.jsx";
import StoreProductDetailPage from "./pages/store/StoreProductDetailPage.jsx";
import StoreCartPage from "./pages/store/StoreCartPage.jsx";
import CheckoutPage from "./pages/store/Checkout.jsx";
import StoreLoginPage from "./pages/store/StoreLoginPage.jsx";
import StoreRegisterPage from "./pages/store/StoreRegisterPage.jsx";
import StoreCheckoutSuccessPage from "./pages/store/StoreCheckoutSuccessPage.jsx";
import StoreOrderTrackingPage from "./pages/store/StoreOrderTrackingPage.jsx";
import StoreSearchPage from "./pages/store/StoreSearchPage.jsx";
import StoreOffersPage from "./pages/store/StoreOffersPage.jsx";
import StoreAboutUsPage from "./pages/store/StoreAboutUsPage.jsx";
import StoreContactUsPage from "./pages/store/StoreContactUsPage.jsx";
import StorePrivacyPolicyPage from "./pages/store/StorePrivacyPolicyPage.jsx";
import StoreTermsAndConditionsPage from "./pages/store/StoreTermsAndConditionsPage.jsx";
import StoreFaqPage from "./pages/store/StoreFaqPage.jsx";
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
const AdminAttributesPage = lazy(() => import("./pages/admin/Attributes.jsx"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage.jsx"));
const AdminSubCategoriesPage = lazy(() =>
  import("./pages/admin/AdminSubCategoriesPage.jsx")
);
const AdminCustomerDetailPage = lazy(() =>
  import("./pages/admin/AdminCustomerDetailPage.jsx")
);
const AdminCouponsPage = lazy(() => import("./pages/admin/AdminCouponsPage.jsx"));
const AdminProfilePage = lazy(() => import("./pages/admin/Profile.jsx"));
const ComingSoon = lazy(() => import("./pages/admin/ComingSoon.jsx"));
const LanguagesPage = lazy(() => import("./pages/Languages.jsx"));
const CurrenciesPage = lazy(() => import("./pages/Currencies.jsx"));
const StoreCustomizationPage = lazy(() =>
  import("./pages/admin/StoreCustomization.jsx")
);
const StoreSettingsPage = lazy(() => import("./pages/admin/StoreSettings.jsx"));
import AdminStaffPage from "./pages/admin/Staff.jsx";
const AdminForbiddenPage = lazy(() => import("./pages/admin/Forbidden.jsx"));
import AccountGuard from "./components/AccountGuard.jsx";
import AccountLayout from "./layouts/AccountLayout.jsx";
import AccountDashboardPage from "./pages/account/AccountDashboardPage.jsx";
import AccountOrdersPage from "./pages/account/AccountOrdersPage.jsx";
import AccountOrderDetailPage from "./pages/account/AccountOrderDetailPage.jsx";
import AccountOrderPaymentPage from "./pages/account/AccountOrderPaymentPage.jsx";
import AccountProfilePage from "./pages/account/AccountProfilePage.jsx";
import AccountMyReviewPage from "./pages/account/AccountMyReviewPage.jsx";
import AccountNotificationsPage from "./pages/account/AccountNotificationsPage.jsx";
import AccountMyAccountPage from "./pages/account/AccountMyAccountPage.jsx";
import AccountChangePasswordPage from "./pages/account/AccountChangePasswordPage.jsx";
import AccountShippingAddressPage from "./pages/account/AccountShippingAddressPage.jsx";
import AccountStorePaymentProfilePage from "./pages/account/AccountStorePaymentProfilePage.jsx";
import AccountStorePaymentReviewPage from "./pages/account/AccountStorePaymentReviewPage.jsx";
import AccountStoreInvitationsPage from "./pages/account/AccountStoreInvitationsPage.jsx";
import AdminStorePaymentPage from "./pages/admin/AdminStorePaymentPage.jsx";
import AdminStorePaymentReviewPage from "./pages/admin/AdminStorePaymentReviewPage.jsx";
import SellerLayout from "./layouts/SellerLayout.jsx";
import SellerOrderDetailPage from "./pages/seller/SellerOrderDetailPage.jsx";
import SellerOrdersPage from "./pages/seller/SellerOrdersPage.jsx";
import SellerPaymentProfilePage from "./pages/seller/SellerPaymentProfilePage.jsx";
import SellerStoreProfilePage from "./pages/seller/SellerStoreProfilePage.jsx";
import SellerTeamAuditPage from "./pages/seller/SellerTeamAuditPage.jsx";
import SellerMemberLifecyclePage from "./pages/seller/SellerMemberLifecyclePage.jsx";
import SellerCatalogPage from "./pages/seller/SellerCatalogPage.jsx";
import SellerProductDetailPage from "./pages/seller/SellerProductDetailPage.jsx";
import SellerTeamPage from "./pages/seller/SellerTeamPage.jsx";
import SellerWorkspaceHome from "./pages/seller/SellerWorkspaceHome.jsx";
const AdminPaymentAuditPage = lazy(() =>
  import("./pages/admin/AdminPaymentAuditPage.jsx")
);
const AdminPaymentAuditDetailPage = lazy(() =>
  import("./pages/admin/AdminPaymentAuditDetailPage.jsx")
);
const AdminStorePaymentProfilesPage = lazy(() =>
  import("./pages/admin/AdminStorePaymentProfilesPage.jsx")
);

function LegacyAccountOrderDetailRedirect() {
  const { id } = useParams();
  const target = id ? `/user/my-orders/${id}` : "/user/my-orders";
  return <Navigate to={target} replace />;
}

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
            <Route path="category" element={<StoreCategoryPage />} />
            <Route path="category/:slug" element={<StoreCategoryPage />} />
            <Route path="product/:slug" element={<StoreProductDetailPage />} />
            <Route path="cart" element={<StoreCartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<StoreCheckoutSuccessPage />} />
            <Route path="order/:ref" element={<StoreOrderTrackingPage />} />
            <Route path="about-us" element={<StoreAboutUsPage />} />
            <Route path="privacy-policy" element={<StorePrivacyPolicyPage />} />
            <Route path="faq" element={<StoreFaqPage />} />
            <Route path="faqs" element={<StoreFaqPage />} />
            <Route path="terms" element={<StoreTermsAndConditionsPage />} />
            <Route
              path="terms-and-conditions"
              element={<StoreTermsAndConditionsPage />}
            />
            <Route path="contact-us" element={<StoreContactUsPage />} />
            <Route path="offers" element={<StoreOffersPage />} />
            <Route path="about" element={<Navigate to="/about-us" replace />} />
            <Route path="contact" element={<Navigate to="/contact-us" replace />} />
            <Route path="auth/login" element={<StoreLoginPage />} />
            <Route path="auth/register" element={<StoreRegisterPage />} />
            <Route path="my-orders" element={<Navigate to="/user/my-orders" replace />} />

            <Route path="user" element={<AccountGuard />}>
              <Route element={<AccountLayout />}>
                <Route index element={<Navigate to="/user/dashboard" replace />} />
                <Route path="dashboard" element={<AccountDashboardPage />} />
                <Route path="my-orders" element={<AccountOrdersPage />} />
                <Route path="my-orders/:id" element={<AccountOrderDetailPage />} />
                <Route path="my-orders/:id/payment" element={<AccountOrderPaymentPage />} />
                <Route path="notifications" element={<AccountNotificationsPage />} />
                <Route path="my-reviews" element={<AccountMyReviewPage />} />
                <Route path="my-account" element={<AccountMyAccountPage />} />
                <Route path="shipping-address" element={<AccountShippingAddressPage />} />
                <Route
                  path="store-payment-profile"
                  element={<Navigate to="/admin/online-store/store-payment" replace />}
                />
                <Route
                  path="store-payment-review"
                  element={<Navigate to="/admin/online-store/payment-review" replace />}
                />
                <Route path="store-invitations" element={<AccountStoreInvitationsPage />} />
                <Route path="update-profile" element={<AccountProfilePage />} />
                <Route path="change-password" element={<AccountChangePasswordPage />} />
              </Route>
            </Route>

            <Route path="account" element={<Navigate to="/user/dashboard" replace />} />
            <Route path="account/dashboard" element={<Navigate to="/user/dashboard" replace />} />
            <Route path="account/orders" element={<Navigate to="/user/my-orders" replace />} />
            <Route path="account/orders/:id" element={<LegacyAccountOrderDetailRedirect />} />
            <Route
              path="account/my-review"
              element={<Navigate to="/user/my-reviews" replace />}
            />
            <Route
              path="account/profile"
              element={<Navigate to="/user/update-profile" replace />}
            />
            <Route
              path="account/store-invitations"
              element={<Navigate to="/user/store-invitations" replace />}
            />
          </Route>

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/forbidden" element={<AdminForbiddenPage />} />
          <Route path="/seller/stores/:storeId" element={<SellerLayout />}>
            <Route index element={<SellerWorkspaceHome />} />
            <Route path="dashboard" element={<SellerWorkspaceHome />} />
            <Route path="profile" element={<SellerStoreProfilePage />} />
            <Route path="team" element={<SellerTeamPage />} />
            <Route path="team/:memberId" element={<SellerMemberLifecyclePage />} />
            <Route path="team/audit" element={<SellerTeamAuditPage />} />
            <Route path="catalog" element={<SellerCatalogPage />} />
            <Route path="catalog/:productId" element={<SellerProductDetailPage />} />
            <Route path="orders" element={<SellerOrdersPage />} />
            <Route path="orders/:suborderId" element={<SellerOrderDetailPage />} />
            <Route path="payment-profile" element={<SellerPaymentProfilePage />} />
          </Route>
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
                path="orders/:invoiceNo"
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
                path="categories/id/:id"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminSubCategoriesPage resolveMode="id" />
                  </RequirePerm>
                }
              />
              <Route
                path="categories/:code"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminSubCategoriesPage resolveMode="code" />
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
                    <AdminAttributesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="our-staff"
                element={
                  <RequirePerm perm="STAFF_MANAGE">
                    <AdminStaffPage />
                  </RequirePerm>
                }
              />
              <Route
                path="staff"
                element={
                  <RequirePerm perm="STAFF_MANAGE">
                    <Navigate to="/admin/our-staff" replace />
                  </RequirePerm>
                }
              />
              <Route
                path="languages"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <LanguagesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="currencies"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <CurrenciesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/store-payment"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <AdminStorePaymentPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/payment-review"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <AdminStorePaymentReviewPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/payment-audit"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <AdminPaymentAuditPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/payment-audit/:orderId"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <AdminPaymentAuditDetailPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store/customization"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <StoreCustomizationPage />
                  </RequirePerm>
                }
              />
              <Route
                path="customization"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <StoreCustomizationPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store-customization"
                element={<Navigate to="/admin/store/customization" replace />}
              />
              <Route
                path="store/store-settings"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <StoreSettingsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store/payment-profiles"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <AdminStorePaymentProfilesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store-settings"
                element={<Navigate to="/admin/store/store-settings" replace />}
              />
              <Route
                path="settings"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <Settings />
                  </RequirePerm>
                }
              />
              <Route path="profile" element={<AdminProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

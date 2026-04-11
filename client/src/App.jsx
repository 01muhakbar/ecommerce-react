import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import StoreLayout from "./components/Layout/StoreLayout.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import StoreCartPage from "./pages/store/StoreCartPage.jsx";
import AdminGuard from "./components/AdminGuard.jsx";
import RequirePerm from "./components/guards/RequirePerm.jsx";
import AccountGuard from "./components/AccountGuard.jsx";
import SeoCustomizationBridge from "./components/SeoCustomizationBridge.jsx";
const StoreProductDetailPage = lazy(() => import("./pages/store/StoreProductDetailPage.jsx"));
const CheckoutPage = lazy(() => import("./pages/store/Checkout.jsx"));
const StoreLoginPage = lazy(() => import("./pages/store/StoreLoginPage.jsx"));
const StoreRegisterPage = lazy(() => import("./pages/store/StoreRegisterPage.jsx"));
const StoreForgotPasswordPage = lazy(() => import("./pages/store/StoreForgotPasswordPage.jsx"));
const StoreResetPasswordPage = lazy(() => import("./pages/store/StoreResetPasswordPage.jsx"));
const StoreCheckoutSuccessPage = lazy(() => import("./pages/store/StoreCheckoutSuccessPage.jsx"));
const StoreOrderTrackingPage = lazy(() => import("./pages/store/StoreOrderTrackingPage.jsx"));
const StoreSearchPage = lazy(() => import("./pages/store/StoreSearchPage.jsx"));
const StoreOffersPage = lazy(() => import("./pages/store/StoreOffersPage.jsx"));
const StoreAboutUsPage = lazy(() => import("./pages/store/StoreAboutUsPage.jsx"));
const StoreContactUsPage = lazy(() => import("./pages/store/StoreContactUsPage.jsx"));
const StorePrivacyPolicyPage = lazy(() => import("./pages/store/StorePrivacyPolicyPage.jsx"));
const StoreTermsAndConditionsPage = lazy(() =>
  import("./pages/store/StoreTermsAndConditionsPage.jsx")
);
const StoreFaqPage = lazy(() => import("./pages/store/StoreFaqPage.jsx"));
const StoreMicrositePage = lazy(() => import("./pages/store/StoreMicrositePage.jsx"));
const StoreMicrositeProductDetailPage = lazy(() =>
  import("./pages/store/StoreMicrositeProductDetailPage.jsx")
);
const KachaBazarDemoHomePage = lazy(() => import("./pages/store/KachaBazarDemoHomePage.jsx"));
const AdminLayout = lazy(() => import("./components/layouts/AdminLayout.jsx"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage.jsx"));
const AdminCreateAccountPage = lazy(() => import("./pages/admin/AdminCreateAccountPage.jsx"));
const AdminVerifyAccountPage = lazy(() => import("./pages/admin/AdminVerifyAccountPage.jsx"));
const AdminForgotPasswordPage = lazy(() => import("./pages/admin/AdminForgotPasswordPage.jsx"));
const AdminResetPasswordPage = lazy(() => import("./pages/admin/AdminResetPasswordPage.jsx"));
const AdminResendVerificationPage = lazy(() =>
  import("./pages/admin/AdminResendVerificationPage.jsx")
);
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
const AdminCustomerOrdersPage = lazy(() =>
  import("./pages/admin/AdminCustomerOrdersPage.jsx")
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
const AdminStaffPage = lazy(() => import("./pages/admin/Staff.jsx"));
const AdminForbiddenPage = lazy(() => import("./pages/admin/Forbidden.jsx"));
const AccountLayout = lazy(() => import("./layouts/AccountLayout.jsx"));
const AccountDashboardPage = lazy(() => import("./pages/account/AccountDashboardPage.jsx"));
const AccountOrdersPage = lazy(() => import("./pages/account/AccountOrdersPage.jsx"));
const AccountOrderDetailPage = lazy(() => import("./pages/account/AccountOrderDetailPage.jsx"));
const AccountOrderPaymentPage = lazy(() => import("./pages/account/AccountOrderPaymentPage.jsx"));
const AccountProfilePage = lazy(() => import("./pages/account/AccountProfilePage.jsx"));
const AccountMyReviewPage = lazy(() => import("./pages/account/AccountMyReviewPage.jsx"));
const AccountNotificationsPage = lazy(() =>
  import("./pages/account/AccountNotificationsPage.jsx")
);
const AccountMyAccountPage = lazy(() => import("./pages/account/AccountMyAccountPage.jsx"));
const AccountChangePasswordPage = lazy(() =>
  import("./pages/account/AccountChangePasswordPage.jsx")
);
const AccountShippingAddressPage = lazy(() =>
  import("./pages/account/AccountShippingAddressPage.jsx")
);
const AccountStoreInvitationsPage = lazy(() =>
  import("./pages/account/AccountStoreInvitationsPage.jsx")
);
const AccountLegacySellerRoutePage = lazy(() =>
  import("./pages/account/AccountLegacySellerRoutePage.jsx")
);
const AccountStoreApplicationPage = lazy(() =>
  import("./pages/account/AccountStoreApplicationPage.jsx")
);
const AdminStorePaymentPage = lazy(() => import("./pages/admin/AdminStorePaymentPage.jsx"));
const AdminStorePaymentReviewPage = lazy(() =>
  import("./pages/admin/AdminStorePaymentReviewPage.jsx")
);
const AdminStoreProfilePage = lazy(() => import("./pages/admin/AdminStoreProfilePage.jsx"));
const AdminStoreApplicationsPage = lazy(() =>
  import("./pages/admin/AdminStoreApplicationsPage.jsx")
);
const AdminStoreApplicationDetailPage = lazy(() =>
  import("./pages/admin/AdminStoreApplicationDetailPage.jsx")
);
const SellerLayout = lazy(() => import("./layouts/SellerLayout.jsx"));
const SellerOrderDetailPage = lazy(() => import("./pages/seller/SellerOrderDetailPage.jsx"));
const SellerOrdersPage = lazy(() => import("./pages/seller/SellerOrdersPage.jsx"));
const SellerPaymentReviewPage = lazy(() => import("./pages/seller/SellerPaymentReviewPage.jsx"));
const SellerPaymentProfilePage = lazy(() =>
  import("./pages/seller/SellerPaymentProfilePage.jsx")
);
const SellerStoreProfilePage = lazy(() => import("./pages/seller/SellerStoreProfilePage.jsx"));
const SellerCouponsPage = lazy(() => import("./pages/seller/SellerCouponsPage.jsx"));
const SellerTeamAuditPage = lazy(() => import("./pages/seller/SellerTeamAuditPage.jsx"));
const SellerMemberLifecyclePage = lazy(() =>
  import("./pages/seller/SellerMemberLifecyclePage.jsx")
);
const SellerCatalogPage = lazy(() => import("./pages/seller/SellerCatalogPage.jsx"));
const SellerProductDetailPage = lazy(() => import("./pages/seller/SellerProductDetailPage.jsx"));
const SellerProductAuthoringPage = lazy(() =>
  import("./pages/seller/SellerProductAuthoringPage.jsx")
);
const SellerTeamPage = lazy(() => import("./pages/seller/SellerTeamPage.jsx"));
const SellerWorkspaceHome = lazy(() => import("./pages/seller/SellerWorkspaceHome.jsx"));
const AdminPaymentAuditPage = lazy(() =>
  import("./pages/admin/AdminPaymentAuditPage.jsx")
);
const AdminPaymentAuditDetailPage = lazy(() =>
  import("./pages/admin/AdminPaymentAuditDetailPage.jsx")
);
const AdminShippingReconciliationPage = lazy(() =>
  import("./pages/admin/AdminShippingReconciliationPage.jsx")
);
const AdminStorePaymentProfilesPage = lazy(() =>
  import("./pages/admin/AdminStorePaymentProfilesPage.jsx")
);

function LegacyAccountOrderDetailRedirect() {
  const { id } = useParams();
  const target = id ? `/user/my-orders/${id}` : "/user/my-orders";
  return <Navigate to={target} replace />;
}

function LegacySellerStoreProfileRedirect() {
  const { storeSlug } = useParams();
  const target = storeSlug
    ? `/seller/stores/${encodeURIComponent(storeSlug)}/store-profile`
    : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacySellerCatalogRedirect() {
  const { storeSlug } = useParams();
  const target = storeSlug
    ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products`
    : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacySellerCouponsRedirect() {
  const { storeSlug } = useParams();
  const target = storeSlug
    ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/coupons`
    : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacySellerProductCreateRedirect() {
  const { storeSlug } = useParams();
  const target = storeSlug
    ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products/new`
    : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacySellerProductDetailRedirect() {
  const { storeSlug, productId } = useParams();
  const target =
    storeSlug && productId
      ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products/${encodeURIComponent(productId)}`
      : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacySellerProductEditRedirect() {
  const { storeSlug, productId } = useParams();
  const target =
    storeSlug && productId
      ? `/seller/stores/${encodeURIComponent(storeSlug)}/catalog/products/${encodeURIComponent(productId)}/edit`
      : "/seller/stores";
  return <Navigate to={target} replace />;
}

function LegacyAdminProductsRedirect() {
  return <Navigate to="/admin/catalog/products" replace />;
}

function LegacyAdminProductCreateRedirect() {
  return <Navigate to="/admin/catalog/products/new" replace />;
}

function LegacyAdminProductDetailRedirect() {
  const { id } = useParams();
  const target = id
    ? `/admin/catalog/products/${encodeURIComponent(id)}`
    : "/admin/catalog/products";
  return <Navigate to={target} replace />;
}

function LegacyAdminCategoriesRedirect() {
  return <Navigate to="/admin/catalog/categories" replace />;
}

function LegacyAdminCategoryByIdRedirect() {
  const { id } = useParams();
  const target = id
    ? `/admin/catalog/categories/id/${encodeURIComponent(id)}`
    : "/admin/catalog/categories";
  return <Navigate to={target} replace />;
}

function LegacyAdminCategoryByCodeRedirect() {
  const { code } = useParams();
  const target = code
    ? `/admin/catalog/categories/${encodeURIComponent(code)}`
    : "/admin/catalog/categories";
  return <Navigate to={target} replace />;
}

function LegacyAdminAttributesRedirect() {
  return <Navigate to="/admin/catalog/attributes" replace />;
}

function LegacyAdminCouponsRedirect() {
  return <Navigate to="/admin/catalog/coupons" replace />;
}

function LegacyAdminLanguagesRedirect() {
  return <Navigate to="/admin/international/languages" replace />;
}

function LegacyAdminCurrenciesRedirect() {
  return <Navigate to="/admin/international/currencies" replace />;
}

function LegacyStoreCategoryRedirect() {
  const { slug } = useParams();
  const target = slug
    ? `/search?category=${encodeURIComponent(slug)}&page=1`
    : "/search?page=1";
  return <Navigate to={target} replace />;
}

function ScrollToTopOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTopOnRouteChange />
      <SeoCustomizationBridge />
      <Suspense
        fallback={
          <div className="p-6 text-sm text-slate-500">Loading...</div>
        }
      >
        <Routes>
          <Route path="/demo/kachabazar" element={<KachaBazarDemoHomePage />} />
          <Route
            path="/store/:slug/products/:productSlug"
            element={<StoreMicrositeProductDetailPage />}
          />
          <Route path="/store/:slug" element={<StoreMicrositePage />} />
          <Route path="/" element={<StoreLayout />}>
            <Route index element={<KachaBazarDemoHomePage />} />
            <Route path="search" element={<StoreSearchPage />} />
            <Route path="category" element={<LegacyStoreCategoryRedirect />} />
            <Route path="category/:slug" element={<LegacyStoreCategoryRedirect />} />
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
            <Route path="auth/forgot-password" element={<StoreForgotPasswordPage />} />
            <Route path="auth/reset-password" element={<StoreResetPasswordPage />} />
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
                  element={<AccountLegacySellerRoutePage lane="paymentProfile" />}
                />
                <Route
                  path="store-payment-review"
                  element={<AccountLegacySellerRoutePage lane="paymentReview" />}
                />
                <Route path="store-invitations" element={<AccountStoreInvitationsPage />} />
                <Route path="store-application" element={<AccountStoreApplicationPage />} />
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
          <Route path="/admin/create-account" element={<AdminCreateAccountPage />} />
          <Route path="/admin/verify-account" element={<AdminVerifyAccountPage />} />
          <Route path="/admin/resend-verification" element={<AdminResendVerificationPage />} />
          <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route path="/admin/forbidden" element={<AdminForbiddenPage />} />
          <Route
            path="/seller/stores/:storeSlug/profile"
            element={<LegacySellerStoreProfileRedirect />}
          />
          <Route path="/seller/stores/:storeSlug" element={<SellerLayout />}>
            <Route index element={<SellerWorkspaceHome />} />
            <Route path="dashboard" element={<SellerWorkspaceHome />} />
            <Route path="store-profile" element={<SellerStoreProfilePage />} />
            <Route path="team" element={<SellerTeamPage />} />
            <Route path="team/:memberId" element={<SellerMemberLifecyclePage />} />
            <Route path="team/audit" element={<SellerTeamAuditPage />} />
            <Route path="catalog" element={<LegacySellerCatalogRedirect />} />
            <Route path="catalog/new" element={<LegacySellerProductCreateRedirect />} />
            <Route path="catalog/products" element={<SellerCatalogPage />} />
            <Route
              path="catalog/products/new"
              element={<SellerProductAuthoringPage mode="create" />}
            />
            <Route
              path="catalog/:productId/edit"
              element={<LegacySellerProductEditRedirect />}
            />
            <Route
              path="catalog/products/:productId/edit"
              element={<SellerProductAuthoringPage mode="edit" />}
            />
            <Route path="catalog/:productId" element={<LegacySellerProductDetailRedirect />} />
            <Route path="catalog/products/:productId" element={<SellerProductDetailPage />} />
            <Route path="orders" element={<SellerOrdersPage />} />
            <Route path="orders/:suborderId" element={<SellerOrderDetailPage />} />
            <Route path="payment-review" element={<SellerPaymentReviewPage />} />
            <Route path="payment-profile" element={<SellerPaymentProfilePage />} />
            <Route path="coupons" element={<LegacySellerCouponsRedirect />} />
            <Route path="catalog/coupons" element={<SellerCouponsPage />} />
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
                element={<LegacyAdminProductsRedirect />}
              />
              <Route
                path="products/new"
                element={<LegacyAdminProductCreateRedirect />}
              />
              <Route
                path="products/:id"
                element={<LegacyAdminProductDetailRedirect />}
              />
              <Route
                path="catalog/products"
                element={
                  <RequirePerm perm="PRODUCTS_VIEW">
                    <AdminProductsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="catalog/products/new"
                element={
                  <RequirePerm perm="PRODUCTS_CREATE">
                    <AdminProductForm />
                  </RequirePerm>
                }
              />
              <Route
                path="catalog/products/:id"
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
                path="customer-orders/:id"
                element={
                  <RequirePerm perm="CUSTOMERS_VIEW">
                    <AdminCustomerOrdersPage />
                  </RequirePerm>
                }
              />
              <Route
                path="categories/id/:id"
                element={<LegacyAdminCategoryByIdRedirect />}
              />
              <Route
                path="categories/:code"
                element={<LegacyAdminCategoryByCodeRedirect />}
              />
              <Route
                path="categories"
                element={<LegacyAdminCategoriesRedirect />}
              />
              <Route
                path="catalog/categories/id/:id"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminSubCategoriesPage resolveMode="id" />
                  </RequirePerm>
                }
              />
              <Route
                path="catalog/categories/:code"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminSubCategoriesPage resolveMode="code" />
                  </RequirePerm>
                }
              />
              <Route
                path="catalog/categories"
                element={
                  <RequirePerm perm="CATEGORIES_CRUD">
                    <AdminCategoriesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="coupons"
                element={<LegacyAdminCouponsRedirect />}
              />
              <Route
                path="catalog/coupons"
                element={
                  <RequirePerm perm="COUPONS_CRUD">
                    <AdminCouponsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="attributes"
                element={<LegacyAdminAttributesRedirect />}
              />
              <Route
                path="catalog/attributes"
                element={
                  <RequirePerm perm="ATTRIBUTES_CRUD">
                    <AdminAttributesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="all-accounts"
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
                    <Navigate to="/admin/all-accounts" replace />
                  </RequirePerm>
                }
              />
              <Route
                path="our-staff"
                element={
                  <RequirePerm perm="STAFF_MANAGE">
                    <Navigate to="/admin/all-accounts" replace />
                  </RequirePerm>
                }
              />
              <Route
                path="languages"
                element={<LegacyAdminLanguagesRedirect />}
              />
              <Route
                path="international/languages"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <LanguagesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="currencies"
                element={<LegacyAdminCurrenciesRedirect />}
              />
              <Route
                path="international/currencies"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <CurrenciesPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/store-profile"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <AdminStoreProfilePage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/store-payment"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <AdminStorePaymentPage />
                  </RequirePerm>
                }
              />
              <Route
                path="online-store/payment-review"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
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
                path="online-store/shipping-reconciliation"
                element={
                  <RequirePerm perm="DASHBOARD_VIEW">
                    <AdminShippingReconciliationPage />
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
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <Navigate to="/admin/store/customization" replace />
                  </RequirePerm>
                }
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
                path="store/applications"
                element={
                  <RequirePerm perm="STORE_APPLICATIONS_REVIEW">
                    <AdminStoreApplicationsPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store/applications/:applicationId"
                element={
                  <RequirePerm perm="STORE_APPLICATIONS_REVIEW">
                    <AdminStoreApplicationDetailPage />
                  </RequirePerm>
                }
              />
              <Route
                path="store-settings"
                element={
                  <RequirePerm perm="SETTINGS_MANAGE">
                    <Navigate to="/admin/store/store-settings" replace />
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
              <Route path="profile" element={<AdminProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

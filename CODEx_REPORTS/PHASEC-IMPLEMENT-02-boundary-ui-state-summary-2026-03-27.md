# PHASEC-IMPLEMENT-02 Boundary UI/State Summary

## Boundary baru yang dibuat

- `client/src/components/primitives/ui/`
  - `QueryState.jsx`
  - `index.js`
- `client/src/components/primitives/state/`
  - `UiEmptyState.jsx`
  - `UiErrorState.jsx`
  - `UiSkeleton.jsx`
  - `UiUpdatingBadge.jsx`
  - `index.js`

## Primitives yang berhasil dipindah ke boundary logis

- `QueryState`
- `UiEmptyState`
- `UiErrorState`
- `UiSkeleton`
- `UiUpdatingBadge`

## Consumer yang mulai diarahkan ke boundary baru

- admin pages:
  - `OrderDetail.jsx`
  - `AdminSubCategoriesPage.jsx`
  - `AdminCouponsPage.jsx`
  - `Orders.jsx`
  - `Staff.jsx`
  - `Attributes.jsx`
- storefront/client pages:
  - `StoreHomePage.jsx`
  - `StoreCategoryPage.jsx`
  - `StoreCheckoutSuccessPage.jsx`
  - `StoreProductDetailPage.jsx`
  - `StoreSearchPage.jsx`
  - `StoreCartPage.jsx`
  - `StoreOrderTrackingPage.jsx`
  - `StoreMicrositePage.jsx`
  - `StoreMicrositeProductDetailPage.jsx`
  - `StoreAboutUsPage.jsx`
  - `StoreContactUsPage.jsx`
  - `StoreFaqPage.jsx`
  - `StoreOffersPage.jsx`
  - `StorePrivacyPolicyPage.jsx`
  - `StoreTermsAndConditionsPage.jsx`
  - `KachaBazarDemoHomePage.jsx`
- generic page:
  - `pages/Customers.jsx`

## Yang sengaja ditahan

- `client/src/components/seller/SellerWorkspaceFoundation.jsx`
  - seller-only, bukan shared lintas domain
- `client/src/components/UI/StatusBadge.jsx`
- `client/src/components/UI/ToggleSwitch.jsx`
- `client/src/components/UI/ActionButtons.jsx`
  - masih dominan dipakai oleh table/admin/internal views
  - belum cukup netral untuk dipaksa masuk boundary shared di step ini
- `client/src/components/common/ErrorState.jsx`
- `client/src/components/common/LoadingState.jsx`
  - belum jadi source primitive lintas domain yang konsisten

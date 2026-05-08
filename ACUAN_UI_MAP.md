# ACUAN UI Map

## Storefront (KachaBazar-like)
- Header/search (SUDAH ADA): `client/src/components/kachabazar-demo/StoreHeaderKacha.jsx`, `client/src/components/kachabazar-demo/GreenHeaderBar.jsx`, `client/src/components/kachabazar-demo/NavBar.jsx`, `client/src/components/kachabazar-demo/TopInfoBar.jsx`, `client/src/components/Layout/StoreLayout.jsx`
- Header/search (GAP): belum ada state terpadu untuk loading/error header (mis. dropdown kategori saat gagal load).
- Home sections (SUDAH ADA): hero + sections di `client/src/pages/store/StoreHomePage.jsx`, kartu kategori/produk di `client/src/storefront.jsx` (CategoryCard/ProductCard)
- Home sections (GAP): komponen demo KachaBazar belum dipakai (contoh: `client/src/components/kachabazar-demo/HeroSlider.jsx`, `FeaturedCategoriesMega.jsx`, `PopularProductsGrid.jsx`)
- Search page (SUDAH ADA): `client/src/pages/store/StoreSearchPage.jsx`, filter kategori + pagination di `client/src/storefront.jsx`
- Search page (GAP): sorting/filters lanjutan belum ada (price range, rating, dsb.)
- Category page (SUDAH ADA): `client/src/pages/store/StoreCategoryPage.jsx`, data via `client/src/api/store.service.ts`
- Category page (GAP): hero/summary kategori + breadcrumb belum ada.
- Cart/Checkout/Order tracking (SUDAH ADA): `client/src/pages/store/StoreCartPage.jsx`, `StoreCheckoutPage.jsx`, `StoreCheckoutSuccessPage.jsx`, `StoreOrderTrackingPage.jsx`
- Cart/Checkout/Order tracking (GAP): UI konsisten loading/error/empty belum merata di semua halaman.

## Admin (Dashtar-like)
- Sidebar + topbar (SUDAH ADA): `client/src/layouts/AdminLayout.jsx`, `client/src/components/Layout/Sidebar.jsx` (terdapat versi sidebar lain)
- Sidebar + topbar (GAP): tidak ada topbar yang kaya (notif/search) seperti Dashtar.
- Dashboard cards + charts (SUDAH ADA): card KPI di `client/src/pages/admin/AdminDashboardPage.jsx`
- Dashboard cards + charts (GAP): chart tersedia namun belum dipakai (`client/src/components/Charts/*`, `client/src/components/dashboard/*`)
- Orders table + detail + status update (SUDAH ADA): `client/src/pages/admin/Orders.jsx`, `client/src/pages/admin/OrderDetail.jsx`, update status via `client/src/lib/adminApi.js`
- Orders table + detail + status update (GAP): bulk update + export belum ada.
- Products table + form (SUDAH ADA): `client/src/pages/admin/Products.jsx`, `client/src/pages/admin/ProductForm.jsx`
- Products table + form (GAP): bulk actions/import/export belum ada.

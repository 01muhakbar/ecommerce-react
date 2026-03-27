TASK ID: SELLER-MVF-05
Status: PASS

Yang diamati

- Domain inventory existing masih mengandalkan `Product.stock` + `status/isPublished/sellerSubmissionStatus`, tetapi guard di cart dan multi-store checkout belum selalu membaca state terbaru secara ketat.
- Storefront listing/detail sudah membawa `stock`, tetapi beberapa CTA add-to-cart di katalog/list/search/related card masih bisa dipencet saat stok `0`.
- Multi-store checkout preview sudah memecah cart per store, tetapi sebelumnya belum menandai item out-of-stock atau quantity yang melebihi stok sebagai invalid item secara eksplisit.
- `create-multi-store` sebelumnya masih bisa berjalan memakai snapshot product dari cart include tanpa reload + row lock terhadap product yang benar-benar akan dikurangi stoknya.
- Seller fulfillment route sudah punya governance transition yang cukup jelas, tetapi mutation route belum dibungkus transaction + row lock untuk suborder target.

Gap utama yang ditemukan

- Risiko oversell pada add-to-cart dan `set cart qty`: stok/eligibility produk bisa berubah setelah item sudah ada di cart, tetapi mutation cart belum selalu re-validate terhadap state storefront terkini.
- Drift antara checkout preview dan stock aktual: item dengan stok turun menjadi `0` atau kurang dari qty belum selalu muncul sebagai blocker yang jelas.
- Drift UI storefront: beberapa kartu produk masih menampilkan CTA add-to-cart walaupun payload sudah menunjukkan `stock: 0`.
- Risiko race kecil pada seller fulfillment mutation: suborder update dan parent order sync belum transactional.

Perubahan yang dilakukan

- Hardening `cart` backend supaya add/update quantity selalu me-lock product row dan menolak produk yang tidak lagi purchasable atau stoknya tidak cukup.
- Hardening `checkout/create-multi-store` supaya product yang dipakai saat validasi dan pengurangan stok di-reload ulang dengan `FOR UPDATE`, lalu invalid item diberi reason eksplisit:
  `PRODUCT_NOT_PUBLIC`
  `PRODUCT_STORE_UNMAPPED`
  `PRODUCT_OUT_OF_STOCK`
  `PRODUCT_STOCK_REDUCED`
- Hardening seller fulfillment patch supaya suborder target di-lock dalam transaction, parent order sync ikut 1 transaction, dan audit log dibuat dalam transaction yang sama.
- Sinkronkan feedback checkout frontend agar invalid item tampil jelas ke user, termasuk requested vs available stock.
- Matikan CTA add-to-cart di beberapa surface storefront saat `stock <= 0` agar perilaku frontend sejalan dengan guard server.
- Rapikan copy seller product availability agar seller memahami bahwa listing tetap bisa tampil, tetapi add-to-cart/checkout sekarang memblok item yang tidak lagi purchasable.

File yang diubah

- client/src/api/store.service.ts
- client/src/components/kachabazar-demo/ProductCardKacha.jsx
- client/src/components/store/SearchProductCard.jsx
- client/src/pages/store/Checkout.jsx
- client/src/pages/store/StoreCategoryPage.jsx
- client/src/pages/store/StoreProductDetailPage.jsx
- client/src/storefront.jsx
- server/src/controllers/cartController.ts
- server/src/routes/checkout.ts
- server/src/routes/seller.orders.ts
- server/src/routes/seller.products.ts

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS
- Smoke PASS via fixture dev lokal:
  out-of-stock product ditolak saat `POST /api/cart/add`
  cart quantity update ditolak setelah stok produk diturunkan ke `0`
  `POST /api/checkout/preview` mengembalikan invalid item reason `PRODUCT_OUT_OF_STOCK`
  public store product detail memantulkan `stock` terbaru
  seller fulfillment `MARK_PROCESSING` berhasil untuk suborder store sendiri
  parent order sync berubah ke `processing`
  admin masih bisa membuka detail order hasil sync via lane admin

Dampak ke Seller / Admin / Client

- Seller
  inventory read model lebih jujur terhadap dampak storefront/checkout
  fulfillment mutation seller lebih aman terhadap race kecil
- Admin
  order visibility tetap aman setelah seller fulfillment sync
  authority admin tidak diubah
- Client
  storefront tidak lagi menawarkan add-to-cart pada beberapa CTA saat stok `0`
  cart dan checkout lebih cepat menolak item yang sudah tidak layak dibeli

Risiko / debt / follow-up

- Storefront listing visibility masih tidak menyembunyikan produk out-of-stock; task ini hanya mengeraskan sellability, bukan mengubah merchandising policy.
- Belum ada reservation/hold stock pada saat item masuk cart, jadi race ekstrem antar-checkout masih mungkin sampai tahap order placement; hardening saat ini menurunkan risiko dengan revalidation + row lock di create order.
- Multi-store checkout preview belum di-lock penuh seperti create order, sehingga preview tetap bersifat advisory, tetapi sekarang reason invalid item sudah backend-driven dan lebih akurat.
- Belum ada fulfillment telemetry/dashboard khusus untuk audit race atau stock correction events.

Butuh keputusan user?

Tidak

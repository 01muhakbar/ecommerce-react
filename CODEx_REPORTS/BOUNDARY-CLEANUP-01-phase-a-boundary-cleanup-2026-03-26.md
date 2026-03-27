TASK ID: BOUNDARY-CLEANUP-01
Status: PASS

Ringkasan

Phase A cleanup difokuskan pada boundary Seller vs Client/account tanpa split runtime. Flow seller utama tetap berada di seller workspace, legacy lane account yang overlap diberi marker sunset atau diarahkan ke canonical seller/admin lane, dan copy/backend next-step yang masih menunjuk account lane lama dirapikan agar ownership domain lebih jelas.

Boundary cleanup yang diterapkan

1. Seller auth boundary hardening
- Seller unauthorized state di `SellerLayout` hanya mengarahkan ke login storefront/account.
- CTA login admin di boundary seller tidak lagi ditawarkan.
- Pesan unauthorized seller menegaskan bahwa seller workspace memakai storefront session + seller access scope, bukan admin login.

2. Legacy account lane sunset markers
- `/user/store-payment-profile`
  - Tidak lagi membawa user ke lane admin.
  - Sekarang memakai page legacy marker yang:
    - auto-redirect ke canonical seller payment setup bila hanya ada 1 store seller yang eligible
    - menampilkan chooser bila ada lebih dari 1 seller store
    - menampilkan notice + CTA invitation bila tidak ada access
- `/user/store-payment-review`
  - Pola sunset sama seperti di atas, tetapi diarahkan ke canonical seller payment review lane
- `/user/store-invitations`
  - Tetap hidup sebagai legacy-active lane
  - Belum dipindahkan karena acceptance invitation masih memang account-bound di fase ini

3. Admin alias cleanup
- `/admin/online-store/store-payment` tetap hidup sebagai alias aman
- `/admin/online-store/payment-review` tetap hidup sebagai alias aman
- Keduanya sekarang diarahkan ke canonical admin lane `/admin/store/payment-profiles`
- Admin tidak lagi memakai wrapper page account legacy untuk flow utama payment profile review

4. API ownership cleanup
- Seller workspace flow utama tetap memakai seller namespace:
  - seller workspace context/readiness/finance summary
  - seller payment profile write lane
  - seller store profile
- Admin payment profile flow utama tetap memakai admin/canonical admin contract
- Client/storefront tetap berada pada serializer public-safe store identity dan tidak memakai seller/admin internal contract untuk public store identity

Lane overlap yang diaudit

- Account legacy seller overlaps
  - `/user/store-payment-profile`: legacy redirect/chooser ke seller canonical
  - `/user/store-payment-review`: legacy redirect/chooser ke seller canonical
  - `/user/store-invitations`: tetap legacy-active
- Admin aliases
  - `/admin/online-store/store-payment`: alias ke canonical admin payment profiles
  - `/admin/online-store/payment-review`: alias ke canonical admin payment profiles

Ownership cleanup yang dilakukan

- Seller payment setup next-step/backend copy yang sebelumnya menunjuk `ACCOUNT_PAYMENT_PROFILE` / `ACCOUNT_ADMIN` dipindah ke canonical `SELLER_PAYMENT_SETUP` atau tetap `ADMIN_REVIEW` bila authority memang admin.
- Governance fallback di normalizer seller payment profile tidak lagi mengasumsikan `ACCOUNT_ADMIN`.
- Seller fallback state untuk payment setup mengarah ke seller canonical lane, bukan account lane lama.

Residual legacy yang sengaja dipertahankan

- Seller invitation acceptance masih hidup di account lane dan belum dipindah ke seller runtime.
- Source file account payment profile/review lama masih ada di codebase, tetapi flow utama sekarang tidak lagi diroute ke sana.
- Auth/session masih shared; hardening baru di level route messaging, redirect, dan ownership marker.

File yang diubah

- `client/src/App.jsx`
- `client/src/api/sellerPaymentProfile.ts`
- `client/src/pages/seller/SellerPaymentProfilePage.jsx`
- `server/src/routes/seller.workspace.ts`
- `server/src/routes/seller.paymentProfiles.ts`
- `server/src/services/storePaymentProfileState.ts`

Hasil build

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS

Catatan risiko sisa

- Boundary account invitation masih menjadi coupling yang perlu diputus di phase berikutnya bila seller auth/runtime benar-benar dipisah.
- Admin payment aliases masih sengaja dipertahankan untuk compatibility route, walau canonical flow sudah dipusatkan.
- Fase ini belum memisahkan auth/session runtime dan belum menghapus file legacy yang tidak lagi diroute.

Butuh keputusan user?

Tidak

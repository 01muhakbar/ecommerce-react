TASK ID: BOUNDARY-CLEANUP-02

Boundary Cleanup Summary

Sudah lebih aman

- Public-safe store identity sekarang punya helper eksplisit di backend dan dipakai sama oleh public route dan admin preview.
- Public coupon snapshot sekarang punya serializer eksplisit di backend, jadi storefront tidak lagi membentuk payload public-safe langsung di route.
- Client storefront punya modul API khusus `storePublicIdentity`, sehingga consumer public store profile tidak perlu tergantung langsung ke service storefront yang lebih lebar.

Masih ditunda

- `store.customization` masih menarik sanitizer dari `admin.storeCustomization`; ini coupling lintas lane backend yang masih perlu dipisah.
- `store.service.ts` di client masih terlalu gemuk dan menjadi campuran catalog/checkout/customization/public identity.

Shared module yang aman dipertahankan

- `server/src/services/publicStoreIdentity.ts`
- `server/src/services/storeProfileGovernance.ts`
- `server/src/services/storePaymentProfileState.ts`
- `server/src/services/sellerWorkspaceReadiness.ts`
- `server/src/services/couponGovernance.ts`
- `client/src/utils/storePublicIdentity.ts`

Blocker utama sebelum split runtime

- Sanitizer customization belum keluar dari admin route domain.
- Modul API storefront di client masih monolitik.
- Auth/session masih menyatu lintas storefront dan seller workspace.

Rekomendasi phase berikutnya

1. Ekstrak sanitizer customization ke service/backend shared yang bebas dari route admin.
2. Pecah `client/src/api/store.service.ts` menjadi modul per-domain public.
3. Audit ulang domain order/payment setelah boundary customization selesai, karena itu akan mempermudah split `Client/storefront` dari `Seller Workspace`.

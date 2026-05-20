# P0-SELLER-STORE-PROFILE-INDONESIA-LOCATION-BANNER-UPLOAD-08 Report

## Ringkasan
Seller Store Profile sekarang memakai pola region Indonesia yang sama dengan checkout untuk shipping origin, dan media section mendukung upload banner lewat upload route existing. Backend, checkout flow, lifecycle order/payment, auth, permission, dan database schema tidak diubah.

## ACUAN
### Amati
- `client/src/pages/store/Checkout.jsx` memakai `getProvinceOptions`, `getCityOptions`, dan `getDistrictOptions` dari `client/src/utils/idRegions.ts`.
- `client/src/api/sellerStoreProfile.ts` sudah punya `uploadSellerStoreProfileImage(file)` yang mengirim file ke `/upload`.
- `server/src/services/storeProfileGovernance.ts` menerima `logoUrl` dan `bannerUrl` berupa URL http/https atau path `/uploads/...`.
- `client/src/components/store/StoreMicrositeShell.jsx` sudah membaca public `identity.bannerUrl`.

### Tiru
- Dependent select mengikuti checkout: province reset city dan district, city reset district.
- Upload mengikuti helper Seller Store Profile existing, bukan route baru.
- Field backend lama tetap dipakai untuk kompatibilitas.

### Modifikasi
- Media edit section dipisah menjadi logo area dan banner area.
- Banner bisa upload/replace/remove, dengan fallback `Banner URL`.
- Shipping origin memakai select Indonesia untuk province, city/regency, dan subdistrict.
- UI label `Origin District` diganti menjadi `Origin Subdistrict`, tetap tersimpan ke backend field `originDistrict`.
- `Origin Country` default ke `Indonesia` saat form kosong dan saat save.

## File Diaudit
- `client/src/pages/seller/SellerStoreProfilePage.jsx`
- `client/src/api/sellerStoreProfile.ts`
- `client/src/pages/store/Checkout.jsx`
- `client/src/pages/account/AccountShippingAddressPage.jsx`
- `client/src/utils/idRegions.ts`
- `server/src/routes/seller.storeProfile.ts`
- `server/src/services/storeProfileGovernance.ts`
- `server/src/routes/store.ts`
- `server/src/routes/store.customization.ts`
- `client/src/components/store/StoreMicrositeShell.jsx`
- `client/src/utils/storePublicIdentity.ts`

## File Diubah
- `client/src/pages/seller/SellerStoreProfilePage.jsx`

## Sinkronisasi
| Area | Field/UI | Backend Field | Source Data | Risiko | Action |
|---|---|---|---|---|---|
| Seller Store Profile | Origin Province | `shippingSetup.originProvince` | `client/src/utils/idRegions.ts` | Low: value tetap string existing | Replace free text with checkout-synced select |
| Seller Store Profile | Origin City/Regency | `shippingSetup.originCity` | `client/src/utils/idRegions.ts` | Low: value tetap string existing | Dependent select, reset when province changes |
| Seller Store Profile | Origin Subdistrict | `shippingSetup.originDistrict` | `client/src/utils/idRegions.ts` | Low: UI label differs from backend key | Label renamed only, backend mapping preserved |
| Seller Store Profile | Origin Country | `shippingSetup.originCountry` | Default Indonesia | Low: only saved when seller saves form | Default empty form value to `Indonesia` |
| Seller Store Profile | Banner upload | `bannerUrl` | Existing `/upload` helper | Low: no upload route added | Upload sets `bannerUrl`, fallback URL remains |
| Client Storefront | Banner display | `bannerUrl` | Store public identity | Low: no public API change | No change; existing storefront consumes same field |
| Checkout Client | Shipping selects | no change | Existing region helpers | Low: no checkout edit | No change |

## Manual Check Conditions
- Banner upload uses existing file input and `uploadSellerStoreProfileImage`.
- Banner preview uses resolved `bannerUrl` in edit mode and buyer preview continues to use the same field.
- Province select resets city/regency and subdistrict.
- City/regency select disables until province exists.
- Subdistrict select disables until city/regency exists.
- Country displays and saves as `Indonesia` when empty.

## Validasi
- `pnpm.cmd -F client build` PASS.

## Risiko Tersisa
- Manual browser upload/save/refresh was not executed in this run; validation was limited to code audit and production client build.
- Backend still names the subdistrict field `originDistrict`; this is intentional for compatibility and documented above.

## Follow-up Bugfix: Save Edit Store Details
- Root cause: local store data could expose `shippingSetup` as a string. The seller patch route merged existing shipping setup with object spread, so a string value could become numeric keys before saving and trigger a generic update failure.
- Fix: `server/src/routes/seller.storeProfile.ts` now uses the existing `mergeSellerShippingSetupPatch` normalizer before writing `shippingSetup`.
- Validation: rollback route simulation for `akbar-cahaya-studio` succeeded with `numericKeys: 0`.
- Validation: `pnpm.cmd -F server build` PASS.

## Follow-up Bugfix: Empty Indonesia Origin Selects
- Root cause: the same local `shippingSetup` compatibility shape was still stored as a JSON string. Backend normalization treated non-object shipping setup as empty, so Seller Store Profile rehydrated province/city/subdistrict as blank even after a save flow.
- Fix: `server/src/services/sellerShippingSetup.service.ts` now parses JSON-string shipping setup before normalizing it.
- UX guard: `SellerStoreProfilePage.jsx` now stops shipping setup saves when province, city/regency, or subdistrict are blank, preventing accidental overwrite with empty region values.
- Validation: local data check confirmed `shippingSetup` raw type is `string` and normalization now returns the expected structured keys.
- Validation: `pnpm.cmd -F server build` PASS.
- Validation: `pnpm.cmd -F client build` PASS.

TASK ID: PHASEC-EXTRACT-02

Boundary Summary

Sudah dipisah

- `server/src/routes/store.customization.ts` tidak lagi import helper dari `server/src/routes/admin.storeCustomization.ts`.
- Source of truth sanitization/shaping untuk customization sekarang hidup di service netral:
  - `server/src/services/storeCustomizationSanitizer.ts`
- Public route dan admin route sekarang sama-sama membaca helper dari service netral itu.

Helper netral yang dipusatkan

- `sanitizeStoreCustomization`
- `parseStoredCustomization`
- `buildAdminStoreCustomizationHeaderSettings`
- `buildPublicStoreCustomizationHeaderSettings`
- `normalizeStoreCustomizationRichAboutPayload`
- `buildEffectiveStoreMicrositeRichAboutPayload`
- `isSafeWhatsAppLink`
- `WHATSAPP_LINK_ERROR_MESSAGE`

Boundary ownership setelah cleanup

- Public-safe shaping
  - `server/src/services/storeCustomizationSanitizer.ts`
- Public route consumption
  - `server/src/routes/store.customization.ts`
- Admin CRUD/governance route
  - `server/src/routes/admin.storeCustomization.ts`

Yang tetap ditunda

- `admin.storeCustomization.ts` masih menyimpan banyak helper normalisasi lama yang sekarang sudah tidak menjadi source of truth.
- Itu tidak lagi menjadi dependency public, tetapi masih bisa dirapikan lagi di phase berikutnya jika ingin mengurangi dead code dan memperkecil route admin.

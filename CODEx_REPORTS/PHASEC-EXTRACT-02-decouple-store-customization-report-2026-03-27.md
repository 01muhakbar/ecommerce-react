TASK ID: PHASEC-EXTRACT-02
Status: PASS

Yang diamati

- `server/src/routes/store.customization.ts` sebelumnya masih import `sanitizeCustomization` dari `server/src/routes/admin.storeCustomization.ts`.
- Public-safe shaping untuk customization header, whitelist payload, dan microsite rich-about masih bercampur dengan helper route admin.
- `admin.storeCustomization.ts` juga memegang helper sanitization yang dipakai lintas konteks, sehingga boundary shared/public-safe belum netral.

Coupling utama yang dibongkar

- Dependency langsung:
  - `store.customization.ts` -> `admin.storeCustomization.ts`
- Source of truth public-safe shaping yang tadinya hidup di route admin sekarang dipindah ke service netral.

Cleanup yang dilakukan

- Menambahkan service netral:
  - `server/src/services/storeCustomizationSanitizer.ts`
- Memindahkan source of truth sanitization/shaping ke service itu:
  - sanitize full customization payload
  - parse stored customization payload
  - admin header shaping
  - public header shaping
  - microsite rich-about normalization
  - effective rich-about fallback shaping
  - WhatsApp link validation helper
- Mengupdate public route:
  - `server/src/routes/store.customization.ts`
  - sekarang hanya import service netral
  - tidak lagi import helper dari route admin
- Mengupdate admin route:
  - `server/src/routes/admin.storeCustomization.ts`
  - sekarang memakai helper yang sama dari service netral untuk sanitization, rich-about normalization, header shaping, dan WhatsApp validation

File yang diubah

- `server/src/services/storeCustomizationSanitizer.ts`
- `server/src/routes/store.customization.ts`
- `server/src/routes/admin.storeCustomization.ts`
- `CODEx_REPORTS/PHASEC-EXTRACT-02-boundary-summary-2026-03-27.md`
- `CODEx_REPORTS/PHASEC-EXTRACT-02-decouple-store-customization-report-2026-03-27.md`

Hasil verifikasi

- `pnpm --filter server build` PASS
- `pnpm --filter client build` PASS
- `store.customization.ts` tidak lagi bergantung pada `admin.storeCustomization.ts`
- Tidak ada circular import baru yang terdeteksi pada build
- Contract storefront tetap stabil karena public route tetap mengeluarkan payload yang sama secara shape

Dampak ke Seller / Admin / Client

- Seller
  - tidak ada perubahan flow
- Admin
  - admin customization CRUD tetap memakai sanitization yang sama, tetapi source of truth helper sudah netral
- Client
  - storefront/microsite tetap memakai public-safe customization payload, sekarang dari jalur yang lebih bersih boundary-nya

Risiko / debt / follow-up

- `admin.storeCustomization.ts` masih memuat helper normalisasi lama yang sekarang tidak lagi menjadi source of truth; ini debt internal, bukan regression runtime.
- Phase berikutnya bisa membersihkan dead code di route admin atau memecah service customization lebih lanjut menjadi:
  - shared sanitization
  - public shaping
  - admin-only mutation helpers

Butuh keputusan user?

- Tidak

# E2E-TRUTH-02

## Selector/hook yang ditambahkan

- `data-testid="checkout-preview-blocker-message"` untuk blocker summary checkout preview.
- `data-testid="checkout-preview-group-container-<storeId>"` untuk container group preview store.
- `data-testid="checkout-preview-group-payment-availability-<storeId>"` untuk label payment availability.
- `data-testid="checkout-preview-group-payment-profile-<storeId>"` untuk label readiness/payment profile snapshot.
- `data-testid="checkout-preview-group-blocked-reason-<storeId>"` untuk blocked reason per store ketika cabang itu aktif.
- `data-testid="checkout-invalid-item-<productId>"` dan `data-testid="checkout-invalid-item-message-<productId>"` untuk blocker invalid item.
- `data-testid="checkout-submit-cta"` untuk CTA submit utama.
- `data-testid="checkout-submit-blocker-message"` untuk helper reason submit blocker.
- `data-checkout-source` dipasang pada label readiness/payment dan blocked reason agar smoke bisa membedakan render dari meta backend vs fallback frontend.
- `data-checkout-reason` dipasang pada invalid item card agar smoke bisa mengunci reason code backend tanpa bergantung ke styling.

## Kenapa ini paling kecil dan aman

- Tidak ada redesign checkout UI.
- Tidak ada perubahan flow bisnis checkout.
- Tidak ada perubahan contract API.
- Hook yang ditambahkan hanya atribut non-visual pada render yang sudah ada.
- QA harness tidak diganti; hanya smoke existing yang diperkaya.
- Untuk lane browser POST preview yang masih kena mismatch CORS di harness dev, smoke sekarang fulfill `/api/checkout/preview` dari backend truth yang sama via `buyerClient`, jadi DOM tetap mengunci source of truth tanpa refactor besar framework.

## File yang diubah

- `client/src/pages/store/Checkout.jsx`
- `tools/qa/e2e-truth-smoke.ts`

## Assertion baru yang tercakup

- Client checkout mengunci label `payment availability` langsung dari DOM.
- Client checkout mengunci label `payment profile/readiness snapshot` langsung dari DOM.
- Client checkout mengunci `data-checkout-source` untuk membedakan render meta backend vs fallback.
- Client checkout mengunci fallback behavior saat `paymentAvailabilityMeta` dan `paymentProfileStatusMeta` tidak tersedia.
- Client checkout mengunci invalid item helper reason dari DOM.
- Client checkout mengunci submit blocker helper dan state disabled pada CTA utama.
- Admin payment audit tetap mengunci order status + payment state pada list.
- Seller order detail tetap mengunci seller status + split payment state.

## Residual risk

- Browser POST live ke `/api/checkout/preview` dan `/api/cart/add` di harness dev masih bisa jatuh ke `CORS origin not allowed`; smoke sekarang menghindari drift itu dengan route fulfill untuk preview, tetapi akar dev-proxy/CORS mismatch belum dibereskan di aplikasi runtime test harness.
- Checkout blocked reason per-store tidak selalu aktif di cabang DOM saat store berubah menjadi invalid item; pada state itu smoke mengunci invalid item helper + submit blocker helper yang memang menjadi source of truth aktif.
- Ada artefak upload fixture yang bisa muncul dari smoke di `server/uploads/products/`; itu bukan bagian patch aplikasi.

## Next task paling logis

- Hardening harness dev POST lane supaya browser request live ke `/api/cart/add` dan `/api/checkout/preview` tidak lagi terkena mismatch CORS/proxy, sehingga smoke client bisa sepenuhnya memakai network path browser tanpa route fulfill.

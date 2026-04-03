# PUBLIC-AUTH-NAV-HONESTY-01 Report

## 1. Summary perubahan

Task ini mengaudit CTA auth publik aktif dan merapikan route yang masih berpotensi misleading saat user diarahkan ke login. Fokus patch ada pada lane checkout, cart unauthorized redirect, header account/notifications entry points, dan fallback buyer protected route agar user tidak lagi mengalami silent redirect tanpa intent yang jelas.

Patch utama:

- menambahkan helper kecil `client/src/auth/loginRedirectState.ts` untuk menyatukan `from` dan notice login-required
- `AccountGuard` sekarang memberi fallback notice login-required yang jujur bila user masuk ke route buyer protected tanpa session aktif
- checkout redirects ke login sekarang selalu membawa intent `continue checkout`
- cart unauthorized redirect sekarang membawa `from` dan notice yang lebih jujur
- account/notifications CTA publik sekarang menuju protected route yang benar sehingga guard bisa menjaga return flow
- fallback link login di account orders/reviews kini membawa state redirect yang benar

## 2. Mismatch yang ditemukan

- beberapa CTA publik ke login hanya memindahkan user ke `/auth/login` tanpa notice atau target return yang jelas
- account entry point dari header membuka login langsung, bukan route protected target yang sebenarnya ingin diakses user
- notifications CTA publik juga langsung ke login, sehingga return intent ke lane notifications tidak tercatat
- checkout punya beberapa redirect ke login dengan `from`, tetapi notice login-required belum konsisten
- akses route buyer protected langsung dari CTA publik masih bisa terasa seperti silent redirect bila bukan kasus session-expired

## 3. File yang diubah

- `client/src/auth/loginRedirectState.ts`
- `client/src/auth/authSessionNotice.d.ts`
- `client/src/components/AccountGuard.jsx`
- `client/src/components/kachabazar-demo/HeaderActions.jsx`
- `client/src/components/user/UserNotificationsPopup.jsx`
- `client/src/hooks/useCart.ts`
- `client/src/pages/store/Checkout.jsx`
- `client/src/pages/account/AccountOrdersPage.jsx`
- `client/src/pages/account/AccountMyReviewPage.jsx`

## 4. Dampak patch

### Checkout

- redirect ke login dari checkout kini membawa notice yang jelas: user harus sign in untuk melanjutkan checkout
- `from` tetap mengarah ke `/checkout`, jadi return flow setelah login tetap akurat

### Cart / add-to-cart unauthorized

- saat remote cart session tidak valid, redirect ke login kini membawa intent `continue with your cart`
- pending add tetap dipertahankan, jadi user tidak kehilangan konteks add-to-cart

### Header account / notifications

- CTA account publik kini menuju `/user/my-account`
- CTA notifications publik kini menuju `/user/notifications`
- buyer guard yang mengurus redirect ke login, sehingga target return setelah login lebih jujur dan tidak lagi hilang

### Buyer protected fallback

- `AccountGuard` kini menambahkan notice login-required default bila tidak ada pending auth notice lain
- akses buyer protected route dari CTA publik tidak lagi terasa seperti silent redirect

## 5. Verifikasi

### Build

- `pnpm -F client build` ✅

### QA/smoke

- `pnpm qa:auth:frontend` ✅

Catatan:

- smoke auth frontend yang sudah ada tetap hijau setelah patch redirect state ini
- verifikasi tambahan dilakukan lewat audit manual pada lane checkout, cart unauthorized redirect, header account CTA, dan notifications CTA

## 6. Risiko / residual issue

- task ini belum menambahkan smoke browser-level khusus untuk CTA checkout/cart/account entry point; coverage saat ini masih kombinasi smoke auth umum + audit kode
- CTA login publik murni seperti link `Login` di top bar tetap sederhana dan tidak membawa intent return tertentu; ini diterima karena bukan login-required redirect
- seller layout punya link storefront login tersendiri, tetapi tidak saya ubah karena bukan lane client publik prioritas task ini

## 7. Saran task berikutnya

- lanjutkan `AUTH-RATE-LIMIT-QA-SMOKE-EXTEND-01`
- bila ingin coverage lebih eksplisit, tambahkan smoke frontend kecil untuk CTA checkout/account/notifications login-required redirect

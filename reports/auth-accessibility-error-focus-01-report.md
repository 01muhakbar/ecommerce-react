# AUTH-ACCESSIBILITY-ERROR-FOCUS-01 Report

## 1. Summary perubahan

Task ini merapikan aksesibilitas dan error focus management di route auth aktif agar notice dan field error lebih usable untuk keyboard, mobile, dan screen reader.

Perubahan utama:

- Menambahkan komponen kecil `client/src/components/auth/AuthNotice.jsx` untuk notice auth dengan `role`, `aria-live`, dan focus target yang konsisten.
- Menambahkan focus ring dan `title` pada tombol toggle password agar lebih jelas untuk keyboard dan pointer users.
- Menambahkan `aria-live="polite"` pada password strength indicator.
- Menyambungkan label, field, helper, dan error lewat `htmlFor`, `id`, `aria-invalid`, dan `aria-describedby`.
- Menambahkan focus management ringan agar error utama atau notice penting menjadi lebih mudah ditemukan setelah submit gagal atau state penting berubah.

Task ini tidak mengubah contract API besar.
Task ini tidak melakukan redesign UI besar.

## 2. Route yang diaudit

- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
- `client/src/pages/store/StoreResetPasswordPage.jsx`
- `client/src/pages/account/AccountChangePasswordPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

## 3. Gap yang ditemukan

- Notice success/error/cooldown sebelumnya belum punya `aria-live` yang konsisten.
- Beberapa label auth aktif belum terhubung eksplisit ke input melalui `htmlFor`.
- Field error belum selalu menjadi target fokus yang jelas setelah submit gagal.
- Password toggle belum punya focus styling yang cukup jelas untuk keyboard.
- Password strength indicator belum diumumkan sebagai status yang berubah.

## 4. Patch yang diterapkan

### Shared components

- `client/src/components/auth/AuthNotice.jsx`
  - memberi `role="status"` atau `role="alert"`
  - memakai `aria-live`
  - bisa dijadikan target fokus lewat `tabIndex={-1}`

- `client/src/components/auth/PasswordVisibilityButton.jsx`
  - menambah focus-visible ring
  - menambah `title`

- `client/src/components/auth/PasswordStrengthIndicator.jsx`
  - menambah `role="status"` dan `aria-live="polite"`

### Auth pages

- Login
  - status/error notice sekarang focusable dan dibacakan dengan benar
  - label email/password dihubungkan ke input
  - helper password dihubungkan ke input

- Register
  - field register/verify sekarang punya id, `aria-invalid`, dan helper/error linkage
  - fokus berpindah ke field pertama yang error atau ke notice penting

- Forgot password
  - email field error menjadi target fokus
  - notice success/error/cooldown dibacakan dengan `aria-live`

- Reset password
  - password/confirm password sekarang punya linkage helper/error yang jelas
  - invalid token/incomplete link state memakai notice aksesibel yang sama

- Change password
  - validation message menjadi `role="alert"`
  - submit gagal akan memfokuskan field paling relevan
  - success/error notice sekarang fokusable dan dibacakan

- Admin login
  - auth notice dan login error memakai notice aksesibel yang sama

## 5. File yang diubah

- `client/src/components/auth/AuthNotice.jsx`
- `client/src/components/auth/PasswordVisibilityButton.jsx`
- `client/src/components/auth/PasswordStrengthIndicator.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/store/StoreRegisterPage.jsx`
- `client/src/pages/store/StoreForgotPasswordPage.jsx`
- `client/src/pages/store/StoreResetPasswordPage.jsx`
- `client/src/pages/account/AccountChangePasswordPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

## 6. Verifikasi

### Build

- `pnpm -F client build` ✅

### QA/manual

- Audit manual dilakukan pada:
  - notice success/error/cooldown
  - keyboard focus ke error/notice
  - label to input association
  - password toggle keyboard focus
  - helper text linkage

## 7. Risiko / residual issue

- Focus management saat ini sengaja ringan; tidak semua state memaksa fokus berpindah agar flow tidak terasa agresif.
- Task ini belum menambahkan automated a11y check atau frontend smoke khusus.
- Social login placeholder buttons tetap tidak disentuh karena di luar scope.

## 8. Saran task berikutnya

- Lanjut ke `AUTH-FRONTEND-QA-SMOKE-01` agar route auth aktif punya regression coverage yang eksplisit untuk notice, error, dan expired-session flow.
- Jika ingin hardening lebih lanjut, tambahkan audit focus order dan landmark semantics di layout auth aktif.

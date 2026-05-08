# AUTH-SESSION-EXPIRY-CLIENT-HONESTY-01 Report

## 1. Summary perubahan

Task ini merapikan handling client saat sesi/JWT lama menjadi invalid setelah backend menolak request dengan `401` atau `403`.

Perubahan utama:

- Menambahkan helper kecil `client/src/auth/authSessionNotice.js` untuk menyimpan dan membaca notice sesi berakhir secara konsisten.
- Memperluas unauthorized event agar membawa payload reason sederhana (`status`, `code`, `message`).
- `AuthContext` sekarang menyimpan notice yang jujur sebelum membersihkan sesi ketika probe `/auth/me` atau interceptor menemukan sesi tidak valid.
- `AccountGuard` dan `AdminGuard` sekarang mengarahkan ke login sambil membawa notice sesi, bukan hanya redirect kosong.
- Halaman login client dan admin login sekarang membaca notice itu secara konsisten.

Task ini tidak mengubah contract API besar.
Task ini tidak melakukan redesign UI besar.
Task ini tidak mengubah backend auth flow.

## 2. Source of truth yang diaudit

- `client/src/auth/AuthContext.jsx`
- `client/src/auth/authEvents.ts`
- `client/src/api/axios.ts`
- `client/src/components/AccountGuard.jsx`
- `client/src/components/AdminGuard.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

Temuan awal:

- unauthorized event hanya membersihkan sesi tanpa membawa penjelasan ke user
- guard melakukan redirect ke login tanpa notice
- stale session saat startup bisa hilang diam-diam saat `/auth/me` gagal
- hasilnya user bisa tiba di login tanpa konteks mengapa ia dikeluarkan

## 3. Patch yang diterapkan

### Auth session notice helper

Menambahkan:

- `client/src/auth/authSessionNotice.js`

Helper ini menangani:

- menyimpan pending auth notice
- membaca pending notice untuk redirect ke login
- menghapus notice setelah dibaca
- menormalkan pesan default untuk kasus session expired

### Unauthorized event + interceptor

- `client/src/auth/authEvents.ts`
- `client/src/api/axios.ts`

Perubahan:

- `triggerUnauthorized` sekarang bisa membawa payload reason
- interceptor axios mengirim status/code/message sederhana saat request non-`/auth/me` terkena `401`

### AuthContext

- `client/src/auth/AuthContext.jsx`

Perubahan:

- saat probe sesi awal gagal karena unauthorized, context menyimpan notice lalu clear session
- saat unauthorized event global datang, context menyimpan notice yang sama lalu clear session
- ini menutup gap ketika token lama invalid tetapi client sebelumnya hanya jatuh ke state logout tanpa penjelasan

### Guard dan login surfaces

- `client/src/components/AccountGuard.jsx`
- `client/src/components/AdminGuard.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

Perubahan:

- guard membaca pending notice dan meneruskannya ke login via state
- login client/admin membaca notice dari state atau storage helper
- notice dihapus setelah dipakai agar tidak memicu pesan palsu saat user sengaja membuka login

## 4. File yang diubah

- `client/src/auth/authSessionNotice.js`
- `client/src/auth/authEvents.ts`
- `client/src/api/axios.ts`
- `client/src/auth/AuthContext.jsx`
- `client/src/components/AccountGuard.jsx`
- `client/src/components/AdminGuard.jsx`
- `client/src/pages/store/StoreLoginPage.jsx`
- `client/src/pages/admin/AdminLoginPage.jsx`

## 5. Mismatch yang diperbaiki

- Session invalid sebelumnya bisa membersihkan auth state tanpa notice yang jelas.
- Redirect ke login sebelumnya tidak membawa alasan yang konsisten.
- Probe sesi awal saat startup sebelumnya bisa gagal diam-diam pada stale token.
- Guard aktif sekarang tidak lagi mengarahkan user ke login dalam keadaan ambigu tanpa penjelasan.

## 6. Verifikasi

### Build

- `pnpm -F client build` ✅

### Smoke

- `pnpm -F server smoke:auth-session-invalidation` ✅
- `pnpm -F server smoke:auth-forgot-password` ✅

### QA/manual

- Audit alur session-expired dilakukan pada:
  - probe session awal dari `AuthContext`
  - unauthorized event dari interceptor
  - redirect account guard ke `/auth/login`
  - redirect admin guard ke `/admin/login`

## 7. Risiko / residual issue

- Task ini tidak menambahkan frontend smoke khusus redirect notice, jadi verifikasi notice masih berbasis audit kode + build.
- Unauthorized dari route publik yang memang opsional tetap bisa membersihkan sesi jika request itu memakai jalur auth dan backend mengembalikan `401`; ini sesuai hardening saat ini, tetapi bisa diaudit lagi bila nanti ada edge case tertentu.
- Admin login masih redirect ke `/admin` setelah sukses, belum mengembalikan user ke route admin asal. Ini bukan blocker task ini.

## 8. Saran task berikutnya

- Lanjut ke `AUTH-ACCESSIBILITY-ERROR-FOCUS-01`.
- Setelah itu, tambahkan QA/smoke frontend auth kecil agar redirect notice dan expired-session behavior punya regression coverage yang lebih eksplisit.

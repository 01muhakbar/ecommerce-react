# ADMIN-PUBLIC-AUTH-LIVE-END-TO-END-SUBSET-01 Report

## 1. Summary perubahan

Task ini menambahkan smoke browser live kecil untuk jalur approval staff admin public auth terhadap backend lokal yang sehat. Coverage yang dibuktikan:

- create account staff lewat browser live
- verify valid menghasilkan `pending_approval`
- login tetap ditolak saat `pending_approval`
- approve dijalankan dari halaman `All Accounts`
- login diizinkan setelah approval

Smoke live ini tidak mengganti backend smoke yang sudah ada. Delivery email verify/reset tetap dibuktikan oleh smoke backend `smoke:admin-public-auth`, sedangkan smoke baru fokus pada subset browser + backend nyata yang paling kritis untuk workflow approval.

## 2. Desain subset live yang dipilih

Desain yang dipakai:

- backend app lokal dijalankan langsung pada `http://127.0.0.1:3001`
- client dev server dijalankan pada `http://localhost:5173`
- browser smoke memakai Playwright headless
- create account tetap dilakukan lewat UI browser
- token verify valid untuk subset ini diterbitkan langsung sebagai fixture DB yang sah setelah create account berhasil
- approval tetap dilakukan lewat UI `All Accounts`

Alasan desain ini:

- menjaga smoke tetap live terhadap backend lokal, route aktif, auth guard, dan UI approval
- menghindari ketergantungan rapuh pada parsing email di browser subset
- tetap konsisten dengan boundary task karena delivery email sudah dicakup oleh smoke backend yang lebih tepat untuk lane mail

## 3. File yang diubah

- `tools/qa/admin-public-auth-live-subset.ts`
- `reports/admin-public-auth-live-end-to-end-subset-01-report.md`

## 4. Verifikasi yang dijalankan

- `pnpm -F server build`
- `pnpm -F client build`
- `pnpm qa:admin:public-auth:live`

Hasil:

- build server ✅
- build client ✅
- smoke live subset ✅

## 5. Coverage yang lolos

- create account success path di browser live ✅
- verify valid -> `pending_approval` ✅
- login blocked before approval ✅
- approve via `All Accounts` ✅
- login allowed after approval ✅

## 6. Risiko / residual issue

- Smoke browser live ini masih subset kecil, belum mencakup forgot/reset password admin.
- Token verify untuk subset live ini di-fixture langsung di DB agar flow approval browser tetap stabil; delivery email nyata tetap diverifikasi oleh smoke backend terpisah.
- Smoke mengasumsikan port `3001` dan `5173` tersedia pada environment lokal sehat.

## 7. Rekomendasi task berikutnya

- Tambahkan live subset kecil berikutnya untuk admin public auth reset password bila diperlukan.
- Jika ingin coverage lebih kuat lagi, tambahkan bootstrap mail stub yang benar-benar bisa diassert di browser live tanpa membuat smoke approval menjadi rapuh.

# TASK-2 Perluas QA MVF untuk Sinkronisasi Status Order ke Account Area

Date: 2026-03-07 (Asia/Singapore)  
Workspace: `C:\Users\user\Documents\ecommerce-react`

## CODEx REPORT

### Ringkasan

- `qa:mvf` diperluas tanpa mengubah kontrak API atau logic bisnis order.
- Automation sekarang memverifikasi loop penuh setelah admin update status:
  - tracking endpoint membaca status terbaru
  - account orders list membaca status terbaru
  - account order detail membaca status terbaru
- Perubahan tetap terlokalisir pada script QA dan dokumentasi.

### Coverage Sebelum Task

- Sudah tercakup:
  - store home/search/product route
  - register/login store user
  - add to cart
  - checkout create order
  - tracking API/route sebelum sync balik
  - admin login
  - admin orders list/search/filter/detail
  - admin update status
  - admin refresh persist
- Belum tercakup otomatis:
  - `/api/store/my/orders` setelah admin update status
  - `/api/store/orders/my/:id` setelah admin update status
  - tracking status re-check setelah admin update status

### Coverage Sesudah Task

- Tambahan assertion baru di `qa:mvf`:
  - `store_tracking_status_sync`
  - `account_orders_status_sync`
  - `account_order_detail_status_sync`
- Script juga sekarang menyimpan `generatedOrderId` selain `generatedOrderRef` agar chaining ke account detail stabil.

### File yang diubah

- `tools/qa/mvf-smoke.ps1`
- `MVP_TEST_SCRIPT.md`
- `CODEx_REPORTS/TASK-2.md`

### Alasan Implementasi

- Saya reuse jalur data yang sudah ada di script:
  - checkout response untuk `orderRef` dan `orderId`
  - admin patch response untuk `newStatus`
  - store session yang sama untuk account endpoints
- Assertion dipusatkan di API, bukan UI browser, supaya coverage stabil dan tidak rapuh terhadap perubahan markup.
- Tidak perlu dependency baru, helper baru, atau refactor framework QA.

### Detail Perubahan

- `tools/qa/mvf-smoke.ps1`
  - menangkap `orderId` dari response checkout
  - menambahkan re-check tracking API setelah admin update status
  - menambahkan verifikasi `/api/store/my/orders`
  - menambahkan verifikasi `/api/store/orders/my/:id`
  - menulis `generatedOrderId` ke artifact JSON
- `MVP_TEST_SCRIPT.md`
  - menyelaraskan checklist manual dengan coverage automation terbaru
  - menandai area yang masih manual secara jujur

### Verifikasi

- [x] Build
  - `pnpm --filter client exec vite build`
- [x] Smoke
  - `pnpm qa:mvf`
  - Hasil: PASS
  - Artifact:
    - `.codex-artifacts/qa-mvf/20260307-123210/result.json`
    - `.codex-artifacts/qa-mvf/20260307-123210/summary.txt`

### Hasil

`PASS`

### Gap yang Masih Belum Ter-cover

- `qa:mvf` masih memvalidasi account area lewat API, belum visual/UI browser assertion untuk:
  - `/user/my-orders`
  - `/user/my-orders/:id`
- Session expiry UX di account area masih manual.

### Catatan Risiko

- Script mengandalkan response checkout yang tetap mengembalikan `id` dan `invoiceNo/ref`. Ini bukan perubahan baru; hanya reuse kontrak yang sudah ada.
- Jika nanti endpoint account list/detail berubah shape, assertion baru akan fail lebih cepat, yang justru diinginkan untuk deteksi regresi.

### Rekomendasi TASK-3

- Task paling aman berikutnya:
  - perluas QA dari API smoke ke UI smoke terbatas untuk `/user/my-orders` dan `/user/my-orders/:id`
  - tetap minim, cukup memastikan halaman render dan badge status sesuai data backend tanpa membuat harness Playwright besar baru

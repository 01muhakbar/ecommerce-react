# P0.4 E2E Truth Playwright Report

Tanggal: 2026-05-13

## Ringkasan

Environment blocker `qa:e2e:truth` berhasil dihapus.

Penyebab blocker sebelumnya:

- Playwright package sudah tersedia di repo (`playwright@1.58.2`), tetapi Chromium browser binary belum terpasang di cache lokal user.
- Error sebelumnya menunjuk ke missing executable:
  `C:\Users\AKBAR CAHAYA STUDIO\AppData\Local\ms-playwright\chromium_headless_shell-1208\chrome-headless-shell-win64\chrome-headless-shell.exe`

Perbaikan environment yang dijalankan:

- `pnpm.cmd exec playwright install chromium`

Hasil:

- Chromium, Chrome Headless Shell, FFmpeg, dan Winldd berhasil diunduh ke:
  `C:\Users\AKBAR CAHAYA STUDIO\AppData\Local\ms-playwright`
- `pnpm.cmd qa:e2e:truth` sekarang PASS.

## Script yang Dicek

Root `package.json`:

- `qa:e2e:truth`: `tsx ./tools/qa/e2e-truth-smoke.ts`

Playwright:

- `pnpm.cmd exec playwright --version`: `Version 1.58.2`

## App Code

Tidak ada app code yang diubah untuk P0.4.

Task ini hanya melakukan setup environment Playwright browser dan membuat report.

## Validasi yang Dijalankan

- `pnpm.cmd exec playwright --version`
- `pnpm.cmd exec playwright install chromium`
- `pnpm.cmd qa:e2e:truth`
- `pnpm.cmd -F server build`
- `pnpm.cmd -F client build`
- `pnpm.cmd -F server smoke:product-visibility`
- `pnpm.cmd -F server smoke:checkout-variants`
- `pnpm.cmd -F server smoke:checkout-coupons`

## Hasil Validasi

- PASS: `pnpm.cmd exec playwright --version`
  - Output: `Version 1.58.2`
- PASS: `pnpm.cmd exec playwright install chromium`
- PASS: `pnpm.cmd qa:e2e:truth`
  - Suite berjalan sampai `[e2e-truth] OK`
  - Skenario yang lewat mencakup guest login recovery, client checkout browser assertions, approved order backend setup, admin payment audit, seller order, dan shipment browser assertions.
- PASS: `pnpm.cmd -F server build`
- PASS: `pnpm.cmd -F client build`
  - Catatan: Vite masih memberi warning chunk `vendor-misc` > 500 kB; ini warning existing, bukan blocker P0.4.
- PASS: `pnpm.cmd -F server smoke:product-visibility`
- PASS: `pnpm.cmd -F server smoke:checkout-variants`
- PASS: `pnpm.cmd -F server smoke:checkout-coupons`

## Klasifikasi

- Status P0.4: PASS
- Blocker sebelumnya: environment blocker
- App blocker: tidak ditemukan dalam run ini

## Risiko Tersisa

- Browser binary Playwright terpasang di cache lokal user Windows. Environment CI/mesin lain tetap perlu menjalankan `pnpm exec playwright install chromium` sebelum `qa:e2e:truth`.
- `qa:e2e:truth` menampilkan warning Node `[DEP0190]` dari child process dengan `shell: true`; ini warning tooling existing dan tidak menggagalkan suite.
- Build client masih punya warning ukuran chunk existing.

## Next Task Disarankan

1. Dokumentasikan bootstrap lokal/CI: `pnpm exec playwright install chromium`.
2. Jika CI Linux digunakan, tambahkan step `pnpm exec playwright install-deps chromium` sebelum install browser.
3. Pertimbangkan follow-up tooling untuk warning Node `[DEP0190]` di `tools/qa/e2e-truth-smoke.ts`, terpisah dari P0.4.

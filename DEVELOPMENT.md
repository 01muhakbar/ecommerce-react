# Development Notes

## Baseline Command Discipline

Gunakan urutan ini sebagai baseline operasional sesi development dan sesi Codex:

1. Install dependency:

```bat
pnpm install
```

2. Verifikasi DB lokal:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1
```

3. Jika butuh baseline data bersih:

```bat
pnpm --filter server db:reset
pnpm --filter server seed:demo
```

4. Jalankan seluruh stack:

```bat
pnpm dev
```

5. Jalankan stack parsial bila memang perlu:

```bat
pnpm dev:server
pnpm dev:client
```

6. Verifikasi build/QA:

```bat
pnpm --filter client exec vite build
pnpm qa:mvf
```

### Catatan Baseline

- `pnpm dev` adalah command utama untuk sesi harian.
- `seed:demo` adalah seed baseline yang paling aman karena menyiapkan super admin dan demo katalog.
- Hasil `qa:mvf` disimpan di `.codex-artifacts/qa-mvf/<runId>/`.
- Jika `mysql` tidak ada di PATH, `scripts/db-health.ps1` akan mencoba fallback ke `c:\xampp\mysql\bin\mysql.exe`.

## Port Hygiene (Windows)

If `pnpm dev` reports `Port 5173 is already in use`, use this flow:

1. Check which process is using port `5173`:

```bat
netstat -ano | findstr :5173
```

2. Stop the process by PID:

```bat
taskkill /PID <pid> /F
```

3. Safer option: close the previous terminal tab/window that is still running Vite.

## Vite Port Behavior

Client Vite dev server is configured with:

- `port: 5173`
- `strictPort: false`

So if `5173` is busy, Vite can automatically move to the next port (for example `5174`) instead of failing immediately.

## DB Health Gate (Before `pnpm dev`)

### Prerequisites

- MariaDB/MySQL must be running (XAMPP MySQL module or equivalent local service).
- Local env must be set for server DB access (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`).

### Quick Health Checks

1. Check DB connection directly:

```bat
mysql -u root -e "SELECT 1"
```

Expected: query returns `1` and exits without error.

2. If server is already running, verify API DB status:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
```

Expected response body includes `"ok":true` and `"db":"connected"`.

3. Optional repeatable check script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\db-health.ps1
```

## DB Migrations

Run migrations with:

```bat
pnpm --filter server migrate
```

Notes:

- Migration runner now auto-detects and runs all `server/migrations/*.cjs` (and `.sql`) in filename order.
- Already applied migrations are skipped automatically using the `migrations` registry table.
- No `CJS_MIGRATIONS` env is required for normal usage.
- Optional compatibility mode remains available: set `CJS_MIGRATIONS=file1.cjs,file2.cjs` to run only specific `.cjs` files.
- Legacy fix: `20250823100000-add-userId-to-products.cjs` is idempotent and safe for old data.
  It keeps `products.userId` nullable, backfills invalid refs to `NULL`, then applies FK with
  `ON DELETE SET NULL` and `ON UPDATE CASCADE`.
- If old DB previously failed on that migration, re-run:
  `pnpm --filter server migrate`
- For local development cleanup, `pnpm --filter server db:reset` is still recommended.

## Common Error: `mysql.proxies_priv` Corrupt (XAMPP/MariaDB)

### Typical Symptoms

- App side: `SequelizeConnectionError`, `ETIMEDOUT`, `ECONNREFUSED` during startup.
- MariaDB log shows:
  - `Index for table '.\mysql\proxies_priv' is corrupt`
  - `Can't open and lock privilege tables`

### Recovery (Manual, Safe)

1. Stop MySQL/MariaDB first (XAMPP Control Panel or kill `mysqld.exe`).
2. Backup current privilege table files before any restore:

```powershell
Copy-Item c:\xampp\mysql\data\mysql\proxies_priv.frm c:\xampp\mysql\data\_repair_backup_<timestamp>\
Copy-Item c:\xampp\mysql\data\mysql\proxies_priv.MAD c:\xampp\mysql\data\_repair_backup_<timestamp>\
Copy-Item c:\xampp\mysql\data\mysql\proxies_priv.MAI c:\xampp\mysql\data\_repair_backup_<timestamp>\
```

3. Restore clean copies from XAMPP backup:

```powershell
Copy-Item -Force c:\xampp\mysql\backup\mysql\proxies_priv.frm c:\xampp\mysql\data\mysql\proxies_priv.frm
Copy-Item -Force c:\xampp\mysql\backup\mysql\proxies_priv.MAD c:\xampp\mysql\data\mysql\proxies_priv.MAD
Copy-Item -Force c:\xampp\mysql\backup\mysql\proxies_priv.MAI c:\xampp\mysql\data\mysql\proxies_priv.MAI
```

4. Start MySQL again.
5. Verify after fix:

```bat
mysql -u root -e "SELECT 1"
```

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
```

6. Then run dev normally:

```bat
pnpm dev
```

### Safety Notes

- Do not automate DB file repair in app scripts.
- Always keep a timestamped backup before replacing system table files.

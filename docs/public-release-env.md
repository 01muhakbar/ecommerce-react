# Public Release Gate Environment

Use this setup when running:

```bash
pnpm qa:public-release
```

The gate reads environment variables from the process. It loads `.env` by default, and can load a dedicated release file when `PUBLIC_RELEASE_SMOKE_ENV_FILE` is set.

## Recommended Local/Staging Setup

1. Create a separate MySQL database for release smoke validation.

```sql
CREATE DATABASE ecommerce_public_release;
CREATE USER 'public_release_user'@'localhost' IDENTIFIED BY 'replace_password';
GRANT ALL PRIVILEGES ON ecommerce_public_release.* TO 'public_release_user'@'localhost';
FLUSH PRIVILEGES;
```

2. Copy the example env file and fill real credentials.

```bash
cp .env.public-release.example .env.public-release
```

3. Run the gate with the dedicated env file.

PowerShell:

```powershell
$env:PUBLIC_RELEASE_SMOKE_ENV_FILE=".env.public-release"
pnpm qa:public-release
Remove-Item Env:PUBLIC_RELEASE_SMOKE_ENV_FILE
```

Bash:

```bash
PUBLIC_RELEASE_SMOKE_ENV_FILE=.env.public-release pnpm qa:public-release
```

## Required Variables

Use either:

- `DATABASE_URL`

Or all of:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

Also required:

- `JWT_SECRET`
- `AUTH_COOKIE_NAME`

Recommended for staging/public proof:

- `COOKIE_SECURE`
- `CLIENT_URL` or `CORS_ORIGIN`
- `PUBLIC_BASE_URL` or `CLIENT_PUBLIC_BASE_URL` or `STORE_PUBLIC_BASE_URL`
- `UPLOAD_DIR`

## Current Failure Pattern

If the gate reports:

```text
DB readiness failed: access denied for root@localhost:3306/ecommerce_dev
```

then the gate is using the local development DB credentials from the active environment. Do not change application logic for this. Provide a valid `DATABASE_URL` or DB user/password for a dedicated release smoke database, then rerun the gate.

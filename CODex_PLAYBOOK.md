# CODex Playbook

## Cara Run
1. Install deps: `pnpm install`
2. Dev mode (server + client): `pnpm dev`

## Port Default
- Server: `http://localhost:3001`
- Client: `http://localhost:5173`

## Setup ENV
1. Copy contoh env: `copy .env.example .env`
2. Edit `.env` sesuai lokal (terutama DB creds)
3. Pastikan proxy API di client memakai `VITE_API_BASE=/api`

## DB Reset + Seed (Demo)
Jalankan berurutan:
1. `pnpm --filter server db:reset`
2. `pnpm --filter server seed:super`
3. `pnpm --filter server seed:demo`

## Batasan Keras Sebelum Refactor Besar
Refactor besar hanya boleh dilakukan setelah membuat "Rencana Kolaborasi" (ringkas + bertahap + aman).

# Ledger Accounting Software

Professional desktop-style accounting application for Crown King, tracking partner investments, expenses, petty cash, joint income, and settlement summaries.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/ledger run dev` — run the React frontend (managed by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Optional env: `SQLITE_DATA_DIR` — override SQLite data directory (default: `artifacts/api-server/data/`)

## Electron Desktop App

### Development

```sh
pnpm electron:dev
```

This single command: builds the Electron scripts, starts the API server (port 8080) + Vite dev server (port 5173) via concurrently, then launches Electron once both servers are ready. Requires a display (run on Windows/macOS with a desktop environment).

### Build Windows Installer

Before building the Windows `.exe`, install `electron-builder` once:

```sh
pnpm --filter @workspace/electron add -D electron-builder
```

Then build:

```sh
pnpm electron:build:win
```

Output: `artifacts/electron/dist-win/` — contains the NSIS installer (`.exe`).

**Note on cross-compilation:** Building the Windows installer from Linux requires `better-sqlite3` prebuilt Windows binaries. electron-builder will attempt to download them automatically. If that fails, run `pnpm electron:build:win` on a Windows machine instead.

### How it works

- **Dev mode**: Electron loads `http://localhost:5173` (Vite dev server). The Vite proxy forwards `/api/…` to Express on port 8080.
- **Production mode**: Electron spawns the bundled Express server as a child process (using `ELECTRON_RUN_AS_NODE=1`). Express serves both the API (`/api`) and the built React frontend on port 8080. Electron loads `http://localhost:8080`.
- **Data directory**: In production, SQLite + backups live in `%APPDATA%/Crown King Ledger/ledger-data/`.
- **Backup restore**: When the API server calls `process.exit(0)` after a restore, the Electron main process detects the exit, restarts the server, and reloads the window automatically.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5
- DB: SQLite (better-sqlite3) — offline-first, WAL mode, crash-safe
- Validation: Zod (v3), Orval-generated schemas
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Build: esbuild

## Where things live

- `artifacts/ledger/` — React frontend (all UI pages)
- `artifacts/ledger/src/pages/` — page components (Dashboard, Backup, etc.)
- `artifacts/ledger/src/components/layout/AppLayout.tsx` — sidebar + header shell
- `artifacts/api-server/src/lib/database.ts` — SQLite init, schema, partner seed
- `artifacts/api-server/src/routes/` — REST API routes (partners, dashboard, backup)
- `artifacts/api-server/data/ledger.db` — live SQLite database
- `artifacts/api-server/data/backups/` — manual backup files
- `lib/api-spec/openapi.yaml` — source of truth for API contract

## Architecture decisions

- SQLite (better-sqlite3) is the persistence layer — no external database required; WAL mode + `synchronous=NORMAL` gives crash safety with good write throughput.
- Partners (Yasir 42.5%, Khurram 57.5%) are seeded once at startup in `artifacts/api-server/src/lib/database.ts` and are not user-editable by design.
- The `lib/db` Drizzle/PostgreSQL package is present but NOT used by the API server — the API uses better-sqlite3 directly. `lib/db` can be ignored unless migrating to Postgres.
- Node.js 24 is required — better-sqlite3 v13 uses NAPI 10 and segfaults silently on Node.js 20.

## Product

Crown King accounting app with modules for: Partner Investments, Partner Direct Expenses, Petty Cash Given, Accountant Expenses, Joint Company Income, Excel/CSV bulk import, Reports, Final Summary & Settlement, Backup & Restore, and a Dashboard summarising all financial totals.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Node.js 24 required** — better-sqlite3 v13 segfaults silently on Node.js 20/22. Always use `nodejs-24` module (installed).
- The CSS theme (`artifacts/ledger/src/index.css`) still has all colour tokens set to `red` (placeholder). The app works but will look broken until real HSL values are filled in.
- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `lib/api-spec/openapi.yaml` before using the updated hooks.
- **electron-builder is not pre-installed** (blocked by Replit's package firewall due to a transitive CVE-flagged dependency). Install it on-demand with `pnpm --filter @workspace/electron add -D electron-builder` when you're ready to build the Windows `.exe`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

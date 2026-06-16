# KARNEX AI HR — Frontend (UI)

**Release:** Version 1.0.0

This repo contains **only the UI** for the KARNEX AI Interview Suite. All API, AI, database, and Docker/microservices code lives in the sibling backend repo:

`D:\AI-Interview-Model-B-V2`

## Project Structure

- `frontend/` — Single-page HR/candidate UI (HTML + modular JS)
- `frontend/js/` — `app`, `hr`, `candidate`, `results`, `core`, `state`, etc.
- `frontend/admin-dashboard/` — React admin dashboard (Vite; built to `dist/`, served at `/admin`)
- `start_frontend.bat` — Build admin UI or run Vite dev (`--dev`)
- `start_app.bat` — Alias for `start_frontend.bat` (build only)
- `docs/BACKEND_CONNECTION.md` — Full setup and API connection guide

## Quick Start (Windows)

**Step 1 — build UI (this repo):**
```bat
cd D:\AI-Interview-Model-F-V2
start_frontend.bat
```

**Step 2 — start backend (sibling repo):**
```bat
cd D:\AI-Interview-Model-B-V2
start_app.bat
```

| Script | Purpose |
|--------|---------|
| `start_frontend.bat` | Build admin dashboard (`npm run build`) |
| `start_frontend.bat --dev` | Vite dev server at `http://127.0.0.1:5173/admin/` |
| `start_app.bat` | Alias for `start_frontend.bat` (build only) |

For HTTP / no browser: `start_app.bat --http --no-browser`

## Environment Variables (this repo)

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_ROOT` | optional `.env` or `start_app.bat` | Path to backend repo |
| `VITE_BACKEND_URL` | `frontend/admin-dashboard/.env.development` | Admin dashboard dev proxy (default `http://127.0.0.1:2020`) |

Do **not** put OpenAI keys, database URLs, or SMTP credentials in this repo — use the backend `.env`.

## Build Admin Dashboard

```bat
cd frontend\admin-dashboard
npm install
npm run build
```

The backend serves `frontend/admin-dashboard/dist` at `/admin` (also built automatically by `start_app.bat`).

## Admin Dashboard Dev (hot reload)

**Terminal 1 — backend:**
```bat
cd D:\AI-Interview-Model-B-V2
start_app.bat --http --no-browser
```

**Terminal 2 — Vite:**
```bat
cd D:\AI-Interview-Model-F-V2\frontend\admin-dashboard
npm run dev
```

Open `http://127.0.0.1:5173/admin/`

## UI Design System (Candidate)

- Primary shell uses a dark "Quantum Core" layout (`qc-left` + `qc-right`).
- Keep new candidate UI styles inside the `qc-*` namespace.
- Prefer extending existing tokens/blocks over one-off inline styles.

## Backend / Microservices / Docker

Run Docker, Postgres, microservices gateway, smoke tests, and production deployment from:

`D:\AI-Interview-Model-B-V2`

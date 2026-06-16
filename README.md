# KARNEX AI HR — Frontend (UI)

**Release:** Version 1.0.0

This repo contains **only the UI** for the KARNEX AI Interview Suite. All API, AI, database, and Docker/microservices code lives in the sibling backend repo:

`D:\AI-Interview-Model-B-V2`

## Project Structure

- `frontend/` — Single-page HR/candidate UI (HTML + modular JS)
- `frontend/js/` — `app`, `hr`, `candidate`, `results`, `core`, `state`, etc.
- `frontend/admin-dashboard/` — React admin dashboard (Vite; built to `dist/`, served at `/admin`)
- `frontend/start.bat` — Build admin UI or run Vite dev (`--dev`)
- `docs/BACKEND_CONNECTION.md` — Full setup and API connection guide

## Quick Start (Windows)

**Step 1 — build UI (this repo):**
```bat
cd D:\AI-Interview-Model-F-V2
frontend\start.bat
```

**Step 2 — start backend (sibling repo):**
```bat
cd D:\AI-Interview-Model-B-V2
start_app.bat
```

| Script | Purpose |
|--------|---------|
| `frontend\start.bat` | Build admin dashboard (`npm run build`) |
| `frontend\start.bat --dev` | Vite dev server at `http://127.0.0.1:5173/admin/` |

For HTTP backend mode: start the backend with `start_app.bat --http --no-browser` in the B-V2 repo.

## Environment Variables (this repo)

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_ROOT` | optional `.env` or `frontend\start.bat` | Path to backend repo |
| `VITE_BACKEND_URL` | `frontend/admin-dashboard/.env.development` | Admin dashboard dev proxy (default `http://127.0.0.1:2020`) |

Do **not** put OpenAI keys, database URLs, or SMTP credentials in this repo — use the backend `.env`.

## Build Admin Dashboard

```bat
cd frontend\admin-dashboard
npm install
npm run build
```

The backend serves `frontend/admin-dashboard/dist` at `/admin` (also built automatically by `frontend\start.bat`).

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

## Deploy on Vercel

1. Push this repo to GitHub: [AI-Interview-Model-Frontend-v2](https://github.com/aadityapa/AI-Interview-Model-Frontend-v2)
2. In [Vercel](https://vercel.com/new), import the GitHub repo.
3. Framework preset: **Other** (uses root `vercel.json`).
4. Add environment variable if your backend is hosted elsewhere:
   - `VITE_BACKEND_URL` — only needed for local Vite dev proxy
5. Deploy. Vercel builds the admin dashboard and serves:
   - `/` — HR/candidate UI
   - `/admin` — React admin dashboard

**Note:** API calls use same-origin paths (`/auth`, `/hr`, etc.). For a working app on Vercel you must either proxy those routes to your backend or deploy the backend separately and configure CORS + a reverse proxy.

## Backend / Microservices / Docker

Run Docker, Postgres, microservices gateway, smoke tests, and production deployment from:

`D:\AI-Interview-Model-B-V2`

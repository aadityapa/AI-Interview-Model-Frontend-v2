# Connecting Frontend and Backend (Split Repos)

This frontend repo (`AI-Interview-Model-F-V2`) works with the backend at:

`D:\AI-Interview-Model-B-V2`

The backend **serves the UI and exposes all REST APIs on one port** (default `2020`). No separate frontend server is required for normal use.

## How they connect

| Layer | Location | Role |
|-------|----------|------|
| Frontend (static) | `frontend/` in this repo | HTML/JS UI + React admin dashboard |
| Backend (FastAPI) | `backend/` in B-V2 repo | All API routes (`/auth`, `/hr`, `/next`, etc.) |
| Link | `FRONTEND_DIR` env (backend `.env`) | Tells backend where to find this repo's `frontend/` folder |

Frontend JavaScript calls APIs with **relative paths** (same origin), e.g. `/hr/dashboard`, `/auth/login`. The backend mounts static files from `FRONTEND_DIR` and handles API on the same host/port.

## Quick start (recommended)

### 1. Prerequisites

- **Python 3.10+** with pip (backend)
- **Node.js LTS** (for admin dashboard build)
- **OpenAI API key** in backend `.env` (optional for full AI features)
- **Database**: PostgreSQL (see backend `docker-compose.yml`) **or** remove `AUTH_DB_URL` in backend `.env` to use SQLite

### 2. Configure backend `.env`

In `D:\AI-Interview-Model-B-V2`:

```bat
copy .env.example .env
```

Edit `.env` and set at minimum:

```env
OPENAI_API_KEY=sk-your-key-here
REPORT_CODE=your-secret-code
AUTH_SECRET=your-jwt-secret-at-least-32-chars

# Optional — auto-detected if repos are siblings:
FRONTEND_DIR=D:\AI-Interview-Model-F-V2\frontend

# For local dev without PostgreSQL, comment out or remove:
# AUTH_DB_URL=postgresql://...
```

### 3. Start (separate terminals)

**Terminal 1 — build frontend:**
```bat
cd D:\AI-Interview-Model-F-V2
frontend\start.bat
```

**Terminal 2 — start backend:**
```bat
cd D:\AI-Interview-Model-B-V2
start_app.bat
```

Or HTTP mode: `start_app.bat --http`

### 4. Open in browser

| URL | Purpose |
|-----|---------|
| `https://127.0.0.1:2020` | Main HR / candidate UI |
| `https://127.0.0.1:2020/admin` | Admin dashboard (React) |

For HTTP mode (avoids self-signed cert warnings):

```bat
start_app.bat --http
```

Then open `http://127.0.0.1:2020`.

## Frontend environment variables

| Variable | File | Purpose |
|----------|------|---------|
| `BACKEND_ROOT` | optional `.env` in this repo | Override path to B-V2 for `frontend\start.bat` |
| `VITE_BACKEND_URL` | `frontend/admin-dashboard/.env.development` | Vite dev proxy target (default `http://127.0.0.1:2020`) |

For **microservices gateway** dev, set:

```env
VITE_BACKEND_URL=http://localhost:8080
```

Run microservices from the **backend** repo only:

```bat
cd D:\AI-Interview-Model-B-V2
docker compose -f docker-compose.yml -f docker-compose.microservices.yml up -d --build
```

## Verify backend is running

```powershell
curl http://127.0.0.1:2020/health/live
curl http://127.0.0.1:2020/session-status
```

Expected: HTTP 200 responses.

## Admin dashboard hot reload (optional dev)

**Terminal 1 — backend (HTTP recommended for proxy):**

```bat
cd D:\AI-Interview-Model-B-V2
start_app.bat --http --no-browser
```

**Terminal 2 — Vite dev server:**

```bat
cd D:\AI-Interview-Model-F-V2
frontend\start.bat --dev
```

Open `http://127.0.0.1:5173/admin/` — API calls proxy to `http://127.0.0.1:2020`.

## Common errors

### "Backend not found"

Ensure folder layout:

```
D:\
  AI-Interview-Model-F-V2\   ← frontend (this repo)
  AI-Interview-Model-B-V2\   ← backend
```

Or set `FRONTEND_DIR` in backend `.env`.

### "Cannot reach backend API"

- Start backend first (`start_app.bat`)
- Check logs: `D:\AI-Interview-Model-B-V2\logs\server-https.log`
- Try HTTP mode: `start_app.bat --http`

### PostgreSQL connection failed

Either start Postgres from the backend repo:

```bat
cd D:\AI-Interview-Model-B-V2
docker compose up -d postgres
```

Or use SQLite by removing `AUTH_DB_URL` from backend `.env`.

### Admin dashboard 503

Build the admin UI:

```bat
cd D:\AI-Interview-Model-F-V2
frontend\start.bat
```

Then restart the backend.

### CORS errors (custom domain / LAN IP)

Add origins to **backend** `.env`:

```env
CORS_ALLOW_ORIGINS=https://127.0.0.1:2020,https://YOUR_LAN_IP:2020
```

## API reference (main endpoints)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | HR login |
| `/auth/register` | POST | HR registration |
| `/hr/dashboard` | GET | Candidates + sessions |
| `/hr/schedules` | GET | Interview schedules |
| `/setup` | POST | Start interview setup |
| `/next` | GET | Next interview question |
| `/answer` | POST | Submit answer |
| `/submit` | POST | Finish interview |
| `/report` | POST | Generate evaluation |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |

Full route list is in `D:\AI-Interview-Model-B-V2\backend\main.py`.

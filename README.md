# AgroChie

**A digital farming companion that helps smallholder farmers plan season costs, track spending, and spot plant problems early.**

## Overview

AgroChie is a smart-farming web application for chili, tomato, and shallot growers. Many farmers start a season without a clear picture of costs per growth phase, without tidy expense records, and without an easy way to recognise crop problems early. AgroChie addresses this with:

- machine-learning forecasts of season cost and weekly cost;
- actual expense tracking and a weekly money calendar;
- field weather from Open-Meteo;
- plant health detection from a leaf photo, with recommended actions;
- an AI assistant (Gemini + retrieval over a knowledge base) that answers using the farmer's own field and weather data.

<!-- Screenshot placeholder: add a Home page screenshot here -->

## Table of contents

1. [Key features](#key-features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Getting started](#getting-started)
6. [Services and ports](#services-and-ports)
7. [Configuration](#configuration)
8. [Optional integrations](#optional-integrations)
9. [Try it out](#try-it-out)
10. [Running tests](#running-tests)
11. [Troubleshooting](#troubleshooting)
12. [Project structure](#project-structure)
13. [Known limitations](#known-limitations)
14. [Security overview](#security-overview)
15. [Contributing](#contributing)
16. [License](#license)

## Key features

| Feature | What it does |
| --- | --- |
| Season cost planning | Create a season and get a cost forecast (P10/P50/P90 range) broken down by growth phase. |
| Weekly money calendar | Compares forecast weekly cost with what was actually recorded. |
| Expense tracking | Record, review, and delete actual expenses for a season. |
| Risk and credit | Risk summary and a loan reference code (stored locally; it is **not** a bank approval). |
| Plant health detection | A leaf photo is classified by a CNN in the engine; Gemini then adds recommended actions, materials, and cost estimates. Results are kept in a history and can be added to the expense log. |
| AI assistant | Gemini chat with retrieval over `backend/knowledge`, plus tools for Open-Meteo weather and the user's field context. |
| Field weather | Current weather and forecast for the field coordinates. |
| Multilingual UI | Indonesian (`id`), English (`en`), and Chinese (`zh`). |

Other pages: Home, Season history, weekly field checklist, and Profile (soil type, NPK, pH, coordinates). Users can register, sign in (email/password or optionally Google), or use guest mode.

## Architecture

```mermaid
flowchart LR
    B[Browser] --> W["Next.js web app :3001"]
    W -- "/api/* rewrite" --> A["Express API :3000"]
    A --> P[(PostgreSQL)]
    A -- "x-internal-key" --> E["Python engine (FastAPI) :8000"]
    A --> G[Gemini API]
    A --> O[Ollama - optional]
    A --> M[Open-Meteo]
```

| Component | Role |
| --- | --- |
| `agrochie-web` | User interface. Proxies `/api/*` to the backend so the session cookie stays same-origin and `httpOnly`. |
| `backend` | REST API (Express 5 + Prisma). Authentication, business rules, and the only component that touches the database. |
| `engine` | FastAPI service that loads the trained models and predicts cost and leaf quality. It never accesses the database. |
| PostgreSQL | Persistent storage. |
| Gemini | Assistant, detection recommendations, optional fallback translator. |
| Ollama | Optional local translator for the English/Chinese UI. |

## Tech stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form, Zod, Recharts.
- **Backend:** Node.js (ESM JavaScript), Express 5, Prisma 7 with PostgreSQL, Zod, Argon2, JOSE (JWT), Helmet, Multer, Nodemailer, `@google/genai`.
- **Engine:** Python, FastAPI, Uvicorn, XGBoost, scikit-learn, TensorFlow (CNN), pandas, NumPy, Pillow.
- **Integrations:** Gemini, Open-Meteo, Ollama (optional), Google Identity Services (optional), SMTP (optional).

## Prerequisites

| Tool | Version | Download |
| --- | --- | --- |
| Node.js | 22 LTS or newer | https://nodejs.org/en/download |
| Python | 3.11 or 3.12 (tested on 3.12) | https://www.python.org/downloads/ |
| PostgreSQL | 14 or newer | https://www.postgresql.org/download/ |
| Git | any recent version | https://git-scm.com/downloads |
| Ollama (optional) | latest | https://ollama.com/download |

The trained models are already included in the repository (about 11.5 MB under `engine/models`); no training is required.


## Getting started

Commands are shown for **Windows PowerShell** and **macOS/Linux** (bash/zsh). Use one terminal per service.

### 1. Clone

```bash
git clone https://github.com/Cilok-12Kb/AgroChie.git
cd AgroChie
```

### 2. Create the database

Create a PostgreSQL user and an empty database. Replace `YOUR_PASSWORD` with your own password.

```bash
psql -U postgres -c "CREATE USER agrochie WITH PASSWORD 'YOUR_PASSWORD';"
psql -U postgres -c "CREATE DATABASE agrochie OWNER agrochie;"
```

You can also use pgAdmin or any other client. The connection string then looks like `postgresql://agrochie:YOUR_PASSWORD@localhost:5432/agrochie?schema=public`.

### 3. Backend (port 3000)

Generate two random secrets. Run this command twice; use one value for `JWT_SECRET` and the other for `ENGINE_INTERNAL_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Windows PowerShell**

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cd backend
npm ci
cp .env.example .env
```

Edit `backend/.env` and set the required variables:

- `DATABASE_URL`: your connection string.
- `JWT_SECRET`: at least 32 characters (use a generated value).
- `ENGINE_INTERNAL_KEY`: a generated value. It must be **identical** in `engine/.env`.

Then apply the migrations, seed the reference data, and start the API (same commands on all platforms):

```bash
npx prisma migrate deploy
npm run seed
npm run dev
```

`npm run seed` is required: it loads the crop phase and rainfall reference tables (`CropPhase`, `ClimateRain`) that season planning depends on.

### 4. Engine (port 8000)

In a new terminal, starting from the repository root:

**Windows PowerShell**

```powershell
cd engine
python -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cd engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `engine/.env` and set `ENGINE_INTERNAL_KEY` to the same value as in `backend/.env`. The engine refuses to start if it is empty. Run it from the `engine` folder, because `.env` is read from the current working directory:

```bash
uvicorn app.main:app --port 8000
```

Check `http://127.0.0.1:8000/health` to see the model status.

### 5. Web (port 3001)

In another terminal, from the repository root:

**Windows PowerShell**

```powershell
cd agrochie-web
npm ci
Copy-Item .env.example .env.local
npm run dev -- -p 3001
```

**macOS / Linux**

```bash
cd agrochie-web
npm ci
cp .env.example .env.local
npm run dev -- -p 3001
```

The `dev` script does not set a port, so `-p 3001` is required to match the backend's default CORS origin.

### 6. Open the app

Go to **http://localhost:3001** and create an account. There is no demo account; each user signs up on their own. Use `localhost`, not `127.0.0.1`: CORS only allows the configured `FRONTEND_ORIGIN` (default `http://localhost:3001`).

## Services and ports

Start in this order: **PostgreSQL → engine → backend → web**.

| Order | Service | Port | Start command (from its folder) |
| --- | --- | --- | --- |
| 1 | PostgreSQL | 5432 | managed by your OS / installer |
| 2 | Engine (FastAPI) | 8000 | `uvicorn app.main:app --port 8000` |
| 3 | Backend (Express) | 3000 | `npm run dev` |
| 4 | Web (Next.js) | 3001 | `npm run dev -- -p 3001` |

There is no `docker-compose` file.


## Configuration

Only the important variables are listed. The complete, commented list is in each package's `.env.example`.

**`backend/.env`**

| Name | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Session signing secret, at least 32 characters. |
| `ENGINE_INTERNAL_KEY` | Yes | Shared key sent to the engine as `x-internal-key`; must match `engine/.env`. |
| `PORT` | No | API port (default `3000`). |
| `ENGINE_URL` | No | Engine address (default `http://127.0.0.1:8000`). |
| `FRONTEND_ORIGIN` | No | The single origin allowed by CORS (default `http://localhost:3001`). |
| `GEMINI_API_KEY` | For AI | Without it, the assistant and detection explanations return 503; CNN classification still works. |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | No | Gemini model ids. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | For email | Without SMTP, email verification and password reset are unavailable. |
| `APP_BASE_URL` | No | Base URL for links in emails (defaults to `FRONTEND_ORIGIN`). |
| `GOOGLE_CLIENT_ID` | For Google | Google sign-in is disabled when empty. Not a secret. |
| `DETECTION_PROVIDER` | No | `engine` (default, own CNN) or `gemini`. |
| `TRANSLATE_PROVIDER` | No | `ollama` (default), `gemini`, or `none`. |
| `OLLAMA_HOST`, `OLLAMA_MODEL` | No | Defaults `http://localhost:11434` and `qwen2.5:7b`. |

**`engine/.env`**

| Name | Required | Description |
| --- | --- | --- |
| `ENGINE_INTERNAL_KEY` | Yes | Must equal the backend value. |
| `MODELS_DIR` | No | Model folder (default `engine/models`); read by the code, not listed in `.env.example`. |

**`agrochie-web/.env.local`**

| Name | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | No | Same value as backend `GOOGLE_CLIENT_ID`; empty hides the Google button. |
| `API_PROXY_TARGET` | No | Backend address used by the `/api/*` proxy (default `http://127.0.0.1:3000`). |
| `NEXT_PUBLIC_DETECTION_MAX_MB` | No | Maximum detection photo size in MB. |

Restart the dev server after changing any `NEXT_PUBLIC_*` value.

## Optional integrations

### Gemini (assistant and detection explanations)

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Put it in `backend/.env` as `GEMINI_API_KEY` and restart the backend.

The free tier has a small quota; see [Troubleshooting](#troubleshooting).

### SMTP (email verification and password reset)

For Gmail, enable 2-Step Verification and create an [App Password](https://myaccount.google.com/apppasswords). Then set in `backend/.env`:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=<the app password>
MAIL_FROM="AgroChie <you@gmail.com>"
```

Use `SMTP_SECURE=true` with port `465` for implicit TLS. Never commit these values.

### Google sign-in

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth client ID of type *Web application*.
2. Add `http://localhost:3001` under **Authorized JavaScript origins**.
3. Set `GOOGLE_CLIENT_ID` in `backend/.env` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `agrochie-web/.env.local` (same value), then restart both.

### Ollama (English and Chinese interface)

The interface text is written in Indonesian. When the language is `en` or `zh`, the web app sends the visible text to `POST /api/translate`, and the backend translates it.

```bash
ollama pull qwen2.5:7b
```

Keep Ollama running (default `http://localhost:11434`). How it behaves:

- Translations are cached in `backend/data/translation-cache.json`, so previously translated text is served instantly, even without Ollama. The browser also keeps translations in `localStorage`.
- If Ollama is **not running** and a text has no cached translation, the provider call fails, the text is returned unchanged, and **the original Indonesian text stays on screen**. Nothing is cached for it, and the browser retries on later page changes.
- A translation is also rejected, and the original kept, if it drops numbers or (for `zh`) contains no Chinese characters.
- The first request after Ollama starts can be slow (model cold start; the backend waits up to 120 seconds per call).
- Set `TRANSLATE_FALLBACK_PROVIDER=gemini` to fall back to Gemini when Ollama fails (this uses Gemini quota), or `TRANSLATE_PROVIDER=none` to disable translation.
- To pre-fill the cache while Ollama is running, run `npm run i18n:warm` in `backend`.

## Try it out

1. **Sign up** at http://localhost:3001.
2. Open **Profile** and fill in the field profile (country/region, soil, coordinates). Missing values are never guessed.
3. **Create a season** for chili, tomato, or shallot.
4. View the **cost forecast** and the **money calendar** (requires the engine to be running and a complete field profile).
5. **Record an expense** in the expense log.
6. Open **Plant detection** and upload a clear leaf photo (the CNN works without Gemini; the explanation needs `GEMINI_API_KEY`).
7. **Continue in the assistant** to ask follow-up questions about the result.
8. **Switch the language** (id / en / zh) from the language selector.

## Running tests

```bash
# Backend (node --test)
cd backend
npm test

# Web
cd agrochie-web
npm test

# Engine (virtual environment active)
cd engine
python -m pytest
```

Tests ending in `.db.test.js` create and delete data, so they only run against a database whose name contains `_test`. Create a separate test database (for example `agrochie_test`), copy `backend/.env.test.example` to `backend/.env.test`, point it at that database, then run:

```bash
cd backend
npm run migrate:test
npm run test:db
```

Never point the test configuration at a database that holds real data. Linting and a production build are also available in `agrochie-web` (`npm run lint`, `npm run build`).



## Troubleshooting

| Problem | What to do |
| --- | --- |
| Port already in use (3000, 3001, 8000) | Stop the other process, or change `PORT` / `-p` / `--port` and update `FRONTEND_ORIGIN`, `API_PROXY_TARGET`, and `ENGINE_URL` accordingly. |
| `prisma migrate deploy` fails | Check that PostgreSQL is running, the database exists, and `DATABASE_URL` has the right user, password, host, and database name. |
| Syntax or module errors from Node | Check `node --version`; Node 22 or newer is required. |
| Cannot activate the venv in PowerShell | Run `Set-ExecutionPolicy -Scope Process Bypass` in that window, then `.venv\Scripts\Activate.ps1`. |
| Engine exits at start with an `ENGINE_INTERNAL_KEY` error | Set `ENGINE_INTERNAL_KEY` in `engine/.env` and start `uvicorn` from the `engine` folder. |
| Backend returns 503 (engine unreachable) or 502 (engine error) | Start the engine, verify `ENGINE_URL`, and make sure `ENGINE_INTERNAL_KEY` is identical in `backend/.env` and `engine/.env`. |
| Cannot create a season | Run `npm run seed` in `backend`, and complete the field profile. |
| Sign-in works but requests are blocked (CORS) | Open the app at `http://localhost:3001`, not `127.0.0.1`. |
| Gemini 429 / quota exceeded | The free-tier quota is used up. Wait, use another key or model, and avoid `DETECTION_FALLBACK_PROVIDER=gemini`. |
| Gemini 503 | `GEMINI_API_KEY` is empty, or the model is busy. |
| Google `invalid_client` | `GOOGLE_CLIENT_ID` is wrong or differs between backend and web, or `http://localhost:3001` is missing from Authorized JavaScript origins. |
| English/Chinese text is slow or still Indonesian | Ollama may be off or cold-starting; see [Ollama](#ollama-english-and-chinese-interface). |

## Project structure

```text
AgroChie/
├── agrochie-web/        # Next.js frontend (port 3001)
│   ├── public/
│   └── src/             # app (routes), components, config, features, providers
├── backend/             # Express 5 + Prisma API (port 3000)
│   ├── data/            # translation cache
│   ├── knowledge/       # assistant knowledge base (.md)
│   ├── prisma/          # schema, migrations, seed
│   ├── scripts/         # knowledge ingest, translation cache warm-up
│   ├── src/             # config, controllers, middleware, routes, services, utils
│   └── tests/           # node --test suites
├── engine/              # FastAPI + trained models (port 8000)
│   ├── app/
│   ├── models/          # season cost, weekly cost, plant quality
│   └── tests/           # pytest suites
├── legacy_frontend/     # old prototype, not needed to run the app
└── README.md
```

## Known limitations

- The plant model only recognises the classes it was trained on (chili: cercospora, healthy, leaf curl, nutrient disorder, powdery mildew; tomato: bacterial spot, black mold, gray leaf spot, late blight, healthy, powdery mildew). Low-confidence results are reported as "uncertain".
- AI cost estimates are approximations, not a substitute for an agricultural extension officer.
- Weather depends on Open-Meteo; if it is unreachable, the API answers 503.
- Cost prediction needs the engine and a complete field profile; otherwise the season stays a draft. Weekly costs are never estimated.
- Photos are stored on local disk (`backend/uploads`, not in the repository). Use object storage and a security review for production.
- A field is a single coordinate point, not a polygon.

## Security overview

- Passwords are hashed with Argon2; sessions are JWTs in an `httpOnly` cookie.
- CORS is limited to a single configured origin; Helmet and rate limiting are enabled.
- Every service checks ownership; resources that belong to other users are answered with 404.
- The engine is internal only and requires the shared `x-internal-key`.
- Secrets live in `.env` files, which are git-ignored. Never commit them.

Full authentication details are in [`backend/API_AUTH.md`](backend/API_AUTH.md).

## Contributing

- Work on a feature branch, not on `main`.
- Use Conventional Commit messages, for example `feat(detection): ...`, `fix(weather): ...`, `docs: ...`.
- Run the relevant tests before committing.
- Never commit `.env` files, keys, or user data.

## License

All rights reserved.


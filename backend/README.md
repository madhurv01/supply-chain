# Agri-Chain OS backend

FastAPI backend backed by Supabase (Postgres + Auth). Every request except `/health` requires an
`Authorization: Bearer <supabase-jwt>` header from a signed-in user; the backend builds a
per-request Supabase client authenticated as that user so RLS policies apply naturally.

## Setup

```
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
# edit .env and fill in GROQ_API_KEY (SUPABASE_URL / SUPABASE_ANON_KEY are already filled in)
```

## Run

```
uvicorn backend.main:app --reload --port 8000
```

(run from the repo root so the `backend` package resolves, or `cd backend && uvicorn main:app --reload --port 8000` after adjusting imports if you move the package).

## Seed market data

`market_prices` currently only has a SELECT RLS policy, no INSERT policy, so the table can't be
seeded as a normal authenticated user yet. Apply `scripts/seed_market_data.sql` (repo root
`scripts/` folder) via the Supabase SQL editor or migration tool — it adds an authenticated INSERT
policy and then bulk-inserts all ~17,000 rows from `agriculture.csv`. After that policy exists,
`scripts/seed_market_data.py` can also be used to re-seed (needs `SEED_USER_EMAIL` /
`SEED_USER_PASSWORD` env vars for a real Supabase user).

## Structure

- `config.py` / `supabase_client.py` / `auth.py` — settings, per-request Supabase client, auth dependency.
- `services/` — pure business logic per domain (market, farm, inventory, logistics, finance, forecasts), ported from the old `database.py` / `agents.py`.
- `routers/` — FastAPI routes wrapping the services.
- `agent/` — Groq-powered tool-calling agent (`llama-3.3-70b-versatile`) exposing all the services as tools; `POST /agent/chat`.

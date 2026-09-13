# Agri-Chain OS

An agentic farm-to-market supply chain platform: track crop plots, harvest into inventory, dispatch and monitor shipments, log sales via UPI QR, and run market forecasts — either through dedicated pages or by asking the built-in AI operations agent to do it for you.

## Stack

- **Backend**: FastAPI (Python), Supabase Postgres, Groq (`llama-3.3-70b-versatile`) for the AI agent
- **Frontend**: Next.js 14 (App Router, TypeScript), Tailwind, shadcn/ui, react-leaflet, recharts
- **Auth**: Supabase Auth (email/password)

## Run it

### Backend

Run from the repo root (not from inside `backend\`) — `backend.main:app` is a module path relative to the root:

```
backend\venv\Scripts\activate
pip install -r backend\requirements.txt   # if not already installed
uvicorn backend.main:app --reload --port 8000
```

The venv is already set up with `SUPABASE_URL` / `SUPABASE_ANON_KEY` filled in `backend/.env`. Add your own `GROQ_API_KEY` (free at console.groq.com) to enable the AI agent — without it, the agent responds with a "not configured" message but the rest of the app works normally.

### Frontend

```
cd frontend
npm install
npm run dev
```

Serves at http://localhost:3000, expects the backend at http://localhost:8000 (see `frontend/.env.local`).

### First run

Open http://localhost:3000, sign up with an email/password (Supabase sends a confirmation email — click it before logging in), then explore the dashboard, the AI Agent chat, and each module page.

## Data

`agriculture.csv` is the original commodity price dataset. A ~156-row representative sample (66 commodities, 15 states) is already seeded into the Supabase `market_prices` table. To load the full ~17,000-row dataset instead, run `scripts/seed_market_data.sql` via the Supabase SQL editor.

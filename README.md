# Islamic Research Platform

Phase 1: project scaffolding, folder structure, and basic wiring only.
No content architecture, article editor, or authentication logic has been
implemented yet — see `docs/ARCHITECTURE.md` for what's deliberately left
out and why.

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Cloudflare Workers
- Database: MongoDB Atlas (accessed via the official Node.js driver, not
  the deprecated Data API)
- File storage: Cloudflare R2
- Source control: GitHub

## Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (database can be empty — no setup scripts run
  automatically)
- A Cloudflare account (for R2 + Workers; local dev works without deploying)

## 1. Backend setup (Cloudflare Worker)

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and fill in:
- `MONGODB_URI` — your Atlas connection string (use a least-privilege DB user)
- `MONGODB_DB_NAME` — the database name (can be anything; it starts empty)
- `ADMIN_JWT_SECRET` — reserved for future auth, not used yet; set any long
  random string

Run locally:

```bash
npm run dev
```

This starts the Worker at `http://localhost:8787`. Check it works:

```bash
curl http://localhost:8787/health
```

You should get a JSON response with `"status": "ok"` and the database
connection status (`"connected"` or `"unavailable"`).

### Verifying the real MongoDB Atlas connection
`/health` pings the database, but to check connectivity directly (with full
error output, not just "connected"/"unavailable") run:

```bash
npm run verify:db
```

This connects with the real `mongodb` driver using your `.dev.vars`
credentials, runs `{ ping: 1 }` against your actual Atlas cluster, reports
the round-trip time, and confirms the target database has no collections
yet (as expected before Phase 2). It exits non-zero with the underlying
driver error message on failure (bad URI, IP not allow-listed in Atlas
Network Access, auth failure, etc).

### R2 bucket (optional at this phase)
Not used by any route yet, but if you want it bound correctly:

```bash
wrangler r2 bucket create islamic-research-media
```

### Deploying
```bash
npm run deploy
```
Before deploying, set real secrets in Cloudflare (never commit them):
```bash
wrangler secret put MONGODB_URI
wrangler secret put MONGODB_DB_NAME
wrangler secret put ADMIN_JWT_SECRET
```

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

`.env` defaults to pointing at the local Worker (`http://localhost:8787`) —
adjust `VITE_API_BASE_URL` if your Worker runs elsewhere.

Run locally:

```bash
npm run dev
```

Visit `http://localhost:5173`. You should see the public home page shell.
`http://localhost:5173/admin/login` shows the admin shell (no real login
yet).

## Project structure

See the folder tree in `docs/ARCHITECTURE.md` for the full layout and the
reasoning behind it.

## Current versions (updated)
- Wrangler: `^4.141.0` (latest stable)
- Workers compatibility date: `2026-09-27` (today's date — `nodejs_compat`
  is on by default at this date, so it's no longer listed explicitly in
  `wrangler.toml`; see `docs/ARCHITECTURE.md`)

## Known limitations (intentional, this phase)
- No admin authentication — `adminAuth` middleware and `AuthContext`
  currently reject/stub all calls by design.
- No content data models (Aqeedah, Masail, Categories, Articles) yet.
- No article/block editor yet.
- No search yet.
- No sample or seed data — the database is expected to start empty.
- Manual hand-rolled backend router — fine for a handful of routes, may be
  swapped for a routing library once the API surface grows.

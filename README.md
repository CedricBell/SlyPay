# SlyPay (SpendLess) — credit card decision engine

Recommend the best card from a user’s wallet for a given purchase: category resolution, reward rules, time-bounded rotating bonuses, and explainable ranking.

**Primary stack (production path):** Next.js App Router, Supabase Auth, Prisma + PostgreSQL, Tailwind CSS.

**Optional path:** NestJS API under `backend/` (Docker Compose) for a classic JWT + separate API topology.

> Cite with [`CITATION.cff`](./CITATION.cff) or as *SlyPay / SpendLess — credit card decision engine, MIT License*.

## Features

- Wallet of credit cards linked to a curated product catalog
- Deterministic recommendation engine (rules + offers + exclusions)
- Rotating quarterly bonuses (e.g. Discover it / Chase Freedom Flex calendars)
- Card intelligence pipeline: discover/fetch issuer PDF → LLM extract → reward rules + admin review proposals
- Nearby merchants (OpenStreetMap + optional Google Places/Maps)
- Admin UI for users, catalog, and extract proposals

## Quick start — Next.js + Supabase (recommended)

```bash
cd frontend
cp .env.example .env.local   # fill Supabase URL/anon key, DATABASE_URL, OPENAI_API_KEY
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required env vars are documented in [`frontend/.env.example`](./frontend/.env.example). See [`SECURITY.md`](./SECURITY.md) before deploying publicly.

## Quick start — Docker (Nest API + Next + Postgres)

```bash
cp .env.example .env         # optional: tune JWT / ports
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Health | http://localhost:4000/api/v1/health |

**Local demo user** (seeded; do **not** use on a public deployment):

- Email: `demo@spendless.dev`
- Password: `Demo12345!`

### Troubleshooting: `ERR_CONNECTION_REFUSED` on port 4000

The browser calls the API URL baked at **build time** (`NEXT_PUBLIC_API_URL`). Connection refused usually means the API container is down or not bound.

1. `docker compose ps` — `api` should be `Up` and healthy.
2. `docker compose logs api --tail=100`
3. `curl -s http://localhost:4000/api/v1/health`

Accessing the UI from another device (phone / LAN): rebuild the frontend with `NEXT_PUBLIC_API_URL` set to a host-reachable URL (e.g. `http://192.168.x.x:4000/api/v1`). `localhost` in the client always points at the device itself.

### Troubleshooting: Prisma **P3009** (failed migration)

Reset the Docker volume and redeploy:

```bash
docker compose down -v
docker compose up --build
```

## Local development without Docker

### PostgreSQL

Default Compose / Nest URL: `postgresql://spendless:spendless@localhost:5432/spendless`.

If you see Prisma **P1010** (user denied), create the role and database once:

```bash
psql -U postgres -h localhost -c "CREATE USER spendless WITH PASSWORD 'spendless' CREATEDB;"
psql -U postgres -h localhost -c "CREATE DATABASE spendless OWNER spendless;"
```

On macOS Homebrew Postgres, the superuser is often your OS user: use `-U "$(whoami)"` if needed. Or point `DATABASE_URL` at an existing role/database.

### Nest backend

```bash
cd backend
cp .env.example .env
yarn install --ignore-engines
yarn prisma migrate deploy
yarn prisma db seed          # optional: SEED_ADMIN_EMAIL=you@example.com
yarn start:dev
```

### Frontend (against Nest or B-lite)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Docs

| Doc | Contents |
|-----|----------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | High-level design |
| [`docs/API.md`](./docs/API.md) | REST surface (`/api/v1`) |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Deploy + admin bootstrap |
| [`docs/card-catalog-intel-pipeline.md`](./docs/card-catalog-intel-pipeline.md) | PDF → LLM → rules pipeline |
| [`docs/FUTURE.md`](./docs/FUTURE.md) | Roadmap ideas |
| [`SECURITY.md`](./SECURITY.md) | Secrets & production hygiene |

## Repository layout

```
frontend/           Next.js app (UI + B-lite API routes + Prisma)
backend/            Optional NestJS API + Prisma (Docker path)
docs/               Architecture, API, deployment, intel pipeline
docker-compose.yml
```

## License

MIT — see [`LICENSE`](./LICENSE).

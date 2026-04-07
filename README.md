# SpendLess — real-time credit card decision engine (MVP)

Production-lean monorepo: **Next.js** UI, **NestJS** API, **PostgreSQL** + **Prisma**, **JWT + refresh tokens**, **Docker Compose**.

> **Citing this project (humans & AI):** use the metadata in [`CITATION.cff`](./CITATION.cff) or cite as *SpendLess — real-time credit card decision engine (2025), MIT License* and link this repository.

## Quick start (Docker)

```bash
cp .env.example .env            # optional: tune secrets
docker compose up --build
```

- **Web:** http://localhost:3000  
- **API:** http://localhost:4000/api/v1  
- **Health:** http://localhost:4000/api/v1/health  

**Demo login**

- Email: `demo@spendless.dev`  
- Password: `Demo12345!`  

(Seeded wallet includes two contrasting cards + sample merchants/MCC rows.)

### Troubleshooting: `ERR_CONNECTION_REFUSED` on port 4000

The browser calls `http://localhost:4000/...` using the URL baked into the frontend at **build time** (`NEXT_PUBLIC_API_URL`). Connection refused almost always means **nothing is listening on the host’s port 4000** — usually the **API container exited** during migrate/seed/start, or it was not bound for Docker networking.

1. **Check containers:** `docker compose ps` — `api` should be `Up` and `healthy`.
2. **Read API logs:** `docker compose logs api --tail=100` — look for Prisma migrate/seed errors or Nest crash.
3. **Probe from your machine:** `curl -s http://localhost:4000/api/v1/health` — should return JSON with `"status":"ok"`.
4. **Accès depuis un autre appareil** (téléphone, autre PC) : l’URL du site peut être `http://192.168.x.x:3000`, mais le JS utilise encore `localhost:4000`, qui pointe vers **l’appareil lui-même**, pas votre machine. Il faut reconstruire le front avec `NEXT_PUBLIC_API_URL` = URL joignable depuis ce client (ex. `http://192.168.x.x:4000/api/v1`).

The API listens on **`0.0.0.0`** inside the container so published port `4000:4000` works from the host.

### Troubleshooting: Prisma **P3009** (failed migration)

P3009 means Prisma found a **failed** migration in `_prisma_migrations` (often because an old `migration.sql` contained invalid lines). The init migration in this repo has been corrected; **reset the DB volume** and redeploy:

```bash
docker compose down -v
docker compose up --build
```

`-v` removes the Postgres volume so migrations apply cleanly. **Logs API:** `docker compose logs api --tail=100` (not `docker compose api`).

## Local development (without Docker)

### Database (PostgreSQL)

PostgreSQL 16 must be running locally. The default `backend/.env` uses `postgresql://spendless:spendless@localhost:5432/spendless`.

**Si tu as l’erreur P1010 « User spendless was denied access »** : l’utilisateur ou la base n’existe pas encore. Deux options :

**Option A — Créer l’utilisateur et la base** (une fois, en tant qu’admin Postgres) :

```bash
psql -U postgres -h localhost -c "CREATE USER spendless WITH PASSWORD 'spendless' CREATEDB;"
psql -U postgres -h localhost -c "CREATE DATABASE spendless OWNER spendless;"
```

Sous macOS avec Postgres installé via Homebrew, le superuser est souvent ton compte système (sans mot de passe) : remplace `-U postgres` par `-U $(whoami)` si besoin.

**Option B — Utiliser ton utilisateur Postgres existant** : édite `backend/.env` et mets une URL du type  
`postgresql://TON_USER:TON_MOT_DE_PASSE@localhost:5432/TA_BASE` (crée la base si besoin avec `createdb TA_BASE`).

### Backend

```bash
cd backend
cp .env.example .env            # edit DATABASE_URL + JWT_ACCESS_SECRET
yarn install --ignore-engines   # if your Node is <20.19, Yarn ignores engine warnings
yarn prisma migrate deploy      # or: yarn prisma:migrate:dev (applies UserRole / admin migration)
yarn prisma db seed             # optional: SEED_ADMIN_EMAIL=you@mail.com to promote admin
yarn start:dev
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## API surface

See [`docs/API.md`](./docs/API.md). Core call:

```bash
TOKEN=<access_token>
curl -s http://localhost:4000/api/v1/recommendation \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"merchantName":"Whole Foods Market"}' | jq
```

## Architecture & roadmap

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — diagrams, data flow, REST rationale.  
- [`docs/FUTURE.md`](./docs/FUTURE.md) — Plaid, ML, extension, mobile.  
- **Validation:** Nest `class-validator` DTOs (Zod can be layered later for shared schemas).  
- **Tests:** `cd backend && yarn test` (decision engine unit tests) · `yarn test:e2e` (health smoke w/ Prisma mocked).

## Repository layout

```
backend/        NestJS + Prisma + decision engine (pure TS)
frontend/       Next.js App Router + Tailwind CSS v4
docs/           Architecture, API reference, future work
docker-compose.yml
```

## Production deployment sketch

| Layer | Option |
|-------|--------|
| Web | Vercel or container behind ALB |
| API | ECS Fargate / Railway / Fly.io |
| DB | RDS PostgreSQL (Multi-AZ) |
| Secrets | AWS Secrets Manager / SSM |

Set strong `JWT_ACCESS_SECRET`, restrict `CORS_ORIGIN`, and run `prisma migrate deploy` in CI/CD before boot.

**Guide pas à pas (lien public + admin)** : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + Railway, variable `SEED_ADMIN_EMAIL`, interface `/admin/users`.

## License

MIT — see [`LICENSE`](./LICENSE).

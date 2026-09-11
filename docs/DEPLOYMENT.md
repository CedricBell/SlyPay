# Deployment

Recommended setups for a shareable MVP.

## Path A — Next.js full-stack (B-lite) — recommended

| Component | Suggested service | Role |
|-----------|-------------------|------|
| **App** | [Vercel](https://vercel.com) | `frontend/` (UI + `/api/v1` Route Handlers) |
| **Auth + DB** | [Supabase](https://supabase.com) | Auth + PostgreSQL (Prisma) |

You get one public site URL to share. Configure env vars from [`frontend/.env.example`](../frontend/.env.example) in the Vercel project (never commit real values).

### Steps

1. Create a Supabase project; copy **Project URL**, **anon key**, and a **pooler `DATABASE_URL`** (Transaction mode on serverless).
2. Import the GitHub repo on Vercel; set **Root Directory** to `frontend`.
3. Set env vars (`NEXT_PUBLIC_SUPABASE_*`, `DATABASE_URL`, `OPENAI_API_KEY`, optional Maps/Places keys).
4. Run migrations against the same database: from `frontend/`, `npx prisma migrate deploy` (CI or one-off with the production `DATABASE_URL`).
5. Configure Supabase Auth redirect URLs for your Vercel domain (`/auth/callback`, `/reset-password`).
6. Restrict Google API keys by HTTP referrer / IP if used.

### Admin bootstrap

1. Sign up on the deployed site with the email you want as admin.
2. Set `SEED_ADMIN_EMAIL` to that email (lowercase) in Vercel env, redeploy so the next authenticated request can promote the Prisma user.
3. Sign out and sign in again so the session reflects `ADMIN`.
4. Use **Admin** in the nav → `/admin/users` (and catalog / proposals pages).

Remove or leave unset `SEED_ADMIN_EMAIL` after promotion on any long-lived public environment.

---

## Path B — Nest API + Next + managed Postgres

| Component | Suggested service | Role |
|-----------|-------------------|------|
| **PostgreSQL** | Railway, Neon, Supabase, or RDS | Database |
| **Nest API** | Railway, Render, or Fly.io | `backend/` Dockerfile |
| **Next.js** | Vercel | `frontend/` with `NEXT_PUBLIC_API_URL` |

### 1. PostgreSQL

Create a managed database and copy the URI (`postgresql://…?sslmode=require` when required).

### 2. API (e.g. Railway)

1. Deploy from GitHub; **root directory** `backend`.
2. Wire `DATABASE_URL` from the Postgres service.
3. Prefer `backend/railway.toml` + Dockerfile so the image builds Nest correctly.
4. Environment:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | From the DB provider |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `JWT_ACCESS_EXPIRES` | e.g. `15m` |
| `JWT_REFRESH_DAYS` | e.g. `14` |
| `PORT` | Often injected by the platform |
| `CORS_ORIGIN` | Frontend origin(s), no trailing slash |
| `SEED_ADMIN_EMAIL` | Optional; see Admin above |

Start command pattern: `npx prisma migrate deploy && npx prisma db seed && node dist/main.js`

Health: `GET /api/v1/health`

### 3. Frontend (Vercel)

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API.example.com/api/v1` |

Update API `CORS_ORIGIN` to the exact Vercel origin, then redeploy the API if needed.

### 4. Production security

- Never commit `.env` files; use the PaaS secret store.
- Use a strong unique `JWT_ACCESS_SECRET` (Nest path).
- Disable or change the Docker **demo** user (`demo@spendless.dev`) on public deploys.
- HTTPS everywhere (default on Vercel / Railway).
- See [`SECURITY.md`](../SECURITY.md).

### Troubleshooting

| Issue | Hint |
|-------|------|
| Browser CORS errors | `CORS_ORIGIN` must match the frontend origin exactly |
| 401 after admin promote | Sign in again to refresh the session / JWT |
| Migrations | `prisma migrate deploy` must succeed before serving traffic |

API details: [`API.md`](./API.md).
